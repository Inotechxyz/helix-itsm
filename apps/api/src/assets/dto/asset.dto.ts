import {
  IsString,
  IsOptional,
  IsEnum,
  IsBoolean,
  IsInt,
  IsDateString,
  IsNumber,
  Min,
  Max,
  IsObject,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type, Transform } from 'class-transformer';

// Asset Types
export const AssetTypeEnum = {
  HARDWARE: 'hardware',
  SOFTWARE: 'software',
  CLOUD: 'cloud',
  NETWORK: 'network',
  APPLICATION: 'application',
} as const;
export type AssetTypeEnum = 'hardware' | 'software' | 'cloud' | 'network' | 'application';

// Asset Status
export const AssetStatusEnum = {
  ACTIVE: 'active',
  INACTIVE: 'inactive',
  UNDER_MAINTENANCE: 'under_maintenance',
  RETIRED: 'retired',
  DISPOSED: 'disposed',
} as const;
export type AssetStatusEnum = 'active' | 'inactive' | 'under_maintenance' | 'retired' | 'disposed';

// Relationship Types
export const RelationshipTypeEnum = {
  HOSTS: 'hosts',
  DEPENDS_ON: 'depends_on',
  CONNECTS_TO: 'connects_to',
  SUPPORTS: 'supports',
  RUNS_ON: 'runs_on',
  BACKUP_OF: 'backup_of',
  REPLICATED_TO: 'replicated_to',
} as const;
export type RelationshipTypeEnum = 'hosts' | 'depends_on' | 'connects_to' | 'supports' | 'runs_on' | 'backup_of' | 'replicated_to';

// Maintenance Types
export const MaintenanceTypeEnum = {
  PREVENTIVE: 'preventive',
  CORRECTIVE: 'corrective',
  ADAPTIVE: 'adaptive',
  PERFECTIVE: 'perfective',
} as const;
export type MaintenanceTypeEnum = 'preventive' | 'corrective' | 'adaptive' | 'perfective';

// Maintenance Status
export const MaintenanceStatusEnum = {
  SCHEDULED: 'scheduled',
  IN_PROGRESS: 'in_progress',
  COMPLETED: 'completed',
  CANCELLED: 'cancelled',
} as const;
export type MaintenanceStatusEnum = 'scheduled' | 'in_progress' | 'completed' | 'cancelled';

// Create Asset DTO
export class CreateAssetDto {
  @ApiProperty()
  @IsString()
  name!: string;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  assetTag?: string;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  serialNumber?: string;

  @ApiProperty()
  @IsString()
  typeId!: string;

  @ApiPropertyOptional({ enum: ['active', 'inactive', 'under_maintenance', 'retired', 'disposed'] })
  @IsEnum(['active', 'inactive', 'under_maintenance', 'retired', 'disposed'])
  @IsOptional()
  status?: AssetStatusEnum;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  manufacturer?: string;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  model?: string;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  version?: string;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  vendor?: string;

  @ApiPropertyOptional()
  @IsDateString()
  @IsOptional()
  purchaseDate?: string;

  @ApiPropertyOptional({ type: Number })
  @IsNumber()
  @IsOptional()
  @Type(() => Number)
  purchaseCost?: number;

  @ApiPropertyOptional()
  @IsDateString()
  @IsOptional()
  warrantyExpiry?: string;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  location?: string;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  department?: string;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  assignedToId?: string;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  ipAddress?: string;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  macAddress?: string;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  hostname?: string;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  operatingSystem?: string;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  cpu?: string;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  ram?: string;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  storage?: string;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  notes?: string;

  @ApiPropertyOptional({ type: Object })
  @IsObject()
  @IsOptional()
  metadata?: Record<string, any>;
}

// Update Asset DTO
export class UpdateAssetDto {
  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  name?: string;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  assetTag?: string;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  serialNumber?: string;

  @ApiPropertyOptional({ enum: ['active', 'inactive', 'under_maintenance', 'retired', 'disposed'] })
  @IsEnum(['active', 'inactive', 'under_maintenance', 'retired', 'disposed'])
  @IsOptional()
  status?: AssetStatusEnum;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  manufacturer?: string;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  model?: string;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  version?: string;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  vendor?: string;

  @ApiPropertyOptional()
  @IsDateString()
  @IsOptional()
  purchaseDate?: string;

  @ApiPropertyOptional({ type: Number })
  @IsNumber()
  @IsOptional()
  @Type(() => Number)
  purchaseCost?: number;

  @ApiPropertyOptional()
  @IsDateString()
  @IsOptional()
  warrantyExpiry?: string;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  location?: string;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  department?: string;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  assignedToId?: string;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  ipAddress?: string;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  macAddress?: string;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  hostname?: string;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  operatingSystem?: string;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  cpu?: string;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  ram?: string;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  storage?: string;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  notes?: string;

  @ApiPropertyOptional({ type: Object })
  @IsObject()
  @IsOptional()
  metadata?: Record<string, any>;
}

// Asset Query DTO
export class AssetQueryDto {
  @ApiPropertyOptional({ type: Number })
  @IsOptional()
  @Type(() => Number)
  page?: number;

  @ApiPropertyOptional({ type: Number })
  @IsOptional()
  @Type(() => Number)
  limit?: number;

  @ApiPropertyOptional({ enum: ['active', 'inactive', 'under_maintenance', 'retired', 'disposed'], isArray: true })
  @IsEnum(['active', 'inactive', 'under_maintenance', 'retired', 'disposed'], { each: true })
  @IsOptional()
  status?: AssetStatusEnum[];

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  typeId?: string;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  assignedToId?: string;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  department?: string;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  search?: string;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  sortBy?: string;

  @ApiPropertyOptional({ enum: ['asc', 'desc'] })
  @IsOptional()
  sortOrder?: 'asc' | 'desc';
}

// Asset Type DTOs
export class CreateAssetTypeDto {
  @ApiProperty()
  @IsString()
  name!: string;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  description?: string;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  icon?: string;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  color?: string;

  @ApiPropertyOptional({ type: Number })
  @IsInt()
  @Min(0)
  @IsOptional()
  @Type(() => Number)
  sortOrder?: number;
}

export class UpdateAssetTypeDto {
  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  name?: string;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  description?: string;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  icon?: string;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  color?: string;

  @ApiPropertyOptional({ type: Number })
  @IsInt()
  @Min(0)
  @IsOptional()
  @Type(() => Number)
  sortOrder?: number;

  @ApiPropertyOptional()
  @IsBoolean()
  @IsOptional()
  isActive?: boolean;
}

// Relationship DTOs
export class CreateAssetRelationshipDto {
  @ApiProperty()
  @IsString()
  fromAssetId!: string;

  @ApiProperty()
  @IsString()
  toAssetId!: string;

  @ApiProperty({ enum: ['hosts', 'depends_on', 'connects_to', 'supports', 'runs_on', 'backup_of', 'replicated_to'] })
  @IsEnum(['hosts', 'depends_on', 'connects_to', 'supports', 'runs_on', 'backup_of', 'replicated_to'])
  type!: RelationshipTypeEnum;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  description?: string;
}

export class UpdateAssetRelationshipDto {
  @ApiPropertyOptional({ enum: ['hosts', 'depends_on', 'connects_to', 'supports', 'runs_on', 'backup_of', 'replicated_to'] })
  @IsEnum(['hosts', 'depends_on', 'connects_to', 'supports', 'runs_on', 'backup_of', 'replicated_to'])
  @IsOptional()
  type?: RelationshipTypeEnum;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  description?: string;

  @ApiPropertyOptional()
  @IsBoolean()
  @IsOptional()
  isActive?: boolean;
}

// Maintenance DTOs
export class CreateMaintenanceDto {
  @ApiProperty()
  @IsString()
  assetId!: string;

  @ApiProperty({ enum: ['preventive', 'corrective', 'adaptive', 'perfective'] })
  @IsEnum(['preventive', 'corrective', 'adaptive', 'perfective'])
  type!: MaintenanceTypeEnum;

  @ApiProperty()
  @IsString()
  title!: string;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  description?: string;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  performedBy?: string;

  @ApiPropertyOptional()
  @IsDateString()
  @IsOptional()
  performedAt?: string;

  @ApiPropertyOptional()
  @IsDateString()
  @IsOptional()
  nextDueDate?: string;

  @ApiPropertyOptional({ type: Number })
  @IsNumber()
  @IsOptional()
  @Type(() => Number)
  cost?: number;
}

export class UpdateMaintenanceDto {
  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  title?: string;

  @ApiPropertyOptional({ enum: ['preventive', 'corrective', 'adaptive', 'perfective'] })
  @IsEnum(['preventive', 'corrective', 'adaptive', 'perfective'])
  @IsOptional()
  type?: MaintenanceTypeEnum;

  @ApiPropertyOptional({ enum: ['scheduled', 'in_progress', 'completed', 'cancelled'] })
  @IsEnum(['scheduled', 'in_progress', 'completed', 'cancelled'])
  @IsOptional()
  status?: MaintenanceStatusEnum;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  performedBy?: string;

  @ApiPropertyOptional()
  @IsDateString()
  @IsOptional()
  performedAt?: string;

  @ApiPropertyOptional()
  @IsDateString()
  @IsOptional()
  nextDueDate?: string;

  @ApiPropertyOptional({ type: Number })
  @IsNumber()
  @IsOptional()
  @Type(() => Number)
  cost?: number;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  description?: string;
}

// Link Asset to Ticket DTO
export class LinkAssetTicketDto {
  @ApiProperty()
  @IsString()
  assetId!: string;
}
