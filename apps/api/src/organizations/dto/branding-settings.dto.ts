import { IsString, IsOptional, IsUrl, IsArray, ValidateNested, IsEnum } from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { EmailTemplateType } from '@prisma/client';

export class EmailFooterLinkDto {
  @ApiProperty({ description: 'Link label', type: String })
  @IsString()
  label!: string;

  @ApiProperty({ description: 'Link URL', type: String })
  @IsUrl()
  url!: string;
}

export class UpdateBrandingSettingsDto {
  @ApiPropertyOptional({ description: 'Logo URL' })
  @IsUrl()
  @IsOptional()
  logoUrl?: string;

  @ApiPropertyOptional({ description: 'Primary brand color (hex)' })
  @IsString()
  @IsOptional()
  primaryColor?: string;

  @ApiPropertyOptional({ description: 'Secondary brand color (hex)' })
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

  @ApiPropertyOptional({ description: 'Email footer links', type: [EmailFooterLinkDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => EmailFooterLinkDto)
  @IsOptional()
  emailFooterLinks?: EmailFooterLinkDto[];
}

export class CreateEmailTemplateDto {
  @ApiProperty({ enum: EmailTemplateType, description: 'Template type' })
  @IsEnum(EmailTemplateType)
  templateType!: EmailTemplateType;

  @ApiProperty({ description: 'Email subject' })
  @IsString()
  subject!: string;

  @ApiProperty({ description: 'Email body (HTML)', type: String })
  @IsString()
  body!: string;
}

export class UpdateEmailTemplateDto {
  @ApiProperty({ description: 'Email subject' })
  @IsString()
  subject!: string;

  @ApiProperty({ description: 'Email body (HTML)', type: String })
  @IsString()
  body!: string;
}
