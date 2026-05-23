import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../common/prisma.service';
import * as nodemailer from 'nodemailer';

export interface EmailTransportConfig {
  host: string;
  port: number;
  secure: boolean;
  auth: {
    user: string;
    pass: string;
  };
}

/**
 * Service for managing per-organization email settings
 * Provides SMTP/IMAP configurations with fallback to global .env settings
 */
@Injectable()
export class OrganizationEmailSettingsService {
  private readonly logger = new Logger(OrganizationEmailSettingsService.name);

  constructor(
    private prisma: PrismaService,
    private config: ConfigService,
  ) {}

  /**
   * Get the SMTP transport configuration for an organization
   * Falls back to global .env settings if no org-specific settings exist
   */
  async getSmtpConfig(organizationId?: string): Promise<EmailTransportConfig> {
    if (organizationId) {
      const orgSettings = await this.prisma.organization.findUnique({
        where: { id: organizationId },
        select: {
          id: true,
          name: true,
          emailSettings: true as any,
        },
      });

      if ((orgSettings as any)?.emailSettings) {
        const emailSettings = (orgSettings as any).emailSettings as {
          smtp?: {
            host?: string;
            port?: number;
            secure?: boolean;
            user?: string;
            pass?: string;
            fromAddress?: string;
            fromName?: string;
          };
        };

        if (emailSettings?.smtp?.host && emailSettings?.smtp?.user && emailSettings?.smtp?.pass) {
          this.logger.debug(`Using org-specific SMTP config for org: ${(orgSettings as any).name}`);

          return {
            host: emailSettings.smtp.host,
            port: emailSettings.smtp.port || 587,
            secure: emailSettings.smtp.secure || false,
            auth: {
              user: emailSettings.smtp.user,
              pass: emailSettings.smtp.pass,
            },
          };
        }
      }
    }

    // Fall back to global .env settings
    this.logger.debug('Falling back to global SMTP config from .env');

    return {
      host: this.config.get<string>('SMTP_HOST', 'localhost'),
      port: this.config.get<number>('SMTP_PORT', 587),
      secure: this.config.get<boolean>('SMTP_SECURE', false),
      auth: {
        user: this.config.get<string>('SMTP_USER', ''),
        pass: this.config.get<string>('SMTP_PASSWORD', ''),
      },
    };
  }

  /**
   * Get the IMAP transport configuration for an organization
   * Falls back to global .env settings if no org-specific settings exist
   */
  async getImapConfig(organizationId?: string): Promise<{
    host: string;
    port: number;
    secure: boolean;
    auth: { user: string; pass: string };
    inboxFolder: string;
  }> {
    if (organizationId) {
      const orgSettings = await this.prisma.organization.findUnique({
        where: { id: organizationId },
        select: {
          id: true,
          name: true,
          emailSettings: true as any,
        },
      });

      if ((orgSettings as any)?.emailSettings) {
        const emailSettings = (orgSettings as any).emailSettings as {
          imap?: {
            host?: string;
            port?: number;
            secure?: boolean;
            user?: string;
            pass?: string;
            inboxFolder?: string;
          };
        };

        if (emailSettings?.imap?.host && emailSettings?.imap?.user) {
          this.logger.debug(`Using org-specific IMAP config for org: ${(orgSettings as any).name}`);

          return {
            host: emailSettings.imap.host,
            port: emailSettings.imap.port || 993,
            secure: emailSettings.imap.secure ?? true,
            auth: {
              user: emailSettings.imap.user,
              pass: emailSettings.imap.pass || '',
            },
            inboxFolder: emailSettings.imap.inboxFolder || 'INBOX',
          };
        }
      }
    }

    // Fall back to global .env settings
    this.logger.debug('Falling back to global IMAP config from .env');

    return {
      host: this.config.get<string>('IMAP_HOST', 'localhost'),
      port: this.config.get<number>('IMAP_PORT', 993),
      secure: this.config.get<boolean>('IMAP_SECURE', true),
      auth: {
        user: this.config.get<string>('IMAP_USER', ''),
        pass: this.config.get<string>('IMAP_PASSWORD', ''),
      },
      inboxFolder: this.config.get<string>('IMAP_INBOX_FOLDER', 'INBOX'),
    };
  }

  /**
   * Get the "from" address for an organization
   * Falls back to global .env settings if no org-specific settings exist
   */
  async getFromAddress(organizationId?: string): Promise<{ address: string; name?: string }> {
    if (organizationId) {
      const orgSettings = await this.prisma.organization.findUnique({
        where: { id: organizationId },
        select: {
          id: true,
          name: true,
          emailSettings: true as any,
        },
      });

      if ((orgSettings as any)?.emailSettings) {
        const emailSettings = (orgSettings as any).emailSettings as {
          smtp?: {
            fromAddress?: string;
            fromName?: string;
          };
        };

        if (emailSettings?.smtp?.fromAddress) {
          return {
            address: emailSettings.smtp.fromAddress,
            name: emailSettings.smtp.fromName || undefined,
          };
        }
      }
    }

    // Fall back to global .env settings
    return {
      address: this.config.get<string>('SMTP_FROM', 'noreply@helix.helpdesk'),
      name: this.config.get<string>('SMTP_FROM_NAME'),
    };
  }

  /**
   * Create a nodemailer transporter for a specific organization
   */
  async createTransporter(organizationId?: string): Promise<nodemailer.Transporter> {
    const smtpConfig = await this.getSmtpConfig(organizationId);

    return nodemailer.createTransport({
      host: smtpConfig.host,
      port: smtpConfig.port,
      secure: smtpConfig.secure,
      auth: {
        user: smtpConfig.auth.user,
        pass: smtpConfig.auth.pass,
      },
    });
  }

  /**
   * Check if organization has custom email settings configured
   */
  async hasCustomEmailSettings(organizationId: string): Promise<boolean> {
    const orgSettings = await this.prisma.organization.findUnique({
      where: { id: organizationId },
      select: {
        emailSettings: true as any,
      },
    });

    return !!((orgSettings as any)?.emailSettings);
  }
}
