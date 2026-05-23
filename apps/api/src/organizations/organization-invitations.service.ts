import { Injectable, NotFoundException, ConflictException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../common/prisma.service';
import { EmailService } from '../email/email.service';
import { InviteUserDto, OrganizationRoleEnum } from './dto/invitation.dto';
import { randomBytes } from 'crypto';

@Injectable()
export class OrganizationInvitationsService {
  // Invitation expires in 7 days
  private readonly INVITATION_EXPIRY_DAYS = 7;

  constructor(
    private prisma: PrismaService,
    private emailService: EmailService,
  ) {}

  /**
   * Generate a unique invitation token
   */
  private generateToken(): string {
    return randomBytes(32).toString('hex');
  }

  /**
   * Get invitation expiry date
   */
  private getExpiryDate(): Date {
    const expiryDate = new Date();
    expiryDate.setDate(expiryDate.getDate() + this.INVITATION_EXPIRY_DAYS);
    return expiryDate;
  }

  /**
   * Send invitation to a user
   */
  async inviteUser(organizationId: string, dto: InviteUserDto, invitedBy: string) {
    // Check if organization exists
    const organization = await this.prisma.organization.findUnique({
      where: { id: organizationId },
    });

    if (!organization) {
      throw new NotFoundException(`Organization with ID "${organizationId}" not found`);
    }

    // Check if user is already a member
    const existingUser = await this.prisma.user.findUnique({
      where: { email: dto.email },
    });

    if (existingUser) {
      const existingMembership = await this.prisma.organizationUser.findUnique({
        where: {
          organizationId_userId: {
            organizationId,
            userId: existingUser.id,
          },
        },
      });

      if (existingMembership) {
        throw new ConflictException(`User ${dto.email} is already a member of this organization`);
      }
    }

    // Check if user already has an invitation
    const existingInvitation = await this.prisma.organizationInvitation.findUnique({
      where: {
        organizationId_email: {
          organizationId,
          email: dto.email,
        },
      },
    });

    // If there's an existing invitation that's pending, don't allow re-invitation
    if (existingInvitation && existingInvitation.status === 'pending') {
      throw new ConflictException(`An invitation has already been sent to ${dto.email}`);
    }

    // If there's an existing invitation that's not pending (cancelled, expired, accepted, declined),
    // delete it and allow creating a new one
    if (existingInvitation) {
      await this.prisma.organizationInvitation.delete({
        where: { id: existingInvitation.id },
      });
    }

    // Generate token and create invitation
    const token = this.generateToken();
    const expiresAt = this.getExpiryDate();

    const invitation = await this.prisma.organizationInvitation.create({
      data: {
        organizationId,
        email: dto.email,
        role: dto.orgRole as 'orgadmin' | 'manager' | 'agent' | 'requester',
        token,
        status: 'pending',
        invitedBy,
        message: dto.message,
        expiresAt,
      },
      include: {
        organization: {
          select: {
            id: true,
            name: true,
            slug: true,
            logoUrl: true,
            primaryColor: true,
          },
        },
      },
    });

    // Send invitation email
    try {
      await this.emailService.sendOrganizationInvitation({
        to: dto.email,
        organizationName: organization.name,
        invitedBy: invitedBy,
        role: dto.orgRole,
        message: dto.message,
        invitationToken: token,
        expiresAt: expiresAt.toISOString(),
      });
    } catch (error) {
      console.error('Failed to send invitation email:', error);
      // Don't fail the invitation creation if email fails
    }

    return invitation;
  }

  /**
   * Send bulk invitations
   */
  async bulkInviteUsers(organizationId: string, invitations: InviteUserDto[], invitedBy: string) {
    const results = {
      sent: [] as any[],
      failed: [] as { email: string; error: string }[],
    };

    for (const dto of invitations) {
      try {
        const invitation = await this.inviteUser(organizationId, dto, invitedBy);
        results.sent.push({ email: dto.email, invitation });
      } catch (error: any) {
        results.failed.push({
          email: dto.email,
          error: error.message || 'Unknown error',
        });
      }
    }

    return results;
  }

  /**
   * Get all pending invitations for an organization
   */
  async getPendingInvitations(organizationId: string) {
    return this.prisma.organizationInvitation.findMany({
      where: {
        organizationId,
        status: 'pending',
        expiresAt: { gt: new Date() },
      },
      include: {
        organization: {
          select: {
            id: true,
            name: true,
            slug: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  /**
   * Get all invitations for an organization
   */
  async getAllInvitations(organizationId: string) {
    return this.prisma.organizationInvitation.findMany({
      where: { organizationId },
      include: {
        organization: {
          select: {
            id: true,
            name: true,
            slug: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  /**
   * Accept an invitation
   */
  async acceptInvitation(token: string, userId: string) {
    const invitation = await this.prisma.organizationInvitation.findUnique({
      where: { token },
      include: {
        organization: true,
      },
    });

    if (!invitation) {
      throw new NotFoundException('Invitation not found');
    }

    if (invitation.status !== 'pending') {
      throw new BadRequestException(`Invitation has already been ${invitation.status}`);
    }

    if (invitation.expiresAt < new Date()) {
      throw new BadRequestException('Invitation has expired');
    }

    // Check if user email matches invitation email
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    if (user.email.toLowerCase() !== invitation.email.toLowerCase()) {
      throw new BadRequestException('Invitation email does not match user email');
    }

    // Add user to organization
    const orgUser = await this.prisma.organizationUser.create({
      data: {
        organizationId: invitation.organizationId,
        userId,
        orgRole: invitation.role as 'orgadmin' | 'manager' | 'agent' | 'requester',
      },
      include: {
        organization: {
          select: {
            id: true,
            name: true,
            slug: true,
          },
        },
        user: {
          select: {
            id: true,
            email: true,
            firstName: true,
            lastName: true,
          },
        },
      },
    });

    // Mark invitation as accepted
    await this.prisma.organizationInvitation.update({
      where: { id: invitation.id },
      data: {
        status: 'accepted',
        acceptedAt: new Date(),
      },
    });

    return {
      membership: orgUser,
      organization: invitation.organization,
    };
  }

  /**
   * Decline an invitation
   */
  async declineInvitation(token: string, userId: string) {
    const invitation = await this.prisma.organizationInvitation.findUnique({
      where: { token },
    });

    if (!invitation) {
      throw new NotFoundException('Invitation not found');
    }

    if (invitation.status !== 'pending') {
      throw new BadRequestException(`Invitation has already been ${invitation.status}`);
    }

    return this.prisma.organizationInvitation.update({
      where: { id: invitation.id },
      data: { status: 'declined' },
    });
  }

  /**
   * Resend an invitation
   */
  async resendInvitation(invitationId: string) {
    const invitation = await this.prisma.organizationInvitation.findUnique({
      where: { id: invitationId },
      include: {
        organization: true,
      },
    });

    if (!invitation) {
      throw new NotFoundException('Invitation not found');
    }

    if (invitation.status !== 'pending') {
      throw new BadRequestException(`Cannot resend a ${invitation.status} invitation`);
    }

    // Generate new token and expiry
    const newToken = this.generateToken();
    const newExpiryDate = this.getExpiryDate();

    const updatedInvitation = await this.prisma.organizationInvitation.update({
      where: { id: invitationId },
      data: {
        token: newToken,
        expiresAt: newExpiryDate,
      },
      include: {
        organization: {
          select: {
            id: true,
            name: true,
            slug: true,
            logoUrl: true,
            primaryColor: true,
          },
        },
      },
    });

    // Send new invitation email
    try {
      await this.emailService.sendOrganizationInvitation({
        to: invitation.email,
        organizationName: invitation.organization.name,
        invitedBy: invitation.invitedBy,
        role: invitation.role as OrganizationRoleEnum,
        invitationToken: newToken,
        expiresAt: newExpiryDate.toISOString(),
      });
    } catch (error) {
      console.error('Failed to resend invitation email:', error);
    }

    return updatedInvitation;
  }

  /**
   * Cancel an invitation
   */
  async cancelInvitation(invitationId: string) {
    const invitation = await this.prisma.organizationInvitation.findUnique({
      where: { id: invitationId },
    });

    if (!invitation) {
      throw new NotFoundException('Invitation not found');
    }

    if (invitation.status !== 'pending') {
      throw new BadRequestException(`Cannot cancel a ${invitation.status} invitation`);
    }

    return this.prisma.organizationInvitation.delete({
      where: { id: invitationId },
    });
  }

  /**
   * Get invitation by token (public)
   */
  async getInvitationByToken(token: string) {
    const invitation = await this.prisma.organizationInvitation.findUnique({
      where: { token },
      include: {
        organization: {
          select: {
            id: true,
            name: true,
            slug: true,
            logoUrl: true,
            primaryColor: true,
            secondaryColor: true,
          },
        },
      },
    });

    if (!invitation) {
      throw new NotFoundException('Invitation not found');
    }

    // Check if expired
    const isExpired = invitation.expiresAt < new Date();

    return {
      ...invitation,
      isExpired,
      isValid: invitation.status === 'pending' && !isExpired,
    };
  }

  /**
   * Cleanup expired invitations
   */
  async cleanupExpiredInvitations() {
    return this.prisma.organizationInvitation.updateMany({
      where: {
        status: 'pending',
        expiresAt: { lt: new Date() },
      },
      data: {
        status: 'expired',
      },
    });
  }
}
