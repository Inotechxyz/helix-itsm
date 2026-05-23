import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma.service';
import * as nodemailer from 'nodemailer';

interface EmailJobData {
  to: string;
  subject: string;
  html: string;
  type: string;
  metadata?: Record<string, any>;
  headers?: Record<string, string>;
  organizationId?: string;
}

@Injectable()
export class EmailService {
  private readonly logger = new Logger(EmailService.name);

  constructor(
    private config: ConfigService,
    private prisma: PrismaService,
  ) {}

  /**
   * Get SMTP transporter for a specific organization
   * Falls back to global settings if org doesn't have custom SMTP
   */
  private async getTransporter(organizationId?: string): Promise<nodemailer.Transporter> {
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
          };
        };

        if (emailSettings?.smtp?.host && emailSettings?.smtp?.user) {
          this.logger.debug(`Using org-specific SMTP for: ${(orgSettings as any).name}`);

          return nodemailer.createTransport({
            host: emailSettings.smtp.host,
            port: emailSettings.smtp.port || 587,
            secure: emailSettings.smtp.secure || false,
            auth: {
              user: emailSettings.smtp.user,
              pass: emailSettings.smtp.pass || '',
            },
          });
        }
      }
    }

    // Fall back to global .env settings
    this.logger.debug('Falling back to global SMTP config');
    return nodemailer.createTransport({
      host: this.config.get('SMTP_HOST', 'localhost'),
      port: this.config.get<number>('SMTP_PORT', 587),
      secure: this.config.get<boolean>('SMTP_SECURE', false),
      auth: {
        user: this.config.get('SMTP_USER'),
        pass: this.config.get('SMTP_PASSWORD'),
      },
    });
  }

  /**
   * Get the "from" address for a specific organization
   */
  private async getFromAddress(organizationId?: string): Promise<string> {
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
          const name = emailSettings.smtp.fromName || (orgSettings as any).name;
          return name ? `"${name}" <${emailSettings.smtp.fromAddress}>` : emailSettings.smtp.fromAddress;
        }
      }
    }

    // Fall back to global .env settings
    const fromAddress = this.config.get('SMTP_FROM', 'noreply@helix.helpdesk');
    const fromName = this.config.get('SMTP_FROM_NAME');
    return fromName ? `"${fromName}" <${fromAddress}>` : fromAddress;
  }

  /**
   * Send email with organization-specific SMTP settings
   */
  async sendEmail(
    to: string,
    subject: string,
    html: string,
    headers?: Record<string, string>,
    organizationId?: string,
  ): Promise<void> {
    try {
      const transporter = await this.getTransporter(organizationId);
      const fromAddress = await this.getFromAddress(organizationId);

      const mailOptions: nodemailer.SendMailOptions = {
        from: fromAddress,
        to,
        subject,
        html,
      };

      if (headers) {
        mailOptions.headers = headers;
      }

      await transporter.sendMail(mailOptions);
      this.logger.log(`Email sent to ${to}: ${subject}${organizationId ? ` (org: ${organizationId})` : ''}`);
    } catch (error) {
      this.logger.error(`Failed to send email to ${to}`, error);
      throw error;
    }
  }

  /**
   * Process email job from queue with organization awareness
   */
  async processEmailJob(job: EmailJobData): Promise<void> {
    const { to, subject, html, headers, organizationId } = job;
    await this.sendEmail(to, subject, html, headers, organizationId);
  }

  async processEmailQueue() {
    this.logger.log('Processing email queue...');
    // Queue processing logic handled by Bull
  }
}
