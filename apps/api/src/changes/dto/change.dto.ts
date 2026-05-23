import {
  IsString,
  IsOptional,
  IsEnum,
  IsInt,
  Min,
  IsDateString,
  IsBoolean,
  IsUUID,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type, Transform } from 'class-transformer';
import { Prisma } from '@prisma/client';

// Change Type
export enum ChangeType {
  STANDARD = 'standard',
  NORMAL = 'normal',
  EMERGENCY = 'emergency',
}

// Change Status
export enum ChangeStatus {
  DRAFT = 'draft',
  SUBMITTED = 'submitted',
  PENDING_APPROVAL = 'pending_approval',
  APPROVED = 'approved',
  REJECTED = 'rejected',
  SCHEDULED = 'scheduled',
  IN_PROGRESS = 'in_progress',
  COMPLETED = 'completed',
  CANCELLED = 'cancelled',
  CLOSED = 'closed',
}

// Change Priority
export enum ChangePriority {
  CRITICAL = 'critical',
  HIGH = 'high',
  MEDIUM = 'medium',
  LOW = 'low',
}

// Change Risk
export enum ChangeRisk {
  LOW = 'low',
  MEDIUM = 'medium',
  HIGH = 'high',
  CRITICAL = 'critical',
}

// CAB Meeting Status
export enum CABMeetingStatus {
  SCHEDULED = 'scheduled',
  IN_PROGRESS = 'in_progress',
  COMPLETED = 'completed',
  CANCELLED = 'cancelled',
}

// Change Approval Role
export enum ChangeApproverRole {
  MANAGER = 'manager',
  CAB = 'cab',
  IT_SECURITY = 'it_security',
  BUSINESS_OWNER = 'business_owner',
  FINAL_APPROVER = 'final_approver',
}

// Change Approval Status
export enum ChangeApprovalStatus {
  PENDING = 'pending',
  APPROVED = 'approved',
  REJECTED = 'rejected',
  DELEGATED = 'delegated',
}

// Create Change Request DTO
export class CreateChangeRequestDto {
  @ApiProperty()
  @IsString()
  title!: string;

  @ApiProperty()
  @IsString()
  description!: string;

  @ApiProperty({ enum: ['standard', 'normal', 'emergency'] })
  @IsEnum(['standard', 'normal', 'emergency'])
  type!: ChangeType;

  @ApiPropertyOptional({ enum: ['critical', 'high', 'medium', 'low'] })
  @IsEnum(['critical', 'high', 'medium', 'low'])
  @IsOptional()
  priority?: ChangePriority;

  @ApiPropertyOptional({ enum: ['low', 'medium', 'high', 'critical'] })
  @IsEnum(['low', 'medium', 'high', 'critical'])
  @IsOptional()
  risk?: ChangeRisk;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  category?: string;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  justification?: string;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  implementationPlan?: string;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  rollbackPlan?: string;

  @ApiPropertyOptional()
  @IsUUID()
  @IsOptional()
  assignedToId?: string;

  @ApiPropertyOptional()
  @IsDateString()
  @IsOptional()
  scheduledStartDate?: string;

  @ApiPropertyOptional()
  @IsDateString()
  @IsOptional()
  scheduledEndDate?: string;
}

// Update Change Request DTO
export class UpdateChangeRequestDto {
  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  title?: string;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  description?: string;

  @ApiPropertyOptional({ enum: ['standard', 'normal', 'emergency'] })
  @IsEnum(['standard', 'normal', 'emergency'])
  @IsOptional()
  type?: ChangeType;

  @ApiPropertyOptional({ enum: ['draft', 'submitted', 'pending_approval', 'approved', 'rejected', 'scheduled', 'in_progress', 'completed', 'cancelled', 'closed'] })
  @IsEnum(['draft', 'submitted', 'pending_approval', 'approved', 'rejected', 'scheduled', 'in_progress', 'completed', 'cancelled', 'closed'])
  @IsOptional()
  status?: ChangeStatus;

  @ApiPropertyOptional({ enum: ['critical', 'high', 'medium', 'low'] })
  @IsEnum(['critical', 'high', 'medium', 'low'])
  @IsOptional()
  priority?: ChangePriority;

  @ApiPropertyOptional({ enum: ['low', 'medium', 'high', 'critical'] })
  @IsEnum(['low', 'medium', 'high', 'critical'])
  @IsOptional()
  risk?: ChangeRisk;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  category?: string;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  justification?: string;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  implementationPlan?: string;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  rollbackPlan?: string;

  @ApiPropertyOptional()
  @IsUUID()
  @IsOptional()
  assignedToId?: string;

  @ApiPropertyOptional()
  @IsDateString()
  @IsOptional()
  scheduledStartDate?: string;

  @ApiPropertyOptional()
  @IsDateString()
  @IsOptional()
  scheduledEndDate?: string;

  @ApiPropertyOptional()
  @IsBoolean()
  @IsOptional()
  cabReviewed?: boolean;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  closureNotes?: string;
}

// Link Asset DTO
export class LinkAssetDto {
  @ApiProperty()
  @IsUUID()
  assetId!: string;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  impact?: string;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  description?: string;
}

// Link Ticket DTO
export class LinkTicketDto {
  @ApiProperty()
  @IsUUID()
  ticketId!: string;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  reason?: string;
}

// Link Problem DTO
export class LinkProblemDto {
  @ApiProperty()
  @IsUUID()
  problemId!: string;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  reason?: string;
}

// Create Risk Assessment DTO
export class CreateRiskAssessmentDto {
  @ApiProperty({ enum: ['low', 'medium', 'high', 'critical'] })
  @IsEnum(['low', 'medium', 'high', 'critical'])
  riskLevel!: ChangeRisk;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  impactLevel?: string;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  probability?: string;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  riskDescription?: string;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  mitigationSteps?: string;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  contingencyPlan?: string;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  riskOwner?: string;
}

// Update Risk Assessment DTO
export class UpdateRiskAssessmentDto {
  @ApiPropertyOptional({ enum: ['low', 'medium', 'high', 'critical'] })
  @IsEnum(['low', 'medium', 'high', 'critical'])
  @IsOptional()
  riskLevel?: ChangeRisk;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  impactLevel?: string;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  probability?: string;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  riskDescription?: string;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  mitigationSteps?: string;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  contingencyPlan?: string;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  riskOwner?: string;
}

// Approval DTO
export class ApprovalDto {
  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  comments?: string;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  decision?: string;

  @ApiPropertyOptional()
  @IsUUID()
  @IsOptional()
  delegatedToId?: string;
}

// Rejection DTO
export class RejectionDto {
  @ApiProperty()
  @IsString()
  reason!: string;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  comments?: string;
}

// Change Query DTO
export class ChangeQueryDto {
  @ApiPropertyOptional({ type: Number })
  @IsOptional()
  @Type(() => Number)
  page?: number;

  @ApiPropertyOptional({ type: Number })
  @IsOptional()
  @Type(() => Number)
  limit?: number;

  @ApiPropertyOptional({ enum: ['draft', 'submitted', 'pending_approval', 'approved', 'rejected', 'scheduled', 'in_progress', 'completed', 'cancelled', 'closed'], isArray: true })
  @IsEnum(['draft', 'submitted', 'pending_approval', 'approved', 'rejected', 'scheduled', 'in_progress', 'completed', 'cancelled', 'closed'], { each: true })
  @IsOptional()
  status?: string[];

  @ApiPropertyOptional({ enum: ['standard', 'normal', 'emergency'], isArray: true })
  @IsEnum(['standard', 'normal', 'emergency'], { each: true })
  @IsOptional()
  type?: string[];

  @ApiPropertyOptional({ enum: ['critical', 'high', 'medium', 'low'], isArray: true })
  @IsEnum(['critical', 'high', 'medium', 'low'], { each: true })
  @IsOptional()
  priority?: string[];

  @ApiPropertyOptional()
  @IsUUID()
  @IsOptional()
  assignedToId?: string;

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

// Create CAB Meeting DTO
export class CreateCABMeetingDto {
  @ApiProperty()
  @IsString()
  title!: string;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  description?: string;

  @ApiProperty()
  @IsDateString()
  scheduledAt!: string;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  location?: string;
}

// Update CAB Meeting DTO
export class UpdateCABMeetingDto {
  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  title?: string;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  description?: string;

  @ApiPropertyOptional()
  @IsDateString()
  @IsOptional()
  scheduledAt?: string;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  location?: string;

  @ApiPropertyOptional({ enum: ['scheduled', 'in_progress', 'completed', 'cancelled'] })
  @IsEnum(['scheduled', 'in_progress', 'completed', 'cancelled'])
  @IsOptional()
  status?: CABMeetingStatus;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  notes?: string;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  decisions?: string;
}

// Add Agenda Item DTO
export class AddAgendaItemDto {
  @ApiPropertyOptional()
  @IsUUID()
  @IsOptional()
  changeRequestId?: string;

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
  presenter?: string;

  @ApiPropertyOptional()
  @IsInt()
  @Min(1)
  @IsOptional()
  duration?: number;
}
