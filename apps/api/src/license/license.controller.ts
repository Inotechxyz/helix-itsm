import { Controller, Post, Get, Body, Param, UseGuards, Req, ParseUUIDPipe, Logger } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { Request } from 'express';
import { JwtAuthWithOrgGuard } from '../auth/guards/jwt-auth-with-org.guard';
import { OrganizationAccessGuard } from '../guards/organization-access.guard';
import { OrganizationRoles } from '../decorators/organization-roles.decorator';
import { OrganizationRole } from '@helix/shared';
import { PrismaService } from '../common/prisma.service';
import { LicenseService, ImportLicenseDto } from '@inotechxyz/protected-license';

@ApiTags('License')
@ApiBearerAuth()
@Controller('organizations/:orgId/license')
@UseGuards(JwtAuthWithOrgGuard, OrganizationAccessGuard)
export class LicenseController {
  private readonly logger = new Logger(LicenseController.name);

  constructor(
    private readonly licenseService: LicenseService,
    private readonly prisma: PrismaService,
  ) {}

  @Post('import')
  @OrganizationRoles(OrganizationRole.ORGADMIN)
  @ApiOperation({ summary: 'Import a license token for the organization' })
  @ApiResponse({ status: 201, description: 'License imported successfully' })
  @ApiResponse({ status: 400, description: 'Invalid license token' })
  @ApiResponse({ status: 403, description: 'Organization slug mismatch or expired license' })
  async importLicense(
    @Param('orgId', ParseUUIDPipe) orgId: string,
    @Body() dto: ImportLicenseDto,
    @Req() req: Request,
  ) {
    this.logger.log(`importLicense called for org: ${orgId}`);
    this.logger.debug(`Token received: ${dto.token?.substring(0, 50)}...`);

    // Validate the token first without saving
    const organization = await this.prisma.organization.findUnique({
      where: { id: orgId },
      select: { id: true, slug: true, name: true, maxUsers: true, maxStorage: true },
    });

    this.logger.debug(`Organization found: ${JSON.stringify(organization)}`);

    if (!organization) {
      throw new Error('Organization not found');
    }

    // Validate token and extract license data
    const license = await this.licenseService.validateAndExtractLicense(
      dto.token,
      organization.slug,
    );

    this.logger.debug(`Token validated, license data: ${JSON.stringify(license)}`);

    // Update organization with license token and reset legacy fields
    // The license token should be the source of truth for tier and limits
    await this.prisma.organization.update({
      where: { id: orgId },
      data: {
        licenseToken: dto.token,
        licenseActivatedAt: new Date(),
        // Reset legacy fields - license controls these now
        maxUsers: 50,                   // Reset to default
        maxStorage: 10,                // Reset to default
      },
    });

    this.logger.log('Organization updated with license token');

    // Invalidate cache to force re-validation
    await this.licenseService.invalidateCache(orgId);

    return {
      success: true,
      organizationId: orgId,
      organizationName: organization.name,
      tier: license.tier,
      modules: license.modules,
      expiresAt: license.expiresAt,
      message: 'License imported successfully. Legacy tier and limits have been reset.',
    };
  }

  @Get()
  @ApiOperation({ summary: 'Get current license status for the organization' })
  @ApiResponse({ status: 200, description: 'License status retrieved' })
  async getLicenseStatus(
    @Param('orgId', ParseUUIDPipe) orgId: string,
    @Req() req: Request,
  ) {
    const license = await this.licenseService.getLicense(orgId);
    const daysRemaining = await this.licenseService.getDaysRemaining(orgId);
    const isExpiringSoon = await this.licenseService.isExpiringSoon(orgId);
    const isExpired = await this.licenseService.isExpired(orgId);

    // hasLicense is true only if tier is set (i.e., license token exists)
    const hasLicense = license.tier !== null;

    return {
      hasLicense,
      tier: license.tier,
      modules: license.modules,
      expiresAt: license.expiresAt,
      daysRemaining: hasLicense ? daysRemaining : 0,
      isExpiringSoon: hasLicense ? isExpiringSoon : false,
      isExpired: hasLicense ? isExpired : false,
      validatedAt: license.validatedAt,
      aiEnabled: license.aiEnabled,
      aiModel: license.aiModel,
    };
  }

  @Post('refresh')
  @OrganizationRoles(OrganizationRole.ORGADMIN)
  @ApiOperation({ summary: 'Force refresh license validation from token' })
  @ApiResponse({ status: 200, description: 'License refreshed successfully' })
  async refreshLicense(
    @Param('orgId', ParseUUIDPipe) orgId: string,
    @Req() req: Request,
  ) {
    // Invalidate cache
    await this.licenseService.invalidateCache(orgId);

    // Re-fetch license to update cache
    const license = await this.licenseService.getLicense(orgId);
    const daysRemaining = await this.licenseService.getDaysRemaining(orgId);
    const isExpiringSoon = await this.licenseService.isExpiringSoon(orgId);

    return {
      success: true,
      tier: license.tier,
      modules: license.modules,
      expiresAt: license.expiresAt,
      daysRemaining,
      isExpiringSoon,
      validatedAt: license.validatedAt,
      aiEnabled: license.aiEnabled,
      aiModel: license.aiModel,
    };
  }

  @Get('modules')
  @ApiOperation({ summary: 'Get list of enabled modules for the organization' })
  @ApiResponse({ status: 200, description: 'List of enabled modules' })
  async getEnabledModules(
    @Param('orgId', ParseUUIDPipe) orgId: string,
    @Req() req: Request,
  ) {
    const modules = await this.licenseService.getEnabledModules(orgId);
    return { modules };
  }

  @Post('invalidate-cache')
  @OrganizationRoles(OrganizationRole.ORGADMIN)
  @ApiOperation({ summary: 'Invalidate the license cache' })
  @ApiResponse({ status: 200, description: 'Cache invalidated' })
  async invalidateCache(@Param('orgId', ParseUUIDPipe) orgId: string) {
    await this.licenseService.invalidateCache(orgId);
    return { success: true, message: 'License cache invalidated' };
  }
}
