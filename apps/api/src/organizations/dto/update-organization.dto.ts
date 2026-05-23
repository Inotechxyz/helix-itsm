import { IsString, IsOptional, IsEnum, IsUrl, IsObject, IsBoolean, IsNumber } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { OrganizationStatusEnum, OrganizationTierEnum, OrganizationAuthProviderEnum } from './create-organization.dto';

export class UpdateOrganizationDto {
  @ApiPropertyOptional({ description: 'Organization name' })
  @IsString()
  @IsOptional()
  name?: string;

  @ApiPropertyOptional({ description: 'Unique slug for the organization (used in URLs)' })
  @IsString()
  @IsOptional()
  slug?: string;

  @ApiPropertyOptional({ enum: OrganizationStatusEnum, description: 'Organization status' })
  @IsEnum(OrganizationStatusEnum)
  @IsOptional()
  status?: typeof OrganizationStatusEnum[keyof typeof OrganizationStatusEnum];

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
  authProviderType?: typeof OrganizationAuthProviderEnum[keyof typeof OrganizationAuthProviderEnum];

  @ApiPropertyOptional({ description: 'Authentication provider configuration (JSON)' })
  @IsObject()
  @IsOptional()
  authProviderConfig?: Record<string, unknown>;

  @ApiPropertyOptional({ enum: OrganizationTierEnum, description: 'Organization tier' })
  @IsEnum(OrganizationTierEnum)
  @IsOptional()
  tier?: typeof OrganizationTierEnum[keyof typeof OrganizationTierEnum];

  @ApiPropertyOptional({ description: 'Maximum number of users' })
  @IsNumber()
  @IsOptional()
  maxUsers?: number;

  @ApiPropertyOptional({ description: 'Maximum storage in GB' })
  @IsNumber()
  @IsOptional()
  maxStorage?: number;

  @ApiPropertyOptional({ description: 'Soft delete the organization' })
  @IsBoolean()
  @IsOptional()
  deletedAt?: Date;
}

export class UpdateBrandingDto {
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
}

export class UpdateAuthConfigDto {
  @ApiPropertyOptional({ description: 'Authentication provider type' })
  @IsEnum(OrganizationAuthProviderEnum)
  @IsOptional()
  authProviderType?: typeof OrganizationAuthProviderEnum[keyof typeof OrganizationAuthProviderEnum];

  @ApiPropertyOptional({ description: 'Authentication provider configuration (JSON)' })
  @IsObject()
  @IsOptional()
  authProviderConfig?: Record<string, unknown>;
}

export class UpdateAzureAdConfigDto {
  @ApiPropertyOptional({ description: 'Enable Azure AD SSO for this organization' })
  @IsBoolean()
  @IsOptional()
  azureAdEnabled?: boolean;

  @ApiPropertyOptional({ description: 'Azure AD Client ID' })
  @IsString()
  @IsOptional()
  azureAdClientId?: string;

  @ApiPropertyOptional({ description: 'Azure AD Client Secret' })
  @IsString()
  @IsOptional()
  azureAdClientSecret?: string;

  @ApiPropertyOptional({ description: 'Azure AD Tenant ID' })
  @IsString()
  @IsOptional()
  azureAdTenantId?: string;

  @ApiPropertyOptional({ description: 'Azure AD Redirect URI' })
  @IsString()
  @IsOptional()
  azureAdRedirectUri?: string;
}
