import { Injectable } from '@nestjs/common';
import { PrismaService } from '../common/prisma.service';
import { CacheService } from '../cache/cache.service';
import { Prisma } from '@prisma/client';

const TicketStatus = {
  RESOLVED: 'resolved',
  CLOSED: 'closed',
} as const;

const TicketPriority = {
  CRITICAL: 'critical',
  HIGH: 'high',
  MEDIUM: 'medium',
  LOW: 'low',
} as const;

// Performance limits to prevent memory exhaustion during stress testing
const MAX_DATE_RANGE_DAYS = 90; // Maximum date range for report queries
const MAX_RECORDS_FETCH = 10000; // Maximum records to fetch for in-memory aggregation

@Injectable()
export class ReportsService {
  constructor(
    private prisma: PrismaService,
    private cache: CacheService,
  ) {}

  private enforceDateRange(dateFrom?: string, dateTo?: string): { dateFrom: Date; dateTo: Date } {
    const now = new Date();
    const defaultDateTo = dateTo ? new Date(dateTo) : now;
    let defaultDateFrom = dateFrom ? new Date(dateFrom) : new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

    // Enforce maximum date range
    const maxDateFrom = new Date(defaultDateTo.getTime() - MAX_DATE_RANGE_DAYS * 24 * 60 * 60 * 1000);
    if (defaultDateFrom < maxDateFrom) {
      defaultDateFrom = maxDateFrom;
    }

    return { dateFrom: defaultDateFrom, dateTo: defaultDateTo };
  }

  /**
   * Get base where clause with organization filtering
   */
  private getOrgWhere(organizationId?: string): { organizationId: string } | {} {
    return organizationId ? { organizationId } : {};
  }

  async getDashboard(organizationId?: string) {
    const orgFilter = this.getOrgWhere(organizationId);
    console.log('[ReportsService] getDashboard called with orgId:', organizationId, '| filter:', JSON.stringify(orgFilter));
    const cacheKey = this.cache.key('reports', 'dashboard', organizationId || 'global');
    return this.cache.wrap(cacheKey, async () => {
      const now = new Date();
      const startOfDay = new Date(now.setHours(0, 0, 0, 0));

      const [
        totalTickets,
        openTickets,
        resolvedToday,
        slaBreached,
        avgResolutionTime,
        ticketsByStatus,
        ticketsByPriority,
        recentTickets,
      ] = await Promise.all([
        this.prisma.ticket.count({ where: { ...orgFilter, deletedAt: null } }),
        this.prisma.ticket.count({
          where: {
            ...orgFilter,
            deletedAt: null,
            status: { notIn: [TicketStatus.RESOLVED, TicketStatus.CLOSED] },
          },
        }),
        this.prisma.ticket.count({
          where: {
            ...orgFilter,
            resolvedAt: { gte: startOfDay },
          },
        }),
        this.prisma.ticket.count({
          where: {
            ...orgFilter,
            slaBreached: true,
            status: { notIn: [TicketStatus.RESOLVED, TicketStatus.CLOSED] },
          },
        }),
        this.calculateAvgResolutionTime(orgFilter),
        this.getStatusDistribution(organizationId),
        this.getPriorityDistribution(organizationId),
        this.prisma.ticket.findMany({
          where: { ...orgFilter, deletedAt: null },
          orderBy: { createdAt: 'desc' },
          take: 10,
          include: {
            requester: { select: { firstName: true, lastName: true, email: true } },
            assignedAgent: { select: { firstName: true, lastName: true } },
          },
        }),
      ]);

      return {
        totalTickets,
        openTickets,
        resolvedToday,
        slaBreached,
        avgResolutionTime,
        ticketsByStatus,
        ticketsByPriority,
        recentTickets,
      };
    }, 'short'); // 30 seconds cache for dashboard
  }

  async getVolumeTrends(options: {
    dateFrom?: string;
    dateTo?: string;
    groupBy?: 'day' | 'week' | 'month';
    organizationId?: string;
  }) {
    const { dateFrom, dateTo, groupBy = 'day', organizationId } = options;

    // Enforce date range limits to prevent memory exhaustion
    const { dateFrom: enforcedDateFrom, dateTo: enforcedDateTo } = this.enforceDateRange(dateFrom, dateTo);

    const where: Prisma.TicketWhereInput = {
      ...(organizationId ? this.getOrgWhere(organizationId) : {}),
      deletedAt: null,
      createdAt: {
        gte: enforcedDateFrom,
        lte: enforcedDateTo,
      },
    };

    const tickets = await this.prisma.ticket.findMany({
      where,
      select: { createdAt: true, type: true },
      orderBy: { createdAt: 'asc' },
      take: MAX_RECORDS_FETCH, // Limit to prevent memory issues
    });

    // Group by date
    const grouped: Record<string, { incident: number; service_request: number }> = {};

    tickets.forEach((ticket) => {
      let key: string;
      const date = new Date(ticket.createdAt);

      switch (groupBy) {
        case 'week':
          const weekStart = new Date(date);
          weekStart.setDate(date.getDate() - date.getDay());
          key = weekStart.toISOString().slice(0, 10);
          break;
        case 'month':
          key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
          break;
        default:
          key = date.toISOString().slice(0, 10);
      }

      if (!grouped[key]) {
        grouped[key] = { incident: 0, service_request: 0 };
      }
      grouped[key][ticket.type as 'incident' | 'service_request']++;
    });

    return Object.entries(grouped).map(([date, data]) => ({
      date,
      ...data,
      total: data.incident + data.service_request,
    }));
  }

  async getResolutionTime(options: {
    dateFrom?: string;
    dateTo?: string;
    teamId?: string;
    organizationId?: string;
  }) {
    const { dateFrom, dateTo, teamId, organizationId } = options;

    // Enforce date range limits to prevent memory exhaustion
    const { dateFrom: enforcedDateFrom, dateTo: enforcedDateTo } = this.enforceDateRange(dateFrom, dateTo);

    const where: Prisma.TicketWhereInput = {
      ...(organizationId ? this.getOrgWhere(organizationId) : {}),
      deletedAt: null,
      resolvedAt: { not: null },
      createdAt: {
        gte: enforcedDateFrom,
        lte: enforcedDateTo,
      },
    };

    if (teamId) {
      where.assignedTeamId = teamId;
    }

    const tickets = await this.prisma.ticket.findMany({
      where,
      select: { createdAt: true, resolvedAt: true, priority: true },
      take: MAX_RECORDS_FETCH, // Limit to prevent memory issues
    });

    const resolutionTimes = tickets.map((t) => ({
      priority: t.priority,
      hours: (t.resolvedAt!.getTime() - t.createdAt.getTime()) / (1000 * 60 * 60),
    }));

    const byPriority: Record<string, { count: number; avgHours: number }> = {};
    const priorities = [TicketPriority.CRITICAL, TicketPriority.HIGH, TicketPriority.MEDIUM, TicketPriority.LOW];

    priorities.forEach((p) => {
      const filtered = resolutionTimes.filter((r) => r.priority === p);
      if (filtered.length > 0) {
        byPriority[p] = {
          count: filtered.length,
          avgHours: filtered.reduce((sum, r) => sum + r.hours, 0) / filtered.length,
        };
      }
    });

    return {
      overall: resolutionTimes.length > 0
        ? resolutionTimes.reduce((sum, r) => sum + r.hours, 0) / resolutionTimes.length
        : 0,
      byPriority,
      tickets: resolutionTimes.length,
    };
  }

  async getAgentPerformance(options: {
    dateFrom?: string;
    dateTo?: string;
    teamId?: string;
    organizationId?: string;
  }) {
    const { dateFrom, dateTo, teamId, organizationId } = options;

    // Enforce date range limits to prevent memory exhaustion
    const { dateFrom: enforcedDateFrom, dateTo: enforcedDateTo } = this.enforceDateRange(dateFrom, dateTo);

    const where: Prisma.TicketWhereInput = {
      ...(organizationId ? this.getOrgWhere(organizationId) : {}),
      deletedAt: null,
      assignedAgentId: { not: null },
      createdAt: {
        gte: enforcedDateFrom,
        lte: enforcedDateTo,
      },
    };

    if (teamId) {
      where.assignedTeamId = teamId;
    }

    const tickets = await this.prisma.ticket.findMany({
      where,
      include: {
        assignedAgent: {
          select: { id: true, firstName: true, lastName: true, email: true },
        },
      },
      take: MAX_RECORDS_FETCH, // Limit to prevent memory issues
    });

    // Group by agent
    const agentStats: Record<string, any> = {};

    tickets.forEach((ticket) => {
      const agentId = ticket.assignedAgentId!;
      if (!agentStats[agentId]) {
        agentStats[agentId] = {
          agent: ticket.assignedAgent,
          total: 0,
          resolved: 0,
          avgResolutionHours: 0,
          slaBreached: 0,
        };
      }

      agentStats[agentId].total++;
      if (ticket.status === TicketStatus.RESOLVED || ticket.status === TicketStatus.CLOSED) {
        agentStats[agentId].resolved++;
      }
      if (ticket.slaBreached) {
        agentStats[agentId].slaBreached++;
      }
    });

    // Calculate averages
    return Object.values(agentStats).map((stats: any) => ({
      ...stats,
      resolutionRate: stats.total > 0 ? (stats.resolved / stats.total) * 100 : 0,
      slaCompliance: stats.total > 0 ? ((stats.total - stats.slaBreached) / stats.total) * 100 : 0,
    }));
  }

  async getSlaCompliance(options: {
    dateFrom?: string;
    dateTo?: string;
    organizationId?: string;
  }) {
    const { dateFrom, dateTo, organizationId } = options;

    const where: Prisma.TicketWhereInput = {
      ...(organizationId ? this.getOrgWhere(organizationId) : {}),
      deletedAt: null,
    };
    if (dateFrom || dateTo) {
      where.createdAt = {};
      if (dateFrom) {
        where.createdAt.gte = new Date(dateFrom);
      }
      if (dateTo) {
        where.createdAt.lte = new Date(dateTo);
      }
    }

    const [total, breached] = await Promise.all([
      this.prisma.ticket.count({ where }),
      this.prisma.ticket.count({ where: { ...where, slaBreached: true } }),
    ]);

    return {
      total,
      breached,
      compliant: total - breached,
      complianceRate: total > 0 ? ((total - breached) / total) * 100 : 100,
    };
  }

  async getStatusDistribution(organizationId?: string) {
    const where: Prisma.TicketWhereInput = {
      ...(organizationId ? this.getOrgWhere(organizationId) : {}),
      deletedAt: null,
    };
    const distribution = await this.prisma.ticket.groupBy({
      by: ['status'],
      where,
      _count: { status: true },
    });

    return distribution.reduce((acc, item) => {
      acc[item.status] = item._count.status;
      return acc;
    }, {} as Record<string, number>);
  }

  async getPriorityDistribution(organizationId?: string) {
    const where: Prisma.TicketWhereInput = {
      ...(organizationId ? this.getOrgWhere(organizationId) : {}),
      deletedAt: null,
    };
    const distribution = await this.prisma.ticket.groupBy({
      by: ['priority'],
      where,
      _count: { priority: true },
    });

    return distribution.reduce((acc, item) => {
      acc[item.priority] = item._count.priority;
      return acc;
    }, {} as Record<string, number>);
  }

  private async calculateAvgResolutionTime(orgFilter: { organizationId: string } | {}) {
    const result = await this.prisma.ticket.findMany({
      where: {
        ...orgFilter,
        deletedAt: null,
        resolvedAt: { not: null },
      },
      select: { createdAt: true, resolvedAt: true },
      take: 1000,
      orderBy: { resolvedAt: 'desc' },
    });

    if (result.length === 0) return 0;

    const totalHours = result.reduce((sum, t) => {
      return sum + (t.resolvedAt!.getTime() - t.createdAt.getTime()) / (1000 * 60 * 60);
    }, 0);

    return totalHours / result.length;
  }

  // ==================== MTTR, FRT, First Contact Resolution ====================

  /**
   * Get comprehensive KPI metrics including MTTR, FRT, and First Contact Resolution
   */
  async getKpiMetrics(options: {
    dateFrom?: string;
    dateTo?: string;
    teamId?: string;
    organizationId?: string;
  }) {
    const { dateFrom, dateTo, teamId, organizationId } = options;
    const { dateFrom: enforcedDateFrom, dateTo: enforcedDateTo } = this.enforceDateRange(dateFrom, dateTo);

    const where: Prisma.TicketWhereInput = {
      ...(organizationId ? this.getOrgWhere(organizationId) : {}),
      deletedAt: null,
      createdAt: {
        gte: enforcedDateFrom,
        lte: enforcedDateTo,
      },
    };

    if (teamId) {
      where.assignedTeamId = teamId;
    }

    // Fetch all tickets for the date range
    const tickets = await this.prisma.ticket.findMany({
      where,
      select: {
        id: true,
        createdAt: true,
        resolvedAt: true,
        firstResponseAt: true,
        frtBreached: true,
        slaBreached: true,
        status: true,
        priority: true,
        assignedAgentId: true,
      },
      take: MAX_RECORDS_FETCH,
    });

    // Calculate MTTR (Mean Time to Resolution)
    const resolvedTickets = tickets.filter(t => t.resolvedAt !== null);
    const mttr = this.calculateMTTR(resolvedTickets);

    // Calculate FRT (First Response Time)
    const frtStats = this.calculateFRT(tickets);

    // Calculate First Contact Resolution
    const fcrStats = await this.calculateFirstContactResolution(tickets);

    // Calculate SLA compliance
    const slaCompliance = this.calculateSLACompliance(tickets);

    return {
      mttr,
      frt: frtStats,
      firstContactResolution: fcrStats,
      slaCompliance,
      totalTickets: tickets.length,
      resolvedTickets: resolvedTickets.length,
      period: {
        from: enforcedDateFrom.toISOString(),
        to: enforcedDateTo.toISOString(),
      },
    };
  }

  /**
   * MTTR: Mean Time to Resolution - average hours from ticket creation to resolution
   */
  private calculateMTTR(resolvedTickets: any[]): {
    overall: number;
    byPriority: Record<string, number>;
    trend: { period: string; value: number }[];
  } {
    const priorities = [TicketPriority.CRITICAL, TicketPriority.HIGH, TicketPriority.MEDIUM, TicketPriority.LOW];
    const byPriority: Record<string, number> = {};
    const trendMap: Record<string, { total: number; count: number }> = {};

    resolvedTickets.forEach(ticket => {
      const hours = (ticket.resolvedAt!.getTime() - ticket.createdAt.getTime()) / (1000 * 60 * 60);

      // By priority
      if (!byPriority[ticket.priority]) {
        byPriority[ticket.priority] = 0;
      }
      byPriority[ticket.priority] += hours;

      // Trend by week
      const weekStart = new Date(ticket.createdAt);
      weekStart.setDate(weekStart.getDate() - weekStart.getDay());
      const weekKey = weekStart.toISOString().slice(0, 10);

      if (!trendMap[weekKey]) {
        trendMap[weekKey] = { total: 0, count: 0 };
      }
      trendMap[weekKey].total += hours;
      trendMap[weekKey].count++;
    });

    // Calculate averages by priority
    const priorityCounts: Record<string, number> = {};
    resolvedTickets.forEach(t => {
      priorityCounts[t.priority] = (priorityCounts[t.priority] || 0) + 1;
    });

    const avgByPriority: Record<string, number> = {};
    priorities.forEach(p => {
      if (priorityCounts[p] > 0) {
        avgByPriority[p] = Number((byPriority[p] / priorityCounts[p]).toFixed(2));
      } else {
        avgByPriority[p] = 0;
      }
    });

    // Calculate overall average
    const overall = resolvedTickets.length > 0
      ? Number((resolvedTickets.reduce((sum, t) => {
          return sum + (t.resolvedAt!.getTime() - t.createdAt.getTime()) / (1000 * 60 * 60);
        }, 0) / resolvedTickets.length).toFixed(2))
      : 0;

    // Build trend array
    const trend = Object.entries(trendMap)
      .map(([period, data]) => ({
        period,
        value: Number((data.total / data.count).toFixed(2)),
      }))
      .sort((a, b) => a.period.localeCompare(b.period))
      .slice(-8); // Last 8 weeks

    return {
      overall,
      byPriority: avgByPriority,
      trend,
    };
  }

  /**
   * FRT: First Response Time - average hours from ticket creation to first response
   */
  private calculateFRT(tickets: any[]): {
    overall: number;
    byPriority: Record<string, number>;
    breached: number;
    breachedRate: number;
    trend: { period: string; avgHours: number; breachedRate: number }[];
  } {
    const priorities = [TicketPriority.CRITICAL, TicketPriority.HIGH, TicketPriority.MEDIUM, TicketPriority.LOW];
    const ticketsWithResponse = tickets.filter(t => t.firstResponseAt !== null);
    const breached = tickets.filter(t => t.frtBreached).length;

    const byPriority: Record<string, { total: number; count: number }> = {};
    const trendMap: Record<string, { total: number; count: number; breached: number }> = {};

    tickets.forEach(ticket => {
      if (ticket.firstResponseAt) {
        const hours = (ticket.firstResponseAt.getTime() - ticket.createdAt.getTime()) / (1000 * 60 * 60);

        // By priority
        if (!byPriority[ticket.priority]) {
          byPriority[ticket.priority] = { total: 0, count: 0 };
        }
        byPriority[ticket.priority].total += hours;
        byPriority[ticket.priority].count++;

        // Trend by week
        const weekStart = new Date(ticket.createdAt);
        weekStart.setDate(weekStart.getDate() - weekStart.getDay());
        const weekKey = weekStart.toISOString().slice(0, 10);

        if (!trendMap[weekKey]) {
          trendMap[weekKey] = { total: 0, count: 0, breached: 0 };
        }
        trendMap[weekKey].total += hours;
        trendMap[weekKey].count++;
        if (ticket.frtBreached) {
          trendMap[weekKey].breached++;
        }
      }
    });

    // Calculate averages by priority
    const avgByPriority: Record<string, number> = {};
    priorities.forEach(p => {
      if (byPriority[p] && byPriority[p].count > 0) {
        avgByPriority[p] = Number((byPriority[p].total / byPriority[p].count).toFixed(2));
      } else {
        avgByPriority[p] = 0;
      }
    });

    // Calculate overall average
    const overall = ticketsWithResponse.length > 0
      ? Number((ticketsWithResponse.reduce((sum, t) => {
          return sum + (t.firstResponseAt!.getTime() - t.createdAt.getTime()) / (1000 * 60 * 60);
        }, 0) / ticketsWithResponse.length).toFixed(2))
      : 0;

    // Build trend array
    const trend = Object.entries(trendMap)
      .map(([period, data]) => ({
        period,
        avgHours: Number((data.total / data.count).toFixed(2)),
        breachedRate: Number(((data.breached / data.count) * 100).toFixed(2)),
      }))
      .sort((a, b) => a.period.localeCompare(b.period))
      .slice(-8);

    return {
      overall,
      byPriority: avgByPriority,
      breached,
      breachedRate: tickets.length > 0 ? Number(((breached / tickets.length) * 100).toFixed(2)) : 0,
      trend,
    };
  }

  /**
   * First Contact Resolution - percentage of tickets resolved without additional comments
   */
  private async calculateFirstContactResolution(tickets: any[]): Promise<{
    overall: number;
    byPriority: Record<string, number>;
    resolvedWithoutResponse: number;
    trend: { period: string; value: number }[];
  }> {
    const priorities = [TicketPriority.CRITICAL, TicketPriority.HIGH, TicketPriority.MEDIUM, TicketPriority.LOW];
    const resolvedTickets = tickets.filter(t => t.status === TicketStatus.RESOLVED || t.status === TicketStatus.CLOSED);

    // Get comment counts for resolved tickets
    const ticketIds = resolvedTickets.map(t => t.id);
    const commentCounts = await this.prisma.comment.groupBy({
      by: ['ticketId'],
      where: { ticketId: { in: ticketIds } },
      _count: { ticketId: true },
    });

    const commentMap = new Map(commentCounts.map(c => [c.ticketId, c._count.ticketId]));

    // FCR = tickets with only 1 comment (the auto-created one) or no comments
    let resolvedWithoutResponse = 0;
    const byPriority: Record<string, { fcr: number; total: number }> = {};

    resolvedTickets.forEach(ticket => {
      const commentCount = commentMap.get(ticket.id) || 0;

      // If ticket was assigned and resolved without additional comments from requester
      if (commentCount <= 1) {
        resolvedWithoutResponse++;
      }

      // By priority
      if (!byPriority[ticket.priority]) {
        byPriority[ticket.priority] = { fcr: 0, total: 0 };
      }
      byPriority[ticket.priority].total++;
      if (commentCount <= 1) {
        byPriority[ticket.priority].fcr++;
      }
    });

    // Calculate percentages by priority
    const byPriorityPercent: Record<string, number> = {};
    priorities.forEach(p => {
      if (byPriority[p] && byPriority[p].total > 0) {
        byPriorityPercent[p] = Number(((byPriority[p].fcr / byPriority[p].total) * 100).toFixed(2));
      } else {
        byPriorityPercent[p] = 0;
      }
    });

    // Calculate overall FCR
    const overall = resolvedTickets.length > 0
      ? Number(((resolvedWithoutResponse / resolvedTickets.length) * 100).toFixed(2))
      : 0;

    // For trend, we need to calculate by period - using createdAt for simplicity
    const trendMap: Record<string, { fcr: number; total: number }> = {};
    resolvedTickets.forEach(ticket => {
      const weekStart = new Date(ticket.createdAt);
      weekStart.setDate(weekStart.getDate() - weekStart.getDay());
      const weekKey = weekStart.toISOString().slice(0, 10);

      if (!trendMap[weekKey]) {
        trendMap[weekKey] = { fcr: 0, total: 0 };
      }
      trendMap[weekKey].total++;
      const commentCount = commentMap.get(ticket.id) || 0;
      if (commentCount <= 1) {
        trendMap[weekKey].fcr++;
      }
    });

    const trend = Object.entries(trendMap)
      .map(([period, data]) => ({
        period,
        value: Number(((data.fcr / data.total) * 100).toFixed(2)),
      }))
      .sort((a, b) => a.period.localeCompare(b.period))
      .slice(-8);

    return {
      overall,
      byPriority: byPriorityPercent,
      resolvedWithoutResponse,
      trend,
    };
  }

  /**
   * SLA Compliance calculation
   */
  private calculateSLACompliance(tickets: any[]): {
    frtCompliance: number;
    frtBreached: number;
    resolutionCompliance: number;
    resolutionBreached: number;
    byPriority: Record<string, { frt: number; resolution: number }>;
  } {
    const priorities = [TicketPriority.CRITICAL, TicketPriority.HIGH, TicketPriority.MEDIUM, TicketPriority.LOW];
    const byPriority: Record<string, { frt: { met: number; breached: number }; resolution: { met: number; breached: number } }> = {};

    priorities.forEach(p => {
      byPriority[p] = {
        frt: { met: 0, breached: 0 },
        resolution: { met: 0, breached: 0 },
      };
    });

    let frtBreached = 0;
    let resolutionBreached = 0;

    tickets.forEach(ticket => {
      // FRT compliance
      if (ticket.frtBreached) {
        frtBreached++;
      }

      // Resolution compliance
      if (ticket.slaBreached && (ticket.status === TicketStatus.RESOLVED || ticket.status === TicketStatus.CLOSED)) {
        resolutionBreached++;
      }

      // By priority
      if (byPriority[ticket.priority]) {
        if (ticket.frtBreached) {
          byPriority[ticket.priority].frt.breached++;
        } else {
          byPriority[ticket.priority].frt.met++;
        }

        if (ticket.status === TicketStatus.RESOLVED || ticket.status === TicketStatus.CLOSED) {
          if (ticket.slaBreached) {
            byPriority[ticket.priority].resolution.breached++;
          } else {
            byPriority[ticket.priority].resolution.met++;
          }
        }
      }
    });

    // Calculate percentages by priority
    const byPriorityPercent: Record<string, { frt: number; resolution: number }> = {};
    priorities.forEach(p => {
      const frtTotal = byPriority[p].frt.met + byPriority[p].frt.breached;
      const resTotal = byPriority[p].resolution.met + byPriority[p].resolution.breached;

      byPriorityPercent[p] = {
        frt: frtTotal > 0 ? Number(((byPriority[p].frt.met / frtTotal) * 100).toFixed(2)) : 100,
        resolution: resTotal > 0 ? Number(((byPriority[p].resolution.met / resTotal) * 100).toFixed(2)) : 100,
      };
    });

    return {
      frtCompliance: tickets.length > 0 ? Number((((tickets.length - frtBreached) / tickets.length) * 100).toFixed(2)) : 100,
      frtBreached,
      resolutionCompliance: tickets.length > 0 ? Number((((tickets.length - resolutionBreached) / tickets.length) * 100).toFixed(2)) : 100,
      resolutionBreached,
      byPriority: byPriorityPercent,
    };
  }
}
