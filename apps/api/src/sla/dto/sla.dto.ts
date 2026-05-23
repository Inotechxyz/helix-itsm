import {
  IsString,
  IsOptional,
  IsEnum,
  IsBoolean,
  IsInt,
  Min,
  Max,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

// ============ SLA Policy DTOs ============

export enum TicketPriorityEnum {
  CRITICAL = 'critical',
  HIGH = 'high',
  MEDIUM = 'medium',
  LOW = 'low',
}

export enum TicketTypeEnum {
  INCIDENT = 'incident',
  SERVICE_REQUEST = 'service_request',
}

export enum UserTierEnum {
  STANDARD = 'standard',
  PREMIUM = 'premium',
  ENTERPRISE = 'enterprise',
  VIP = 'vip',
}

export enum TeamTypeEnum {
  FIRST_LINE = 'first_line',
  SECOND_LINE = 'second_line',
  THIRD_LINE = 'third_line',
}

export class CreateSlaPolicyDto {
  @ApiProperty()
  @IsString()
  name!: string;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  description?: string;

  @ApiProperty({ enum: ['critical', 'high', 'medium', 'low'] })
  @IsEnum(['critical', 'high', 'medium', 'low'])
  priority!: TicketPriorityEnum;

  @ApiPropertyOptional({ enum: ['incident', 'service_request'] })
  @IsEnum(['incident', 'service_request'])
  @IsOptional()
  ticketType?: TicketTypeEnum;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  categoryId?: string;

  @ApiPropertyOptional({ enum: ['standard', 'premium', 'enterprise', 'vip'] })
  @IsEnum(['standard', 'premium', 'enterprise', 'vip'])
  @IsOptional()
  userTier?: UserTierEnum;

  @ApiProperty({ description: 'First Response Time target in hours' })
  @IsInt()
  @Min(1)
  responseTimeHours!: number;

  @ApiProperty({ description: 'Resolution Time target in hours' })
  @IsInt()
  @Min(1)
  resolutionTimeHours!: number;

  @ApiPropertyOptional({ description: 'Warning threshold percentage (default: 75)' })
  @IsInt()
  @Min(1)
  @Max(100)
  @IsOptional()
  warningThreshold?: number = 75;
}

export class UpdateSlaPolicyDto {
  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  name?: string;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  description?: string;

  @ApiPropertyOptional()
  @IsBoolean()
  @IsOptional()
  isActive?: boolean;

  @ApiPropertyOptional({ enum: ['critical', 'high', 'medium', 'low'] })
  @IsEnum(['critical', 'high', 'medium', 'low'])
  @IsOptional()
  priority?: TicketPriorityEnum;

  @ApiPropertyOptional({ enum: ['incident', 'service_request'] })
  @IsEnum(['incident', 'service_request'])
  @IsOptional()
  ticketType?: TicketTypeEnum;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  categoryId?: string;

  @ApiPropertyOptional({ enum: ['standard', 'premium', 'enterprise', 'vip'] })
  @IsEnum(['standard', 'premium', 'enterprise', 'vip'])
  @IsOptional()
  userTier?: UserTierEnum;

  @ApiPropertyOptional()
  @IsInt()
  @Min(1)
  @IsOptional()
  responseTimeHours?: number;

  @ApiPropertyOptional()
  @IsInt()
  @Min(1)
  @IsOptional()
  resolutionTimeHours?: number;

  @ApiPropertyOptional()
  @IsInt()
  @Min(1)
  @Max(100)
  @IsOptional()
  warningThreshold?: number;
}

// ============ Escalation Rule DTOs ============

export enum EscalationConditionEnum {
  NOT_ASSIGNED = 'not_assigned',
  NO_RESPONSE = 'no_response',
  NO_UPDATE = 'no_update',
  APPROACHING_BREACH = 'approaching_breach',
}

export enum EscalationActionEnum {
  NOTIFY_AGENT = 'notify_agent',
  NOTIFY_MANAGER = 'notify_manager',
  NOTIFY_TEAM = 'notify_team',
  ESCALATE_TO_TEAM = 'escalate_to_team',
  INCREASE_PRIORITY = 'increase_priority',
  AUTO_ASSIGN = 'auto_assign',
  SEND_EMAIL = 'send_email',
}

export class CreateEscalationRuleDto {
  @ApiProperty()
  @IsString()
  name!: string;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  description?: string;

  @ApiProperty()
  @IsString()
  slaPolicyId!: string;

  @ApiProperty({ enum: ['critical', 'high', 'medium', 'low'] })
  @IsEnum(['critical', 'high', 'medium', 'low'])
  priority!: TicketPriorityEnum;

  @ApiProperty({ enum: EscalationConditionEnum })
  @IsEnum(EscalationConditionEnum)
  condition!: EscalationConditionEnum;

  @ApiProperty({ description: 'Threshold in hours' })
  @IsInt()
  @Min(1)
  thresholdHours!: number;

  @ApiProperty({ enum: EscalationActionEnum })
  @IsEnum(EscalationActionEnum)
  action!: EscalationActionEnum;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  actionTarget?: string;

  @ApiPropertyOptional()
  @IsBoolean()
  @IsOptional()
  notifyManager?: boolean;

  @ApiPropertyOptional()
  @IsBoolean()
  @IsOptional()
  increasePriority?: boolean;
}

export class UpdateEscalationRuleDto {
  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  name?: string;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  description?: string;

  @ApiPropertyOptional()
  @IsBoolean()
  @IsOptional()
  isActive?: boolean;

  @ApiPropertyOptional()
  @IsInt()
  @Min(1)
  @IsOptional()
  thresholdHours?: number;

  @ApiPropertyOptional({ enum: EscalationActionEnum })
  @IsEnum(EscalationActionEnum)
  @IsOptional()
  action?: EscalationActionEnum;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  actionTarget?: string;

  @ApiPropertyOptional()
  @IsBoolean()
  @IsOptional()
  notifyManager?: boolean;

  @ApiPropertyOptional()
  @IsBoolean()
  @IsOptional()
  increasePriority?: boolean;
}

// ============ OLA Policy DTOs ============

export class CreateOlaPolicyDto {
  @ApiProperty()
  @IsString()
  name!: string;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  description?: string;

  @ApiProperty({ enum: TeamTypeEnum })
  @IsEnum(TeamTypeEnum)
  fromTeamType!: TeamTypeEnum;

  @ApiProperty({ enum: TeamTypeEnum })
  @IsEnum(TeamTypeEnum)
  toTeamType!: TeamTypeEnum;

  @ApiProperty({ description: 'Response time target in hours' })
  @IsInt()
  @Min(1)
  responseTimeHours!: number;

  @ApiProperty({ description: 'Resolution time target in hours' })
  @IsInt()
  @Min(1)
  resolutionTimeHours!: number;
}

export class UpdateOlaPolicyDto {
  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  name?: string;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  description?: string;

  @ApiPropertyOptional()
  @IsBoolean()
  @IsOptional()
  isActive?: boolean;

  @ApiPropertyOptional()
  @IsInt()
  @Min(1)
  @IsOptional()
  responseTimeHours?: number;

  @ApiPropertyOptional()
  @IsInt()
  @Min(1)
  @IsOptional()
  resolutionTimeHours?: number;
}

// ============ OLA Handoff DTOs ============

export class CreateOlaHandoffDto {
  @ApiProperty()
  @IsString()
  ticketId!: string;

  @ApiProperty()
  @IsString()
  fromTeamId!: string;

  @ApiProperty()
  @IsString()
  toTeamId!: string;

  @ApiProperty()
  @IsString()
  initiatedById!: string;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  notes?: string;
}

export class UpdateOlaHandoffDto {
  @ApiPropertyOptional()
  @IsBoolean()
  @IsOptional()
  responseMet?: boolean;

  @ApiPropertyOptional()
  @IsBoolean()
  @IsOptional()
  resolutionMet?: boolean;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  notes?: string;
}

// ============ Query DTOs ============

export class SlaPolicyQueryDto {
  @ApiPropertyOptional()
  @IsOptional()
  page?: number;

  @ApiPropertyOptional()
  @IsOptional()
  limit?: number;

  @ApiPropertyOptional({ enum: ['critical', 'high', 'medium', 'low'] })
  @IsEnum(['critical', 'high', 'medium', 'low'])
  @IsOptional()
  priority?: string;

  @ApiPropertyOptional()
  @IsBoolean()
  @IsOptional()
  isActive?: boolean;
}

export class OlaPolicyQueryDto {
  @ApiPropertyOptional()
  @IsOptional()
  page?: number;

  @ApiPropertyOptional()
  @IsOptional()
  limit?: number;

  @ApiPropertyOptional({ enum: TeamTypeEnum })
  @IsEnum(TeamTypeEnum)
  @IsOptional()
  fromTeamType?: TeamTypeEnum;

  @ApiPropertyOptional({ enum: TeamTypeEnum })
  @IsEnum(TeamTypeEnum)
  @IsOptional()
  toTeamType?: TeamTypeEnum;

  @ApiPropertyOptional()
  @IsBoolean()
  @IsOptional()
  isActive?: boolean;
}
