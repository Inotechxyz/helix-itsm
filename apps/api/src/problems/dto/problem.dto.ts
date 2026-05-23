import {
  IsString,
  IsOptional,
  IsEnum,
  IsInt,
  Min,
  IsDateString,
  IsNumber,
  IsBoolean,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type, Transform } from 'class-transformer';
import { Prisma } from '@prisma/client';

// Problem Status
export enum ProblemStatus {
  NEW = 'new',
  INVESTIGATING = 'investigating',
  IDENTIFIED = 'identified',
  RESOLVED = 'resolved',
  CLOSED = 'closed',
}

// Problem Impact
export enum ProblemImpact {
  LOW = 'low',
  MODERATE = 'moderate',
  HIGH = 'high',
  CRITICAL = 'critical',
}

// RCA Type
export enum RCAType {
  ROOT_CAUSE = 'root_cause',
  CONTRIBUTING_FACTOR = 'contributing_factor',
  ENVIRONMENTAL = 'environmental',
}

// Known Error Status
export enum KnownErrorStatus {
  ACTIVE = 'active',
  RESOLVED = 'resolved',
  OBSOLETE = 'obsolete',
}

// Create Problem DTO
export class CreateProblemDto {
  @ApiProperty()
  @IsString()
  title!: string;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  description?: string;

  @ApiPropertyOptional({ enum: ['new', 'investigating', 'identified', 'resolved', 'closed'] })
  @IsEnum(['new', 'investigating', 'identified', 'resolved', 'closed'])
  @IsOptional()
  status?: ProblemStatus;

  @ApiPropertyOptional({ enum: ['critical', 'high', 'medium', 'low'] })
  @IsEnum(['critical', 'high', 'medium', 'low'])
  @IsOptional()
  priority?: string;

  @ApiPropertyOptional({ enum: ['low', 'moderate', 'high', 'critical'] })
  @IsEnum(['low', 'moderate', 'high', 'critical'])
  @IsOptional()
  impact?: ProblemImpact;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  category?: string;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  assignedToId?: string;
}

// Update Problem DTO
export class UpdateProblemDto {
  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  title?: string;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  description?: string;

  @ApiPropertyOptional({ enum: ['new', 'investigating', 'identified', 'resolved', 'closed'] })
  @IsEnum(['new', 'investigating', 'identified', 'resolved', 'closed'])
  @IsOptional()
  status?: ProblemStatus;

  @ApiPropertyOptional({ enum: ['critical', 'high', 'medium', 'low'] })
  @IsEnum(['critical', 'high', 'medium', 'low'])
  @IsOptional()
  priority?: string;

  @ApiPropertyOptional({ enum: ['low', 'moderate', 'high', 'critical'] })
  @IsEnum(['low', 'moderate', 'high', 'critical'])
  @IsOptional()
  impact?: ProblemImpact;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  category?: string;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  assignedToId?: string;
}

// Link Incident DTO
export class LinkIncidentDto {
  @ApiProperty()
  @IsString()
  ticketId!: string;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  impactLevel?: string;
}

// Create RCA DTO
export class CreateRCADto {
  @ApiPropertyOptional({ enum: ['root_cause', 'contributing_factor', 'environmental'] })
  @IsEnum(['root_cause', 'contributing_factor', 'environmental'])
  @IsOptional()
  analysisType?: RCAType;

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
  cause?: string;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  impact?: string;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  solution?: string;
}

// Update RCA DTO
export class UpdateRCADto {
  @ApiPropertyOptional({ enum: ['root_cause', 'contributing_factor', 'environmental'] })
  @IsEnum(['root_cause', 'contributing_factor', 'environmental'])
  @IsOptional()
  analysisType?: RCAType;

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
  cause?: string;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  impact?: string;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  solution?: string;
}

// Create Known Error DTO
export class CreateKnownErrorDto {
  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  errorCode?: string;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  symptoms?: string;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  workaround?: string;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  knownSolution?: string;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  kbArticleId?: string;
}

// Update Known Error DTO
export class UpdateKnownErrorDto {
  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  errorCode?: string;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  symptoms?: string;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  workaround?: string;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  knownSolution?: string;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  kbArticleId?: string;

  @ApiPropertyOptional({ enum: ['active', 'resolved', 'obsolete'] })
  @IsEnum(['active', 'resolved', 'obsolete'])
  @IsOptional()
  status?: KnownErrorStatus;
}

// Problem Query DTO
export class ProblemQueryDto {
  @ApiPropertyOptional({ type: Number })
  @IsOptional()
  @Type(() => Number)
  page?: number;

  @ApiPropertyOptional({ type: Number })
  @IsOptional()
  @Type(() => Number)
  limit?: number;

  @ApiPropertyOptional({ enum: ['new', 'investigating', 'identified', 'resolved', 'closed'], isArray: true })
  @IsEnum(['new', 'investigating', 'identified', 'resolved', 'closed'], { each: true })
  @IsOptional()
  status?: string[];

  @ApiPropertyOptional({ enum: ['critical', 'high', 'medium', 'low'], isArray: true })
  @IsEnum(['critical', 'high', 'medium', 'low'], { each: true })
  @IsOptional()
  priority?: string[];

  @ApiPropertyOptional()
  @IsString()
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
