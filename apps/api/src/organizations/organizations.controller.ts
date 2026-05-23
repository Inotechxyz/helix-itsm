import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  HttpCode,
  HttpStatus,
  Request,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { OrganizationsService } from './organizations.service';
import { OrganizationInvitationsService } from './organization-invitations.service';
import { OrganizationEmailTemplatesService } from './organization-email-templates.service';
import {
  CreateOrganizationDto,
  UpdateOrganizationDto,
  OrganizationQueryDto,
  UpdateBrandingDto,
  UpdateAuthConfigDto,
  UpdateAzureAdConfigDto,
  InviteUserDto,
  BulkInviteUserDto,
  UpdateBrandingSettingsDto,
  CreateEmailTemplateDto,
  UpdateEmailTemplateDto,
  UpdateOrganizationEmailSettingsDto,
} from './dto';
import { JwtAuthWithOrgGuard } from '../auth/guards/jwt-auth-with-org.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { OrganizationAccessGuard } from '../guards/organization-access.guard';
import { RoleAssignmentGuard } from '../guards/role-assignment.guard';
import { Roles } from '../decorators/roles.decorator';
import { OrganizationRoles } from '../decorators/organization-roles.decorator';
import { Public } from '../decorators/public.decorator';
import { UserRole, OrganizationRole } from '@helix/shared';
import { EmailTemplateType } from '@prisma/client';

@ApiTags('organizations')
@Controller('organizations')
@UseGuards(JwtAuthWithOrgGuard)
export class OrganizationsController {
  constructor(
    private readonly organizationsService: OrganizationsService,
    private readonly invitationsService: OrganizationInvitationsService,
    private readonly emailTemplatesService: OrganizationEmailTemplatesService,
  ) {}

  // ============================================
  // Global Organization Management (SuperAdmin only)
  // ============================================

  @Post()
  @UseGuards(RolesGuard)
  @Roles(UserRole.superadmin)
  @ApiOperation({ summary: 'Create a new organization (SuperAdmin only)' })
  @ApiResponse({ status: 201, description: 'Organization created successfully' })
  @ApiResponse({ status: 409, description: 'Organization slug already exists' })
  create(@Body() dto: CreateOrganizationDto) {
    return this.organizationsService.create(dto);
  }

  @Get()
  @UseGuards(RolesGuard)
  @Roles(UserRole.superadmin)
  @ApiOperation({ summary: 'List all organizations (SuperAdmin only)' })
  findAll(@Query() query: OrganizationQueryDto) {
    return this.organizationsService.findAll(query);
  }

  // NOTE: This route must be defined BEFORE ':id' to prevent "public" from being captured as an ID
  @Public()
  @Get('public')
  @ApiOperation({ summary: 'List all organizations for login dropdown (public)' })
  getAllPublic() {
    return this.organizationsService.findAllPublic();
  }

  @Get(':id')
  @UseGuards(RolesGuard, OrganizationAccessGuard)
  @OrganizationRoles(OrganizationRole.ORGADMIN)
  @ApiOperation({ summary: 'Get organization by ID' })
  findOne(@Param('id') id: string) {
    return this.organizationsService.findOne(id);
  }

  @Get('slug/:slug')
  @ApiOperation({ summary: 'Get organization by slug (public)' })
  findBySlug(@Param('slug') slug: string) {
    return this.organizationsService.findBySlug(slug);
  }

  @Patch(':id')
  @UseGuards(RolesGuard, OrganizationAccessGuard)
  @OrganizationRoles(OrganizationRole.ORGADMIN)
  @ApiOperation({ summary: 'Update organization' })
  update(@Param('id') id: string, @Body() dto: UpdateOrganizationDto) {
    return this.organizationsService.update(id, dto);
  }

  @Delete(':id')
  @UseGuards(RolesGuard)
  @Roles(UserRole.superadmin)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Soft delete organization (SuperAdmin only)' })
  delete(@Param('id') id: string) {
    return this.organizationsService.delete(id);
  }

  @Post(':id/restore')
  @UseGuards(RolesGuard)
  @Roles(UserRole.superadmin)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Restore a soft-deleted organization (SuperAdmin only)' })
  restore(@Param('id') id: string) {
    return this.organizationsService.restore(id);
  }

  @Delete(':id/force')
  @UseGuards(RolesGuard)
  @Roles(UserRole.superadmin)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Permanently delete organization (SuperAdmin only)' })
  forceDelete(@Param('id') id: string) {
    return this.organizationsService.forceDelete(id);
  }

  // ============================================
  // User Management within Organization
  // ============================================

  @Get(':id/users')
  @UseGuards(OrganizationAccessGuard)
  @OrganizationRoles(OrganizationRole.ORGADMIN, OrganizationRole.MANAGER)
  @ApiOperation({ summary: 'Get all users in organization' })
  getUsers(@Param('id') id: string) {
    return this.organizationsService.getUsers(id);
  }

  @Get(':id/teams')
  @UseGuards(OrganizationAccessGuard)
  @OrganizationRoles(OrganizationRole.ORGADMIN, OrganizationRole.MANAGER)
  @ApiOperation({ summary: 'Get all teams in organization' })
  getTeams(@Param('id') id: string) {
    return this.organizationsService.getTeams(id);
  }

  @Get(':id/teams/:teamId/members')
  @UseGuards(OrganizationAccessGuard)
  @OrganizationRoles(OrganizationRole.ORGADMIN, OrganizationRole.MANAGER)
  @ApiOperation({ summary: 'Get all members of a team' })
  getTeamMembers(@Param('id') id: string, @Param('teamId') teamId: string) {
    return this.organizationsService.getTeamMembers(id, teamId);
  }

  @Post(':id/users')
  @UseGuards(OrganizationAccessGuard, RoleAssignmentGuard)
  @OrganizationRoles(OrganizationRole.ORGADMIN)
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Add user to organization' })
  addUser(
    @Param('id') id: string,
    @Body() body: { userId: string; orgRole?: string },
  ) {
    return this.organizationsService.addUser(id, body.userId, body.orgRole);
  }

  @Patch(':id/users/:userId/role')
  @UseGuards(OrganizationAccessGuard, RoleAssignmentGuard)
  @OrganizationRoles(OrganizationRole.ORGADMIN)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Update user role in organization' })
  updateUserRole(
    @Param('id') id: string,
    @Param('userId') userId: string,
    @Body() body: { orgRole: string },
  ) {
    return this.organizationsService.updateUserRole(id, userId, body.orgRole);
  }

  @Delete(':id/users/:userId')
  @UseGuards(OrganizationAccessGuard)
  @OrganizationRoles(OrganizationRole.ORGADMIN)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Remove user from organization' })
  removeUser(@Param('id') id: string, @Param('userId') userId: string) {
    return this.organizationsService.removeUser(id, userId);
  }

  // ============================================
  // Branding & Auth Configuration
  // ============================================

  @Patch(':id/branding')
  @UseGuards(OrganizationAccessGuard)
  @OrganizationRoles(OrganizationRole.ORGADMIN)
  @ApiOperation({ summary: 'Update organization branding settings' })
  updateBranding(@Param('id') id: string, @Body() dto: UpdateBrandingDto) {
    return this.organizationsService.update(id, dto);
  }

  @Patch(':id/auth')
  @UseGuards(OrganizationAccessGuard)
  @OrganizationRoles(OrganizationRole.ORGADMIN)
  @ApiOperation({ summary: 'Update organization authentication settings' })
  updateAuthConfig(@Param('id') id: string, @Body() dto: UpdateAuthConfigDto) {
    return this.organizationsService.update(id, dto);
  }

  @Patch(':id/azure-ad')
  @UseGuards(OrganizationAccessGuard)
  @OrganizationRoles(OrganizationRole.ORGADMIN)
  @ApiOperation({ summary: 'Update organization Azure AD SSO configuration' })
  updateAzureAdConfig(@Param('id') id: string, @Body() dto: UpdateAzureAdConfigDto) {
    return this.organizationsService.updateAzureAdConfig(id, dto);
  }

  @Get(':id/azure-ad')
  @UseGuards(OrganizationAccessGuard)
  @ApiOperation({ summary: 'Get organization Azure AD SSO configuration' })
  getAzureAdConfig(@Param('id') id: string) {
    return this.organizationsService.getAzureAdConfig(id);
  }

  // ============================================
  // Email Settings Configuration
  // ============================================

  @Get(':id/email-settings')
  @UseGuards(OrganizationAccessGuard)
  @ApiOperation({ summary: 'Get organization email settings (without passwords)' })
  getEmailSettings(@Param('id') id: string) {
    return this.organizationsService.getEmailSettings(id);
  }

  @Patch(':id/email-settings')
  @UseGuards(OrganizationAccessGuard)
  @OrganizationRoles(OrganizationRole.ORGADMIN)
  @ApiOperation({ summary: 'Update organization email settings (SMTP/IMAP)' })
  updateEmailSettings(
    @Param('id') id: string,
    @Body() dto: UpdateOrganizationEmailSettingsDto,
  ) {
    return this.organizationsService.updateEmailSettings(id, dto);
  }

  @Post(':id/email-settings/test')
  @UseGuards(OrganizationAccessGuard)
  @OrganizationRoles(OrganizationRole.ORGADMIN)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Test organization email settings connection' })
  testEmailSettings(@Param('id') id: string) {
    return this.organizationsService.testEmailSettings(id);
  }

  // ============================================
  // Invitation Management
  // ============================================

  @Post(':id/invitations')
  @UseGuards(OrganizationAccessGuard)
  @OrganizationRoles(OrganizationRole.ORGADMIN, OrganizationRole.MANAGER)
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Send invitation to a user' })
  sendInvitation(
    @Param('id') id: string,
    @Body() dto: InviteUserDto,
    @Request() req: any,
  ) {
    return this.invitationsService.inviteUser(id, dto, req.user.id);
  }

  @Post(':id/invitations/bulk')
  @UseGuards(OrganizationAccessGuard)
  @OrganizationRoles(OrganizationRole.ORGADMIN)
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Send bulk invitations' })
  sendBulkInvitations(
    @Param('id') id: string,
    @Body() dto: BulkInviteUserDto,
    @Request() req: any,
  ) {
    return this.invitationsService.bulkInviteUsers(id, dto.invitations, req.user.id);
  }

  @Get(':id/invitations')
  @UseGuards(OrganizationAccessGuard)
  @OrganizationRoles(OrganizationRole.ORGADMIN, OrganizationRole.MANAGER)
  @ApiOperation({ summary: 'Get all invitations for organization' })
  getInvitations(@Param('id') id: string) {
    return this.invitationsService.getAllInvitations(id);
  }

  @Get(':id/invitations/pending')
  @UseGuards(OrganizationAccessGuard)
  @OrganizationRoles(OrganizationRole.ORGADMIN, OrganizationRole.MANAGER)
  @ApiOperation({ summary: 'Get pending invitations for organization' })
  getPendingInvitations(@Param('id') id: string) {
    return this.invitationsService.getPendingInvitations(id);
  }

  @Post(':id/invitations/:invitationId/resend')
  @UseGuards(OrganizationAccessGuard)
  @OrganizationRoles(OrganizationRole.ORGADMIN, OrganizationRole.MANAGER)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Resend an invitation' })
  resendInvitation(@Param('id') id: string, @Param('invitationId') invitationId: string) {
    return this.invitationsService.resendInvitation(invitationId);
  }

  @Delete(':id/invitations/:invitationId')
  @UseGuards(OrganizationAccessGuard)
  @OrganizationRoles(OrganizationRole.ORGADMIN, OrganizationRole.MANAGER)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Cancel an invitation' })
  cancelInvitation(@Param('id') id: string, @Param('invitationId') invitationId: string) {
    return this.invitationsService.cancelInvitation(invitationId);
  }

  // Public invitation endpoints

  @Public()
  @Get('invitations/:token')
  @ApiOperation({ summary: 'Get invitation details by token (public)' })
  getInvitationByToken(@Param('token') token: string) {
    return this.invitationsService.getInvitationByToken(token);
  }

  @Public()
  @Post('invitations/:token/accept')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Accept an invitation' })
  acceptInvitation(
    @Param('token') token: string,
    @Body() body: { userId: string },
  ) {
    return this.invitationsService.acceptInvitation(token, body.userId);
  }

  @Public()
  @Post('invitations/:token/decline')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Decline an invitation' })
  declineInvitation(
    @Param('token') token: string,
    @Body() body: { userId: string },
  ) {
    return this.invitationsService.declineInvitation(token, body.userId);
  }

  // ============================================
  // Email Templates
  // ============================================

  @Get(':id/branding')
  @UseGuards(OrganizationAccessGuard)
  @OrganizationRoles(OrganizationRole.ORGADMIN)
  @ApiOperation({ summary: 'Get organization branding settings' })
  getBrandingSettings(@Param('id') id: string) {
    return this.emailTemplatesService.getBrandingSettings(id);
  }

  @Patch(':id/branding/settings')
  @UseGuards(OrganizationAccessGuard)
  @OrganizationRoles(OrganizationRole.ORGADMIN)
  @ApiOperation({ summary: 'Update organization branding settings' })
  updateBrandingSettings(
    @Param('id') id: string,
    @Body() dto: UpdateBrandingSettingsDto,
  ) {
    return this.emailTemplatesService.updateBrandingSettings(id, dto);
  }

  @Get(':id/email-templates')
  @UseGuards(OrganizationAccessGuard)
  @OrganizationRoles(OrganizationRole.ORGADMIN)
  @ApiOperation({ summary: 'Get all email templates for organization' })
  getEmailTemplates(@Param('id') id: string) {
    return this.emailTemplatesService.getAllTemplates(id);
  }

  @Get(':id/email-templates/types')
  @UseGuards(OrganizationAccessGuard)
  @OrganizationRoles(OrganizationRole.ORGADMIN)
  @ApiOperation({ summary: 'Get available email template types' })
  getEmailTemplateTypes() {
    return this.emailTemplatesService.getAvailableTemplateTypes();
  }

  @Get(':id/email-templates/:templateType')
  @UseGuards(OrganizationAccessGuard)
  @OrganizationRoles(OrganizationRole.ORGADMIN)
  @ApiOperation({ summary: 'Get specific email template' })
  getEmailTemplate(
    @Param('id') id: string,
    @Param('templateType') templateType: EmailTemplateType,
  ) {
    return this.emailTemplatesService.getTemplate(id, templateType);
  }

  @Post(':id/email-templates')
  @UseGuards(OrganizationAccessGuard)
  @OrganizationRoles(OrganizationRole.ORGADMIN)
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Create or update email template' })
  upsertEmailTemplate(
    @Param('id') id: string,
    @Body() dto: CreateEmailTemplateDto,
  ) {
    return this.emailTemplatesService.upsertTemplate(id, dto);
  }

  @Patch(':id/email-templates/:templateType')
  @UseGuards(OrganizationAccessGuard)
  @OrganizationRoles(OrganizationRole.ORGADMIN)
  @ApiOperation({ summary: 'Update email template' })
  updateEmailTemplate(
    @Param('id') id: string,
    @Param('templateType') templateType: EmailTemplateType,
    @Body() dto: UpdateEmailTemplateDto,
  ) {
    return this.emailTemplatesService.upsertTemplate(id, {
      templateType,
      subject: dto.subject,
      body: dto.body,
    });
  }

  @Delete(':id/email-templates/:templateType')
  @UseGuards(OrganizationAccessGuard)
  @OrganizationRoles(OrganizationRole.ORGADMIN)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Delete custom email template (reverts to default)' })
  deleteEmailTemplate(
    @Param('id') id: string,
    @Param('templateType') templateType: EmailTemplateType,
  ) {
    return this.emailTemplatesService.deleteTemplate(id, templateType);
  }

  @Post(':id/email-templates/reset')
  @UseGuards(OrganizationAccessGuard)
  @OrganizationRoles(OrganizationRole.ORGADMIN)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Reset all email templates to default' })
  resetEmailTemplates(@Param('id') id: string) {
    return this.emailTemplatesService.resetAllTemplates(id);
  }
}
