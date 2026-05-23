import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../common/prisma.service';
import {
  CreateAssetDto,
  UpdateAssetDto,
  AssetQueryDto,
  CreateAssetTypeDto,
  UpdateAssetTypeDto,
  CreateAssetRelationshipDto,
  UpdateAssetRelationshipDto,
  CreateMaintenanceDto,
  UpdateMaintenanceDto,
  LinkAssetTicketDto,
} from './dto/asset.dto';
import { Prisma } from '@prisma/client';

@Injectable()
export class AssetsService {
  constructor(private prisma: PrismaService) {}

  // ============ Asset Types ============

  async findAllTypes(organizationId?: string) {
    const where: any = { isActive: true };
    if (organizationId) {
      where.organizationId = organizationId;
    }
    return this.prisma.assetType.findMany({
      where,
      orderBy: { sortOrder: 'asc' },
      include: {
        _count: {
          select: { assets: true },
        },
      },
    });
  }

  async findTypeById(id: string, organizationId?: string) {
    const where: any = { id };
    if (organizationId) {
      where.organizationId = organizationId;
    }
    const type = await this.prisma.assetType.findFirst({
      where,
      include: { _count: { select: { assets: true } } },
    });
    if (!type) throw new NotFoundException('Asset type not found');
    return type;
  }

  async createType(dto: CreateAssetTypeDto, organizationId?: string) {
    const slug = this.generateSlug(dto.name);
    return this.prisma.assetType.create({
      data: {
        name: dto.name,
        slug,
        description: dto.description,
        icon: dto.icon,
        color: dto.color,
        sortOrder: dto.sortOrder ?? 0,
        organizationId,
      },
    });
  }

  async updateType(id: string, dto: UpdateAssetTypeDto, organizationId?: string) {
    await this.findTypeById(id, organizationId);
    return this.prisma.assetType.update({
      where: { id },
      data: dto,
    });
  }

  async deleteType(id: string, organizationId?: string) {
    await this.findTypeById(id, organizationId);

    // Check if type has assets
    const where: any = { typeId: id };
    if (organizationId) {
      where.organizationId = organizationId;
    }
    const assetCount = await this.prisma.asset.count({ where });
    if (assetCount > 0) {
      throw new Error(`Cannot delete type with ${assetCount} associated assets`);
    }

    return this.prisma.assetType.delete({ where: { id } });
  }

  // ============ Assets ============

  async findAll(query: AssetQueryDto, organizationId?: string) {
    const {
      page = 1,
      limit = 20,
      status,
      typeId,
      assignedToId,
      department,
      search,
      sortBy = 'createdAt',
      sortOrder = 'desc',
    } = query;

    const where: Prisma.AssetWhereInput = {
      deletedAt: null,
    };

    if (organizationId) {
      where.organizationId = organizationId;
    }

    if (status && status.length > 0) {
      where.status = { in: status };
    }

    if (typeId) {
      where.typeId = typeId;
    }

    if (assignedToId) {
      where.assignedToId = assignedToId;
    }

    if (department) {
      where.department = department;
    }

    if (search) {
      where.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { assetTag: { contains: search, mode: 'insensitive' } },
        { serialNumber: { contains: search, mode: 'insensitive' } },
        { manufacturer: { contains: search, mode: 'insensitive' } },
        { model: { contains: search, mode: 'insensitive' } },
        { hostname: { contains: search, mode: 'insensitive' } },
        { ipAddress: { contains: search, mode: 'insensitive' } },
      ];
    }

    const [items, total] = await Promise.all([
      this.prisma.asset.findMany({
        where,
        include: {
          type: true,
          assignedTo: {
            select: { id: true, firstName: true, lastName: true, email: true },
          },
          parentAsset: {
            select: { id: true, name: true, assetTag: true },
          },
          _count: {
            select: {
              childAssets: true,
              relationshipsFrom: true,
              relationshipsTo: true,
              maintenanceRecords: true,
              tickets: true,
            },
          },
        },
        skip: (page - 1) * limit,
        take: limit,
        orderBy: { [sortBy]: sortOrder },
      }),
      this.prisma.asset.count({ where }),
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
    const where: any = { id, deletedAt: null };
    if (organizationId) {
      where.organizationId = organizationId;
    }
    const asset = await this.prisma.asset.findFirst({
      where,
      include: {
        type: true,
        assignedTo: {
          select: { id: true, firstName: true, lastName: true, email: true },
        },
        parentAsset: {
          select: { id: true, name: true, assetTag: true },
        },
        childAssets: {
          select: { id: true, name: true, assetTag: true, status: true },
        },
        relationshipsFrom: {
          include: {
            toAsset: {
              select: { id: true, name: true, assetTag: true, status: true, type: true },
            },
          },
        },
        relationshipsTo: {
          include: {
            fromAsset: {
              select: { id: true, name: true, assetTag: true, status: true, type: true },
            },
          },
        },
        maintenanceRecords: {
          orderBy: { createdAt: 'desc' },
          take: 10,
        },
        tickets: {
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
      },
    });

    if (!asset) {
      throw new NotFoundException('Asset not found');
    }

    return asset;
  }

  async findByAssetTag(assetTag: string, organizationId?: string) {
    const where: any = { assetTag, deletedAt: null };
    if (organizationId) {
      where.organizationId = organizationId;
    }
    const asset = await this.prisma.asset.findFirst({
      where,
      include: { type: true },
    });
    if (!asset) {
      throw new NotFoundException('Asset not found');
    }
    return asset;
  }

  async create(dto: CreateAssetDto, organizationId?: string) {
    // Generate asset tag if not provided
    let assetTag = dto.assetTag;
    if (!assetTag) {
      const where: any = { deletedAt: null };
      if (organizationId) {
        where.organizationId = organizationId;
      }
      const count = await this.prisma.asset.count({ where });
      assetTag = `AST-${String(count + 1).padStart(6, '0')}`;
    }

    const data: Prisma.AssetCreateInput = {
      name: dto.name,
      assetTag,
      serialNumber: dto.serialNumber,
      type: { connect: { id: dto.typeId } },
      status: dto.status ?? 'active',
      manufacturer: dto.manufacturer,
      model: dto.model,
      version: dto.version,
      vendor: dto.vendor,
      purchaseDate: dto.purchaseDate ? new Date(dto.purchaseDate) : null,
      purchaseCost: dto.purchaseCost,
      warrantyExpiry: dto.warrantyExpiry ? new Date(dto.warrantyExpiry) : null,
      location: dto.location,
      department: dto.department,
      ipAddress: dto.ipAddress,
      macAddress: dto.macAddress,
      hostname: dto.hostname,
      operatingSystem: dto.operatingSystem,
      cpu: dto.cpu,
      ram: dto.ram,
      storage: dto.storage,
      notes: dto.notes,
      metadata: dto.metadata as Prisma.InputJsonValue,
      lastInventoryAt: new Date(),
      organization: organizationId ? { connect: { id: organizationId } } : undefined,
    };

    if (dto.assignedToId) {
      data.assignedTo = { connect: { id: dto.assignedToId } };
    }

    return this.prisma.asset.create({ data });
  }

  async update(id: string, dto: UpdateAssetDto, organizationId?: string) {
    await this.findById(id, organizationId);

    const updateData: Prisma.AssetUpdateInput = {
      ...dto,
      purchaseDate: dto.purchaseDate ? new Date(dto.purchaseDate) : undefined,
      warrantyExpiry: dto.warrantyExpiry ? new Date(dto.warrantyExpiry) : undefined,
      metadata: dto.metadata as Prisma.InputJsonValue | undefined,
    };

    if (dto.assignedToId !== undefined) {
      updateData.assignedTo = dto.assignedToId
        ? { connect: { id: dto.assignedToId } }
        : { disconnect: true };
    }

    // Remove undefined values
    Object.keys(updateData).forEach((key) => {
      if ((updateData as any)[key] === undefined) {
        delete (updateData as any)[key];
      }
    });

    return this.prisma.asset.update({
      where: { id },
      data: updateData,
    });
  }

  async delete(id: string, organizationId?: string) {
    await this.findById(id, organizationId);
    return this.prisma.asset.update({
      where: { id },
      data: { deletedAt: new Date() },
    });
  }

  async getAssetTree(id: string, maxDepth: number = 3, organizationId?: string) {
    const asset = await this.findById(id, organizationId);

    // Optimized: fetch all descendants in one query and build tree in memory
    const getChildren = async (parentId: string, currentDepth: number): Promise<any[]> => {
      if (currentDepth >= maxDepth) return [];

      const where: any = { parentAssetId: parentId, deletedAt: null };
      if (organizationId) {
        where.organizationId = organizationId;
      }
      const children = await this.prisma.asset.findMany({
        where,
        select: {
          id: true,
          name: true,
          assetTag: true,
          status: true,
          type: true,
        },
      });

      if (children.length === 0) return [];

      // Recursively fetch children (with depth limit)
      const childIds = children.map((c) => c.id);
      const childrenWithNested = await Promise.all(
        children.map(async (child) => ({
          ...child,
          children: currentDepth < maxDepth - 1 ? await getChildren(child.id, currentDepth + 1) : [],
        })),
      );

      return childrenWithNested;
    };

    return {
      ...asset,
      children: await getChildren(id, 0),
    };
  }

  // ============ Asset Relationships ============

  async createRelationship(dto: CreateAssetRelationshipDto, organizationId?: string) {
    // Verify both assets exist
    await this.findById(dto.fromAssetId, organizationId);
    await this.findById(dto.toAssetId, organizationId);

    if (dto.fromAssetId === dto.toAssetId) {
      throw new Error('Cannot create relationship between the same asset');
    }

    return this.prisma.assetRelationship.create({
      data: {
        fromAssetId: dto.fromAssetId,
        toAssetId: dto.toAssetId,
        type: dto.type,
        description: dto.description,
      },
      include: {
        fromAsset: { select: { id: true, name: true, assetTag: true } },
        toAsset: { select: { id: true, name: true, assetTag: true } },
      },
    });
  }

  async updateRelationship(id: string, dto: UpdateAssetRelationshipDto, organizationId?: string) {
    const relationship = await this.prisma.assetRelationship.findUnique({
      where: { id },
    });
    if (!relationship) throw new NotFoundException('Relationship not found');

    // If type is being changed, verify the new relationship doesn't already exist
    if (dto.type && dto.type !== relationship.type) {
      const existing = await this.prisma.assetRelationship.findFirst({
        where: {
          fromAssetId: relationship.fromAssetId,
          toAssetId: relationship.toAssetId,
          type: dto.type,
          id: { not: id },
        },
      });
      if (existing) {
        throw new Error('A relationship with this type already exists between these assets');
      }
    }

    return this.prisma.assetRelationship.update({
      where: { id },
      data: {
        type: dto.type,
        description: dto.description,
        isActive: dto.isActive,
      },
      include: {
        fromAsset: { select: { id: true, name: true, assetTag: true } },
        toAsset: { select: { id: true, name: true, assetTag: true } },
      },
    });
  }

  async getRelationshipById(id: string, organizationId?: string) {
    const relationship = await this.prisma.assetRelationship.findUnique({
      where: { id },
      include: {
        fromAsset: {
          select: { id: true, name: true, assetTag: true, status: true, type: true },
        },
        toAsset: {
          select: { id: true, name: true, assetTag: true, status: true, type: true },
        },
      },
    });
    if (!relationship) throw new NotFoundException('Relationship not found');
    return relationship;
  }

  async deleteRelationship(id: string, organizationId?: string) {
    const relationship = await this.prisma.assetRelationship.findUnique({
      where: { id },
    });
    if (!relationship) throw new NotFoundException('Relationship not found');
    return this.prisma.assetRelationship.delete({ where: { id } });
  }

  async getAssetImpact(id: string, maxDepth: number = 3, organizationId?: string) {
    // Get all assets that depend on this asset (cascade)
    const getDependents = async (assetId: string, depth: number): Promise<any[]> => {
      if (depth >= maxDepth) return [];

      const relationships = await this.prisma.assetRelationship.findMany({
        where: {
          toAssetId: assetId,
          isActive: true,
          type: { in: ['hosts', 'depends_on', 'runs_on', 'supports'] },
        },
        include: {
          fromAsset: {
            select: { id: true, name: true, assetTag: true, status: true, type: true },
          },
        },
      });

      const result = [];
      for (const rel of relationships) {
        result.push({
          ...rel.fromAsset,
          relationship: rel.type,
          dependents: depth < maxDepth - 1 ? await getDependents(rel.fromAsset.id, depth + 1) : [],
        });
      }
      return result;
    };

    const asset = await this.findById(id, organizationId);
    return {
      asset: {
        id: asset.id,
        name: asset.name,
        assetTag: asset.assetTag,
        status: asset.status,
      },
      impactedAssets: await getDependents(id, 0),
    };
  }

  // ============ Maintenance Records ============

  async findMaintenanceRecords(assetId: string, organizationId?: string) {
    await this.findById(assetId, organizationId);
    return this.prisma.assetMaintenance.findMany({
      where: { assetId },
      orderBy: { createdAt: 'desc' },
    });
  }

  async createMaintenance(dto: CreateMaintenanceDto, organizationId?: string) {
    await this.findById(dto.assetId, organizationId);
    return this.prisma.assetMaintenance.create({
      data: {
        assetId: dto.assetId,
        type: dto.type,
        title: dto.title,
        description: dto.description,
        performedBy: dto.performedBy,
        performedAt: dto.performedAt ? new Date(dto.performedAt) : null,
        nextDueDate: dto.nextDueDate ? new Date(dto.nextDueDate) : null,
        cost: dto.cost,
      },
    });
  }

  async updateMaintenance(id: string, dto: UpdateMaintenanceDto, organizationId?: string) {
    const maintenance = await this.prisma.assetMaintenance.findUnique({
      where: { id },
    });
    if (!maintenance) throw new NotFoundException('Maintenance record not found');

    return this.prisma.assetMaintenance.update({
      where: { id },
      data: {
        ...dto,
        performedAt: dto.performedAt ? new Date(dto.performedAt) : undefined,
        nextDueDate: dto.nextDueDate ? new Date(dto.nextDueDate) : undefined,
      },
    });
  }

  async deleteMaintenance(id: string, organizationId?: string) {
    const maintenance = await this.prisma.assetMaintenance.findUnique({
      where: { id },
    });
    if (!maintenance) throw new NotFoundException('Maintenance record not found');
    return this.prisma.assetMaintenance.delete({ where: { id } });
  }

  // ============ Asset Ticket Linking ============

  async linkTicket(assetId: string, dto: LinkAssetTicketDto, ticketId: string, organizationId?: string) {
    await this.findById(assetId, organizationId);

    // Verify ticket exists
    const ticket = await this.prisma.ticket.findUnique({
      where: { id: ticketId },
    });
    if (!ticket) throw new NotFoundException('Ticket not found');

    // Check if already linked
    const existing = await this.prisma.assetTicket.findUnique({
      where: {
        assetId_ticketId: {
          assetId,
          ticketId: dto.assetId,
        },
      },
    });

    if (existing) {
      return existing;
    }

    return this.prisma.assetTicket.create({
      data: {
        assetId,
        ticketId: dto.assetId,
      },
    });
  }

  async unlinkTicket(assetId: string, linkedAssetId: string, organizationId?: string) {
    return this.prisma.assetTicket.delete({
      where: {
        assetId_ticketId: {
          assetId,
          ticketId: linkedAssetId,
        },
      },
    });
  }

  // ============ Statistics ============

  async getStats(organizationId?: string) {
    const where: any = { deletedAt: null };
    if (organizationId) {
      where.organizationId = organizationId;
    }

    const [
      totalAssets,
      activeAssets,
      maintenanceDue,
      recentActivity,
    ] = await Promise.all([
      this.prisma.asset.count({ where }),
      this.prisma.asset.count({ where: { ...where, status: 'active' } }),
      this.prisma.assetMaintenance.count({
        where: {
          status: 'scheduled',
          nextDueDate: { lte: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000) }, // Due within 7 days
        },
      }),
      this.prisma.asset.findMany({
        where,
        orderBy: { updatedAt: 'desc' },
        take: 5,
        select: {
          id: true,
          name: true,
          assetTag: true,
          status: true,
          updatedAt: true,
        },
      }),
    ]);

    const byType = await this.prisma.asset.groupBy({
      by: ['typeId'],
      where,
      _count: { typeId: true },
    });

    // Batch fetch all asset types to avoid N+1 queries
    const typeIds = byType.map((item) => item.typeId);
    const assetTypes = await this.prisma.assetType.findMany({
      where: { id: { in: typeIds } },
      select: { id: true, name: true },
    });

    const typeMap = new Map(assetTypes.map((t) => [t.id, t.name]));
    const typeDetails = byType.map((item) => ({
      type: typeMap.get(item.typeId) ?? 'Unknown',
      count: item._count.typeId,
    }));

    return {
      totalAssets,
      activeAssets,
      maintenanceDue,
      recentActivity,
      byType: typeDetails,
    };
  }

  // ============ CMDB Enhancement: Dependency Graph ============

  async getDependencyGraph(organizationId?: string) {
    const where: any = { deletedAt: null };
    if (organizationId) {
      where.organizationId = organizationId;
    }

    // Get all assets with relationships for visualization
    const assets = await this.prisma.asset.findMany({
      where,
      select: {
        id: true,
        name: true,
        assetTag: true,
        status: true,
        type: {
          select: { id: true, name: true, icon: true, color: true },
        },
        businessCriticality: true,
        ciClass: true,
      },
    });

    // Get relationships only between assets in this organization
    const assetIds = assets.map(a => a.id);
    const relationships = await this.prisma.assetRelationship.findMany({
      where: {
        isActive: true,
        fromAssetId: { in: assetIds },
        toAssetId: { in: assetIds },
      },
      select: {
        id: true,
        fromAssetId: true,
        toAssetId: true,
        type: true,
        description: true,
      },
    });

    // Build nodes and edges for graph visualization
    const nodes = assets.map((asset) => ({
      id: asset.id,
      label: asset.name,
      assetTag: asset.assetTag,
      status: asset.status,
      type: asset.type.name,
      typeColor: asset.type.color,
      criticality: asset.businessCriticality,
      ciClass: asset.ciClass,
    }));

    const edges = relationships.map((rel) => ({
      id: rel.id,
      source: rel.fromAssetId,
      target: rel.toAssetId,
      type: rel.type,
      label: rel.type,
    }));

    return { nodes, edges };
  }

  async getCiStats(organizationId?: string) {
    // CI Classification statistics
    const where: any = { deletedAt: null };
    if (organizationId) {
      where.organizationId = organizationId;
    }

    const [
      byCriticality,
      byComplexity,
      byCiClass,
      byRiskLevel,
    ] = await Promise.all([
      // Count by business criticality
      this.prisma.asset.groupBy({
        by: ['businessCriticality'],
        where,
        _count: { businessCriticality: true },
      }),
      // Count by technical complexity
      this.prisma.asset.groupBy({
        by: ['technicalComplexity'],
        where,
        _count: { technicalComplexity: true },
      }),
      // Count by CI class
      this.prisma.asset.groupBy({
        by: ['ciClass'],
        where: { ...where, ciClass: { not: null } },
        _count: { ciClass: true },
      }),
      // Count by risk level
      this.prisma.asset.groupBy({
        by: ['riskLevel'],
        where: { ...where, riskLevel: { not: null } },
        _count: { riskLevel: true },
      }),
    ]);

    return {
      byCriticality: byCriticality.map((item) => ({
        value: item.businessCriticality,
        count: item._count.businessCriticality,
      })),
      byComplexity: byComplexity.map((item) => ({
        value: item.technicalComplexity,
        count: item._count.technicalComplexity,
      })),
      byCiClass: byCiClass.map((item) => ({
        value: item.ciClass,
        count: item._count.ciClass,
      })),
      byRiskLevel: byRiskLevel.map((item) => ({
        value: item.riskLevel,
        count: item._count.riskLevel,
      })),
    };
  }

  async getImpactAnalysis(assetId: string, maxDepth: number = 2, organizationId?: string) {
    const asset = await this.findById(assetId, organizationId);

    // Get direct dependencies (what this asset depends on)
    const dependsOn = await this.prisma.assetRelationship.findMany({
      where: {
        fromAssetId: assetId,
        type: { in: ['depends_on', 'hosts', 'runs_on'] },
      },
      include: {
        toAsset: {
          select: { id: true, name: true, assetTag: true, status: true, type: true },
        },
      },
    });

    // Get cascading impact (what depends on this asset)
    const impacts = await this.prisma.assetRelationship.findMany({
      where: {
        toAssetId: assetId,
        type: { in: ['depends_on', 'hosts', 'runs_on'] },
      },
      include: {
        fromAsset: {
          select: { id: true, name: true, assetTag: true, status: true, type: true },
        },
      },
    });

    // Calculate cascade depth (limited to prevent query explosion)
    const getCascadeImpact = async (
      targetAssetId: string,
      depth: number,
    ): Promise<any[]> => {
      if (depth >= maxDepth) return [];

      const downstream = await this.prisma.assetRelationship.findMany({
        where: {
          toAssetId: targetAssetId,
          type: { in: ['depends_on', 'hosts', 'runs_on'] },
        },
        include: {
          fromAsset: {
            select: { id: true, name: true, assetTag: true, status: true, type: true },
          },
        },
      });

      const result = [];
      for (const rel of downstream) {
        result.push({
          ...rel.fromAsset,
          relationship: rel.type,
          cascadeDepth: depth + 1,
          cascade: depth < maxDepth - 1 ? await getCascadeImpact(rel.fromAsset.id, depth + 1) : [],
        });
      }
      return result;
    };

    return {
      asset: {
        id: asset.id,
        name: asset.name,
        assetTag: asset.assetTag,
        status: asset.status,
        businessCriticality: asset.businessCriticality,
        ciClass: asset.ciClass,
      },
      dependsOn: dependsOn.map((rel) => ({
        ...rel.toAsset,
        relationship: rel.type,
      })),
      impacts: impacts.map((rel) => ({
        ...rel.fromAsset,
        relationship: rel.type,
      })),
      cascadeImpact: await getCascadeImpact(assetId, 0),
    };
  }

  // ============ Helpers ============

  private generateSlug(name: string): string {
    return name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/(^-|-$)/g, '');
  }
}
