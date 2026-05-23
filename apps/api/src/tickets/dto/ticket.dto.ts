import {
  IsString,
  IsOptional,
  IsEnum,
  IsArray,
  IsBoolean,
  IsInt,
  IsEmail,
  Min,
  Max,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type, Transform, TransformFnParams } from 'class-transformer';
import { BaseQueryDto } from '../../common/dto/base-query.dto';

// Transform comma-separated string to array
const toArray = (params: TransformFnParams): string[] | undefined => {
  const value = params.value as string | string[] | undefined;
  if (!value) return undefined;
  if (Array.isArray(value)) return value;
  return String(value).split(',').map(v => v.trim()).filter(v => v);
};

// Use string literal types for enums
const TicketType = {
  INCIDENT: 'incident',
  SERVICE_REQUEST: 'service_request',
} as const;
type TicketType = 'incident' | 'service_request';

const TicketStatus = {
  NEW: 'new',
  ASSIGNED: 'assigned',
  IN_PROGRESS: 'in_progress',
  PENDING: 'pending',
  RESOLVED: 'resolved',
  CLOSED: 'closed',
} as const;
type TicketStatus = 'new' | 'assigned' | 'in_progress' | 'pending' | 'resolved' | 'closed';

const TicketPriority = {
  CRITICAL: 'critical',
  HIGH: 'high',
  MEDIUM: 'medium',
  LOW: 'low',
} as const;
type TicketPriority = 'critical' | 'high' | 'medium' | 'low';

const TicketChannel = {
  MANUAL: 'manual',
  EMAIL: 'email',
  OTHERS: 'others',
} as const;
export type TicketChannel = 'manual' | 'email' | 'others';

export class CreateTicketDto {
  @ApiProperty({ enum: ['incident', 'service_request'] })
  @IsEnum(['incident', 'service_request'])
  type!: TicketType;

  @ApiProperty()
  @IsString()
  title!: string;

  @ApiProperty()
  @IsString()
  description!: string;

  @ApiProperty({ enum: ['critical', 'high', 'medium', 'low'] })
  @IsEnum(['critical', 'high', 'medium', 'low'])
  priority!: TicketPriority;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  categoryId?: string;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  assignedTeamId?: string;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  externalId?: string;
}

export class UpdateTicketDto {
  @ApiPropertyOptional({ enum: ['new', 'assigned', 'in_progress', 'pending', 'resolved', 'closed'] })
  @IsEnum(['new', 'assigned', 'in_progress', 'pending', 'resolved', 'closed'])
  @IsOptional()
  status?: TicketStatus;

  @ApiPropertyOptional({ enum: ['critical', 'high', 'medium', 'low'] })
  @IsEnum(['critical', 'high', 'medium', 'low'])
  @IsOptional()
  priority?: TicketPriority;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  title?: string;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  description?: string;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  categoryId?: string;
}

export class AssignTicketDto {
  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  agentId?: string;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  teamId?: string;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  reason?: string;
}

export class TransitionTicketDto {
  @ApiProperty({ enum: ['new', 'assigned', 'in_progress', 'pending', 'resolved', 'closed'] })
  @IsEnum(['new', 'assigned', 'in_progress', 'pending', 'resolved', 'closed'])
  toStatus!: TicketStatus;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  reason?: string;
}

export class AddCommentDto {
  @ApiProperty()
  @IsString()
  content!: string;

  @ApiPropertyOptional()
  @IsBoolean()
  @IsOptional()
  isInternal?: boolean;

  @ApiPropertyOptional({ description: 'Email recipients for email replies', isArray: true })
  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  recipients?: string[];

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  originalMessageId?: string;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  originalSubject?: string;

  @ApiPropertyOptional()
  @IsBoolean()
  @IsOptional()
  includeOriginalContent?: boolean;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  originalContent?: string;
}

export class TicketQueryDto extends BaseQueryDto {
  @ApiPropertyOptional({ enum: ['new', 'assigned', 'in_progress', 'pending', 'resolved', 'closed'], isArray: true })
  @Transform(toArray)
  @IsEnum(['new', 'assigned', 'in_progress', 'pending', 'resolved', 'closed'], { each: true })
  @IsOptional()
  status?: TicketStatus[];

  @ApiPropertyOptional({ enum: ['critical', 'high', 'medium', 'low'], isArray: true })
  @Transform(toArray)
  @IsEnum(['critical', 'high', 'medium', 'low'], { each: true })
  @IsOptional()
  priority?: TicketPriority[];

  @ApiPropertyOptional({ enum: ['incident', 'service_request'], isArray: true })
  @Transform(toArray)
  @IsEnum(['incident', 'service_request'], { each: true })
  @IsOptional()
  type?: TicketType[];

  @ApiPropertyOptional({ enum: ['manual', 'email', 'others'], isArray: true })
  @Transform(toArray)
  @IsEnum(['manual', 'email', 'others'], { each: true })
  @IsOptional()
  channel?: TicketChannel[];

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  requesterId?: string;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  assignedAgentId?: string;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  assignedTeamId?: string;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  categoryId?: string;
}
