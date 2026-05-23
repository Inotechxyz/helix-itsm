import { IsString, IsOptional, IsEnum, IsBoolean, IsNumber } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { OrganizationStatusEnum } from './create-organization.dto';

export class OrganizationQueryDto {
  @ApiPropertyOptional({ description: 'Search by name or slug' })
  @IsString()
  @IsOptional()
  search?: string;

  @ApiPropertyOptional({ enum: OrganizationStatusEnum, description: 'Filter by status' })
  @IsEnum(OrganizationStatusEnum)
  @IsOptional()
  status?: typeof OrganizationStatusEnum[keyof typeof OrganizationStatusEnum];

  @ApiPropertyOptional({ type: Boolean, description: 'Include deleted organizations' })
  @IsBoolean()
  @IsOptional()
  @Type(() => Boolean)
  includeDeleted?: boolean;

  @ApiPropertyOptional({ type: Number, description: 'Page number' })
  @IsNumber()
  @IsOptional()
  @Type(() => Number)
  page?: number;

  @ApiPropertyOptional({ type: Number, description: 'Items per page' })
  @IsNumber()
  @IsOptional()
  @Type(() => Number)
  limit?: number;
}
