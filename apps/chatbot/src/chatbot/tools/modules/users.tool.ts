import { Injectable, Logger } from '@nestjs/common';
import { BaseToolPlugin, ToolDefinition, ToolContext, ToolResult } from '../base-tool.interface';
import { PrismaService } from '../../../common/prisma.service';
import { ApiClientService, RequestContext } from '../../http/api-client.service';

/**
 * Users Module Tool Plugin
 * Provides user information and organization context
 * Uses PrismaService for user/team lookups (no complex business logic)
 * Uses API for organization member lookups
 */
@Injectable()
export class UsersToolPlugin extends BaseToolPlugin {
  private logger = new Logger(UsersToolPlugin.name);

  constructor(
    private prisma: PrismaService,
    private apiClient: ApiClientService,
  ) {
    super();
  }

  readonly moduleName = 'users';
  readonly displayName = 'User Management';
  readonly description = 'Access user information and organization context';

  getTools(): ToolDefinition[] {
    return [
      {
        name: 'get_current_user',
        description: 'Get information about the current logged-in user',
        category: 'Users',
        module: this.moduleName,
        requiredModules: [],
        parameters: {},
      },
      {
        name: 'get_my_profile',
        description: 'Get detailed profile of the current user',
        category: 'Users',
        module: this.moduleName,
        requiredModules: [],
        parameters: {},
      },
      {
        name: 'get_user_by_email',
        description: 'Look up a user by their email address',
        category: 'Users',
        module: this.moduleName,
        requiredModules: [],
        parameters: {
          email: { type: 'string', description: 'User email address', required: true },
        },
      },
      {
        name: 'get_my_organization',
        description: 'Get information about the current user\'s organization',
        category: 'Users',
        module: this.moduleName,
        requiredModules: [],
        parameters: {},
      },
      {
        name: 'get_organization_members',
        description: 'Get list of members in the organization',
        category: 'Users',
        module: this.moduleName,
        requiredModules: [],
        parameters: {
          limit: { type: 'number', description: 'Max results', required: false, default: 20 },
          search: { type: 'string', description: 'Search by name or email', required: false },
        },
      },
      {
        name: 'get_my_teams',
        description: 'Get teams the current user belongs to',
        category: 'Users',
        module: this.moduleName,
        requiredModules: [],
        parameters: {},
      },
      {
        name: 'get_team_members',
        description: 'Get members of a specific team',
        category: 'Users',
        module: this.moduleName,
        requiredModules: [],
        parameters: {
          teamId: { type: 'string', description: 'Team ID', required: true },
        },
      },
    ];
  }

  async execute(
    toolName: string,
    params: Record<string, any>,
    context: ToolContext,
  ): Promise<ToolResult> {
    try {
      switch (toolName) {
        case 'get_current_user':
          return this.getCurrentUser(context);
        case 'get_my_profile':
          return this.getMyProfile(context);
        case 'get_user_by_email':
          return this.getUserByEmail(params, context);
        case 'get_my_organization':
          return this.getMyOrganization(context);
        case 'get_organization_members':
          return this.getOrganizationMembers(params, context);
        case 'get_my_teams':
          return this.getMyTeams(context);
        case 'get_team_members':
          return this.getTeamMembers(params, context);

        default:
          return { success: false, toolName, error: `Unknown tool: ${toolName}` };
      }
    } catch (error: any) {
      this.logger.error(`Error executing ${toolName}: ${error?.message || error}`);
      return { success: false, toolName, error: error?.message || 'Unknown error' };
    }
  }

  private buildRequestContext(context: ToolContext): RequestContext {
    return {
      userId: context.userId,
      organizationId: context.organizationId,
      userEmail: context.userEmail,
    };
  }

  // ====================
  // User lookups (direct DB - no business logic needed)
  // ====================

  private async getCurrentUser(context: ToolContext): Promise<ToolResult> {
    const user = await this.prisma.user.findUnique({
      where: { id: context.userId },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        avatarUrl: true,
        role: true,
        isActive: true,
        createdAt: true,
      },
    });

    if (!user) {
      return { success: false, toolName: 'get_current_user', error: 'User not found' };
    }

    return {
      success: true,
      toolName: 'get_current_user',
      result: {
        id: user.id,
        email: user.email,
        name: `${user.firstName} ${user.lastName}`,
        firstName: user.firstName,
        lastName: user.lastName,
        avatarUrl: user.avatarUrl,
        role: user.role,
        isActive: user.isActive,
        joinedAt: user.createdAt,
      },
    };
  }

  private async getMyProfile(context: ToolContext): Promise<ToolResult> {
    const user = await this.prisma.user.findUnique({
      where: { id: context.userId },
      include: {
        teams: {
          include: { team: true },
        },
        organizationUsers: {
          include: {
            organization: { select: { id: true, name: true, slug: true } },
          },
        },
      },
    });

    if (!user) {
      return { success: false, toolName: 'get_my_profile', error: 'User not found' };
    }

    return {
      success: true,
      toolName: 'get_my_profile',
      result: {
        id: user.id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        avatarUrl: user.avatarUrl,
        role: user.role,
        tier: user.tier,
        teams: user.teams.map(t => ({
          id: t.team.id,
          name: t.team.name,
          type: t.team.type,
        })),
        organizations: user.organizationUsers.map(ou => ({
          id: ou.organization.id,
          name: ou.organization.name,
          slug: ou.organization.slug,
          role: ou.orgRole,
        })),
        currentOrganization: context.organizationId,
        isActive: user.isActive,
        createdAt: user.createdAt,
      },
    };
  }

  private async getUserByEmail(params: any, context: ToolContext): Promise<ToolResult> {
    const reqContext = this.buildRequestContext(context);

    // Try API first
    const response = await this.apiClient.get('/v1/users', reqContext, {
      email: params.email,
      limit: 1,
    });

    if (response.success && response.data) {
      const users = Array.isArray(response.data) ? response.data : (response.data.items || response.data.users || []);
      if (users.length > 0) {
        const user = users[0];
        return {
          success: true,
          toolName: 'get_user_by_email',
          result: {
            id: user.id,
            email: user.email,
            name: user.name || `${user.firstName || ''} ${user.lastName || ''}`.trim(),
            firstName: user.firstName,
            lastName: user.lastName,
            avatarUrl: user.avatarUrl,
            role: user.orgRole || user.role,
          },
        };
      }
    }

    // Fall back to direct DB lookup
    const user = await this.prisma.user.findFirst({
      where: {
        email: params.email,
        isActive: true,
      },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        avatarUrl: true,
        organizationUsers: {
          where: { organizationId: context.organizationId },
          select: { orgRole: true },
        },
      },
    });

    if (!user) {
      return { success: false, toolName: 'get_user_by_email', error: 'User not found' };
    }

    return {
      success: true,
      toolName: 'get_user_by_email',
      result: {
        id: user.id,
        email: user.email,
        name: `${user.firstName} ${user.lastName}`,
        firstName: user.firstName,
        lastName: user.lastName,
        avatarUrl: user.avatarUrl,
        role: user.organizationUsers[0]?.orgRole || 'member',
      },
    };
  }

  // ====================
  // Organization lookups
  // ====================

  private async getMyOrganization(context: ToolContext): Promise<ToolResult> {
    // Use API for organization data
    const reqContext = this.buildRequestContext(context);

    const response = await this.apiClient.get(`/v1/organizations/${context.organizationId}`, reqContext);

    if (response.success && response.data) {
      const org = response.data;
      return {
        success: true,
        toolName: 'get_my_organization',
        result: {
          id: org.id,
          name: org.name,
          slug: org.slug,
          status: org.status,
          memberCount: org.memberCount,
          createdAt: org.createdAt,
        },
      };
    }

    // Fall back to direct DB lookup
    const orgUserCount = await this.prisma.organizationUser.count({
      where: {
        organizationId: context.organizationId,
        user: { isActive: true },
      },
    });

    const org = await this.prisma.organization.findUnique({
      where: { id: context.organizationId },
      select: {
        id: true,
        name: true,
        slug: true,
        status: true,
        createdAt: true,
      },
    });

    if (!org) {
      return { success: false, toolName: 'get_my_organization', error: 'Organization not found' };
    }

    return {
      success: true,
      toolName: 'get_my_organization',
      result: {
        id: org.id,
        name: org.name,
        slug: org.slug,
        status: org.status,
        memberCount: orgUserCount,
        createdAt: org.createdAt,
      },
    };
  }

  private async getOrganizationMembers(params: any, context: ToolContext): Promise<ToolResult> {
    // Use API for members list
    const reqContext = this.buildRequestContext(context);

    const response = await this.apiClient.get('/v1/users', reqContext, {
      limit: params.limit || 20,
      search: params.search,
    });

    if (!response.success) {
      // Fall back to direct DB lookup
      const where: any = {
        organizationId: context.organizationId,
        user: { isActive: true },
      };

      if (params.search) {
        where.user = {
          ...where.user,
          OR: [
            { firstName: { contains: params.search, mode: 'insensitive' } },
            { lastName: { contains: params.search, mode: 'insensitive' } },
            { email: { contains: params.search, mode: 'insensitive' } },
          ],
        };
      }

      const members = await this.prisma.organizationUser.findMany({
        where,
        take: params.limit || 20,
        include: {
          user: {
            select: {
              id: true,
              email: true,
              firstName: true,
              lastName: true,
              avatarUrl: true,
              role: true,
            },
          },
        },
      });

      return {
        success: true,
        toolName: 'get_organization_members',
        result: {
          total: members.length,
          members: members.map(m => ({
            id: m.user.id,
            email: m.user.email,
            name: `${m.user.firstName} ${m.user.lastName}`,
            firstName: m.user.firstName,
            lastName: m.user.lastName,
            avatarUrl: m.user.avatarUrl,
            role: m.user.role,
            orgRole: m.orgRole,
            joinedAt: m.createdAt,
          })),
        },
      };
    }

    const users = Array.isArray(response.data) ? response.data : (response.data.items || response.data.users || []);

    return {
      success: true,
      toolName: 'get_organization_members',
      result: {
        total: users.length,
        members: users.map((u: any) => ({
          id: u.id,
          email: u.email,
          name: u.name || `${u.firstName || ''} ${u.lastName || ''}`.trim(),
          firstName: u.firstName,
          lastName: u.lastName,
          avatarUrl: u.avatarUrl,
          role: u.role,
          orgRole: u.orgRole,
        })),
      },
    };
  }

  // ====================
  // Team lookups (no API endpoints - use Prisma)
  // ====================

  private async getMyTeams(context: ToolContext): Promise<ToolResult> {
    const userTeams = await this.prisma.userTeam.findMany({
      where: { userId: context.userId },
      include: {
        team: {
          select: {
            id: true,
            name: true,
            type: true,
            description: true,
            organizationId: true,
          },
        },
      },
    });

    return {
      success: true,
      toolName: 'get_my_teams',
      result: {
        total: userTeams.length,
        teams: userTeams.map(ut => ({
          id: ut.team.id,
          name: ut.team.name,
          type: ut.team.type,
          description: ut.team.description,
          isPrimary: ut.isPrimary,
        })),
      },
    };
  }

  private async getTeamMembers(params: any, context: ToolContext): Promise<ToolResult> {
    // Verify team belongs to organization
    const team = await this.prisma.team.findFirst({
      where: {
        id: params.teamId,
        organizationId: context.organizationId,
      },
    });

    if (!team) {
      return { success: false, toolName: 'get_team_members', error: 'Team not found' };
    }

    const members = await this.prisma.userTeam.findMany({
      where: { teamId: params.teamId },
      include: {
        user: {
          select: {
            id: true,
            email: true,
            firstName: true,
            lastName: true,
            avatarUrl: true,
          },
        },
      },
    });

    return {
      success: true,
      toolName: 'get_team_members',
      result: {
        team: {
          id: team.id,
          name: team.name,
          type: team.type,
        },
        total: members.length,
        members: members.map(m => ({
          id: m.user.id,
          email: m.user.email,
          name: `${m.user.firstName} ${m.user.lastName}`,
          avatarUrl: m.user.avatarUrl,
          isPrimary: m.isPrimary,
        })),
      },
    };
  }
}