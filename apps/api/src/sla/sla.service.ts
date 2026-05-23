import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../common/prisma.service';
import { CacheService } from '../cache/cache.service';
import { Prisma } from '@prisma/client';
import {
  CreateSlaPolicyDto,
  UpdateSlaPolicyDto,
  CreateEscalationRuleDto,
  UpdateEscalationRuleDto,
  CreateOlaPolicyDto,
  UpdateOlaPolicyDto,
  CreateOlaHandoffDto,
  UpdateOlaHandoffDto,
  SlaPolicyQueryDto,
  OlaPolicyQueryDto,
} from './dto/sla.dto';

@Injectable()
export class SlaService {
  constructor(
    private prisma: PrismaService,
    private cache: CacheService,
  ) {}

  // ============ SLA Policies ============

  async findAllPolicies(query: SlaPolicyQueryDto, organizationId?: string) {
    const cacheKey = this.cache.key('sla', 'policies', organizationId || 'all', JSON.stringify(query));
    return this.cache.wrap(cacheKey, async () => {
      const { page = 1, limit = 20, priority, isActive } = query;

      const where: Prisma.SlaPolicyWhereInput = {};

      if (priority) {
        where.priority = priority as any;
      }

      if (isActive !== undefined) {
        where.isActive = isActive;
      }

      if (organizationId) {
        where.organizationId = organizationId;
      }

      const [items, total] = await Promise.all([
        this.prisma.slaPolicy.findMany({
          where,
          include: {
            _count: {
              select: { tickets: true, escalationRules: true },
            },
          },
          skip: (page - 1) * limit,
          take: limit,
          orderBy: { createdAt: 'desc' },
        }),
        this.prisma.slaPolicy.count({ where }),
      ]);

      return {
        items,
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      };
    }, 'medium');
  }

  async findPolicyById(id: string, organizationId?: string) {
    const cacheKey = this.cache.key('sla', 'policy', organizationId || 'all', id);
    return this.cache.wrap(cacheKey, async () => {
      const where: Prisma.SlaPolicyWhereInput = { id };
      if (organizationId) {
        where.organizationId = organizationId;
      }

      const policy = await this.prisma.slaPolicy.findFirst({
        where,
        include: {
          escalationRules: {
            where: { isActive: true },
            orderBy: { thresholdHours: 'asc' },
          },
          _count: {
            select: { tickets: true },
          },
        },
      });

      if (!policy) {
        throw new NotFoundException('SLA Policy not found');
      }

      return policy;
    }, 'medium');
  }

  async createPolicy(dto: CreateSlaPolicyDto, organizationId?: string) {
    // Check for duplicate
    const whereDuplicate: Prisma.SlaPolicyWhereInput = { name: dto.name };
    if (organizationId) {
      whereDuplicate.organizationId = organizationId;
    }

    const existing = await this.prisma.slaPolicy.findFirst({
      where: whereDuplicate,
    });

    if (existing) {
      throw new BadRequestException('SLA Policy with this name already exists');
    }

    const result = await this.prisma.slaPolicy.create({
      data: {
        name: dto.name,
        description: dto.description,
        priority: dto.priority as any,
        ticketType: dto.ticketType as any,
        categoryId: dto.categoryId,
        userTier: dto.userTier as any,
        responseTimeHours: dto.responseTimeHours,
        resolutionTimeHours: dto.resolutionTimeHours,
        warningThreshold: dto.warningThreshold ?? 75,
        organizationId,
      },
    });

    await this.invalidateSlaCache(organizationId);
    return result;
  }

  async updatePolicy(id: string, dto: UpdateSlaPolicyDto, organizationId?: string) {
    await this.findPolicyById(id, organizationId);

    const result = await this.prisma.slaPolicy.update({
      where: { id },
      data: {
        name: dto.name,
        description: dto.description,
        isActive: dto.isActive,
        priority: dto.priority as any,
        ticketType: dto.ticketType as any,
        categoryId: dto.categoryId,
        userTier: dto.userTier as any,
        responseTimeHours: dto.responseTimeHours,
        resolutionTimeHours: dto.resolutionTimeHours,
        warningThreshold: dto.warningThreshold,
      },
    });

    await this.cache.del(this.cache.key('sla', 'policy', organizationId || 'all', id));
    await this.invalidateSlaCache(organizationId);
    return result;
  }

  async deletePolicy(id: string, organizationId?: string) {
    const policy = await this.findPolicyById(id, organizationId);

    // Check if policy has tickets
    if (policy._count.tickets > 0) {
      throw new BadRequestException(
        `Cannot delete policy with ${policy._count.tickets} associated tickets. Reassign tickets first.`,
      );
    }

    const result = await this.prisma.slaPolicy.delete({ where: { id } });

    await this.cache.del(this.cache.key('sla', 'policy', organizationId || 'all', id));
    await this.invalidateSlaCache(organizationId);
    return result;
  }

  // ============ Escalation Rules ============

  async findEscalationRules(slaPolicyId: string) {
    await this.findPolicyById(slaPolicyId);

    return this.prisma.slaEscalationRule.findMany({
      where: { slaPolicyId },
      orderBy: { thresholdHours: 'asc' },
    });
  }

  async createEscalationRule(dto: CreateEscalationRuleDto) {
    // Verify policy exists
    await this.findPolicyById(dto.slaPolicyId);

    const result = await this.prisma.slaEscalationRule.create({
      data: {
        name: dto.name,
        description: dto.description,
        slaPolicyId: dto.slaPolicyId,
        priority: dto.priority as any,
        condition: dto.condition as any,
        thresholdHours: dto.thresholdHours,
        action: dto.action as any,
        actionTarget: dto.actionTarget,
        notifyManager: dto.notifyManager ?? false,
        increasePriority: dto.increasePriority ?? false,
      },
    });

    await this.cache.del(this.cache.key('sla', 'policy', dto.slaPolicyId));
    return result;
  }

  async updateEscalationRule(id: string, dto: UpdateEscalationRuleDto) {
    const rule = await this.prisma.slaEscalationRule.findUnique({
      where: { id },
    });

    if (!rule) {
      throw new NotFoundException('Escalation Rule not found');
    }

    const result = await this.prisma.slaEscalationRule.update({
      where: { id },
      data: {
        name: dto.name,
        description: dto.description,
        isActive: dto.isActive,
        thresholdHours: dto.thresholdHours,
        action: dto.action as any,
        actionTarget: dto.actionTarget,
        notifyManager: dto.notifyManager,
        increasePriority: dto.increasePriority,
      },
    });

    await this.cache.del(this.cache.key('sla', 'policy', rule.slaPolicyId));
    return result;
  }

  async deleteEscalationRule(id: string) {
    const rule = await this.prisma.slaEscalationRule.findUnique({
      where: { id },
    });

    if (!rule) {
      throw new NotFoundException('Escalation Rule not found');
    }

    const result = await this.prisma.slaEscalationRule.delete({ where: { id } });

    await this.cache.del(this.cache.key('sla', 'policy', rule.slaPolicyId));
    return result;
  }

  // ============ OLA Policies ============

  async findAllOlaPolicies(query: OlaPolicyQueryDto, organizationId?: string) {
    const cacheKey = this.cache.key('sla', 'ola-policies', organizationId || 'all', JSON.stringify(query));
    return this.cache.wrap(cacheKey, async () => {
      const { page = 1, limit = 20, fromTeamType, toTeamType, isActive } = query;

      const where: Prisma.OlaPolicyWhereInput = {};

      if (fromTeamType) {
        where.fromTeamType = fromTeamType as any;
      }

      if (toTeamType) {
        where.toTeamType = toTeamType as any;
      }

      if (isActive !== undefined) {
        where.isActive = isActive;
      }

      if (organizationId) {
        where.organizationId = organizationId;
      }

      const [items, total] = await Promise.all([
        this.prisma.olaPolicy.findMany({
          where,
          skip: (page - 1) * limit,
          take: limit,
          orderBy: { createdAt: 'desc' },
        }),
        this.prisma.olaPolicy.count({ where }),
      ]);

      return {
        items,
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      };
    }, 'medium');
  }

  async findOlaPolicyById(id: string, organizationId?: string) {
    const cacheKey = this.cache.key('sla', 'ola-policy', organizationId || 'all', id);
    return this.cache.wrap(cacheKey, async () => {
      const where: Prisma.OlaPolicyWhereInput = { id };
      if (organizationId) {
        where.organizationId = organizationId;
      }

      const policy = await this.prisma.olaPolicy.findFirst({ where });

      if (!policy) {
        throw new NotFoundException('OLA Policy not found');
      }

      return policy;
    }, 'medium');
  }

  async findOlaPolicyByTeamTypes(fromTeamType: string, toTeamType: string) {
    // Don't cache this - it's used for ticket creation logic
    return this.prisma.olaPolicy.findFirst({
      where: {
        fromTeamType: fromTeamType as any,
        toTeamType: toTeamType as any,
        isActive: true,
      },
    });
  }

  async createOlaPolicy(dto: CreateOlaPolicyDto, organizationId?: string) {
    // Check for duplicate
    const whereDuplicate: Prisma.OlaPolicyWhereInput = { name: dto.name };
    if (organizationId) {
      whereDuplicate.organizationId = organizationId;
    }

    const existing = await this.prisma.olaPolicy.findFirst({
      where: whereDuplicate,
    });

    if (existing) {
      throw new BadRequestException('OLA Policy with this name already exists');
    }

    const result = await this.prisma.olaPolicy.create({
      data: {
        name: dto.name,
        description: dto.description,
        fromTeamType: dto.fromTeamType as any,
        toTeamType: dto.toTeamType as any,
        responseTimeHours: dto.responseTimeHours,
        resolutionTimeHours: dto.resolutionTimeHours,
        organizationId,
      },
    });

    await this.invalidateOlaCache(organizationId);
    return result;
  }

  async updateOlaPolicy(id: string, dto: UpdateOlaPolicyDto, organizationId?: string) {
    await this.findOlaPolicyById(id, organizationId);

    const result = await this.prisma.olaPolicy.update({
      where: { id },
      data: {
        name: dto.name,
        description: dto.description,
        isActive: dto.isActive,
        responseTimeHours: dto.responseTimeHours,
        resolutionTimeHours: dto.resolutionTimeHours,
      },
    });

    await this.cache.del(this.cache.key('sla', 'ola-policy', organizationId || 'all', id));
    await this.invalidateOlaCache(organizationId);
    return result;
  }

  async deleteOlaPolicy(id: string, organizationId?: string) {
    await this.findOlaPolicyById(id, organizationId);

    const result = await this.prisma.olaPolicy.delete({ where: { id } });

    await this.cache.del(this.cache.key('sla', 'ola-policy', organizationId || 'all', id));
    await this.invalidateOlaCache(organizationId);
    return result;
  }

  // ============ OLA Handoffs ============

  async findOlaHandoffs(ticketId: string) {
    return this.prisma.olaHandoff.findMany({
      where: { ticketId },
      orderBy: { createdAt: 'desc' },
    });
  }

  async createOlaHandoff(dto: CreateOlaHandoffDto) {
    // Verify ticket exists
    const ticket = await this.prisma.ticket.findUnique({
      where: { id: dto.ticketId },
    });

    if (!ticket) {
      throw new NotFoundException('Ticket not found');
    }

    // Find OLA policy for these team types
    const fromTeam = await this.prisma.team.findUnique({
      where: { id: dto.fromTeamId },
    });
    const toTeam = await this.prisma.team.findUnique({
      where: { id: dto.toTeamId },
    });

    if (!fromTeam || !toTeam) {
      throw new BadRequestException('Invalid team IDs');
    }

    const olaPolicy = await this.findOlaPolicyByTeamTypes(fromTeam.type, toTeam.type);

    const now = new Date();
    const responseDeadline = olaPolicy
      ? new Date(now.getTime() + olaPolicy.responseTimeHours * 60 * 60 * 1000)
      : null;
    const resolvedDeadline = olaPolicy
      ? new Date(now.getTime() + olaPolicy.resolutionTimeHours * 60 * 60 * 1000)
      : null;

    return this.prisma.olaHandoff.create({
      data: {
        ticketId: dto.ticketId,
        fromTeamId: dto.fromTeamId,
        toTeamId: dto.toTeamId,
        initiatedById: dto.initiatedById,
        responseDeadline,
        resolvedDeadline,
        notes: dto.notes,
      },
    });
  }

  async updateOlaHandoff(id: string, dto: UpdateOlaHandoffDto) {
    const handoff = await this.prisma.olaHandoff.findUnique({
      where: { id },
    });

    if (!handoff) {
      throw new NotFoundException('OLA Handoff not found');
    }

    const updateData: Prisma.OlaHandoffUpdateInput = {
      ...dto,
    };

    // Set timestamps if marking as met
    if (dto.responseMet === true && !handoff.responseAt) {
      updateData.responseAt = new Date();
    }
    if (dto.resolutionMet === true && !handoff.resolvedAt) {
      updateData.resolvedAt = new Date();
    }

    return this.prisma.olaHandoff.update({
      where: { id },
      data: updateData,
    });
  }

  // ============ Ticket SLA Calculations ============

  /**
   * Find the best matching SLA policy for a ticket
   * Priority: category + tier > category > ticket type + tier > ticket type > priority only
   */
  async findMatchingPolicy(ticket: {
    priority: string;
    type: string;
    categoryId?: string | null;
    requester?: { tier?: string | null };
    organizationId?: string;
  }) {
    // Build where clause
    const where: any = { isActive: true };
    if (ticket.organizationId) {
      where.organizationId = ticket.organizationId;
    }

    // Try to find most specific policy first
    const policies = await this.prisma.slaPolicy.findMany({
      where,
      orderBy: { createdAt: 'desc' },
    });

    // Find best match
    for (const policy of policies) {
      const priorityMatch = policy.priority === ticket.priority;
      const typeMatch = !policy.ticketType || policy.ticketType === ticket.type;
      const categoryMatch = !policy.categoryId || policy.categoryId === ticket.categoryId;
      const tierMatch = !policy.userTier || policy.userTier === ticket.requester?.tier;

      if (priorityMatch && typeMatch && categoryMatch && tierMatch) {
        return policy;
      }
    }

    // Fallback to priority-only policy
    return policies.find((p) => p.priority === ticket.priority && !p.ticketType && !p.categoryId && !p.userTier);
  }

  /**
   * Calculate SLA deadlines based on policy
   */
  calculateSlaDeadlines(policy: {
    responseTimeHours: number;
    resolutionTimeHours: number;
  }, createdAt: Date) {
    const firstResponseDeadline = new Date(createdAt);
    firstResponseDeadline.setHours(firstResponseDeadline.getHours() + policy.responseTimeHours);

    const resolutionDeadline = new Date(createdAt);
    resolutionDeadline.setHours(resolutionDeadline.getHours() + policy.resolutionTimeHours);

    return {
      firstResponseDeadline,
      resolutionDeadline,
    };
  }

  /**
   * Check if SLA is approaching breach (warning threshold)
   */
  isApproachingBreach(
    deadline: Date,
    warningThreshold: number,
    createdAt: Date,
  ): boolean {
    const now = new Date();
    const totalTime = deadline.getTime() - createdAt.getTime();
    const elapsedTime = now.getTime() - createdAt.getTime();
    const percentElapsed = (elapsedTime / totalTime) * 100;

    return percentElapsed >= warningThreshold && deadline > now;
  }

  /**
   * Check if SLA has been breached
   */
  isBreached(deadline: Date): boolean {
    return new Date() > deadline;
  }

  /**
   * Get SLA status for a ticket
   */
  async getTicketSlaStatus(ticketId: string) {
    const ticket = await this.prisma.ticket.findUnique({
      where: { id: ticketId },
      include: {
        slaPolicy: true,
        requester: {
          select: { tier: true },
        },
        escalations: {
          orderBy: { createdAt: 'desc' },
          take: 5,
        },
      },
    });

    if (!ticket) {
      throw new NotFoundException('Ticket not found');
    }

    const now = new Date();
    const createdAt = ticket.createdAt;

    // Calculate SLA status
    let frtStatus: 'ok' | 'warning' | 'breached' | 'met' = 'ok';
    let resolutionStatus: 'ok' | 'warning' | 'breached' | 'met' = 'ok';

    const warningThreshold = ticket.slaPolicy?.warningThreshold ?? 75;

    // FRT status
    if (ticket.firstResponseAt) {
      frtStatus = 'met';
    } else if (ticket.firstResponseDeadline) {
      if (this.isBreached(ticket.firstResponseDeadline)) {
        frtStatus = 'breached';
      } else if (this.isApproachingBreach(ticket.firstResponseDeadline, warningThreshold, createdAt)) {
        frtStatus = 'warning';
      }
    }

    // Resolution status
    if (ticket.resolvedAt || ticket.closedAt) {
      resolutionStatus = 'met';
    } else if (ticket.slaDeadline) {
      if (this.isBreached(ticket.slaDeadline)) {
        resolutionStatus = 'breached';
      } else if (this.isApproachingBreach(ticket.slaDeadline, warningThreshold, createdAt)) {
        resolutionStatus = 'warning';
      }
    }

    // Calculate time remaining
    const frtTimeRemaining = ticket.firstResponseDeadline
      ? Math.max(0, ticket.firstResponseDeadline.getTime() - now.getTime())
      : null;
    const resolutionTimeRemaining = ticket.slaDeadline
      ? Math.max(0, ticket.slaDeadline.getTime() - now.getTime())
      : null;

    return {
      ticketId: ticket.id,
      ticketNumber: ticket.ticketNumber,
      priority: ticket.priority,
      policy: ticket.slaPolicy ? {
        id: ticket.slaPolicy.id,
        name: ticket.slaPolicy.name,
        responseTimeHours: ticket.slaPolicy.responseTimeHours,
        resolutionTimeHours: ticket.slaPolicy.resolutionTimeHours,
        warningThreshold: ticket.slaPolicy.warningThreshold,
      } : null,
      firstResponse: {
        deadline: ticket.firstResponseDeadline,
        status: frtStatus,
        timeRemaining: frtTimeRemaining,
        met: ticket.firstResponseAt,
      },
      resolution: {
        deadline: ticket.slaDeadline,
        status: resolutionStatus,
        timeRemaining: resolutionTimeRemaining,
        met: ticket.resolvedAt || ticket.closedAt,
      },
      escalationLevel: ticket.escalationLevel,
      recentEscalations: ticket.escalations,
    };
  }

  // ============ Statistics ============

  async getSlaStats(organizationId?: string) {
    const cacheKey = this.cache.key('sla', 'stats', organizationId || 'all');
    return this.cache.wrap(cacheKey, async () => {
      const whereOrg = organizationId ? { organizationId } : {};

      const [
        totalPolicies,
        activePolicies,
        totalEscalationRules,
        totalOlaPolicies,
        activeOlaPolicies,
        ticketsAtRisk,
        ticketsBreached,
      ] = await Promise.all([
        this.prisma.slaPolicy.count({ where: whereOrg }),
        this.prisma.slaPolicy.count({ where: { ...whereOrg, isActive: true } }),
        this.prisma.slaEscalationRule.count(),
        this.prisma.olaPolicy.count({ where: whereOrg }),
        this.prisma.olaPolicy.count({ where: { ...whereOrg, isActive: true } }),
        this.getTicketsAtRiskCount(organizationId),
        this.prisma.ticket.count({
          where: {
            ...whereOrg,
            slaBreached: true,
            status: { notIn: ['resolved', 'closed'] },
          },
        }),
      ]);

      return {
        slaPolicies: {
          total: totalPolicies,
          active: activePolicies,
        },
        escalationRules: {
          total: totalEscalationRules,
        },
        olaPolicies: {
          total: totalOlaPolicies,
          active: activeOlaPolicies,
        },
        ticketsAtRisk,
        ticketsBreached,
      };
    }, 'short');
  }

  // ============ Cache Invalidation ============

  private async invalidateSlaCache(organizationId?: string): Promise<void> {
    if (organizationId) {
      await this.cache.delPattern(`cache:sla:policies*${organizationId}*`);
      await this.cache.delPattern(`cache:sla:policy*${organizationId}*`);
    } else {
      await this.cache.delPattern('cache:sla:policies*');
    }
  }

  private async invalidateOlaCache(organizationId?: string): Promise<void> {
    if (organizationId) {
      await this.cache.delPattern(`cache:sla:ola-policies*${organizationId}*`);
      await this.cache.delPattern(`cache:sla:ola-policy*${organizationId}*`);
    } else {
      await this.cache.delPattern('cache:sla:ola-policies*');
    }
  }

  private async getTicketsAtRiskCount(organizationId?: string): Promise<number> {
    const now = new Date();
    const warningThreshold = 75; // Default

    const where: any = {
      slaDeadline: { not: null },
      status: { notIn: ['resolved', 'closed'] },
      slaBreached: false,
    };
    if (organizationId) {
      where.organizationId = organizationId;
    }

    const tickets = await this.prisma.ticket.findMany({
      where,
      select: {
        id: true,
        slaDeadline: true,
        createdAt: true,
        slaPolicy: {
          select: { warningThreshold: true },
        },
      },
    });

    let count = 0;
    for (const ticket of tickets) {
      if (ticket.slaDeadline && this.isApproachingBreach(ticket.slaDeadline, warningThreshold, ticket.createdAt)) {
        count++;
      }
    }

    return count;
  }

  // ============ Create Ticket Escalation Record ============

  async createTicketEscalation(ticketId: string, data: {
    ruleId?: string;
    reason: string;
    previousLevel: number;
    newLevel: number;
    actionTaken: string;
    notifiedUsers: string[];
  }) {
    return this.prisma.ticketEscalation.create({
      data: {
        ticketId,
        ruleId: data.ruleId,
        reason: data.reason,
        previousLevel: data.previousLevel,
        newLevel: data.newLevel,
        actionTaken: data.actionTaken as any,
        notifiedUsers: data.notifiedUsers,
      },
    });
  }
}
