import { Injectable, NotFoundException, ConflictException } from '@nestjs/common';
import { PrismaService } from '../common/prisma.service';
import { CacheService } from '../cache/cache.service';
import { CreateTeamDto, UpdateTeamDto } from './dto/team.dto';
import { UserRole } from '@helix/shared';

@Injectable()
export class TeamsService {
  constructor(
    private prisma: PrismaService,
    private cache: CacheService,
  ) {}

  /**
   * Find all teams, optionally filtered by organization
   */
  async findAll(options: { organizationId?: string; userRole?: UserRole } = {}) {
    const { organizationId, userRole } = options;

    // SuperAdmin without organizationId gets all teams
    if (userRole === UserRole.superadmin && !organizationId) {
      return this.findAllInternal();
    }

    // With organizationId - filter by organization
    if (organizationId) {
      return this.findAllInternal(organizationId);
    }

    // No organization context - return empty (user should have org context)
    return [];
  }

  private async findAllInternal(organizationId?: string) {
    const cacheKey = this.cache.key('teams', 'list', organizationId || 'all');
    return this.cache.wrap(cacheKey, async () => {
      const where: any = { isActive: true };
      if (organizationId) {
        where.organizationId = organizationId;
      }

      return this.prisma.team.findMany({
        where,
        include: {
          lead: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              email: true,
              avatarUrl: true,
            },
          },
          _count: {
            select: { members: true, tickets: true },
          },
        },
        orderBy: { name: 'asc' },
      });
    }, 'long');
  }

  async findOne(id: string, options: { organizationId?: string; userRole?: UserRole } = {}) {
    const { organizationId, userRole } = options;

    // SuperAdmin bypasses organization check
    if (userRole === UserRole.superadmin) {
      return this.findOneInternal(id);
    }

    // With organizationId - verify team belongs to organization
    if (organizationId) {
      return this.findOneInternal(id, organizationId);
    }

    throw new NotFoundException('Team not found');
  }

  private async findOneInternal(id: string, organizationId?: string) {
    const cacheKey = this.cache.key('teams', id);
    return this.cache.wrap(cacheKey, async () => {
      const where: any = { id };
      if (organizationId) {
        where.organizationId = organizationId;
      }

      const team = await this.prisma.team.findFirst({
        where,
        include: {
          lead: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              email: true,
              avatarUrl: true,
            },
          },
          members: {
            include: {
              user: {
                select: {
                  id: true,
                  firstName: true,
                  lastName: true,
                  email: true,
                  avatarUrl: true,
                  role: true,
                },
              },
            },
          },
          _count: {
            select: { tickets: true },
          },
        },
      });

      if (!team) {
        throw new NotFoundException('Team not found');
      }

      return team;
    }, 'medium');
  }

  async create(dto: CreateTeamDto, organizationId: string) {
    // Check for duplicate name within organization
    const existing = await this.prisma.team.findFirst({
      where: {
        name: dto.name,
        organizationId,
      },
    });

    if (existing) {
      throw new ConflictException('Team with this name already exists in this organization');
    }

    const result = await this.prisma.team.create({
      data: {
        ...dto,
        organizationId,
      },
      include: {
        lead: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
          },
        },
      },
    });

    await this.invalidateCache(organizationId);
    return result;
  }

  async update(id: string, dto: UpdateTeamDto, organizationId?: string) {
    await this.findOne(id, { organizationId });

    // Check for duplicate name within organization if name is being changed
    if (dto.name) {
      const existing = await this.prisma.team.findFirst({
        where: {
          name: dto.name,
          organizationId,
          id: { not: id },
        },
      });

      if (existing) {
        throw new ConflictException('Team with this name already exists in this organization');
      }
    }

    const result = await this.prisma.team.update({
      where: { id },
      data: dto,
      include: {
        lead: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
          },
        },
      },
    });

    await this.cache.del(this.cache.key('teams', id));
    await this.invalidateCache(organizationId);
    return result;
  }

  async addMember(teamId: string, userId: string, isPrimary = false, organizationId?: string) {
    await this.findOne(teamId, { organizationId });

    // Verify user belongs to the same organization
    if (organizationId) {
      const userOrg = await this.prisma.organizationUser.findUnique({
        where: {
          organizationId_userId: {
            organizationId,
            userId,
          },
        },
      });

      if (!userOrg) {
        throw new ConflictException('User does not belong to this organization');
      }
    }

    const existing = await this.prisma.userTeam.findUnique({
      where: {
        userId_teamId: { userId, teamId },
      },
    });

    if (existing) {
      throw new ConflictException('User is already a member of this team');
    }

    // If this is the primary team, unset primary on other teams
    if (isPrimary) {
      await this.prisma.userTeam.updateMany({
        where: { userId },
        data: { isPrimary: false },
      });
    }

    const result = await this.prisma.userTeam.create({
      data: {
        userId,
        teamId,
        isPrimary,
      },
      include: {
        user: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
          },
        },
      },
    });

    await this.cache.del(this.cache.key('teams', teamId));
    return result;
  }

  async removeMember(teamId: string, userId: string, organizationId?: string) {
    await this.findOne(teamId, { organizationId });

    await this.prisma.userTeam.deleteMany({
      where: { userId, teamId },
    });

    await this.cache.del(this.cache.key('teams', teamId));
    return { success: true };
  }

  async getMembers(teamId: string, organizationId?: string) {
    await this.findOne(teamId, { organizationId });

    return this.prisma.userTeam.findMany({
      where: { teamId },
      include: {
        user: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
            avatarUrl: true,
            role: true,
            isActive: true,
          },
        },
      },
    });
  }

  /**
   * Get teams for a specific organization
   */
  async findByOrganization(organizationId: string) {
    return this.findAllInternal(organizationId);
  }

  /**
   * Get team with organization validation
   */
  async findOneForOrg(id: string, organizationId: string) {
    return this.findOneInternal(id, organizationId);
  }

  private async invalidateCache(organizationId?: string): Promise<void> {
    // Always delete the 'all' key
    await this.cache.del(this.cache.key('teams', 'list', 'all'));
    if (organizationId) {
      // Delete org-specific key
      await this.cache.del(this.cache.key('teams', 'list', organizationId));
    }
  }
}
