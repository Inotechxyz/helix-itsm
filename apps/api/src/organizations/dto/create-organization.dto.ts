import { IsString, IsOptional, IsEnum, IsUrl, IsObject } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

// Organization Status enum
export const OrganizationStatusEnum = {
  ACTIVE: 'active',
  SUSPENDED: 'suspended',
  PENDING: 'pending',
} as const;
export type OrganizationStatus = typeof OrganizationStatusEnum[keyof typeof OrganizationStatusEnum];

// Organization Tier enum
export const OrganizationTierEnum = {
  STARTER: 'starter',
  STANDARD: 'standard',
  PREMIUM: 'premium',
  ENTERPRISE: 'enterprise',
} as const;
export type OrganizationTier = typeof OrganizationTierEnum[keyof typeof OrganizationTierEnum];

// Organization Auth Provider enum
export const OrganizationAuthProviderEnum = {
  LOCAL: 'local',
  AZURE_AD: 'azure_ad',
  GOOGLE: 'google',
  SAML: 'saml',
  OKTA: 'okta',
} as const;
export type OrganizationAuthProvider = typeof OrganizationAuthProviderEnum[keyof typeof OrganizationAuthProviderEnum];

export class CreateOrganizationDto {
  @ApiProperty({ description: 'Organization name' })
  @IsString()
  name!: string;

  @ApiProperty({ description: 'Unique slug for the organization (used in URLs)' })
  @IsString()
  slug!: string;

  @ApiPropertyOptional({ enum: OrganizationStatusEnum, description: 'Organization status' })
  @IsEnum(OrganizationStatusEnum)
  @IsOptional()
  status?: OrganizationStatus;

  @ApiPropertyOptional({ description: 'Logo URL' })
  @IsUrl()
  @IsOptional()
  logoUrl?: string;

  @ApiPropertyOptional({ description: 'Primary brand color' })
  @IsString()
  @IsOptional()
  primaryColor?: string;

  @ApiPropertyOptional({ description: 'Secondary brand color' })
  @IsString()
  @IsOptional()
  secondaryColor?: string;

  @ApiPropertyOptional({ description: 'Favicon URL' })
  @IsUrl()
  @IsOptional()
  faviconUrl?: string;

  @ApiPropertyOptional({ description: 'Email from name' })
  @IsString()
  @IsOptional()
  emailFromName?: string;

  @ApiPropertyOptional({ description: 'Email footer text' })
  @IsString()
  @IsOptional()
  emailFooterText?: string;

  @ApiPropertyOptional({ enum: OrganizationAuthProviderEnum, description: 'Authentication provider type' })
  @IsEnum(OrganizationAuthProviderEnum)
  @IsOptional()
  authProviderType?: OrganizationAuthProvider;

  @ApiPropertyOptional({ description: 'Authentication provider configuration (JSON)' })
  @IsObject()
  @IsOptional()
  authProviderConfig?: Record<string, unknown>;

  @ApiPropertyOptional({ enum: OrganizationTierEnum, description: 'Organization tier' })
  @IsEnum(OrganizationTierEnum)
  @IsOptional()
  tier?: OrganizationTier;

  @ApiPropertyOptional({ description: 'Maximum number of users' })
  @IsOptional()
  maxUsers?: number;

  @ApiPropertyOptional({ description: 'Maximum storage in GB' })
  @IsOptional()
  maxStorage?: number;
}
