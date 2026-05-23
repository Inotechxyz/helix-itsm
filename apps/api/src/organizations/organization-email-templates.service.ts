import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../common/prisma.service';
import { EmailTemplateType, Prisma, Prisma as PrismaTypes } from '@prisma/client';

export interface EmailTemplateInput {
  templateType: EmailTemplateType;
  subject: string;
  body: string;
}

export interface BrandingSettings {
  logoUrl?: string | null;
  primaryColor?: string | null;
  secondaryColor?: string | null;
  faviconUrl?: string | null;
  emailFromName?: string | null;
  emailFooterText?: string | null;
  emailFooterLinks?: Array<{ label: string; url: string }> | null;
}

// Input type for updates - fields are optional but when provided can be string, null, or undefined
export interface BrandingSettingsUpdate {
  logoUrl?: string | null;
  primaryColor?: string | null;
  secondaryColor?: string | null;
  faviconUrl?: string | null;
  emailFromName?: string | null;
  emailFooterText?: string | null;
  emailFooterLinks?: Array<{ label: string; url: string }> | null;
}

@Injectable()
export class OrganizationEmailTemplatesService {
  constructor(private prisma: PrismaService) {}

  /**
   * Get organization branding settings
   */
  async getBrandingSettings(organizationId: string) {
    const organization = await this.prisma.organization.findUnique({
      where: { id: organizationId },
      select: {
        logoUrl: true,
        primaryColor: true,
        secondaryColor: true,
        faviconUrl: true,
        emailFromName: true,
        emailFooterText: true,
        emailFooterLinks: true,
      },
    });

    if (!organization) {
      throw new NotFoundException(`Organization with ID "${organizationId}" not found`);
    }

    return organization as BrandingSettings;
  }

  /**
   * Update organization branding settings
   */
  async updateBrandingSettings(
    organizationId: string,
    settings: BrandingSettingsUpdate,
  ) {
    // Verify organization exists
    const organization = await this.prisma.organization.findUnique({
      where: { id: organizationId },
    });

    if (!organization) {
      throw new NotFoundException(`Organization with ID "${organizationId}" not found`);
    }

    // Build update data dynamically, only including fields that are explicitly set
    // Note: Prisma requires undefined for fields to exclude from update
    const updateData: Record<string, unknown> = {};

    if (settings.logoUrl !== undefined) {
      updateData.logoUrl = settings.logoUrl;
    }
    if (settings.primaryColor !== undefined) {
      updateData.primaryColor = settings.primaryColor;
    }
    if (settings.secondaryColor !== undefined) {
      updateData.secondaryColor = settings.secondaryColor;
    }
    if (settings.faviconUrl !== undefined) {
      updateData.faviconUrl = settings.faviconUrl;
    }
    if (settings.emailFromName !== undefined) {
      updateData.emailFromName = settings.emailFromName;
    }
    if (settings.emailFooterText !== undefined) {
      updateData.emailFooterText = settings.emailFooterText;
    }
    if (settings.emailFooterLinks !== undefined) {
      updateData.emailFooterLinks = settings.emailFooterLinks;
    }

    return this.prisma.organization.update({
      where: { id: organizationId },
      data: updateData,
      select: {
        logoUrl: true,
        primaryColor: true,
        secondaryColor: true,
        faviconUrl: true,
        emailFromName: true,
        emailFooterText: true,
        emailFooterLinks: true,
      },
    });
  }

  /**
   * Get email template for organization
   */
  async getTemplate(organizationId: string, templateType: EmailTemplateType) {
    const template = await this.prisma.organizationEmailTemplate.findUnique({
      where: {
        organizationId_templateType: {
          organizationId,
          templateType,
        },
      },
    });

    return template;
  }

  /**
   * Get all email templates for organization
   */
  async getAllTemplates(organizationId: string) {
    return this.prisma.organizationEmailTemplate.findMany({
      where: { organizationId },
      orderBy: { templateType: 'asc' },
    });
  }

  /**
   * Create or update email template
   */
  async upsertTemplate(organizationId: string, input: EmailTemplateInput) {
    // Verify organization exists
    const organization = await this.prisma.organization.findUnique({
      where: { id: organizationId },
    });

    if (!organization) {
      throw new NotFoundException(`Organization with ID "${organizationId}" not found`);
    }

    return this.prisma.organizationEmailTemplate.upsert({
      where: {
        organizationId_templateType: {
          organizationId,
          templateType: input.templateType,
        },
      },
      create: {
        organizationId,
        templateType: input.templateType,
        subject: input.subject,
        body: input.body,
        isCustomized: true,
      },
      update: {
        subject: input.subject,
        body: input.body,
        isCustomized: true,
      },
    });
  }

  /**
   * Delete custom email template (reverts to default)
   */
  async deleteTemplate(organizationId: string, templateType: EmailTemplateType) {
    const template = await this.prisma.organizationEmailTemplate.findUnique({
      where: {
        organizationId_templateType: {
          organizationId,
          templateType,
        },
      },
    });

    if (!template) {
      throw new NotFoundException('Email template not found');
    }

    return this.prisma.organizationEmailTemplate.delete({
      where: { id: template.id },
    });
  }

  /**
   * Reset all templates to default
   */
  async resetAllTemplates(organizationId: string) {
    return this.prisma.organizationEmailTemplate.deleteMany({
      where: { organizationId },
    });
  }

  /**
   * Get template with organization branding applied
   */
  async getResolvedTemplate(organizationId: string, templateType: EmailTemplateType) {
    const template = await this.prisma.organizationEmailTemplate.findUnique({
      where: {
        organizationId_templateType: {
          organizationId,
          templateType,
        },
      },
    });

    // If no custom template, return null - caller should use default
    if (!template) {
      return null;
    }

    // Get organization branding
    const branding = await this.getBrandingSettings(organizationId);

    return {
      template,
      branding,
    };
  }

  /**
   * Get available template types (for admin UI)
   */
  getAvailableTemplateTypes(): Array<{ type: EmailTemplateType; label: string; description: string }> {
    return [
      { type: 'TICKET_CREATED', label: 'Ticket Created', description: 'Sent when a new ticket is created' },
      { type: 'TICKET_ASSIGNED', label: 'Ticket Assigned', description: 'Sent when a ticket is assigned to an agent' },
      { type: 'TICKET_UPDATED', label: 'Ticket Updated', description: 'Sent when a ticket is updated' },
      { type: 'TICKET_RESOLVED', label: 'Ticket Resolved', description: 'Sent when a ticket is resolved' },
      { type: 'TICKET_CLOSED', label: 'Ticket Closed', description: 'Sent when a ticket is closed' },
      { type: 'TICKET_COMMENT', label: 'Ticket Comment', description: 'Sent when a comment is added to a ticket' },
      { type: 'SERVICE_REQUEST_SUBMITTED', label: 'Service Request Submitted', description: 'Sent when a service request is submitted' },
      { type: 'SERVICE_REQUEST_APPROVED', label: 'Service Request Approved', description: 'Sent when a service request is approved' },
      { type: 'SERVICE_REQUEST_REJECTED', label: 'Service Request Rejected', description: 'Sent when a service request is rejected' },
      { type: 'SERVICE_REQUEST_COMPLETED', label: 'Service Request Completed', description: 'Sent when a service request is completed' },
      { type: 'PASSWORD_RESET', label: 'Password Reset', description: 'Sent for password reset requests' },
      { type: 'EMAIL_VERIFICATION', label: 'Email Verification', description: 'Sent for email verification' },
      { type: 'ORG_INVITATION', label: 'Organization Invitation', description: 'Sent when user is invited to organization' },
    ];
  }
}
