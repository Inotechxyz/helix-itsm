import { IsString, IsOptional, IsEnum, IsBoolean } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

// Use string literal types for enums
const TeamType = {
  FIRST_LINE: 'first_line',
  SECOND_LINE: 'second_line',
  THIRD_LINE: 'third_line',
} as const;
type TeamType = 'first_line' | 'second_line' | 'third_line';

export class CreateTeamDto {
  @ApiProperty({ example: 'First Line Support' })
  @IsString()
  name!: string;

  @ApiProperty({ enum: ['first_line', 'second_line', 'third_line'] })
  @IsEnum(['first_line', 'second_line', 'third_line'])
  type!: TeamType;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  description?: string;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  leadId?: string;
}

export class UpdateTeamDto {
  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  name?: string;

  @ApiPropertyOptional({ enum: ['first_line', 'second_line', 'third_line'] })
  @IsEnum(['first_line', 'second_line', 'third_line'])
  @IsOptional()
  type?: TeamType;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  description?: string;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  leadId?: string;

  @ApiPropertyOptional()
  @IsBoolean()
  @IsOptional()
  isActive?: boolean;
}

export class AddMemberDto {
  @ApiProperty()
  @IsString()
  userId!: string;

  @ApiPropertyOptional()
  @IsBoolean()
  @IsOptional()
  isPrimary?: boolean;
}
