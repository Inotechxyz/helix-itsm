import { Process, Processor } from '@nestjs/bull';
import { Logger } from '@nestjs/common';
import { Job } from 'bull';
import { EmailService } from '../services/email.service';

interface EmailJobData {
  to: string;
  subject: string;
  html: string;
  type: string;
  metadata?: Record<string, any>;
  headers?: Record<string, string>;
  organizationId?: string;
}

@Processor('email')
export class EmailProcessor {
  private readonly logger = new Logger(EmailProcessor.name);

  constructor(private emailService: EmailService) {}

  @Process('send')
  async handleEmail(job: Job<EmailJobData>) {
    const { to, subject, html, type, metadata, organizationId } = job.data;

    this.logger.log(`Processing email job ${job.id}: ${type}${organizationId ? ` (org: ${organizationId})` : ''}`);

    try {
      await this.emailService.sendEmail(to, subject, html, undefined, organizationId);
      this.logger.log(`Email sent successfully to ${to}`);
    } catch (error) {
      this.logger.error(`Failed to send email to ${to}`, error);
      throw error;
    }
  }

  @Process('send-comment-reply')
  async handleCommentReply(job: Job<EmailJobData>) {
    const { to, subject, html, type, metadata, headers, organizationId } = job.data;

    this.logger.log(`Processing comment reply job ${job.id}: ${type}${organizationId ? ` (org: ${organizationId})` : ''}`);

    try {
      await this.emailService.sendEmail(to, subject, html, headers, organizationId);
      this.logger.log(`Comment reply email sent successfully to ${to}`);
    } catch (error) {
      this.logger.error(`Failed to send comment reply email to ${to}`, error);
      throw error;
    }
  }
}
