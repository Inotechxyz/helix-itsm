import { IsEmail, IsNotEmpty, IsString, IsOptional, IsUUID } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

/**
 * DTO for organization-aware login
 */
export class OrgLoginDto {
  @ApiProperty({ example: 'john.doe@example.com' })
  @IsEmail()
  email!: string;

  @ApiProperty({ example: 'Password123!' })
  @IsString()
  password!: string;

  @ApiProperty({ example: 'acme-corp', description: 'Organization slug' })
  @IsString()
  @IsNotEmpty()
  organizationSlug!: string;
}

/**
 * DTO for organization login by ID
 */
export class OrgLoginByIdDto {
  @ApiProperty({ example: 'john.doe@example.com' })
  @IsEmail()
  email!: string;

  @ApiProperty({ example: 'Password123!' })
  @IsString()
  password!: string;

  @ApiProperty({ example: '550e8400-e29b-41d4-a716-446655440000', description: 'Organization ID' })
  @IsUUID()
  organizationId!: string;
}

/**
 * DTO for switching organizations
 */
export class SwitchOrganizationDto {
  @ApiProperty({ example: '550e8400-e29b-41d4-a716-446655440000', description: 'Organization ID to switch to' })
  @IsUUID()
  organizationId!: string;
}

/**
 * DTO for organization selection during registration
 */
export class OrgRegisterDto {
  @ApiProperty({ example: 'john.doe@example.com' })
  @IsEmail()
  email!: string;

  @ApiProperty({ example: 'Password123!', description: 'Must contain: 8+ chars, uppercase, lowercase, number, special character' })
  @IsString()
  @IsNotEmpty()
  password!: string;

  @ApiProperty({ example: 'John' })
  @IsString()
  @IsNotEmpty()
  firstName!: string;

  @ApiProperty({ example: 'Doe' })
  @IsString()
  @IsNotEmpty()
  lastName!: string;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  jobTitle?: string;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  department?: string;

  @ApiProperty({ example: '550e8400-e29b-41d4-a716-446655440000', description: 'Organization ID to register with' })
  @IsUUID()
  organizationId!: string;
}

/**
 * Response DTO for organization info in auth response
 */
export class OrganizationInfoDto {
  @ApiProperty()
  id!: string;

  @ApiProperty()
  name!: string;

  @ApiProperty()
  slug!: string;

  @ApiPropertyOptional()
  logoUrl?: string;

  @ApiPropertyOptional()
  primaryColor?: string;
}

/**
 * Response DTO for user's organization membership
 */
export class UserOrganizationDto {
  @ApiProperty()
  id!: string;

  @ApiProperty()
  name!: string;

  @ApiProperty()
  slug!: string;

  @ApiProperty()
  status!: string;

  @ApiPropertyOptional()
  logoUrl?: string;

  @ApiPropertyOptional()
  primaryColor?: string;

  @ApiProperty()
  role!: string;

  @ApiProperty()
  joinedAt!: Date;
}
