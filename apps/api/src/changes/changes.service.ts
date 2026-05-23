import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../common/prisma.service';
import {
  CreateChangeRequestDto,
  UpdateChangeRequestDto,
  ChangeQueryDto,
  LinkAssetDto,
  LinkTicketDto,
  LinkProblemDto,
  CreateRiskAssessmentDto,
  UpdateRiskAssessmentDto,
  ApprovalDto,
  RejectionDto,
  CreateCABMeetingDto,
  UpdateCABMeetingDto,
  AddAgendaItemDto,
} from './dto/change.dto';
import { Prisma } from '@prisma/client';

@Injectable()
export class ChangesService {
  constructor(private prisma: PrismaService) {}

  // ============ Change Requests ============

  async findAll(query: ChangeQueryDto, organizationId?: string) {
    const {
      page = 1,
      limit = 20,
      status,
      type,
      priority,
      assignedToId,
      search,
      sortBy = 'createdAt',
      sortOrder = 'desc',
    } = query;

    const where: Prisma.ChangeRequestWhereInput = {};

    if (organizationId) {
      where.organizationId = organizationId;
    }

    if (status && status.length > 0) {
      where.status = { in: status as any };
    }

    if (type && type.length > 0) {
      where.type = { in: type as any };
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
        { changeNumber: { contains: search, mode: 'insensitive' } },
      ];
    }

    const [items, total] = await Promise.all([
      this.prisma.changeRequest.findMany({
        where,
        include: {
          requester: {
            select: { id: true, firstName: true, lastName: true, email: true },
          },
          assignee: {
            select: { id: true, firstName: true, lastName: true, email: true },
          },
          riskAssessment: true,
          affectedAssets: {
            include: {
              asset: {
                select: { id: true, name: true, assetTag: true },
              },
            },
          },
          linkedTickets: {
            include: {
              ticket: {
                select: { id: true, ticketNumber: true, title: true },
              },
            },
          },
          linkedProblems: {
            include: {
              problem: {
                select: { id: true, problemNumber: true, title: true },
              },
            },
          },
          approvals: {
            include: {
              // approver info
            },
          },
          _count: {
            select: {
              affectedAssets: true,
              linkedTickets: true,
              linkedProblems: true,
            },
          },
        },
        skip: (page - 1) * limit,
        take: limit,
        orderBy: { [sortBy]: sortOrder },
      }),
      this.prisma.changeRequest.count({ where }),
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
    const change = await this.prisma.changeRequest.findFirst({
      where,
      include: {
        requester: {
          select: { id: true, firstName: true, lastName: true, email: true },
        },
        assignee: {
          select: { id: true, firstName: true, lastName: true, email: true },
        },
        approver: {
          select: { id: true, firstName: true, lastName: true, email: true },
        },
        rejector: {
          select: { id: true, firstName: true, lastName: true, email: true },
        },
        riskAssessment: true,
        affectedAssets: {
          include: {
            asset: true,
          },
        },
        linkedTickets: {
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
        linkedProblems: {
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
        },
        approvals: true,
      },
    });

    if (!change) {
      throw new NotFoundException('Change request not found');
    }

    return change;
  }

  async findByNumber(changeNumber: string, organizationId?: string) {
    const where: any = { changeNumber };
    if (organizationId) {
      where.organizationId = organizationId;
    }
    const change = await this.prisma.changeRequest.findFirst({
      where,
      include: {
        requester: true,
        assignee: true,
        riskAssessment: true,
        affectedAssets: {
          include: { asset: true },
        },
        linkedTickets: {
          include: { ticket: true },
        },
        linkedProblems: {
          include: { problem: true },
        },
        approvals: true,
      },
    });

    if (!change) {
      throw new NotFoundException('Change request not found');
    }

    return change;
  }

  async create(dto: CreateChangeRequestDto, userId?: string, organizationId?: string) {
    // Generate change number
    const where: any = {};
    if (organizationId) {
      where.organizationId = organizationId;
    }
    const count = await this.prisma.changeRequest.count({ where });
    const changeNumber = `CHG-${String(count + 1).padStart(6, '0')}`;

    const data: Prisma.ChangeRequestCreateInput = {
      changeNumber,
      title: dto.title,
      description: dto.description,
      type: dto.type,
      priority: (dto.priority as any) || 'medium',
      risk: (dto.risk as any) || 'low',
      justification: dto.justification,
      implementationPlan: dto.implementationPlan,
      rollbackPlan: dto.rollbackPlan,
      scheduledStartDate: dto.scheduledStartDate ? new Date(dto.scheduledStartDate) : null,
      scheduledEndDate: dto.scheduledEndDate ? new Date(dto.scheduledEndDate) : null,
      organization: organizationId ? { connect: { id: organizationId } } : undefined,
    };

    if (dto.category) {
      data.changeCategory = { connect: { id: dto.category } };
    }

    if (dto.assignedToId) {
      data.assignee = { connect: { id: dto.assignedToId } };
    }

    if (userId) {
      data.requester = { connect: { id: userId } };
    }

    return this.prisma.changeRequest.create({ data });
  }

  async update(id: string, dto: UpdateChangeRequestDto, organizationId?: string) {
    await this.findById(id, organizationId);

    const updateData: Prisma.ChangeRequestUpdateInput = {
      title: dto.title,
      description: dto.description,
      justification: dto.justification,
      implementationPlan: dto.implementationPlan,
      rollbackPlan: dto.rollbackPlan,
      cabReviewed: dto.cabReviewed,
      closureNotes: dto.closureNotes,
    };

    if (dto.category) {
      updateData.changeCategory = { connect: { id: dto.category } };
    }

    if (dto.type) {
      updateData.type = dto.type;
    }

    if (dto.status) {
      updateData.status = dto.status;

      // Handle status-specific timestamps
      if (dto.status === 'approved') {
        updateData.approvedAt = new Date();
      } else if (dto.status === 'rejected') {
        updateData.rejectedAt = new Date();
      } else if (dto.status === 'in_progress') {
        updateData.actualStartDate = new Date();
      } else if (dto.status === 'completed') {
        updateData.actualEndDate = new Date();
      }
    }

    if (dto.priority) {
      updateData.priority = dto.priority as any;
    }

    if (dto.risk) {
      updateData.risk = dto.risk as any;
    }

    if (dto.assignedToId !== undefined) {
      updateData.assignee = dto.assignedToId
        ? { connect: { id: dto.assignedToId } }
        : { disconnect: true };
    }

    if (dto.scheduledStartDate) {
      updateData.scheduledStartDate = new Date(dto.scheduledStartDate);
    }

    if (dto.scheduledEndDate) {
      updateData.scheduledEndDate = new Date(dto.scheduledEndDate);
    }

    // Remove undefined values
    Object.keys(updateData).forEach((key) => {
      if ((updateData as any)[key] === undefined) {
        delete (updateData as any)[key];
      }
    });

    return this.prisma.changeRequest.update({
      where: { id },
      data: updateData,
    });
  }

  async delete(id: string, organizationId?: string) {
    await this.findById(id, organizationId);
    return this.prisma.changeRequest.delete({ where: { id } });
  }

  async submit(id: string, userId?: string, organizationId?: string) {
    await this.findById(id, organizationId);
    return this.prisma.changeRequest.update({
      where: { id },
      data: {
        status: 'submitted',
        ...(userId ? { requester: { connect: { id: userId } } } : {}),
      },
    });
  }

  // ============ Approval Workflow ============

  async approve(id: string, dto: ApprovalDto, approverId?: string, organizationId?: string) {
    await this.findById(id, organizationId);

    const updateData: Prisma.ChangeRequestUpdateInput = {
      status: 'approved',
      approvedAt: new Date(),
    };

    if (approverId) {
      updateData.approver = { connect: { id: approverId } };
    }

    return this.prisma.changeRequest.update({
      where: { id },
      data: updateData,
    });
  }

  async reject(id: string, dto: RejectionDto, rejectorId?: string, organizationId?: string) {
    await this.findById(id, organizationId);

    const updateData: Prisma.ChangeRequestUpdateInput = {
      status: 'rejected',
      rejectedAt: new Date(),
      rejectedReason: dto.reason,
    };

    if (rejectorId) {
      updateData.rejector = { connect: { id: rejectorId } };
    }

    return this.prisma.changeRequest.update({
      where: { id },
      data: updateData,
    });
  }

  // ============ Asset Linking ============

  async linkAsset(changeId: string, dto: LinkAssetDto, organizationId?: string) {
    await this.findById(changeId, organizationId);

    // Check if asset exists
    const where: any = { id: dto.assetId };
    if (organizationId) {
      where.organizationId = organizationId;
    }
    const asset = await this.prisma.asset.findFirst({ where });
    if (!asset) {
      throw new NotFoundException('Asset not found');
    }

    // Check if already linked
    const existing = await this.prisma.changeAffectedAsset.findUnique({
      where: {
        changeRequestId_assetId: {
          changeRequestId: changeId,
          assetId: dto.assetId,
        },
      },
    });

    if (existing) {
      return existing;
    }

    return this.prisma.changeAffectedAsset.create({
      data: {
        changeRequest: { connect: { id: changeId } },
        asset: { connect: { id: dto.assetId } },
        impact: dto.impact,
        description: dto.description,
      },
    });
  }

  async unlinkAsset(changeId: string, assetId: string) {
    return this.prisma.changeAffectedAsset.delete({
      where: {
        changeRequestId_assetId: {
          changeRequestId: changeId,
          assetId,
        },
      },
    });
  }

  // ============ Ticket Linking ============

  async linkTicket(changeId: string, dto: LinkTicketDto, organizationId?: string) {
    await this.findById(changeId, organizationId);

    // Check if ticket exists
    const where: any = { id: dto.ticketId };
    if (organizationId) {
      where.organizationId = organizationId;
    }
    const ticket = await this.prisma.ticket.findFirst({ where });
    if (!ticket) {
      throw new NotFoundException('Ticket not found');
    }

    // Check if already linked
    const existing = await this.prisma.changeLinkedTicket.findUnique({
      where: {
        changeRequestId_ticketId: {
          changeRequestId: changeId,
          ticketId: dto.ticketId,
        },
      },
    });

    if (existing) {
      return existing;
    }

    return this.prisma.changeLinkedTicket.create({
      data: {
        changeRequest: { connect: { id: changeId } },
        ticket: { connect: { id: dto.ticketId } },
        reason: dto.reason,
      },
    });
  }

  async unlinkTicket(changeId: string, ticketId: string) {
    return this.prisma.changeLinkedTicket.delete({
      where: {
        changeRequestId_ticketId: {
          changeRequestId: changeId,
          ticketId,
        },
      },
    });
  }

  // ============ Problem Linking ============

  async linkProblem(changeId: string, dto: LinkProblemDto, organizationId?: string) {
    await this.findById(changeId, organizationId);

    // Check if problem exists
    const where: any = { id: dto.problemId };
    if (organizationId) {
      where.organizationId = organizationId;
    }
    const problem = await this.prisma.problem.findFirst({ where });
    if (!problem) {
      throw new NotFoundException('Problem not found');
    }

    // Check if already linked
    const existing = await this.prisma.changeLinkedProblem.findUnique({
      where: {
        changeRequestId_problemId: {
          changeRequestId: changeId,
          problemId: dto.problemId,
        },
      },
    });

    if (existing) {
      return existing;
    }

    return this.prisma.changeLinkedProblem.create({
      data: {
        changeRequest: { connect: { id: changeId } },
        problem: { connect: { id: dto.problemId } },
        reason: dto.reason,
      },
    });
  }

  async unlinkProblem(changeId: string, problemId: string) {
    return this.prisma.changeLinkedProblem.delete({
      where: {
        changeRequestId_problemId: {
          changeRequestId: changeId,
          problemId,
        },
      },
    });
  }

  // ============ Risk Assessment ============

  async createRiskAssessment(changeId: string, dto: CreateRiskAssessmentDto, organizationId?: string) {
    await this.findById(changeId, organizationId);

    // Check if already exists
    const existing = await this.prisma.riskAssessment.findUnique({
      where: { changeRequestId: changeId },
    });

    if (existing) {
      throw new Error('Risk assessment already exists for this change request');
    }

    return this.prisma.riskAssessment.create({
      data: {
        changeRequest: { connect: { id: changeId } },
        riskLevel: dto.riskLevel,
        impactLevel: dto.impactLevel,
        probability: dto.probability,
        riskDescription: dto.riskDescription,
        mitigationSteps: dto.mitigationSteps,
        contingencyPlan: dto.contingencyPlan,
        riskOwner: dto.riskOwner,
      },
    });
  }

  async updateRiskAssessment(changeId: string, dto: UpdateRiskAssessmentDto, organizationId?: string) {
    await this.findById(changeId, organizationId);

    const assessment = await this.prisma.riskAssessment.findUnique({
      where: { changeRequestId: changeId },
    });

    if (!assessment) {
      throw new NotFoundException('Risk assessment not found');
    }

    return this.prisma.riskAssessment.update({
      where: { changeRequestId: changeId },
      data: {
        riskLevel: dto.riskLevel as any,
        impactLevel: dto.impactLevel,
        probability: dto.probability,
        riskDescription: dto.riskDescription,
        mitigationSteps: dto.mitigationSteps,
        contingencyPlan: dto.contingencyPlan,
        riskOwner: dto.riskOwner,
      },
    });
  }

  // ============ Statistics ============

  async getStats(organizationId?: string) {
    const where: any = {};
    if (organizationId) {
      where.organizationId = organizationId;
    }

    const [
      totalChanges,
      pendingChanges,
      approvedChanges,
      rejectedChanges,
      inProgressChanges,
      completedChanges,
      byType,
      byPriority,
      upcomingSchedules,
    ] = await Promise.all([
      this.prisma.changeRequest.count({ where }),
      this.prisma.changeRequest.count({
        where: { ...where, status: { in: ['submitted', 'pending_approval'] } },
      }),
      this.prisma.changeRequest.count({
        where: { ...where, status: 'approved' },
      }),
      this.prisma.changeRequest.count({
        where: { ...where, status: 'rejected' },
      }),
      this.prisma.changeRequest.count({
        where: { ...where, status: 'in_progress' },
      }),
      this.prisma.changeRequest.count({
        where: { ...where, status: { in: ['completed', 'closed'] } },
      }),
      this.prisma.changeRequest.groupBy({
        by: ['type'],
        where,
        _count: { type: true },
      }),
      this.prisma.changeRequest.groupBy({
        by: ['priority'],
        where,
        _count: { priority: true },
      }),
      this.prisma.changeRequest.findMany({
        where: {
          ...where,
          status: { in: ['approved', 'scheduled'] },
          scheduledStartDate: { gte: new Date() },
        },
        select: {
          id: true,
          changeNumber: true,
          title: true,
          type: true,
          scheduledStartDate: true,
          scheduledEndDate: true,
        },
        orderBy: { scheduledStartDate: 'asc' },
        take: 10,
      }),
    ]);

    return {
      total: totalChanges,
      pending: pendingChanges,
      approved: approvedChanges,
      rejected: rejectedChanges,
      inProgress: inProgressChanges,
      completed: completedChanges,
      byType: byType.map((item) => ({
        type: item.type,
        count: item._count.type,
      })),
      byPriority: byPriority.map((item) => ({
        priority: item.priority,
        count: item._count.priority,
      })),
      upcomingSchedules,
    };
  }

  // ============ CAB Meetings ============

  async getCABMeetings(status?: string, organizationId?: string) {
    const where: Prisma.CABMeetingWhereInput = {};

    if (organizationId) {
      where.organizationId = organizationId;
    }

    if (status) {
      where.status = status as any;
    }

    return this.prisma.cABMeeting.findMany({
      where,
      include: {
        agendaItems: {
          orderBy: { orderIndex: 'asc' },
        },
      },
      orderBy: { scheduledAt: 'desc' },
    });
  }

  async getCABMeetingById(id: string, organizationId?: string) {
    const where: any = { id };
    if (organizationId) {
      where.organizationId = organizationId;
    }
    const meeting = await this.prisma.cABMeeting.findFirst({
      where,
      include: {
        agendaItems: {
          orderBy: { orderIndex: 'asc' },
          include: {
            // Include change request details if linked
          },
        },
      },
    });

    if (!meeting) {
      throw new NotFoundException('CAB meeting not found');
    }

    return meeting;
  }

  async createCABMeeting(dto: CreateCABMeetingDto, organizationId?: string) {
    return this.prisma.cABMeeting.create({
      data: {
        title: dto.title,
        description: dto.description,
        scheduledAt: new Date(dto.scheduledAt),
        location: dto.location,
        organizationId,
      },
    });
  }

  async updateCABMeeting(id: string, dto: UpdateCABMeetingDto, organizationId?: string) {
    const where: any = { id };
    if (organizationId) {
      where.organizationId = organizationId;
    }
    const meeting = await this.prisma.cABMeeting.findFirst({ where });

    if (!meeting) {
      throw new NotFoundException('CAB meeting not found');
    }

    return this.prisma.cABMeeting.update({
      where: { id },
      data: {
        title: dto.title,
        description: dto.description,
        scheduledAt: dto.scheduledAt ? new Date(dto.scheduledAt) : undefined,
        location: dto.location,
        status: dto.status as any,
        notes: dto.notes,
        decisions: dto.decisions,
      },
    });
  }

  async deleteCABMeeting(id: string, organizationId?: string) {
    const where: any = { id };
    if (organizationId) {
      where.organizationId = organizationId;
    }
    const meeting = await this.prisma.cABMeeting.findFirst({ where });

    if (!meeting) {
      throw new NotFoundException('CAB meeting not found');
    }

    return this.prisma.cABMeeting.delete({ where: { id } });
  }

  async addAgendaItem(meetingId: string, dto: AddAgendaItemDto, organizationId?: string) {
    const where: any = { id: meetingId };
    if (organizationId) {
      where.organizationId = organizationId;
    }
    const meeting = await this.prisma.cABMeeting.findFirst({
      where,
      include: { agendaItems: true },
    });

    if (!meeting) {
      throw new NotFoundException('CAB meeting not found');
    }

    const maxOrder = meeting.agendaItems.reduce((max, item) => Math.max(max, item.orderIndex), -1);

    return this.prisma.cABMeeting.update({
      where: { id: meetingId },
      data: {
        agendaItems: {
          create: {
            title: dto.title,
            description: dto.description,
            presenter: dto.presenter,
            duration: dto.duration,
            changeRequestId: dto.changeRequestId,
            orderIndex: dto.changeRequestId ? maxOrder + 1 : 0,
          },
        },
      },
      include: {
        agendaItems: {
          orderBy: { orderIndex: 'asc' },
        },
      },
    });
  }

  async removeAgendaItem(meetingId: string, agendaItemId: string, organizationId?: string) {
    const where: any = { id: meetingId };
    if (organizationId) {
      where.organizationId = organizationId;
    }
    const meeting = await this.prisma.cABMeeting.findFirst({ where });

    if (!meeting) {
      throw new NotFoundException('CAB meeting not found');
    }

    return this.prisma.cABAgendaItem.delete({
      where: { id: agendaItemId },
    });
  }
}
