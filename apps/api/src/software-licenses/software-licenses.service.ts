import { Injectable, NotFoundException, BadRequestException, Logger } from '@nestjs/common';
import { PrismaService } from '../common/prisma.service';
import {
  CreateSoftwareDto,
  UpdateSoftwareDto,
  CreateSoftwareLicenseDto,
  UpdateSoftwareLicenseDto,
  CreateLicenseAssignmentDto,
  SoftwareQueryDto,
  LicenseQueryDto,
  AssignmentQueryDto,
} from './software-licenses.dto';
import { Prisma } from '@prisma/client';

@Injectable()
export class SoftwareLicensesService {
  private readonly logger = new Logger(SoftwareLicensesService.name);

  constructor(private prisma: PrismaService) {}

  // ==================== Software ====================

  async createSoftware(dto: CreateSoftwareDto, organizationId?: string) {
    const slug = this.generateSlug(dto.name);

    return this.prisma.software.create({
      data: {
        ...dto,
        slug,
        organizationId,
      },
      include: {
        licenses: {
          select: {
            id: true,
            name: true,
            totalSeats: true,
            purchasedSeats: true,
            isActive: true,
          },
        },
      },
    });
  }

  async findAllSoftware(query: SoftwareQueryDto, organizationId?: string) {
    const { search, category, licenseType, isActive, page = 1, limit = 20 } = query;
    const skip = (page - 1) * limit;

    const where: Prisma.SoftwareWhereInput = {};

    if (organizationId) {
      where.organizationId = organizationId;
    }

    if (search) {
      where.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { vendor: { contains: search, mode: 'insensitive' } },
        { publisher: { contains: search, mode: 'insensitive' } },
      ];
    }

    if (category) {
      where.category = category;
    }

    if (licenseType) {
      where.licenseType = licenseType;
    }

    if (isActive !== undefined) {
      where.isActive = isActive;
    }

    const [items, total] = await Promise.all([
      this.prisma.software.findMany({
        where,
        skip,
        take: limit,
        orderBy: { name: 'asc' },
        include: {
          licenses: {
            select: {
              id: true,
              totalSeats: true,
              purchasedSeats: true,
              expiryDate: true,
            },
          },
        },
      }),
      this.prisma.software.count({ where }),
    ]);

    return {
      items,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  async findSoftwareById(id: string, organizationId?: string) {
    const where: Prisma.SoftwareWhereInput = { id };
    if (organizationId) {
      where.organizationId = organizationId;
    }

    const software = await this.prisma.software.findFirst({
      where,
      include: {
        licenses: {
          where: { isActive: true },
          include: {
            assignments: {
              where: { revokedAt: null },
              include: {
                user: {
                  select: { id: true, firstName: true, lastName: true, email: true },
                },
                asset: {
                  select: { id: true, name: true, assetTag: true },
                },
              },
            },
          },
        },
      },
    });

    if (!software) {
      throw new NotFoundException('Software not found');
    }

    return software;
  }

  async updateSoftware(id: string, dto: UpdateSoftwareDto, organizationId?: string) {
    await this.findSoftwareById(id, organizationId);

    return this.prisma.software.update({
      where: { id },
      data: dto,
    });
  }

  async deleteSoftware(id: string, organizationId?: string) {
    await this.findSoftwareById(id, organizationId);

    // Check for active licenses
    const activeLicenses = await this.prisma.softwareLicense.count({
      where: { softwareId: id, isActive: true },
    });

    if (activeLicenses > 0) {
      throw new BadRequestException(
        'Cannot delete software with active licenses. Please deactivate instead.',
      );
    }

    return this.prisma.software.delete({ where: { id } });
  }

  // ==================== Software Licenses ====================

  async createLicense(dto: CreateSoftwareLicenseDto, organizationId?: string) {
    // Verify software exists
    await this.findSoftwareById(dto.softwareId, organizationId);

    return this.prisma.softwareLicense.create({
      data: {
        ...dto,
        organizationId,
        purchaseDate: dto.purchaseDate ? new Date(dto.purchaseDate) : undefined,
        expiryDate: dto.expiryDate ? new Date(dto.expiryDate) : undefined,
      },
      include: {
        software: {
          select: { id: true, name: true, slug: true },
        },
        _count: {
          select: {
            assignments: {
              where: { revokedAt: null },
            },
          },
        },
      },
    });
  }

  async findAllLicenses(query: LicenseQueryDto, organizationId?: string) {
    const {
      search,
      softwareId,
      licenseType,
      isActive,
      expiringSoon,
      page = 1,
      limit = 20,
    } = query;
    const skip = (page - 1) * limit;

    const where: Prisma.SoftwareLicenseWhereInput = {};

    if (organizationId) {
      where.organizationId = organizationId;
    }

    if (search) {
      where.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { licenseKey: { contains: search, mode: 'insensitive' } },
        { vendor: { contains: search, mode: 'insensitive' } },
        { subscriptionId: { contains: search, mode: 'insensitive' } },
      ];
    }

    if (softwareId) {
      where.softwareId = softwareId;
    }

    if (licenseType) {
      where.licenseType = licenseType;
    }

    if (isActive !== undefined) {
      where.isActive = isActive;
    }

    if (expiringSoon) {
      const thirtyDaysFromNow = new Date();
      thirtyDaysFromNow.setDate(thirtyDaysFromNow.getDate() + 30);
      where.expiryDate = {
        lte: thirtyDaysFromNow,
        gte: new Date(),
      };
    }

    const [items, total] = await Promise.all([
      this.prisma.softwareLicense.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          software: {
            select: { id: true, name: true, slug: true },
          },
          _count: {
            select: {
              assignments: {
                where: { revokedAt: null },
              },
            },
          },
        },
      }),
      this.prisma.softwareLicense.count({ where }),
    ]);

    return {
      items,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  async findLicenseById(id: string, organizationId?: string) {
    const where: Prisma.SoftwareLicenseWhereInput = { id };
    if (organizationId) {
      where.organizationId = organizationId;
    }

    const license = await this.prisma.softwareLicense.findFirst({
      where,
      include: {
        software: true,
        assignments: {
          where: { revokedAt: null },
          include: {
            user: {
              select: { id: true, firstName: true, lastName: true, email: true },
            },
            asset: {
              select: { id: true, name: true, assetTag: true },
            },
          },
        },
      },
    });

    if (!license) {
      throw new NotFoundException('License not found');
    }

    return license;
  }

  async updateLicense(id: string, dto: UpdateSoftwareLicenseDto, organizationId?: string) {
    await this.findLicenseById(id, organizationId);

    return this.prisma.softwareLicense.update({
      where: { id },
      data: {
        ...dto,
        purchaseDate: dto.purchaseDate ? new Date(dto.purchaseDate) : undefined,
        expiryDate: dto.expiryDate ? new Date(dto.expiryDate) : undefined,
      },
    });
  }

  async deleteLicense(id: string, organizationId?: string) {
    await this.findLicenseById(id, organizationId);

    // Check for active assignments
    const activeAssignments = await this.prisma.softwareLicenseAssignment.count({
      where: { licenseId: id, revokedAt: null },
    });

    if (activeAssignments > 0) {
      throw new BadRequestException(
        'Cannot delete license with active assignments. Please revoke them first.',
      );
    }

    return this.prisma.softwareLicense.delete({ where: { id } });
  }

  // ==================== License Assignments ====================

  async createAssignment(dto: CreateLicenseAssignmentDto, assignedById: string, organizationId?: string) {
    // Verify license exists
    const license = await this.findLicenseById(dto.licenseId, organizationId);

    if (!dto.userId && !dto.assetId) {
      throw new BadRequestException('Either userId or assetId must be provided');
    }

    // Check seat availability
    const currentAssignments = license.assignments.length;
    if (currentAssignments >= license.totalSeats) {
      throw new BadRequestException('No available seats for this license');
    }

    // Check for existing assignment
    const existingAssignment = await this.prisma.softwareLicenseAssignment.findFirst({
      where: {
        licenseId: dto.licenseId,
        revokedAt: null,
        OR: [
          { userId: dto.userId || undefined },
          { assetId: dto.assetId || undefined },
        ],
      },
    });

    if (existingAssignment) {
      throw new BadRequestException('This user or asset already has an active assignment for this license');
    }

    return this.prisma.softwareLicenseAssignment.create({
      data: {
        ...dto,
        assignedById,
        // organizationId is not on this model - it's inherited from the license
      },
      include: {
        license: {
          select: { id: true, name: true, totalSeats: true },
        },
        user: {
          select: { id: true, firstName: true, lastName: true, email: true },
        },
        asset: {
          select: { id: true, name: true, assetTag: true },
        },
      },
    });
  }

  async findAllAssignments(query: AssignmentQueryDto, organizationId?: string) {
    const { licenseId, userId, assetId, includeRevoked } = query;

    const where: Prisma.SoftwareLicenseAssignmentWhereInput = {};

    // Filter by organization via license relationship
    if (organizationId) {
      where.license = { organizationId };
    }

    if (licenseId) {
      where.licenseId = licenseId;
    }

    if (userId) {
      where.userId = userId;
    }

    if (assetId) {
      where.assetId = assetId;
    }

    if (!includeRevoked) {
      where.revokedAt = null;
    }

    return this.prisma.softwareLicenseAssignment.findMany({
      where,
      orderBy: { assignedAt: 'desc' },
      include: {
        license: {
          select: { id: true, name: true, totalSeats: true, expiryDate: true },
        },
        user: {
          select: { id: true, firstName: true, lastName: true, email: true },
        },
        asset: {
          select: { id: true, name: true, assetTag: true },
        },
      },
    });
  }

  async revokeAssignment(id: string, revokedById: string, organizationId?: string) {
    // Filter by organization via license relationship if needed
    const assignment = await this.prisma.softwareLicenseAssignment.findFirst({
      where: organizationId
        ? { id, license: { organizationId } }
        : { id },
    });

    if (!assignment) {
      throw new NotFoundException('Assignment not found');
    }

    if (assignment.revokedAt) {
      throw new BadRequestException('Assignment is already revoked');
    }

    return this.prisma.softwareLicenseAssignment.update({
      where: { id },
      data: {
        revokedAt: new Date(),
        revokedById,
      },
    });
  }

  async deleteAssignment(id: string, organizationId?: string) {
    await this.prisma.softwareLicenseAssignment.findFirst({
      where: organizationId
        ? { id, license: { organizationId } }
        : { id },
    });

    return this.prisma.softwareLicenseAssignment.delete({ where: { id } });
  }

  // ==================== Statistics ====================

  async getStats(organizationId?: string) {
    const whereOrg = organizationId ? { organizationId } : {};
    const whereAssignmentOrg = organizationId ? { license: whereOrg } : {};

    const [
      totalSoftware,
      totalLicenses,
      activeLicenses,
      expiringLicenses,
      totalAssignments,
      totalSeats,
    ] = await Promise.all([
      this.prisma.software.count({ where: { ...whereOrg, isActive: true } }),
      this.prisma.softwareLicense.count({ where: whereOrg }),
      this.prisma.softwareLicense.count({ where: { ...whereOrg, isActive: true } }),
      this.prisma.softwareLicense.count({
        where: {
          ...whereOrg,
          isActive: true,
          expiryDate: {
            lte: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
            gte: new Date(),
          },
        },
      }),
      this.prisma.softwareLicenseAssignment.count({ where: { ...whereAssignmentOrg, revokedAt: null } }),
      this.prisma.softwareLicense.aggregate({
        _sum: { totalSeats: true },
        where: { ...whereOrg, isActive: true },
      }),
    ]);

    const usedSeats = totalAssignments;

    return {
      totalSoftware,
      totalLicenses,
      activeLicenses,
      expiringLicenses,
      totalAssignments,
      usedSeats,
      totalSeats: totalSeats._sum.totalSeats || 0,
      availableSeats: (totalSeats._sum.totalSeats || 0) - usedSeats,
      seatUtilization: totalSeats._sum.totalSeats
        ? Math.round((usedSeats / totalSeats._sum.totalSeats) * 100)
        : 0,
    };
  }

  // ==================== Helpers ====================

  private generateSlug(name: string): string {
    const base = name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '');
    return `${base}-${Date.now().toString(36)}`;
  }
}
