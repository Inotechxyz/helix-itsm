import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../common/prisma.service';
import { CacheService } from '../cache/cache.service';
import { ServiceStatus, ServiceRequestStatus } from '@helix/shared';
import { Prisma, ServiceStatus as PrismaServiceStatus } from '@prisma/client';

@Injectable()
export class ServiceCatalogService {
  constructor(
    private prisma: PrismaService,
    private cache: CacheService,
  ) {}

  // Services
  async findAllServices(options: {
    status?: string;
    categoryId?: string;
    search?: string;
    page?: number;
    limit?: number;
    organizationId?: string;
  }) {
    const { status, categoryId, search, page: pageParam, limit: limitParam, organizationId } = options;
    const page = typeof pageParam === 'number' && pageParam > 0 ? pageParam : 1;
    const limit = typeof limitParam === 'number' && limitParam > 0 ? limitParam : 20;

    const cacheKey = this.cache.key('catalog', 'services', JSON.stringify({ status, categoryId, search, page, limit, organizationId }));

    return this.cache.wrap(cacheKey, async () => {
      const where: Prisma.ServiceWhereInput = {};

      if (organizationId) {
        where.organizationId = organizationId;
      }

      if (status) {
        where.status = status as PrismaServiceStatus;
      }

      if (categoryId) {
        where.categoryId = categoryId;
      }

      if (search) {
        where.OR = [
          { name: { contains: search } },
          { description: { contains: search } },
        ];
      }

      const skipValue = (page - 1) * limit;
      const services = await this.prisma.service.findMany({
        where,
        include: {
          category: { select: { id: true, name: true, slug: true } },
          assignedTeam: { select: { id: true, name: true } },
        },
        skip: skipValue,
        take: limit,
        orderBy: { name: 'asc' as const },
      });

      const total = await this.prisma.service.count({ where });

      return { items: services, total, page, limit, totalPages: Math.ceil(total / limit) };
    }, 'medium');
  }

  async findServiceBySlug(slug: string, organizationId?: string) {
    const cacheKey = this.cache.key('catalog', 'service', slug, organizationId || 'all');
    return this.cache.wrap(cacheKey, async () => {
      const where: any = { slug };
      if (organizationId) {
        where.organizationId = organizationId;
      }
      const service = await this.prisma.service.findFirst({
        where,
        include: {
          category: true,
          assignedTeam: true,
          assignedAgent: { select: { id: true, firstName: true, lastName: true } },
        },
      });

      if (!service) throw new NotFoundException('Service not found');
      return service;
    }, 'medium');
  }

  async createService(data: {
    name: string;
    description?: string;
    shortDescription?: string;
    categoryId: string;
    price?: number;
    currency?: string;
    deliveryTimeDays?: number;
    requiresApproval?: boolean;
    autoFulfill?: boolean;
    slaHours?: number;
    formFields?: any;
    instructions?: string;
    assignedTeamId?: string;
  }, userId: string, organizationId?: string) {
    const slug = this.generateSlug(data.name);

    const result = await this.prisma.service.create({
      data: {
        ...data,
        slug,
        assignedAgentId: userId,
        organizationId,
      },
      include: {
        category: true,
        assignedTeam: true,
      },
    });

    await this.invalidateCache(organizationId);
    return result;
  }

  async updateService(id: string, data: any, organizationId?: string) {
    const where: any = { id };
    if (organizationId) {
      where.organizationId = organizationId;
    }
    const service = await this.prisma.service.findFirst({ where });
    if (!service) throw new NotFoundException('Service not found');

    const updateData: Prisma.ServiceUpdateInput = { ...data };
    if (data.name && data.name !== service.name) {
      updateData.slug = this.generateSlug(data.name);
    }

    const result = await this.prisma.service.update({
      where: { id },
      data: updateData,
      include: { category: true, assignedTeam: true },
    });

    // Invalidate org-specific cache
    if (organizationId) {
      await this.cache.del(this.cache.key('catalog', 'service', service.slug, organizationId));
    }
    await this.cache.del(this.cache.key('catalog', 'service', service.slug, 'all'));
    await this.invalidateCache(organizationId);
    return result;
  }

  async activateService(id: string, organizationId?: string) {
    const where: any = { id };
    if (organizationId) {
      where.organizationId = organizationId;
    }
    const service = await this.prisma.service.findFirst({ where });
    if (!service) throw new NotFoundException('Service not found');

    console.log(`[ServiceCatalog] Activating service ${id}, current status: ${service.status}, orgId: ${organizationId}`);

    const result = await this.prisma.service.update({
      where: { id },
      data: { status: ServiceStatus.ACTIVE },
    });

    console.log(`[ServiceCatalog] Service ${id} activated, new status: ${result.status}`);

    await this.invalidateCache(organizationId);
    return result;
  }

  async deactivateService(id: string, organizationId?: string) {
    const where: any = { id };
    if (organizationId) {
      where.organizationId = organizationId;
    }
    const service = await this.prisma.service.findFirst({ where });
    if (!service) throw new NotFoundException('Service not found');

    const result = await this.prisma.service.update({
      where: { id },
      data: { status: ServiceStatus.INACTIVE },
    });

    await this.invalidateCache(organizationId);
    return result;
  }

  // Categories
  async findAllCategories(organizationId?: string) {
    const cacheKey = this.cache.key('catalog', 'categories', organizationId || 'all');
    return this.cache.wrap(cacheKey, async () => {
      const where: any = { isActive: true };
      if (organizationId) {
        where.organizationId = organizationId;
      }
      return this.prisma.serviceCategory.findMany({
        where,
        include: {
          _count: { select: { services: true } },
        },
        orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
      });
    }, 'long');
  }

  async createCategory(data: {
    name: string;
    slug?: string;
    description?: string;
    icon?: string;
    color?: string;
    sortOrder?: number;
  }, organizationId?: string) {
    const slug = data.slug || this.generateSlug(data.name);
    const result = await this.prisma.serviceCategory.create({
      data: {
        name: data.name,
        slug,
        description: data.description,
        icon: data.icon,
        color: data.color,
        sortOrder: data.sortOrder || 0,
        organizationId,
      },
    });

    // Invalidate org-specific cache
    if (organizationId) {
      await this.cache.del(this.cache.key('catalog', 'categories', organizationId));
    }
    await this.cache.del(this.cache.key('catalog', 'categories', 'all'));
    return result;
  }

  async updateCategory(id: string, data: {
    name?: string;
    slug?: string;
    description?: string;
    icon?: string;
    color?: string;
    sortOrder?: number;
    isActive?: boolean;
  }, organizationId?: string) {
    const where: any = { id };
    if (organizationId) {
      where.organizationId = organizationId;
    }
    const category = await this.prisma.serviceCategory.findFirst({ where });
    if (!category) throw new NotFoundException('Category not found');

    const result = await this.prisma.serviceCategory.update({
      where: { id },
      data: {
        name: data.name,
        slug: data.slug,
        description: data.description,
        icon: data.icon,
        color: data.color,
        sortOrder: data.sortOrder,
        isActive: data.isActive,
      },
    });

    // Invalidate org-specific cache
    if (organizationId) {
      await this.cache.del(this.cache.key('catalog', 'categories', organizationId));
    }
    await this.cache.del(this.cache.key('catalog', 'categories', 'all'));
    return result;
  }

  async deleteCategory(id: string, organizationId?: string) {
    const where: any = { id };
    if (organizationId) {
      where.organizationId = organizationId;
    }
    const category = await this.prisma.serviceCategory.findFirst({ where });
    if (!category) throw new NotFoundException('Category not found');

    const serviceCount = await this.prisma.service.count({ where: { categoryId: id, ...(organizationId && { organizationId }) } });
    if (serviceCount > 0) {
      throw new Error('Cannot delete category with services. Please reassign services first.');
    }

    const result = await this.prisma.serviceCategory.delete({ where: { id } });

    // Invalidate org-specific cache
    if (organizationId) {
      await this.cache.del(this.cache.key('catalog', 'categories', organizationId));
    }
    await this.cache.del(this.cache.key('catalog', 'categories', 'all'));
    return result;
  }

  // Service Requests - don't cache (user-specific, frequently changing)
  async findAllRequests(options: {
    status?: ServiceRequestStatus[];
    serviceId?: string;
    requesterId?: string;
    page?: number;
    limit?: number;
    organizationId?: string;
  }) {
    const { status, serviceId, requesterId, page = 1, limit = 20, organizationId } = options;
    console.log('[ServiceCatalogService] findAllRequests options:', JSON.stringify(options));

    const where: Prisma.ServiceRequestWhereInput = {};
    if (organizationId) {
      where.organizationId = organizationId;
    }
    if (status && status.length > 0) {
      console.log('[ServiceCatalogService] Status filter:', status);
      where.status = { in: status };
    }
    if (serviceId) where.serviceId = serviceId;
    if (requesterId) where.requesterId = requesterId;

    console.log('[ServiceCatalogService] Where clause:', JSON.stringify(where));

    const [requests, total] = await Promise.all([
      this.prisma.serviceRequest.findMany({
        where,
        include: {
          service: { select: { id: true, name: true, slug: true } },
          requester: { select: { id: true, firstName: true, lastName: true, email: true } },
        },
        skip: (page - 1) * limit,
        take: limit,
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.serviceRequest.count({ where }),
    ]);

    return { items: requests, total, page, limit, totalPages: Math.ceil(total / limit) };
  }

  async findRequestById(id: string, organizationId?: string) {
    const where: any = { id };
    if (organizationId) {
      where.organizationId = organizationId;
    }
    const request = await this.prisma.serviceRequest.findFirst({
      where,
      include: {
        service: true,
        requester: { select: { id: true, firstName: true, lastName: true, email: true } },
        approver: { select: { id: true, firstName: true, lastName: true } },
        approvedBy: { select: { id: true, firstName: true, lastName: true } },
        linkedTicket: { select: { id: true, ticketNumber: true } },
      },
    });

    if (!request) throw new NotFoundException('Service request not found');
    return request;
  }

  async createRequest(data: {
    serviceId: string;
    justification?: string;
    formData?: Record<string, unknown>;
  }, userId: string, organizationId?: string) {
    const where: any = { id: data.serviceId };
    if (organizationId) {
      where.organizationId = organizationId;
    }
    const service = await this.prisma.service.findFirst({
      where,
    });
    if (!service) throw new NotFoundException('Service not found');

    const countWhere: any = {};
    if (organizationId) {
      countWhere.organizationId = organizationId;
    }
    const count = await this.prisma.serviceRequest.count({ where: countWhere });
    const requestNumber = `SRQ-${new Date().toISOString().slice(0, 10).replace(/-/g, '')}-${String(count + 1).padStart(4, '0')}`;

    let slaDeadline: Date | undefined;
    if (service.slaHours) {
      slaDeadline = new Date();
      slaDeadline.setHours(slaDeadline.getHours() + service.slaHours);
    }

    const request = await this.prisma.serviceRequest.create({
      data: {
        requestNumber,
        serviceId: data.serviceId,
        requesterId: userId,
        justification: data.justification,
        formData: data.formData as Prisma.JsonObject,
        approvalRequired: service.requiresApproval,
        slaDeadline,
        status: service.autoFulfill ? ServiceRequestStatus.APPROVED : ServiceRequestStatus.DRAFT,
        organizationId,
      },
      include: {
        service: { select: { id: true, name: true, slug: true } },
        requester: { select: { id: true, firstName: true, lastName: true, email: true } },
      },
    });

    await this.prisma.service.update({
      where: { id: data.serviceId },
      data: { requestCount: { increment: 1 } },
    });

    return request;
  }

  async submitRequest(id: string, organizationId?: string) {
    const request = await this.findRequestById(id, organizationId);
    if (request.status !== ServiceRequestStatus.DRAFT) {
      throw new Error('Request can only be submitted from draft status');
    }

    return this.prisma.serviceRequest.update({
      where: { id },
      data: {
        status: request.approvalRequired
          ? ServiceRequestStatus.PENDING_APPROVAL
          : ServiceRequestStatus.IN_PROGRESS,
        submittedAt: new Date(),
      },
    });
  }

  async approveRequest(id: string, approverId: string, comments?: string, organizationId?: string) {
    const request = await this.findRequestById(id, organizationId);

    // Fetch the service to get assigned team/agent
    const service = await this.prisma.service.findUnique({
      where: { id: request.serviceId },
      select: { id: true, name: true, assignedTeamId: true, assignedAgentId: true },
    });

    // Create a ticket linked to this service request
    const prefix = 'SR';
    const maxRetries = 10;
    let ticketNumber: string = '';
    let ticketId: string = '';

    for (let attempt = 0; attempt < maxRetries; attempt++) {
      try {
        const existingTickets = await this.prisma.ticket.findMany({
          where: { type: 'service_request', organizationId },
          select: { ticketNumber: true },
          orderBy: { createdAt: 'desc' },
          take: 1,
        });

        let nextNumber = 1;
        if (existingTickets.length > 0) {
          const lastTicketNumber = existingTickets[0].ticketNumber;
          const match = lastTicketNumber.match(new RegExp(`^${prefix}-(\\d+)(?:-\\w+)?$`));
          if (match) {
            nextNumber = parseInt(match[1], 10) + 1;
          }
        }
        const randomSuffix = Math.random().toString(36).substring(2, 6).toUpperCase();
        ticketNumber = `${prefix}-${String(nextNumber).padStart(5, '0')}-${randomSuffix}`;

        // Verify the ticket number doesn't exist
        const existing = await this.prisma.ticket.findFirst({
          where: { ticketNumber, organizationId },
        });
        if (existing) {
          throw new Error(`Ticket number ${ticketNumber} already exists`);
        }

        // Build description from service request data
        let description = `Service Request: ${service?.name || 'Unknown Service'}\n`;
        description += `Request Number: ${request.requestNumber}\n\n`;
        if (request.justification) {
          description += `Justification:\n${request.justification}\n\n`;
        }
        if (request.formData) {
          description += `Form Data:\n${JSON.stringify(request.formData, null, 2)}`;
        }

        // Create ticket with the service request
        const ticket = await this.prisma.$transaction(async (tx) => {
          const data: Prisma.TicketCreateInput = {
            ticketNumber,
            channel: 'manual',
            type: 'service_request',
            title: `${service?.name || 'Service Request'} - ${request.requestNumber}`,
            description,
            priority: 'medium',
            status: 'new',
            requester: { connect: { id: request.requesterId } },
            slaDeadline: request.slaDeadline,
            lastActivityAt: new Date(),
            organization: { connect: { id: organizationId } },
            linkedTicket: { connect: { id: request.id } },
          };

          if (service?.assignedAgentId) {
            data.assignedAgent = { connect: { id: service.assignedAgentId } };
          }
          if (service?.assignedTeamId) {
            data.assignedTeam = { connect: { id: service.assignedTeamId } };
          }

          return tx.ticket.create({ data });
        });

        ticketId = ticket.id;
        break;
      } catch (error: any) {
        if (attempt === maxRetries - 1) {
          throw new Error(`Failed to create ticket after ${maxRetries} attempts: ${error.message}`);
        }
        // Continue to next retry
      }
    }

    // Update the service request with the linked ticket and set status to in_progress
    return this.prisma.serviceRequest.update({
      where: { id },
      data: {
        status: ServiceRequestStatus.IN_PROGRESS,
        approvedById: approverId,
        approvedAt: new Date(),
        approvalComments: comments,
        linkedTicketId: ticketId,
      },
    });
  }

  async rejectRequest(id: string, approverId: string, comments: string, organizationId?: string) {
    await this.findRequestById(id, organizationId);

    return this.prisma.serviceRequest.update({
      where: { id },
      data: {
        status: ServiceRequestStatus.REJECTED,
        approvedById: approverId,
        approvedAt: new Date(),
        approvalComments: comments,
      },
    });
  }

  async completeRequest(id: string, notes?: string, rating?: number, feedback?: string, organizationId?: string) {
    const request = await this.findRequestById(id, organizationId);

    const update = await this.prisma.serviceRequest.update({
      where: { id },
      data: {
        status: ServiceRequestStatus.COMPLETED,
        completedAt: new Date(),
        completionNotes: notes,
        rating,
        userFeedback: feedback,
      },
    });

    const completedCount = await this.prisma.serviceRequest.count({
      where: {
        serviceId: request.serviceId,
        status: ServiceRequestStatus.COMPLETED,
      },
    });
    const totalCount = await this.prisma.serviceRequest.count({
      where: { serviceId: request.serviceId },
    });

    await this.prisma.service.update({
      where: { id: request.serviceId },
      data: {
        completionRate: totalCount > 0 ? (completedCount / totalCount) * 100 : 0,
      },
    });

    return update;
  }

  async cancelRequest(id: string, organizationId?: string) {
    await this.findRequestById(id, organizationId);
    return this.prisma.serviceRequest.update({
      where: { id },
      data: { status: ServiceRequestStatus.CANCELLED },
    });
  }

  // Stats - user-specific, don't cache
  async getStats(requesterId?: string, organizationId?: string) {
    const where: any = {};
    if (organizationId) {
      where.organizationId = organizationId;
    }
    if (requesterId) {
      where.requesterId = requesterId;
    }

    const [
      totalRequests,
      pendingApprovals,
      inProgress,
      completedThisMonth,
      myRequests,
    ] = await Promise.all([
      this.prisma.serviceRequest.count({ where }),
      this.prisma.serviceRequest.count({
        where: { ...where, status: ServiceRequestStatus.PENDING_APPROVAL },
      }),
      this.prisma.serviceRequest.count({
        where: { ...where, status: ServiceRequestStatus.IN_PROGRESS },
      }),
      this.prisma.serviceRequest.count({
        where: {
          ...where,
          status: ServiceRequestStatus.COMPLETED,
          completedAt: { gte: new Date(new Date().setDate(1)) },
        },
      }),
      this.prisma.serviceRequest.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        take: 10,
        include: {
          service: { select: { name: true, slug: true } },
        },
      }),
    ]);

    return {
      totalRequests,
      pendingApprovals,
      inProgress,
      completedThisMonth,
      myRequests,
    };
  }

  // Cache invalidation
  private async invalidateCache(organizationId?: string): Promise<void> {
    if (organizationId) {
      // Delete all service catalog cache keys for this organization
      // The cache keys include org ID in JSON format, so we match the pattern
      await this.cache.delPattern(`cache:catalog:services:*${organizationId}*`);
      await this.cache.delPattern(`cache:catalog:service:${organizationId}*`);
      await this.cache.delPattern(`cache:catalog:categories:*${organizationId}*`);
    } else {
      // Delete all cache keys
      await this.cache.delPattern('cache:catalog:services*');
      await this.cache.delPattern('cache:catalog:service*');
      await this.cache.del(this.cache.key('catalog', 'categories'));
      await this.cache.del(this.cache.key('catalog', 'categories', 'all'));
    }
  }

  private generateSlug(name: string): string {
    return name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
  }
}
