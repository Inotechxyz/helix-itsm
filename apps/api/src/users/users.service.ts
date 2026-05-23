import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../common/prisma.service';
import { CacheService } from '../cache/cache.service';
import { CreateUserDto, UpdateUserDto, AssignTeamsDto, UserQueryDto } from './dto/user.dto';
import { Prisma } from '@prisma/client';
import * as bcrypt from 'bcryptjs';

@Injectable()
export class UsersService {
  constructor(
    private prisma: PrismaService,
    private cache: CacheService,
  ) {}

  async findAll(query: UserQueryDto, organizationId?: string) {
    const { search, role, orgRole, teamId, isActive, page = 1, limit = 20 } = query;

    // Cache key based on query params including org
    const cacheKey = this.cache.key('users', 'list', JSON.stringify({ search, role, orgRole, teamId, isActive, page, limit, organizationId }));

    return this.cache.wrap(cacheKey, async () => {
      const where: Prisma.UserWhereInput = {
        deletedAt: null,
      };

      if (search) {
        where.OR = [
          { email: { contains: search, mode: 'insensitive' } },
          { firstName: { contains: search, mode: 'insensitive' } },
          { lastName: { contains: search, mode: 'insensitive' } },
        ];
      }

      // System role filter (user, superadmin)
      if (role) {
        where.role = role as 'user' | 'superadmin';
      }

      // Organization role filter (orgadmin, manager, approver, agent, requester)
      if (orgRole && organizationId) {
        where.organizationUsers = {
          some: {
            organizationId,
            orgRole: orgRole as 'orgadmin' | 'manager' | 'approver' | 'agent' | 'requester',
          },
        };
      }

      if (teamId) {
        where.teams = {
          some: { teamId },
        };
      }

      if (isActive !== undefined) {
        where.isActive = isActive;
      }

      // Filter by organization if specified (for basic org membership check)
      if (organizationId && !orgRole) {
        where.organizationUsers = {
          some: { organizationId },
        };
      }

      const [users, total] = await Promise.all([
        this.prisma.user.findMany({
          where,
          include: {
            teams: {
              include: { team: true },
            },
            // Include org roles if filtering by organization
            organizationUsers: organizationId
              ? { where: { organizationId } }
              : true,
          },
          skip: (page - 1) * limit,
          take: limit,
          orderBy: { createdAt: 'desc' },
        }),
        this.prisma.user.count({ where }),
      ]);

      // Map organizationUsers to a simpler format
      const usersWithOrgRoles = users.map((user) => {
        if (organizationId && user.organizationUsers) {
          const orgUsers = Array.isArray(user.organizationUsers)
            ? user.organizationUsers
            : [user.organizationUsers];
          return {
            ...user,
            organizationUsers: undefined,
            currentOrgRole: orgUsers.length > 0 ? (orgUsers[0] as any).orgRole : null,
          };
        }
        return user;
      });

      return {
        items: usersWithOrgRoles,
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      };
    }, 'medium');
  }

  async findOne(id: string, organizationId?: string) {
    const cacheKey = this.cache.key('users', id, organizationId || '');
    return this.cache.wrap(cacheKey, async () => {
      const user = await this.prisma.user.findUnique({
        where: { id },
        include: {
          teams: {
            include: { team: true },
          },
          organizationUsers: organizationId
            ? { where: { organizationId } }
            : true,
        },
      });

      if (!user || user.deletedAt) {
        throw new NotFoundException('User not found');
      }

      // Map organizationUsers to a simpler format
      if (organizationId && user.organizationUsers) {
        const orgUsers = Array.isArray(user.organizationUsers)
          ? user.organizationUsers
          : [user.organizationUsers];
        return {
          ...user,
          organizationUsers: undefined,
          currentOrgRole: orgUsers.length > 0 ? (orgUsers[0] as any).orgRole : null,
        };
      }

      return user;
    }, 'medium');
  }

  async findByEmail(email: string) {
    // Don't cache auth-related queries
    return this.prisma.user.findUnique({
      where: { email },
      include: {
        teams: {
          include: { team: true },
        },
      },
    });
  }

  async create(dto: CreateUserDto) {
    const data: Prisma.UserCreateInput = {
      email: dto.email,
      firstName: dto.firstName,
      lastName: dto.lastName,
      role: dto.role,
      jobTitle: dto.jobTitle,
      department: dto.department,
      phone: dto.phone,
      avatarUrl: dto.avatarUrl,
    };

    if (dto.password) {
      data.password = await bcrypt.hash(dto.password, 12);
    }

    const result = await this.prisma.user.create({
      data,
      include: {
        teams: {
          include: { team: true },
        },
      },
    });

    await this.invalidateUserListCache();
    return result;
  }

  async update(id: string, dto: UpdateUserDto) {
    await this.findOne(id); // Verify exists

    const result = await this.prisma.user.update({
      where: { id },
      data: dto,
      include: {
        teams: {
          include: { team: true },
        },
      },
    });

    await this.cache.del(this.cache.key('users', id));
    await this.invalidateUserListCache();
    return result;
  }

  async assignTeams(userId: string, dto: AssignTeamsDto) {
    await this.findOne(userId); // Verify exists

    // Update team assignments
    await this.prisma.userTeam.deleteMany({
      where: { userId },
    });

    const teamAssignments = dto.teamIds.map((teamId, index) => ({
      userId,
      teamId,
      isPrimary: dto.primaryTeamId === teamId || index === 0,
    }));

    await this.prisma.userTeam.createMany({
      data: teamAssignments,
    });

    const result = await this.findOne(userId);
    await this.invalidateUserListCache();
    return result;
  }

  async delete(id: string) {
    await this.findOne(id); // Verify exists

    // Soft delete
    const result = await this.prisma.user.update({
      where: { id },
      data: { deletedAt: new Date(), isActive: false },
    });

    await this.cache.del(this.cache.key('users', id));
    await this.invalidateUserListCache();
    return result;
  }

  private async invalidateUserListCache(): Promise<void> {
    // Invalidate all user list caches (pattern-based invalidation is expensive, so we just clear known keys)
    await this.cache.delPattern('cache:users:list*');
  }
}
