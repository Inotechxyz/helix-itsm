import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, IsBoolean, IsNumber, ValidateNested, Min, Max } from 'class-validator';
import { Type } from 'class-transformer';

/**
 * SMTP Configuration for an organization
 */
export class SmtpConfigDto {
  @ApiPropertyOptional({ description: 'SMTP server hostname' })
  @IsOptional()
  @IsString()
  host?: string;

  @ApiPropertyOptional({ description: 'SMTP server port', default: 587 })
  @IsOptional()
  @IsNumber()
  @Min(1)
  @Max(65535)
  port?: number;

  @ApiPropertyOptional({ description: 'Use TLS/SSL', default: false })
  @IsOptional()
  @IsBoolean()
  secure?: boolean;

  @ApiPropertyOptional({ description: 'SMTP authentication username' })
  @IsOptional()
  @IsString()
  user?: string;

  @ApiPropertyOptional({ description: 'SMTP authentication password' })
  @IsOptional()
  @IsString()
  pass?: string;

  @ApiPropertyOptional({ description: 'Default from email address' })
  @IsOptional()
  @IsString()
  fromAddress?: string;

  @ApiPropertyOptional({ description: 'Default from name' })
  @IsOptional()
  @IsString()
  fromName?: string;
}

/**
 * IMAP Configuration for an organization (for receiving emails)
 */
export class ImapConfigDto {
  @ApiPropertyOptional({ description: 'IMAP server hostname' })
  @IsOptional()
  @IsString()
  host?: string;

  @ApiPropertyOptional({ description: 'IMAP server port', default: 993 })
  @IsOptional()
  @IsNumber()
  @Min(1)
  @Max(65535)
  port?: number;

  @ApiPropertyOptional({ description: 'Use TLS/SSL', default: true })
  @IsOptional()
  @IsBoolean()
  secure?: boolean;

  @ApiPropertyOptional({ description: 'IMAP authentication username' })
  @IsOptional()
  @IsString()
  user?: string;

  @ApiPropertyOptional({ description: 'IMAP authentication password' })
  @IsOptional()
  @IsString()
  pass?: string;

  @ApiPropertyOptional({ description: 'Folder to monitor for incoming emails', default: 'INBOX' })
  @IsOptional()
  @IsString()
  inboxFolder?: string;
}

/**
 * Combined Email Settings for an organization
 */
export class OrganizationEmailSettingsDto {
  @ApiPropertyOptional({ description: 'SMTP settings for sending emails', type: SmtpConfigDto })
  @IsOptional()
  @ValidateNested()
  @Type(() => SmtpConfigDto)
  smtp?: SmtpConfigDto;

  @ApiPropertyOptional({ description: 'IMAP settings for receiving emails', type: ImapConfigDto })
  @IsOptional()
  @ValidateNested()
  @Type(() => ImapConfigDto)
  imap?: ImapConfigDto;
}

/**
 * DTO for updating organization email settings
 */
export class UpdateOrganizationEmailSettingsDto {
  @ApiPropertyOptional({ description: 'SMTP settings', type: SmtpConfigDto })
  @IsOptional()
  @ValidateNested()
  @Type(() => SmtpConfigDto)
  smtp?: Partial<SmtpConfigDto>;

  @ApiPropertyOptional({ description: 'IMAP settings', type: ImapConfigDto })
  @IsOptional()
  @ValidateNested()
  @Type(() => ImapConfigDto)
  imap?: Partial<ImapConfigDto>;
}

/**
 * Response DTO for email settings (excludes sensitive data like passwords)
 */
export class OrganizationEmailSettingsResponseDto {
  @ApiProperty({ description: 'SMTP is configured', default: false })
  hasSmtp!: boolean;

  @ApiPropertyOptional({ description: 'SMTP server hostname' })
  smtpHost?: string;

  @ApiPropertyOptional({ description: 'SMTP server port' })
  smtpPort?: number;

  @ApiPropertyOptional({ description: 'SMTP uses secure connection' })
  smtpSecure?: boolean;

  @ApiPropertyOptional({ description: 'Default from email address' })
  smtpFromAddress?: string;

  @ApiPropertyOptional({ description: 'Default from name' })
  smtpFromName?: string;

  @ApiProperty({ description: 'IMAP is configured', default: false })
  hasImap!: boolean;

  @ApiPropertyOptional({ description: 'IMAP server hostname' })
  imapHost?: string;

  @ApiPropertyOptional({ description: 'IMAP server port' })
  imapPort?: number;

  @ApiPropertyOptional({ description: 'IMAP uses secure connection' })
  imapSecure?: boolean;

  @ApiPropertyOptional({ description: 'Monitored inbox folder' })
  imapInboxFolder?: string;

  @ApiProperty({ description: 'Email settings are using organization-specific config' })
  isCustom!: boolean;

  // Raw config objects for form population (excludes password)
  @ApiPropertyOptional({ description: 'SMTP username for editing', type: Object })
  smtp?: {
    host?: string;
    port?: number;
    secure?: boolean;
    user?: string;
    fromAddress?: string;
    fromName?: string;
  };

  @ApiPropertyOptional({ description: 'IMAP username for editing', type: Object })
  imap?: {
    host?: string;
    port?: number;
    secure?: boolean;
    user?: string;
    inboxFolder?: string;
  };
}
