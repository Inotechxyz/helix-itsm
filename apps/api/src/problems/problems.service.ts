import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../common/prisma.service';
import {
  CreateProblemDto,
  UpdateProblemDto,
  LinkIncidentDto,
  CreateRCADto,
  UpdateRCADto,
  CreateKnownErrorDto,
  UpdateKnownErrorDto,
  ProblemQueryDto,
} from './dto/problem.dto';
import { Prisma } from '@prisma/client';

@Injectable()
export class ProblemsService {
  constructor(private prisma: PrismaService) {}

  // ============ Problems ============

  async findAll(query: ProblemQueryDto, organizationId?: string) {
    const {
      page = 1,
      limit = 20,
      status,
      priority,
      assignedToId,
      search,
      sortBy = 'createdAt',
      sortOrder = 'desc',
    } = query;

    const where: Prisma.ProblemWhereInput = {};

    if (organizationId) {
      where.organizationId = organizationId;
    }

    if (status && status.length > 0) {
      where.status = { in: status as any };
    }

    if (priority && priority.length > 0) {
      where.priority = { in: priority as any };
    }

    if (assignedToId) {
      where.assignedToId = assignedToId;
    }

    if (search) {
      where.OR = [
        { title: { contains: search, mode: 'insensitive' } },
        { description: { contains: search, mode: 'insensitive' } },
        { problemNumber: { contains: search, mode: 'insensitive' } },
      ];
    }

    const [items, total] = await Promise.all([
      this.prisma.problem.findMany({
        where,
        include: {
          incidents: {
            include: {
              ticket: {
                select: {
                  id: true,
                  ticketNumber: true,
                  title: true,
                  status: true,
                  priority: true,
                },
              },
            },
          },
          rootCauses: true,
          knownError: true,
          _count: {
            select: {
              incidents: true,
              rootCauses: true,
            },
          },
        },
        skip: (page - 1) * limit,
        take: limit,
        orderBy: { [sortBy]: sortOrder },
      }),
      this.prisma.problem.count({ where }),
    ]);

    return {
      items,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  async findById(id: string, organizationId?: string) {
    const where: any = { id };
    if (organizationId) {
      where.organizationId = organizationId;
    }
    const problem = await this.prisma.problem.findFirst({
      where,
      include: {
        incidents: {
          include: {
            ticket: {
              select: {
                id: true,
                ticketNumber: true,
                title: true,
                status: true,
                priority: true,
                requester: {
                  select: { id: true, firstName: true, lastName: true, email: true },
                },
              },
            },
          },
        },
        rootCauses: {
          orderBy: { createdAt: 'desc' },
        },
        knownError: true,
      },
    });

    if (!problem) {
      throw new NotFoundException('Problem not found');
    }

    return problem;
  }

  async findByNumber(problemNumber: string, organizationId?: string) {
    const where: any = { problemNumber };
    if (organizationId) {
      where.organizationId = organizationId;
    }
    const problem = await this.prisma.problem.findFirst({
      where,
      include: {
        incidents: {
          include: {
            ticket: true,
          },
        },
        rootCauses: true,
        knownError: true,
      },
    });

    if (!problem) {
      throw new NotFoundException('Problem not found');
    }

    return problem;
  }

  async create(dto: CreateProblemDto, organizationId?: string) {
    // Generate problem number
    const where: any = {};
    if (organizationId) {
      where.organizationId = organizationId;
    }
    const count = await this.prisma.problem.count({ where });
    const problemNumber = `PRB-${String(count + 1).padStart(6, '0')}`;

    const data: Prisma.ProblemCreateInput = {
      problemNumber,
      title: dto.title,
      description: dto.description,
      status: dto.status || 'new',
      priority: (dto.priority as any) || 'medium',
      impact: (dto.impact as any) || 'moderate',
      category: dto.category,
      assignedToId: dto.assignedToId,
      organization: organizationId ? { connect: { id: organizationId } } : undefined,
    };

    return this.prisma.problem.create({ data });
  }

  async update(id: string, dto: UpdateProblemDto, organizationId?: string) {
    await this.findById(id, organizationId);

    const updateData: Prisma.ProblemUpdateInput = {
      title: dto.title,
      description: dto.description,
      category: dto.category,
    };

    if (dto.status) {
      updateData.status = dto.status;

      // Set resolved/closed timestamps
      if (dto.status === 'resolved') {
        updateData.resolvedAt = new Date();
      } else if (dto.status === 'closed') {
        updateData.closedAt = new Date();
      }
    }

    if (dto.priority) {
      updateData.priority = dto.priority as any;
    }

    if (dto.impact) {
      updateData.impact = dto.impact as any;
    }

    if (dto.assignedToId !== undefined) {
      updateData.assignedToId = dto.assignedToId || null;
    }

    // Remove undefined values
    Object.keys(updateData).forEach((key) => {
      if ((updateData as any)[key] === undefined) {
        delete (updateData as any)[key];
      }
    });

    return this.prisma.problem.update({
      where: { id },
      data: updateData,
    });
  }

  async delete(id: string, organizationId?: string) {
    await this.findById(id, organizationId);
    return this.prisma.problem.delete({ where: { id } });
  }

  // ============ Incident Linking ============

  async linkIncident(problemId: string, dto: LinkIncidentDto, organizationId?: string) {
    // Verify problem exists
    await this.findById(problemId, organizationId);

    // Verify ticket exists
    const where: any = { id: dto.ticketId };
    if (organizationId) {
      where.organizationId = organizationId;
    }
    const ticket = await this.prisma.ticket.findFirst({
      where,
    });
    if (!ticket) {
      throw new NotFoundException('Ticket not found');
    }

    // Check if already linked
    const existing = await this.prisma.problemIncident.findUnique({
      where: {
        problemId_ticketId: {
          problemId,
          ticketId: dto.ticketId,
        },
      },
    });

    if (existing) {
      return existing;
    }

    return this.prisma.problemIncident.create({
      data: {
        problemId,
        ticketId: dto.ticketId,
        impactLevel: dto.impactLevel,
      },
      include: {
        ticket: {
          select: {
            id: true,
            ticketNumber: true,
            title: true,
            status: true,
          },
        },
      },
    });
  }

  async unlinkIncident(problemId: string, ticketId: string, organizationId?: string) {
    // Verify problem exists first
    await this.findById(problemId, organizationId);

    return this.prisma.problemIncident.delete({
      where: {
        problemId_ticketId: {
          problemId,
          ticketId,
        },
      },
    });
  }

  async getLinkedTickets(problemId: string, organizationId?: string) {
    await this.findById(problemId, organizationId);

    const links = await this.prisma.problemIncident.findMany({
      where: { problemId },
      include: {
        ticket: {
          select: {
            id: true,
            ticketNumber: true,
            title: true,
            status: true,
            priority: true,
            createdAt: true,
            resolvedAt: true,
            requester: {
              select: { firstName: true, lastName: true },
            },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    return links.map((link) => ({
      ...link.ticket,
      linkedAt: link.createdAt,
      impactLevel: link.impactLevel,
    }));
  }

  // ============ Root Cause Analysis ============

  async findRCAs(problemId: string, organizationId?: string) {
    await this.findById(problemId, organizationId);
    return this.prisma.rootCauseAnalysis.findMany({
      where: { problemId },
      orderBy: { createdAt: 'desc' },
    });
  }

  async createRCA(problemId: string, dto: CreateRCADto, organizationId?: string) {
    await this.findById(problemId, organizationId);

    return this.prisma.rootCauseAnalysis.create({
      data: {
        problemId,
        analysisType: dto.analysisType as any || 'root_cause',
        title: dto.title,
        description: dto.description,
        cause: dto.cause,
        impact: dto.impact,
        solution: dto.solution,
      },
    });
  }

  async updateRCA(id: string, dto: UpdateRCADto, organizationId?: string) {
    const where: any = { id };
    if (organizationId) {
      where.problem = { organizationId };
    }
    const rca = await this.prisma.rootCauseAnalysis.findFirst({
      where,
      include: { problem: true },
    });

    if (!rca) {
      throw new NotFoundException('RCA record not found');
    }

    return this.prisma.rootCauseAnalysis.update({
      where: { id },
      data: {
        analysisType: dto.analysisType as any,
        title: dto.title,
        description: dto.description,
        cause: dto.cause,
        impact: dto.impact,
        solution: dto.solution,
      },
    });
  }

  async deleteRCA(id: string, organizationId?: string) {
    const where: any = { id };
    if (organizationId) {
      where.problem = { organizationId };
    }
    const rca = await this.prisma.rootCauseAnalysis.findFirst({
      where,
    });

    if (!rca) {
      throw new NotFoundException('RCA record not found');
    }

    return this.prisma.rootCauseAnalysis.delete({ where: { id } });
  }

  // ============ Known Error Database ============

  async getKnownError(problemId: string, organizationId?: string) {
    await this.findById(problemId, organizationId);
    return this.prisma.knownError.findUnique({
      where: { problemId },
    });
  }

  async createKnownError(problemId: string, dto: CreateKnownErrorDto, organizationId?: string) {
    await this.findById(problemId, organizationId);

    // Check if already exists
    const existing = await this.prisma.knownError.findUnique({
      where: { problemId },
    });

    if (existing) {
      throw new Error('Known error record already exists for this problem');
    }

    return this.prisma.knownError.create({
      data: {
        problemId,
        errorCode: dto.errorCode,
        symptoms: dto.symptoms,
        workaround: dto.workaround,
        knownSolution: dto.knownSolution,
        kbArticleId: dto.kbArticleId,
      },
    });
  }

  async updateKnownError(id: string, dto: UpdateKnownErrorDto, organizationId?: string) {
    const where: any = { id };
    if (organizationId) {
      where.problem = { organizationId };
    }
    const knownError = await this.prisma.knownError.findFirst({
      where,
      include: { problem: true },
    });

    if (!knownError) {
      throw new NotFoundException('Known error record not found');
    }

    return this.prisma.knownError.update({
      where: { id },
      data: {
        errorCode: dto.errorCode,
        symptoms: dto.symptoms,
        workaround: dto.workaround,
        knownSolution: dto.knownSolution,
        kbArticleId: dto.kbArticleId,
        status: dto.status,
      },
    });
  }

  async deleteKnownError(id: string, organizationId?: string) {
    const where: any = { id };
    if (organizationId) {
      where.problem = { organizationId };
    }
    const knownError = await this.prisma.knownError.findFirst({
      where,
    });

    if (!knownError) {
      throw new NotFoundException('Known error record not found');
    }

    return this.prisma.knownError.delete({ where: { id } });
  }

  async getAllKnownErrors(status?: string, organizationId?: string) {
    const where: Prisma.KnownErrorWhereInput = {};

    if (status) {
      where.status = status as any;
    }

    if (organizationId) {
      where.problem = { organizationId };
    }

    return this.prisma.knownError.findMany({
      where,
      include: {
        problem: {
          select: {
            id: true,
            problemNumber: true,
            title: true,
            status: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  // ============ Statistics ============

  async getStats(organizationId?: string) {
    const where: any = {};
    if (organizationId) {
      where.organizationId = organizationId;
    }

    const knownErrorWhere: any = {};
    if (organizationId) {
      knownErrorWhere.problem = { organizationId };
    }

    const [
      totalProblems,
      openProblems,
      resolvedProblems,
      closedProblems,
      withKnownErrors,
    ] = await Promise.all([
      this.prisma.problem.count({ where }),
      this.prisma.problem.count({
        where: { ...where, status: { notIn: ['resolved', 'closed'] } },
      }),
      this.prisma.problem.count({
        where: { ...where, status: 'resolved' },
      }),
      this.prisma.problem.count({
        where: { ...where, status: 'closed' },
      }),
      this.prisma.knownError.count({
        where: { status: 'active', ...knownErrorWhere },
      }),
    ]);

    const byStatus = await this.prisma.problem.groupBy({
      by: ['status'],
      where,
      _count: { status: true },
    });

    const byPriority = await this.prisma.problem.groupBy({
      by: ['priority'],
      where: { ...where, status: { notIn: ['resolved', 'closed'] } },
      _count: { priority: true },
    });

    return {
      total: totalProblems,
      open: openProblems,
      resolved: resolvedProblems,
      closed: closedProblems,
      activeKnownErrors: withKnownErrors,
      byStatus: byStatus.map((item) => ({
        status: item.status,
        count: item._count.status,
      })),
      byPriority: byPriority.map((item) => ({
        priority: item.priority,
        count: item._count.priority,
      })),
    };
  }
}
