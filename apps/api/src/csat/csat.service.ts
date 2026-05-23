import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../common/prisma.service';
import { Prisma, CsatQuestionType } from '@prisma/client';

const CsatSurveyStatus = {
  PENDING: 'pending',
  SENT: 'sent',
  VIEWED: 'viewed',
  COMPLETED: 'completed',
  EXPIRED: 'expired',
  OPTED_OUT: 'opted_out',
} as const;

@Injectable()
export class CsatService {
  constructor(private prisma: PrismaService) {}

  // ==================== Survey Configuration ====================

  async getConfig(id: string) {
    const config = await this.prisma.csatSurveyConfig.findUnique({
      where: { id },
      include: {
        questions: {
          where: { isActive: true },
          orderBy: { orderIndex: 'asc' },
        },
      },
    });

    if (!config) {
      throw new NotFoundException('CSAT survey configuration not found');
    }

    return config;
  }

  async getActiveConfig() {
    const config = await this.prisma.csatSurveyConfig.findFirst({
      where: { isActive: true },
      include: {
        questions: {
          where: { isActive: true },
          orderBy: { orderIndex: 'asc' },
        },
      },
    });

    if (!config) {
      // Return default config if none exists
      return this.createDefaultConfig();
    }

    return config;
  }

  async listConfigs(params?: {
    skip?: number;
    take?: number;
    where?: Prisma.CsatSurveyConfigWhereInput;
  }) {
    const skip = params?.skip ?? 0;
    const take = params?.take ?? 50;
    const where = params?.where;

    const [configs, total] = await Promise.all([
      this.prisma.csatSurveyConfig.findMany({
        where,
        skip,
        take,
        include: {
          questions: {
            where: { isActive: true },
            orderBy: { orderIndex: 'asc' },
          },
          _count: {
            select: { surveys: true },
          },
        },
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.csatSurveyConfig.count({ where }),
    ]);

    return {
      data: configs,
      total,
      skip,
      take,
    };
  }

  async createConfig(data: {
    name: string;
    description?: string;
    sendDelayHours?: number;
    reminderDelayHours?: number;
    maxReminders?: number;
    minTicketAgeHours?: number;
    requireComment?: boolean;
    questions?: {
      questionText: string;
      questionType?: CsatQuestionType;
      isRequired?: boolean;
      scaleMin?: number;
      scaleMax?: number;
      orderIndex?: number;
    }[];
  }) {
    const { questions, ...configData } = data;

    const config = await this.prisma.csatSurveyConfig.create({
      data: {
        ...configData,
        questions: questions
          ? {
              create: questions.map((q, index) => ({
                ...q,
                orderIndex: q.orderIndex ?? index,
              })),
            }
          : undefined,
      },
      include: {
        questions: {
          orderBy: { orderIndex: 'asc' },
        },
      },
    });

    return config;
  }

  async updateConfig(id: string, data: Partial<{
    name: string;
    description: string;
    isActive: boolean;
    sendDelayHours: number;
    reminderDelayHours: number;
    maxReminders: number;
    minTicketAgeHours: number;
    requireComment: boolean;
  }>) {
    const config = await this.prisma.csatSurveyConfig.update({
      where: { id },
      data,
      include: {
        questions: {
          orderBy: { orderIndex: 'asc' },
        },
      },
    });

    if (!config) {
      throw new NotFoundException('CSAT survey configuration not found');
    }

    return config;
  }

  async addQuestion(configId: string, data: {
    questionText: string;
    questionType?: CsatQuestionType;
    isRequired?: boolean;
    scaleMin?: number;
    scaleMax?: number;
  }) {
    const maxOrder = await this.prisma.csatQuestion.aggregate({
      where: { configId },
      _max: { orderIndex: true },
    });

    const question = await this.prisma.csatQuestion.create({
      data: {
        ...data,
        configId,
        orderIndex: (maxOrder._max.orderIndex ?? -1) + 1,
      },
    });

    return question;
  }

  async updateQuestion(questionId: string, data: Partial<{
    questionText: string;
    questionType: CsatQuestionType;
    isRequired: boolean;
    scaleMin: number;
    scaleMax: number;
    orderIndex: number;
    isActive: boolean;
  }>) {
    const question = await this.prisma.csatQuestion.update({
      where: { id: questionId },
      data,
    });

    if (!question) {
      throw new NotFoundException('Question not found');
    }

    return question;
  }

  async deleteQuestion(questionId: string) {
    await this.prisma.csatQuestion.delete({
      where: { id: questionId },
    });

    return { success: true };
  }

  private async createDefaultConfig() {
    // Check if default config already exists (using findFirst since name is part of compound unique with organizationId)
    const existing = await this.prisma.csatSurveyConfig.findFirst({
      where: { name: 'Default Survey' },
    });

    if (existing) {
      return existing;
    }

    return this.prisma.csatSurveyConfig.create({
      data: {
        name: 'Default Survey',
        description: 'Default CSAT survey configuration',
        sendDelayHours: 24,
        reminderDelayHours: 72,
        maxReminders: 2,
        minTicketAgeHours: 1,
        requireComment: false,
        questions: {
          create: [
            {
              questionText: 'How satisfied are you with the resolution of your ticket?',
              questionType: 'rating' as CsatQuestionType,
              isRequired: true,
              scaleMin: 1,
              scaleMax: 5,
              orderIndex: 0,
            },
            {
              questionText: 'How would you rate the responsiveness of our support team?',
              questionType: 'rating' as CsatQuestionType,
              isRequired: true,
              scaleMin: 1,
              scaleMax: 5,
              orderIndex: 1,
            },
            {
              questionText: 'Would you recommend our service to others?',
              questionType: 'nps' as CsatQuestionType,
              isRequired: false,
              scaleMin: 0,
              scaleMax: 10,
              orderIndex: 2,
            },
            {
              questionText: 'Any additional comments or feedback?',
              questionType: 'comment' as CsatQuestionType,
              isRequired: false,
              orderIndex: 3,
            },
          ],
        },
      },
      include: {
        questions: {
          orderBy: { orderIndex: 'asc' },
        },
      },
    });
  }

  // ==================== Survey Responses ====================

  async getSurveyByTicket(ticketId: string) {
    const survey = await this.prisma.csatSurvey.findUnique({
      where: { ticketId },
      include: {
        config: {
          include: {
            questions: {
              where: { isActive: true },
              orderBy: { orderIndex: 'asc' },
            },
          },
        },
        responses: true,
        ticket: {
          select: {
            id: true,
            ticketNumber: true,
            title: true,
            resolvedAt: true,
            requester: {
              select: { firstName: true, lastName: true, email: true },
            },
            assignedAgent: {
              select: { firstName: true, lastName: true },
            },
          },
        },
      },
    });

    return survey;
  }

  async getSurveyById(id: string) {
    const survey = await this.prisma.csatSurvey.findUnique({
      where: { id },
      include: {
        config: {
          include: {
            questions: {
              where: { isActive: true },
              orderBy: { orderIndex: 'asc' },
            },
          },
        },
        responses: {
          include: {
            question: true,
          },
        },
        ticket: {
          select: {
            id: true,
            ticketNumber: true,
            title: true,
            status: true,
            priority: true,
            resolvedAt: true,
            requester: {
              select: { id: true, firstName: true, lastName: true, email: true },
            },
            assignedAgent: {
              select: { id: true, firstName: true, lastName: true },
            },
          },
        },
      },
    });

    if (!survey) {
      throw new NotFoundException('Survey not found');
    }

    return survey;
  }

  async listSurveys(params?: {
    skip?: number;
    take?: number;
    where?: Prisma.CsatSurveyWhereInput;
  }) {
    const skip = params?.skip ?? 0;
    const take = params?.take ?? 50;
    const where = params?.where;

    const [surveys, total] = await Promise.all([
      this.prisma.csatSurvey.findMany({
        where,
        skip,
        take,
        include: {
          ticket: {
            select: {
              id: true,
              ticketNumber: true,
              title: true,
              priority: true,
              resolvedAt: true,
              requester: {
                select: { firstName: true, lastName: true },
              },
              assignedAgent: {
                select: { firstName: true, lastName: true },
              },
            },
          },
        },
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.csatSurvey.count({ where }),
    ]);

    return {
      data: surveys,
      total,
      skip,
      take,
    };
  }

  async createSurvey(ticketId: string) {
    // Check if survey already exists for this ticket
    const existing = await this.prisma.csatSurvey.findUnique({
      where: { ticketId },
    });

    if (existing) {
      throw new BadRequestException('Survey already exists for this ticket');
    }

    // Get active config
    const config = await this.getActiveConfig();

    const survey = await this.prisma.csatSurvey.create({
      data: {
        ticketId,
        configId: config.id,
        status: 'pending',
      },
      include: {
        config: {
          include: {
            questions: {
              where: { isActive: true },
              orderBy: { orderIndex: 'asc' },
            },
          },
        },
      },
    });

    return survey;
  }

  async markSurveySent(surveyId: string) {
    return this.prisma.csatSurvey.update({
      where: { id: surveyId },
      data: {
        status: 'sent',
        sentAt: new Date(),
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days
      },
    });
  }

  async markSurveyViewed(surveyId: string) {
    const survey = await this.prisma.csatSurvey.findUnique({
      where: { id: surveyId },
    });

    if (!survey) {
      throw new NotFoundException('Survey not found');
    }

    // Only update if not already viewed
    if (survey.status === 'sent') {
      return this.prisma.csatSurvey.update({
        where: { id: surveyId },
        data: {
          status: 'viewed',
          firstViewedAt: new Date(),
        },
      });
    }

    return survey;
  }

  async submitSurvey(surveyId: string, data: {
    rating: number;
    comment?: string;
    responses?: {
      questionId: string;
      ratingValue?: number;
      textValue?: string;
    }[];
  }) {
    const survey = await this.prisma.csatSurvey.findUnique({
      where: { id: surveyId },
      include: { config: true },
    });

    if (!survey) {
      throw new NotFoundException('Survey not found');
    }

    if (survey.status === 'completed') {
      throw new BadRequestException('Survey already completed');
    }

    // Validate rating
    if (data.rating < 1 || data.rating > 5) {
      throw new BadRequestException('Rating must be between 1 and 5');
    }

    // If comment is required
    if (survey.config.requireComment && !data.comment) {
      throw new BadRequestException('Comment is required');
    }

    // Update survey with responses
    const updatedSurvey = await this.prisma.$transaction(async (tx) => {
      // Update survey status and rating
      await tx.csatSurvey.update({
        where: { id: surveyId },
        data: {
          status: 'completed',
          completedAt: new Date(),
          rating: data.rating,
          comment: data.comment,
        },
      });

      // Add individual question responses if provided
      if (data.responses && data.responses.length > 0) {
        await tx.csatResponse.createMany({
          data: data.responses.map((r) => ({
            surveyId,
            questionId: r.questionId,
            ratingValue: r.ratingValue,
            textValue: r.textValue,
          })),
        });
      }

      return tx.csatSurvey.findUnique({
        where: { id: surveyId },
        include: {
          config: {
            include: {
              questions: {
                where: { isActive: true },
                orderBy: { orderIndex: 'asc' },
              },
            },
          },
          responses: {
            include: {
              question: true,
            },
          },
        },
      });
    });

    return updatedSurvey;
  }

  async optOutOfSurvey(ticketId: string) {
    const survey = await this.prisma.csatSurvey.findUnique({
      where: { ticketId },
    });

    if (!survey) {
      throw new NotFoundException('Survey not found');
    }

    return this.prisma.csatSurvey.update({
      where: { id: survey.id },
      data: {
        status: 'opted_out',
      },
    });
  }

  async submitSurveyForTicket(ticketId: string, data: { rating: number; comment?: string }) {
    // Validate input
    if (!ticketId) {
      throw new BadRequestException('Ticket ID is required');
    }

    if (!data.rating || data.rating < 1 || data.rating > 5) {
      throw new BadRequestException('Rating must be between 1 and 5');
    }

    // Find or create survey for this ticket
    let survey = await this.prisma.csatSurvey.findUnique({
      where: { ticketId },
      include: { config: true },
    });

    if (!survey) {
      // Get or create active config
      let config = await this.prisma.csatSurveyConfig.findFirst({
        where: { isActive: true },
      });

      if (!config) {
        // Create default config
        config = await this.createDefaultConfig();
      }

      // Create survey - wrap in try/catch for better error handling
      try {
        survey = await this.prisma.csatSurvey.create({
          data: {
            ticketId,
            configId: config.id,
            status: 'pending',
            sentAt: new Date(),
          },
          include: { config: true },
        });
      } catch (error: any) {
        // If creation fails (e.g., duplicate key), try to fetch it again
        if (error.code === 'P2002') {
          survey = await this.prisma.csatSurvey.findUnique({
            where: { ticketId },
            include: { config: true },
          });
        } else {
          throw error;
        }
      }
    }

    if (!survey) {
      throw new BadRequestException('Unable to create or find survey for this ticket');
    }

    if (survey.status === 'completed') {
      throw new BadRequestException('Survey already completed');
    }

    // Update survey
    return this.prisma.csatSurvey.update({
      where: { id: survey.id },
      data: {
        status: 'completed',
        completedAt: new Date(),
        rating: data.rating,
        comment: data.comment,
      },
    });
  }

  // ==================== Analytics ====================

  async getAnalytics(options?: {
    dateFrom?: string;
    dateTo?: string;
    teamId?: string;
  }) {
    const { dateFrom, dateTo, teamId } = options || {};

    const where: Prisma.CsatSurveyWhereInput = {
      status: 'completed',
    };

    if (dateFrom || dateTo) {
      where.completedAt = {};
      if (dateFrom) {
        where.completedAt.gte = new Date(dateFrom);
      }
      if (dateTo) {
        where.completedAt.lte = new Date(dateTo);
      }
    }

    if (teamId) {
      where.ticket = { assignedTeamId: teamId };
    }

    // Get all completed surveys
    const surveys = await this.prisma.csatSurvey.findMany({
      where,
      include: {
        responses: {
          include: {
            question: true,
          },
        },
        ticket: {
          select: {
            priority: true,
            assignedTeamId: true,
            assignedAgentId: true,
          },
        },
      },
    });

    // Calculate metrics
    const totalResponses = surveys.length;

    if (totalResponses === 0) {
      return {
        totalResponses: 0,
        averageRating: 0,
        ratingDistribution: { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 },
        satisfactionScore: 0,
        npsScore: 0,
        responseRate: 0,
        byPriority: {},
        trends: [],
      };
    }

    // Average rating
    const totalRating = surveys.reduce((sum, s) => sum + (s.rating || 0), 0);
    const averageRating = totalRating / totalResponses;

    // Rating distribution
    const ratingDistribution: Record<number, number> = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
    surveys.forEach((s) => {
      if (s.rating) {
        ratingDistribution[s.rating]++;
      }
    });

    // Satisfaction score (percentage of satisfied responses, i.e., rating >= 4)
    const satisfiedCount = surveys.filter((s) => (s.rating || 0) >= 4).length;
    const satisfactionScore = (satisfiedCount / totalResponses) * 100;

    // NPS Score (Net Promoter Score)
    const npsResponses = await this.prisma.csatResponse.findMany({
      where: {
        surveyId: { in: surveys.map((s) => s.id) },
        question: {
          questionType: 'nps',
        },
      },
      include: {
        question: true,
      },
    });

    let promoters = 0;
    let detractors = 0;

    npsResponses.forEach((r) => {
      if (r.ratingValue !== null) {
        if (r.ratingValue >= 9) {
          promoters++;
        } else if (r.ratingValue <= 6) {
          detractors++;
        }
      }
    });

    const npsScore = npsResponses.length > 0
      ? ((promoters - detractors) / npsResponses.length) * 100
      : 0;

    // Response rate
    const totalSent = await this.prisma.csatSurvey.count({
      where: {
        status: { in: ['sent', 'viewed', 'completed'] },
        ...(dateFrom || dateTo
          ? {
              sentAt: {
                ...(dateFrom ? { gte: new Date(dateFrom) } : {}),
                ...(dateTo ? { lte: new Date(dateTo) } : {}),
              },
            }
          : {}),
      },
    });

    const totalPending = await this.prisma.csatSurvey.count({
      where: { status: 'pending' },
    });

    const responseRate = totalSent > 0 ? (totalResponses / totalSent) * 100 : 0;

    // By priority
    const byPriority: Record<string, { count: number; avgRating: number }> = {};
    surveys.forEach((s) => {
      const priority = s.ticket.priority;
      if (!byPriority[priority]) {
        byPriority[priority] = { count: 0, avgRating: 0 };
      }
      byPriority[priority].count++;
      byPriority[priority].avgRating += s.rating || 0;
    });

    Object.keys(byPriority).forEach((p) => {
      if (byPriority[p].count > 0) {
        byPriority[p].avgRating = byPriority[p].avgRating / byPriority[p].count;
      }
    });

    // Trends (weekly)
    const trendsMap: Record<string, { total: number; sum: number; promoters: number; detractors: number }> = {};

    surveys.forEach((s) => {
      if (s.completedAt) {
        const weekStart = new Date(s.completedAt);
        weekStart.setDate(weekStart.getDate() - weekStart.getDay());
        const weekKey = weekStart.toISOString().slice(0, 10);

        if (!trendsMap[weekKey]) {
          trendsMap[weekKey] = { total: 0, sum: 0, promoters: 0, detractors: 0 };
        }

        trendsMap[weekKey].total++;
        trendsMap[weekKey].sum += s.rating || 0;

        // Check NPS
        const npsResponse = s.responses.find(
          (r) => r.question.questionType === 'nps' && r.ratingValue !== null
        );
        if (npsResponse && npsResponse.ratingValue !== null) {
          if (npsResponse.ratingValue >= 9) {
            trendsMap[weekKey].promoters++;
          } else if (npsResponse.ratingValue <= 6) {
            trendsMap[weekKey].detractors++;
          }
        }
      }
    });

    const trends = Object.entries(trendsMap)
      .map(([period, data]) => ({
        period,
        avgRating: data.sum / data.total,
        satisfactionRate: ((data.total - (5 - data.sum / data.total) * data.total) / data.total) * 100,
        nps: ((data.promoters - data.detractors) / data.total) * 100,
        responses: data.total,
      }))
      .sort((a, b) => a.period.localeCompare(b.period))
      .slice(-8); // Last 8 weeks

    return {
      totalResponses,
      averageRating: Number(averageRating.toFixed(2)),
      ratingDistribution,
      satisfactionScore: Number(satisfactionScore.toFixed(2)),
      npsScore: Number(npsScore.toFixed(2)),
      responseRate: Number(responseRate.toFixed(2)),
      byPriority,
      trends,
    };
  }

  async getDashboardStats() {
    const [
      totalSurveys,
      pendingSurveys,
      sentSurveys,
      completedSurveys,
      optedOutSurveys,
      averageRating,
    ] = await Promise.all([
      this.prisma.csatSurvey.count(),
      this.prisma.csatSurvey.count({ where: { status: 'pending' } }),
      this.prisma.csatSurvey.count({ where: { status: 'sent' } }),
      this.prisma.csatSurvey.count({ where: { status: 'completed' } }),
      this.prisma.csatSurvey.count({ where: { status: 'opted_out' } }),
      this.prisma.csatSurvey.aggregate({
        where: { status: 'completed' },
        _avg: { rating: true },
      }),
    ]);

    const recentSurveys = await this.prisma.csatSurvey.findMany({
      where: { status: 'completed' },
      take: 5,
      orderBy: { completedAt: 'desc' },
      include: {
        ticket: {
          select: {
            ticketNumber: true,
            title: true,
            priority: true,
          },
        },
      },
    });

    return {
      totalSurveys,
      pendingSurveys,
      sentSurveys,
      completedSurveys,
      optedOutSurveys,
      averageRating: averageRating._avg.rating || 0,
      recentSurveys,
    };
  }
}
