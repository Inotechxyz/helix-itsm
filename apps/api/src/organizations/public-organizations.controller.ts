import { Controller, Get, Param } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { OrganizationsService } from './organizations.service';
import { OrganizationInvitationsService } from './organization-invitations.service';

/**
 * Public Organizations Controller
 *
 * This controller handles public endpoints that don't require authentication.
 * These endpoints are used for the login page and invitation flows.
 */
@ApiTags('public')
@Controller('public/organizations')
export class PublicOrganizationsController {
  constructor(
    private readonly organizationsService: OrganizationsService,
    private readonly invitationsService: OrganizationInvitationsService,
  ) {}

  @Get()
  @ApiOperation({ summary: 'List all organizations for login dropdown (public)' })
  @ApiResponse({ status: 200, description: 'Returns list of active organizations' })
  getAllPublic() {
    return this.organizationsService.findAllPublic();
  }

  @Get('slug/:slug')
  @ApiOperation({ summary: 'Get organization by slug (public)' })
  @ApiResponse({ status: 200, description: 'Returns organization details' })
  findBySlug(@Param('slug') slug: string) {
    return this.organizationsService.findBySlug(slug);
  }

  @Get('invitations/:token')
  @ApiOperation({ summary: 'Get invitation details by token (public)' })
  @ApiResponse({ status: 200, description: 'Returns invitation details' })
  getInvitationByToken(@Param('token') token: string) {
    return this.invitationsService.getInvitationByToken(token);
  }
}