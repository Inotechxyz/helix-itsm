import { Injectable, Logger, Optional, Inject, forwardRef } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectQueue } from '@nestjs/bull';
import { Queue } from 'bull';
import * as nodemailer from 'nodemailer';
import { OrganizationEmailSettingsService } from '../organizations/organization-email-settings.service';

const NotificationType = {
  TICKET_CREATED: 'ticket_created',
  TICKET_ASSIGNED: 'ticket_assigned',
  TICKET_UPDATED: 'ticket_updated',
  TICKET_COMMENT: 'ticket_comment',
  TICKET_RESOLVED: 'ticket_resolved',
  TICKET_CLOSED: 'ticket_closed',
  SERVICE_REQUEST_SUBMITTED: 'service_request_submitted',
  SERVICE_REQUEST_APPROVED: 'service_request_approved',
  SERVICE_REQUEST_REJECTED: 'service_request_rejected',
  SERVICE_REQUEST_COMPLETED: 'service_request_completed',
  SLA_WARNING: 'sla_warning',
  SLA_BREACHED: 'sla_breached',
} as const;

type EmailType = typeof NotificationType[keyof typeof NotificationType];

export interface EmailJob {
  to: string;
  subject: string;
  html: string;
  type: string;
  metadata?: Record<string, any>;
  organizationId?: string;
}

export interface CommentReplyJob {
  to: string;
  subject: string;
  content: string;
  ticketNumber: string;
  originalMessageId?: string;
  includeOriginalContent?: boolean;
  originalContent?: string;
  organizationId?: string;
}

@Injectable()
export class EmailService {
  private readonly logger = new Logger(EmailService.name);
  private useDirectSending = false;

  constructor(
    private config: ConfigService,
    @Optional() @InjectQueue('email') private emailQueue?: Queue,
    @Optional() private emailSettingsService?: OrganizationEmailSettingsService,
  ) {
    // Check if we should use direct sending
    // Set USE_DIRECT_EMAIL=true in env to bypass Redis/Bull queue
    this.useDirectSending =
      this.config.get<boolean>('USE_DIRECT_EMAIL', false) ||
      !this.emailQueue;
  }

  /**
   * Check if the email queue is available
   */
  private isQueueAvailable(): boolean {
    return !this.useDirectSending && !!this.emailQueue;
  }

  /**
   * Get the transporter for a specific organization (with fallback to global settings)
   */
  private async getTransporter(organizationId?: string): Promise<nodemailer.Transporter> {
    if (this.emailSettingsService && organizationId) {
      return this.emailSettingsService.createTransporter(organizationId);
    }

    // Fall back to global transporter (recreate with global config)
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
    if (this.emailSettingsService && organizationId) {
      const { address, name } = await this.emailSettingsService.getFromAddress(organizationId);
      return name ? `"${name}" <${address}>` : address;
    }

    return this.config.get('SMTP_FROM', 'noreply@helix.helpdesk');
  }

  /**
   * Send email directly via SMTP (fallback when Redis is not available)
   */
  private async sendDirect(to: string, subject: string, html: string, headers?: Record<string, string>, organizationId?: string): Promise<void> {
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
      this.logger.log(`Direct email sent to ${to}: ${subject}`);
    } catch (error) {
      this.logger.error(`Failed to send direct email to ${to}`, error);
      throw error;
    }
  }

  async sendEmail(job: EmailJob): Promise<void> {
    const organizationId = job.organizationId;

    if (this.isQueueAvailable()) {
      try {
        await this.emailQueue!.add('send', job, {
          attempts: 3,
          backoff: {
            type: 'exponential',
            delay: 5000,
          },
        });
        this.logger.log(`Email queued: ${job.to} - ${job.subject}`);
      } catch (error) {
        this.logger.warn('Failed to queue email, falling back to direct send', error);
        await this.sendDirect(job.to, job.subject, job.html, undefined, organizationId);
      }
    } else {
      // Direct sending mode
      this.logger.log(`Direct email mode - sending to ${job.to}: ${job.subject}`);
      await this.sendDirect(job.to, job.subject, job.html, undefined, organizationId);
    }
  }

  async processEmail(job: EmailJob): Promise<void> {
    // This method is used by the Bull processor, but we also use direct sending
    await this.sendDirect(job.to, job.subject, job.html, undefined, job.organizationId);
  }

  // Template-based email methods
  async sendTicketNotification(
    to: string,
    type: string,
    ticket: {
      ticketNumber: string;
      title: string;
      status: string;
    },
    recipientName?: string,
  ) {
    const templates = this.getEmailTemplate(type, ticket, recipientName);
    return this.sendEmail({
      to,
      subject: templates.subject,
      html: templates.html,
      type,
      metadata: { ticketNumber: ticket.ticketNumber },
    });
  }

  private getEmailTemplate(
    type: string,
    ticket: { ticketNumber: string; title: string; status: string },
    recipientName?: string,
  ) {
    const baseUrl = this.config.get('APP_URL', 'http://localhost:5173');

    const templates: Record<string, { subject: string; html: string }> = {
      [NotificationType.TICKET_CREATED]: {
        subject: `[${ticket.ticketNumber}] Ticket Created: ${ticket.title}`,
        html: `
          <h2>Hello ${recipientName || 'there'},</h2>
          <p>Your ticket has been created successfully.</p>
          <p><strong>Ticket Number:</strong> ${ticket.ticketNumber}</p>
          <p><strong>Title:</strong> ${ticket.title}</p>
          <p><strong>Status:</strong> ${ticket.status}</p>
          <p>You can view your ticket <a href="${baseUrl}/tickets/${ticket.ticketNumber}">here</a>.</p>
        `,
      },
      [NotificationType.TICKET_ASSIGNED]: {
        subject: `[${ticket.ticketNumber}] Ticket Assigned to You`,
        html: `
          <h2>Hello ${recipientName || 'there'},</h2>
          <p>A new ticket has been assigned to you.</p>
          <p><strong>Ticket Number:</strong> ${ticket.ticketNumber}</p>
          <p><strong>Title:</strong> ${ticket.title}</p>
          <p>You can view the ticket <a href="${baseUrl}/tickets/${ticket.ticketNumber}">here</a>.</p>
        `,
      },
      [NotificationType.TICKET_UPDATED]: {
        subject: `[${ticket.ticketNumber}] Status Changed to ${ticket.status}`,
        html: `
          <h2>Hello ${recipientName || 'there'},</h2>
          <p>The status of your ticket has been updated.</p>
          <p><strong>Ticket Number:</strong> ${ticket.ticketNumber}</p>
          <p><strong>New Status:</strong> ${ticket.status}</p>
          <p>You can view your ticket <a href="${baseUrl}/tickets/${ticket.ticketNumber}">here</a>.</p>
        `,
      },
      [NotificationType.TICKET_COMMENT]: {
        subject: `[${ticket.ticketNumber}] New Comment`,
        html: `
          <h2>Hello ${recipientName || 'there'},</h2>
          <p>A new comment has been added to your ticket.</p>
          <p><strong>Ticket Number:</strong> ${ticket.ticketNumber}</p>
          <p>You can view your ticket <a href="${baseUrl}/tickets/${ticket.ticketNumber}">here</a>.</p>
        `,
      },
      [NotificationType.SLA_WARNING]: {
        subject: `[${ticket.ticketNumber}] SLA Warning`,
        html: `
          <h2>Warning: SLA Approaching</h2>
          <p>The following ticket is approaching its SLA deadline:</p>
          <p><strong>Ticket Number:</strong> ${ticket.ticketNumber}</p>
          <p><strong>Title:</strong> ${ticket.title}</p>
          <p>Please take action to prevent SLA breach.</p>
        `,
      },
      [NotificationType.SLA_BREACHED]: {
        subject: `[${ticket.ticketNumber}] SLA Breached`,
        html: `
          <h2>Alert: SLA Breached</h2>
          <p>The following ticket has breached its SLA:</p>
          <p><strong>Ticket Number:</strong> ${ticket.ticketNumber}</p>
          <p><strong>Title:</strong> ${ticket.title}</p>
        `,
      },
    };

    return templates[type] || templates[NotificationType.TICKET_UPDATED];
  }

  /**
   * Send a reply email to a comment's recipients
   * Creates an HTML email from the reply content
   */
  async sendCommentReply(job: CommentReplyJob, organizationId?: string): Promise<void> {
    const baseUrl = this.config.get('APP_URL', 'http://localhost:5173');

    // Convert plain text content to HTML
    const contentHtml = this.plainTextToHtml(job.content);

    // Build original message section if requested
    const originalMessageSection = job.includeOriginalContent && job.originalContent
      ? `
        <div style="margin-top: 20px; padding: 15px; background-color: #f0f4f8; border-left: 4px solid #6b7280;">
          <p style="margin: 0 0 10px 0; color: #6b7280; font-size: 12px; font-weight: bold;">
            --- Original Message ---
          </p>
          <div style="white-space: pre-wrap; line-height: 1.6; color: #374151;">
            ${this.plainTextToHtml(job.originalContent)}
          </div>
        </div>
      `
      : '';

    const html = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <div style="background-color: #f8f9fa; padding: 20px; border-bottom: 2px solid #e5e7eb;">
          <p style="margin: 0; color: #6b7280; font-size: 14px;">
            This is a reply to your email regarding ticket
            <a href="${baseUrl}/tickets/${job.ticketNumber}" style="color: #3b82f6;">
              ${job.ticketNumber}
            </a>
          </p>
        </div>
        <div style="padding: 20px; white-space: pre-wrap; line-height: 1.6;">
          ${contentHtml}
        </div>
        ${originalMessageSection}
        <div style="background-color: #f8f9fa; padding: 15px 20px; border-top: 1px solid #e5e7eb; font-size: 12px; color: #6b7280;">
          <p style="margin: 0;">
            Please do not reply to this email directly unless you want to update the ticket.<br/>
            View the ticket online:
            <a href="${baseUrl}/tickets/${job.ticketNumber}" style="color: #3b82f6;">
              ${baseUrl}/tickets/${job.ticketNumber}
            </a>
          </p>
        </div>
      </div>
    `;

    // Prepare threading headers if we have the original message ID
    const headers: Record<string, string> | undefined = job.originalMessageId ? {
      'In-Reply-To': `<${job.originalMessageId}>`,
      'References': `<${job.originalMessageId}>`,
    } : undefined;

    // Use queue if available, otherwise send directly
    if (this.isQueueAvailable()) {
      try {
        await this.emailQueue!.add('send-comment-reply', {
          to: job.to,
          subject: job.subject,
          html,
          type: 'comment_reply',
          metadata: {
            ticketNumber: job.ticketNumber,
            originalMessageId: job.originalMessageId,
          },
          headers,
        });
        this.logger.log(`Comment reply queued for ${job.to}: ${job.subject}`);
      } catch (error) {
        this.logger.warn('Failed to queue comment reply, falling back to direct send', error);
        await this.sendDirect(job.to, job.subject, html, headers, organizationId);
      }
    } else {
      // Direct sending mode
      this.logger.log(`Direct email mode - sending comment reply to ${job.to}: ${job.subject}`);
      await this.sendDirect(job.to, job.subject, html, headers, organizationId);
    }
  }

  /**
   * Convert plain text to basic HTML (handles newlines and basic formatting)
   */
  private plainTextToHtml(text: string): string {
    return text
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/\n\n/g, '</p><p>')
      .replace(/\n/g, '<br/>')
      .replace(/^(.+)$/, '<p>$1</p>');
  }

  /**
   * Send organization invitation email
   */
  async sendOrganizationInvitation(params: {
    to: string;
    organizationName: string;
    invitedBy: string;
    role: string;
    message?: string;
    invitationToken: string;
    expiresAt: string;
    organizationId?: string;
  }): Promise<void> {
    const { to, organizationName, invitedBy, role, message, invitationToken, expiresAt, organizationId } = params;
    const baseUrl = this.config.get('APP_URL', 'http://localhost:3000');
    const acceptUrl = `${baseUrl}/invitations/accept?token=${invitationToken}`;
    const expiresDate = new Date(expiresAt).toLocaleDateString('en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });

    const roleDisplayNames: Record<string, string> = {
      orgadmin: 'Organization Administrator',
      manager: 'Manager',
      agent: 'Agent',
      requester: 'Requester',
    };

    const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Organization Invitation</title>
</head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
  <div style="background: linear-gradient(135deg, #0066CC 0%, #004499 100%); padding: 30px; text-align: center; border-radius: 8px 8px 0 0;">
    <h1 style="color: white; margin: 0; font-size: 24px;">You've Been Invited!</h1>
  </div>

  <div style="background: #ffffff; padding: 30px; border: 1px solid #e0e0e0; border-top: none; border-radius: 0 0 8px 8px;">
    <p style="margin-top: 0;">Hello,</p>

    <p>You've been invited to join <strong>${organizationName}</strong> on Helix Helpdesk as a <strong>${roleDisplayNames[role] || role}</strong>.</p>

    ${message ? `
    <div style="background: #f5f5f5; padding: 15px; border-left: 4px solid #0066CC; margin: 20px 0;">
      <p style="margin: 0; font-style: italic;">"${this.plainTextToHtml(message)}"</p>
      <p style="margin: 10px 0 0 0; font-size: 12px; color: #666;">— ${invitedBy}</p>
    </div>
    ` : ''}

    <p>This invitation will expire on <strong>${expiresDate}</strong>.</p>

    <div style="text-align: center; margin: 30px 0;">
      <a href="${acceptUrl}" style="background: #0066CC; color: white; padding: 12px 30px; text-decoration: none; border-radius: 5px; font-weight: 600; display: inline-block;">Accept Invitation</a>
    </div>

    <p style="font-size: 14px; color: #666;">If the button doesn't work, copy and paste this link into your browser:</p>
    <p style="font-size: 14px; word-break: break-all;"><a href="${acceptUrl}" style="color: #0066CC;">${acceptUrl}</a></p>

    <hr style="border: none; border-top: 1px solid #e0e0e0; margin: 30px 0;">

    <p style="font-size: 12px; color: #999; margin-bottom: 0;">
      If you didn't expect this invitation, you can safely ignore this email.
    </p>
  </div>
</body>
</html>
    `;

    const subject = `You've been invited to join ${organizationName}`;

    await this.sendDirect(to, subject, html, undefined, organizationId);
  }
}
