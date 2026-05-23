import { Injectable, NotFoundException, BadRequestException, Inject, forwardRef } from '@nestjs/common';
import { PrismaService } from '../common/prisma.service';
import { SlaService } from '../sla/sla.service';
import { EmailService } from '../email/email.service';
import {
  CreateTicketDto,
  UpdateTicketDto,
  AssignTicketDto,
  TransitionTicketDto,
  AddCommentDto,
  TicketQueryDto,
} from './dto/ticket.dto';
import { Prisma } from '@prisma/client';

const TicketStatus = {
  NEW: 'new',
  ASSIGNED: 'assigned',
  IN_PROGRESS: 'in_progress',
  PENDING: 'pending',
  RESOLVED: 'resolved',
  CLOSED: 'closed',
} as const;

const TicketPriority = {
  CRITICAL: 'critical',
  HIGH: 'high',
  MEDIUM: 'medium',
  LOW: 'low',
} as const;

@Injectable()
export class TicketsService {
  constructor(
    private prisma: PrismaService,
    @Inject(forwardRef(() => SlaService))
    private slaService: SlaService,
    @Inject(forwardRef(() => EmailService))
    private emailService: EmailService,
  ) {}

  async findAll(query: TicketQueryDto, userId?: string, userRole?: string, organizationId?: string) {
    console.log(`[TicketsService] findAll called: userId=${userId}, userRole=${userRole}, organizationId=${organizationId}`);

    const {
      page = 1,
      limit = 20,
      status,
      priority,
      type,
      channel,
      requesterId,
      assignedAgentId,
      assignedTeamId,
      categoryId,
      search,
      dateFrom,
      dateTo,
      sortBy = 'createdAt',
      sortOrder = 'desc',
    } = query;

    const where: Prisma.TicketWhereInput = {
      deletedAt: null,
    };

    // Add organization filter
    if (organizationId) {
      where.organizationId = organizationId;
    }

    // Status filter
    if (status && status.length > 0) {
      where.status = { in: status };
    }

    // Priority filter
    if (priority && priority.length > 0) {
      where.priority = { in: priority };
    }

    // Type filter
    if (type && type.length > 0) {
      where.type = { in: type };
    }

    // Channel filter
    if (channel && channel.length > 0) {
      where.channel = { in: channel };
    }

    // Requester filter
    if (requesterId) {
      where.requesterId = requesterId;
    }

    // Assigned agent filter
    if (assignedAgentId) {
      where.assignedAgentId = assignedAgentId;
    }

    // Assigned team filter
    if (assignedTeamId) {
      where.assignedTeamId = assignedTeamId;
    }

    // Category filter
    if (categoryId) {
      where.categoryId = categoryId;
    }

    // Search - create an array for search conditions
    const searchConditions: Prisma.TicketWhereInput[] = [];
    if (search) {
      searchConditions.push(
        { title: { contains: search, mode: 'insensitive' } },
        { description: { contains: search, mode: 'insensitive' } },
        { ticketNumber: { contains: search, mode: 'insensitive' } },
      );
    }

    // Date range
    if (dateFrom || dateTo) {
      where.createdAt = {};
      if (dateFrom) {
        where.createdAt.gte = new Date(dateFrom);
      }
      if (dateTo) {
        where.createdAt.lte = new Date(dateTo);
      }
    }

    // Role-based filtering
    console.log(`[TicketsService] Checking role-based filter: userRole=${userRole}, userId=${userId}`);
    if (userRole === 'agent' && !requesterId) {
      console.log(`[TicketsService] Applying agent filter for userId=${userId}`);
      const agentConditions: Prisma.TicketWhereInput[] = [
        { assignedAgentId: userId },
        { assignedTeam: { members: { some: { userId } } } },
      ];
      // Combine search conditions with agent conditions using AND
      if (searchConditions.length > 0) {
        where.AND = [
          { OR: agentConditions },
          { OR: searchConditions },
        ];
      } else {
        where.OR = agentConditions;
      }
    } else if (userRole === 'requester' && userId) {
      console.log(`[TicketsService] Applying requester filter for userId=${userId}`);
      where.requesterId = userId;
      // Add search conditions if present
      if (searchConditions.length > 0) {
        where.AND = searchConditions;
      }
    } else if (searchConditions.length > 0) {
      // No role-based filtering, just use search
      console.log(`[TicketsService] No role filter applied, only search conditions`);
      where.OR = searchConditions;
    } else {
      console.log(`[TicketsService] No role-based filter applied! userRole=${userRole}, requesterId=${requesterId}`);
    }

    console.log(`[TicketsService] Final where clause:`, JSON.stringify(where));

    const [tickets, total] = await Promise.all([
      this.prisma.ticket.findMany({
        where,
        include: {
          requester: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              email: true,
              avatarUrl: true,
            },
          },
          assignedAgent: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              email: true,
              avatarUrl: true,
            },
          },
          assignedTeam: {
            select: {
              id: true,
              name: true,
              type: true,
            },
          },
          category: {
            select: {
              id: true,
              name: true,
            },
          },
          linkedTicket: {
            select: {
              id: true,
              requestNumber: true,
            },
          },
          _count: {
            select: { comments: true, attachments: true },
          },
        },
        skip: (page - 1) * limit,
        take: limit,
        orderBy: { [sortBy]: sortOrder },
      }),
      this.prisma.ticket.count({ where }),
    ]);

    return {
      items: tickets,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  async findOne(id: string, organizationId?: string) {
    const where: Prisma.TicketWhereInput = { id };
    if (organizationId) {
      where.organizationId = organizationId;
    }

    const ticket = await this.prisma.ticket.findFirst({
      where,
      include: {
        requester: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
            avatarUrl: true,
            role: true,
          },
        },
        assignedAgent: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
            avatarUrl: true,
          },
        },
        assignedTeam: true,
        category: true,
        comments: {
          include: {
            author: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
                email: true,
                avatarUrl: true,
              },
            },
          },
          orderBy: { createdAt: 'asc' },
        },
        attachments: {
          include: {
            uploadedBy: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
              },
            },
          },
        },
        statusHistory: {
          orderBy: { createdAt: 'desc' },
        },
        linkedTicket: {
          select: {
            id: true,
            requestNumber: true,
          },
        },
        csatSurvey: {
          select: {
            id: true,
            status: true,
            rating: true,
            comment: true,
            completedAt: true,
          },
        },
      },
    });

    if (!ticket || ticket.deletedAt) {
      throw new NotFoundException('Ticket not found');
    }

    return ticket;
  }

  async findByTicketNumber(ticketNumber: string, organizationId?: string) {
    const where: Prisma.TicketWhereInput = { ticketNumber };
    if (organizationId) {
      where.organizationId = organizationId;
    }

    const ticket = await this.prisma.ticket.findFirst({
      where,
      include: {
        requester: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
            avatarUrl: true,
          },
        },
        assignedAgent: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
            avatarUrl: true,
          },
        },
        assignedTeam: true,
        category: true,
      },
    });

    if (!ticket || ticket.deletedAt) {
      throw new NotFoundException('Ticket not found');
    }

    return ticket;
  }

  async create(dto: CreateTicketDto, requesterId: string, organizationId: string) {
    // Get requester with tier information
    const requester = await this.prisma.user.findUnique({
      where: { id: requesterId },
      select: { tier: true },
    });

    // Find matching SLA policy within organization
    const slaPolicy = await this.slaService.findMatchingPolicy({
      priority: dto.priority,
      type: dto.type,
      categoryId: dto.categoryId,
      requester: { tier: requester?.tier },
      organizationId,
    });

    // Calculate SLA deadlines
    const createdAt = new Date();
    let slaDeadline: Date | undefined;
    let firstResponseDeadline: Date | undefined;

    if (slaPolicy) {
      const deadlines = this.slaService.calculateSlaDeadlines(
        {
          responseTimeHours: slaPolicy.responseTimeHours,
          resolutionTimeHours: slaPolicy.resolutionTimeHours,
        },
        createdAt,
      );
      slaDeadline = deadlines.resolutionDeadline;
      firstResponseDeadline = deadlines.firstResponseDeadline;
    } else {
      // Fallback to default priority-based SLA
      slaDeadline = this.calculateDefaultSlaDeadline(dto.priority);
    }

    // Use retry logic for ticket number generation to handle race conditions
    const prefix = dto.type === 'incident' ? 'INC' : 'SR';
    const maxRetries = 10;

    for (let attempt = 0; attempt < maxRetries; attempt++) {
      try {
        // Generate ticket number within a transaction
        const ticket = await this.prisma.$transaction(async (tx) => {
          // Find the highest ticket number for this type and organization
          const existingTickets = await tx.ticket.findMany({
            where: { type: dto.type, organizationId },
            select: { ticketNumber: true },
            orderBy: { createdAt: 'desc' }, // Use createdAt instead of ticketNumber for ordering
            take: 1,
          });

          let nextNumber = 1;
          if (existingTickets.length > 0) {
            // Extract the number from the last ticket (e.g., "INC-00005" -> 5)
            const lastTicketNumber = existingTickets[0].ticketNumber;
            // Match pattern: PREFIX-XXXXX where X is digits
            const match = lastTicketNumber.match(new RegExp(`^${prefix}-(\\d+)(?:-\\w+)?$`));
            if (match) {
              nextNumber = parseInt(match[1], 10) + 1;
            }
          }
          // Generate ticket number with a suffix to reduce collision risk
          const randomSuffix = Math.random().toString(36).substring(2, 6).toUpperCase();
          const ticketNumber = `${prefix}-${String(nextNumber).padStart(5, '0')}-${randomSuffix}`;

          // Verify the ticket number doesn't exist (double-check)
          const existing = await tx.ticket.findFirst({
            where: { ticketNumber, organizationId },
          });
          if (existing) {
            throw new Error(`Ticket number ${ticketNumber} already exists`);
          }

          // Build the data object
          const data: Prisma.TicketCreateInput = {
            ticketNumber,
            channel: 'manual',
            type: dto.type,
            title: dto.title,
            description: dto.description,
            priority: dto.priority,
            requester: { connect: { id: requesterId } },
            externalId: dto.externalId,
            slaDeadline,
            firstResponseDeadline,
            lastActivityAt: createdAt,
            organization: { connect: { id: organizationId } },
          };

          if (dto.categoryId && dto.categoryId.trim() !== '') {
            data.category = { connect: { id: dto.categoryId, organizationId } };
          }
          if (dto.assignedTeamId && dto.assignedTeamId.trim() !== '') {
            data.assignedTeam = { connect: { id: dto.assignedTeamId, organizationId } };
          }
          if (slaPolicy) {
            data.slaPolicy = { connect: { id: slaPolicy.id, organizationId } };
          }

          const ticket = await tx.ticket.create({
            data,
            include: {
              requester: {
                select: {
                  id: true,
                  firstName: true,
                  lastName: true,
                  email: true,
                  tier: true,
                },
              },
              assignedTeam: true,
              category: true,
              slaPolicy: {
                select: {
                  id: true,
                  name: true,
                  responseTimeHours: true,
                  resolutionTimeHours: true,
                },
              },
            },
          });

          // Create initial status history
          await tx.ticketStatusHistory.create({
            data: {
              ticketId: ticket.id,
              toStatus: TicketStatus.NEW as any,
              changedById: requesterId,
              changedBy: requesterId,
            },
          });

          return ticket;
        });

        return ticket;
      } catch (error: any) {
        // Check if it's a unique constraint error (race condition)
        if ((error.code === 'P2002' || error.message?.includes('already exists')) && attempt < maxRetries - 1) {
          console.warn(`Ticket number collision, retrying (${attempt + 1}/${maxRetries})...`);
          continue;
        }
        throw error;
      }
    }
  }

  async update(id: string, dto: UpdateTicketDto, userId: string, organizationId?: string) {
    await this.findOne(id, organizationId);

    const ticket = await this.prisma.ticket.update({
      where: { id },
      data: dto as any,
      include: {
        requester: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
          },
        },
        assignedAgent: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
          },
        },
        assignedTeam: true,
        category: true,
      },
    });

    return ticket;
  }

  async assign(id: string, dto: AssignTicketDto, userId: string, organizationId?: string) {
    const ticket = await this.findOne(id, organizationId);

    const updateData: Prisma.TicketUpdateInput = {};
    if (dto.agentId) {
      updateData.assignedAgent = { connect: { id: dto.agentId } };
    }
    if (dto.teamId) {
      updateData.assignedTeam = { connect: { id: dto.teamId } };
    }

    const updated = await this.prisma.ticket.update({
      where: { id },
      data: updateData,
      include: {
        assignedAgent: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
          },
        },
        assignedTeam: true,
      },
    });

    // Transition to assigned if new
    if (ticket.status === TicketStatus.NEW) {
      await this.transition(id, { toStatus: TicketStatus.ASSIGNED as any, reason: dto.reason }, userId, organizationId);
    }

    return updated;
  }

  async transition(id: string, dto: TransitionTicketDto, userId: string, organizationId?: string) {
    const ticket = await this.findOne(id, organizationId);

    // Validate transition
    this.validateStatusTransition(ticket.status as any, dto.toStatus as any);

    const updateData: Prisma.TicketUpdateInput = {
      status: dto.toStatus as any,
      lastActivityAt: new Date(),
    };

    // Set timestamps based on status
    switch (dto.toStatus) {
      case TicketStatus.IN_PROGRESS:
        if (!ticket.firstResponseAt) {
          updateData.firstResponseAt = new Date();
          // Check FRT breach when first response is given
          if (ticket.firstResponseDeadline && new Date() > ticket.firstResponseDeadline) {
            updateData.frtBreached = true;
          }
        }
        break;
      case TicketStatus.RESOLVED:
        updateData.resolvedAt = new Date();
        // Check SLA breach when resolved
        if (ticket.slaDeadline && new Date() > ticket.slaDeadline) {
          updateData.slaBreached = true;
        }
        break;
      case TicketStatus.CLOSED:
        updateData.closedAt = new Date();
        // Check SLA breach when closed
        if (ticket.slaDeadline && new Date() > ticket.slaDeadline) {
          updateData.slaBreached = true;
        }
        break;
    }

    const updated = await this.prisma.ticket.update({
      where: { id },
      data: updateData,
    });

    // Auto-complete linked service request when ticket is closed
    if (dto.toStatus === TicketStatus.CLOSED && (ticket as any).linkedTicket?.id) {
      await this.prisma.serviceRequest.update({
        where: { id: (ticket as any).linkedTicket.id },
        data: {
          status: 'completed',
          completedAt: new Date(),
        },
      });
    }

    // Create status history
    await this.prisma.ticketStatusHistory.create({
      data: {
        ticketId: id,
        fromStatus: ticket.status as any,
        toStatus: dto.toStatus as any,
        changedById: userId,
        changedBy: userId,
        reason: dto.reason,
      },
    });

    return updated;
  }

  async addComment(id: string, dto: AddCommentDto, userId: string, organizationId?: string) {
    await this.findOne(id, organizationId);

    // Determine if this is an email reply (has recipients)
    const isEmailReply = dto.recipients && dto.recipients.length > 0;

    // Build comment data using the relation connection syntax
    const comment = await this.prisma.comment.create({
      data: {
        ticket: { connect: { id } },
        author: { connect: { id: userId } },
        content: dto.content,
        isInternal: dto.isInternal ?? false,
        channel: isEmailReply ? 'email' : 'web',
        replyToAddresses: isEmailReply ? dto.recipients!.join(', ') : null,
        originalMessageId: isEmailReply ? (dto.originalMessageId ?? null) : null,
        originalSubject: isEmailReply ? (dto.originalSubject ?? null) : null,
        organization: organizationId ? { connect: { id: organizationId } } : undefined,
      },
      include: {
        author: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
            avatarUrl: true,
          },
        },
      },
    });

    // Update lastActivityAt
    await this.prisma.ticket.update({
      where: { id },
      data: { lastActivityAt: new Date() },
    });

    // Update first response time if this is the first public comment
    if (!dto.isInternal) {
      const ticket = await this.prisma.ticket.findUnique({
        where: { id },
        select: { firstResponseAt: true, firstResponseDeadline: true },
      });

      if (!ticket?.firstResponseAt) {
        const updateData: Prisma.TicketUpdateInput = {
          firstResponseAt: new Date(),
        };

        // Check if FRT was breached
        if (ticket?.firstResponseDeadline && new Date() > ticket.firstResponseDeadline) {
          updateData.frtBreached = true;
        }

        await this.prisma.ticket.update({
          where: { id },
          data: updateData,
        });
      }
    }

    // Send email reply if this is an email reply
    if (isEmailReply && dto.recipients!.length > 0) {
      const ticket = await this.findOne(id);
      const subject = dto.originalSubject ? `Re: ${dto.originalSubject}` : `Re: [${ticket.ticketNumber}] ${ticket.title}`;

      await this.emailService.sendCommentReply({
        to: dto.recipients!.join(', '),
        subject,
        content: dto.content,
        ticketNumber: ticket.ticketNumber,
        originalMessageId: dto.originalMessageId ?? undefined,
        includeOriginalContent: dto.includeOriginalContent ?? false,
        originalContent: dto.includeOriginalContent ? dto.originalContent : undefined,
      });
    }

    return comment;
  }

  async delete(id: string, userId: string, organizationId?: string) {
    await this.findOne(id, organizationId);

    await this.prisma.ticket.update({
      where: { id },
      data: { deletedAt: new Date() },
    });

    return { success: true };
  }

  async getComments(ticketId: string, organizationId?: string) {
    await this.findOne(ticketId, organizationId);

    const where: Prisma.CommentWhereInput = { ticketId };
    if (organizationId) {
      where.organizationId = organizationId;
    }

    return this.prisma.comment.findMany({
      where,
      include: {
        author: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
            avatarUrl: true,
          },
        },
      },
      orderBy: { createdAt: 'asc' },
    });
  }

  private calculateDefaultSlaDeadline(priority: any): Date {
    const hoursMap: Record<string, number> = {
      critical: 4,
      high: 8,
      medium: 24,
      low: 72,
    };

    const deadline = new Date();
    deadline.setHours(deadline.getHours() + (hoursMap[priority] || 24));
    return deadline;
  }

  /**
   * Get tickets by organization
   */
  async findByOrganization(organizationId: string, query: TicketQueryDto, userId?: string, userRole?: string) {
    return this.findAll(query, userId, userRole, organizationId);
  }

  /**
   * Check and update SLA breach status for a ticket
   */
  async checkAndUpdateSlaBreach(ticketId: string): Promise<{ slaBreached: boolean; frtBreached: boolean }> {
    const ticket = await this.prisma.ticket.findUnique({
      where: { id: ticketId },
      select: {
        slaDeadline: true,
        slaBreached: true,
        firstResponseDeadline: true,
        firstResponseAt: true,
        resolvedAt: true,
        closedAt: true,
      },
    });

    if (!ticket) {
      return { slaBreached: false, frtBreached: false };
    }

    const now = new Date();
    const updateData: Prisma.TicketUpdateInput = {};

    // Check resolution SLA breach
    if (!ticket.resolvedAt && !ticket.closedAt && ticket.slaDeadline && !ticket.slaBreached) {
      if (now > ticket.slaDeadline) {
        updateData.slaBreached = true;
      }
    }

    // Check FRT breach
    if (!ticket.firstResponseAt && ticket.firstResponseDeadline) {
      if (now > ticket.firstResponseDeadline) {
        updateData.frtBreached = true;
      }
    }

    if (Object.keys(updateData).length > 0) {
      await this.prisma.ticket.update({
        where: { id: ticketId },
        data: updateData,
      });
    }

    return {
      slaBreached: updateData.slaBreached ? true : ticket.slaBreached,
      frtBreached: updateData.frtBreached ? true : ticket.firstResponseAt ? false : (ticket.firstResponseDeadline ? now > ticket.firstResponseDeadline : false),
    };
  }

  private validateStatusTransition(from: string, to: string) {
    const validTransitions: Record<string, string[]> = {
      new: ['assigned', 'closed'],
      assigned: ['in_progress', 'pending', 'resolved', 'closed'],
      in_progress: ['pending', 'resolved', 'assigned', 'closed'],
      pending: ['in_progress', 'resolved', 'closed'],
      resolved: ['closed', 'assigned'],
      closed: [],
    };

    if (!validTransitions[from]?.includes(to)) {
      throw new BadRequestException(
        `Invalid status transition from ${from} to ${to}`,
      );
    }
  }

  /**
   * Get basic dashboard statistics for tickets (no reports module required)
   */
  async getDashboardStats(organizationId: string) {
    const now = new Date();
    const startOfDay = new Date(now.setHours(0, 0, 0, 0));

    const [
      totalTickets,
      openTickets,
      resolvedToday,
      slaBreached,
      ticketsByStatus,
      recentTickets,
    ] = await Promise.all([
      // Total tickets
      this.prisma.ticket.count({
        where: { organizationId, deletedAt: null },
      }),
      // Open tickets (not resolved or closed)
      this.prisma.ticket.count({
        where: {
          organizationId,
          deletedAt: null,
          status: { notIn: [TicketStatus.RESOLVED, TicketStatus.CLOSED] },
        },
      }),
      // Resolved today
      this.prisma.ticket.count({
        where: {
          organizationId,
          resolvedAt: { gte: startOfDay },
        },
      }),
      // SLA breached (open tickets with breached SLA)
      this.prisma.ticket.count({
        where: {
          organizationId,
          slaBreached: true,
          status: { notIn: [TicketStatus.RESOLVED, TicketStatus.CLOSED] },
        },
      }),
      // Tickets by status
      this.prisma.ticket.groupBy({
        by: ['status'],
        where: { organizationId, deletedAt: null },
        _count: true,
      }),
      // Recent tickets
      this.prisma.ticket.findMany({
        where: { organizationId, deletedAt: null },
        orderBy: { createdAt: 'desc' },
        take: 5,
        include: {
          requester: { select: { firstName: true, lastName: true, email: true } },
        },
      }),
    ]);

    // Format tickets by status
    const statusMap: Record<string, number> = {};
    for (const item of ticketsByStatus) {
      statusMap[item.status] = item._count;
    }

    return {
      totalTickets,
      openTickets,
      resolvedToday,
      slaBreached,
      ticketsByStatus: statusMap,
      recentTickets: recentTickets.map((t) => ({
        id: t.id,
        ticketNumber: t.ticketNumber,
        title: t.title,
        status: t.status,
        priority: t.priority,
        createdAt: t.createdAt,
        requester: {
          firstName: t.requester.firstName,
          lastName: t.requester.lastName,
        },
      })),
    };
  }
}
