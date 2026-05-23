import { Controller, Get, Post, Patch, Delete, Body, Param, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { ServiceCatalogService } from './service-catalog.service';
import { ModuleLicenseGuard, RequiredModule } from '../auth/guards/module-license.guard';
import { CurrentUser } from '../decorators/current-user.decorator';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../decorators/roles.decorator';
import { UserRole, ServiceStatus, ServiceRequestStatus } from '@helix/shared';
import { OrganizationId, RequiredOrganizationId } from '../decorators/organization.decorator';
import { CacheControl } from '../cache/cache-control.decorator';
import { ServiceRequestQueryDto } from './dto/service-request.dto';

@ApiTags('service-catalog')
@Controller('service-catalog')
@UseGuards(ModuleLicenseGuard)
@RequiredModule('service_catalog')
@ApiBearerAuth()
export class ServiceCatalogController {
  constructor(private scService: ServiceCatalogService) {}

  // Services
  @Get('services')
  @CacheControl('medium')
  @ApiOperation({ summary: 'List services' })
  findAllServices(
    @RequiredOrganizationId() organizationId: string,
    @Query('status') status?: string,
    @Query('categoryId') categoryId?: string,
    @Query('search') search?: string,
    @Query('page') page?: number,
    @Query('limit') limit?: number,
  ) {
    return this.scService.findAllServices({ status, categoryId, search, page, limit, organizationId });
  }

  @Get('services/:slug')
  @CacheControl('medium')
  @ApiOperation({ summary: 'Get service by slug' })
  findService(@Param('slug') slug: string, @RequiredOrganizationId() organizationId: string) {
    return this.scService.findServiceBySlug(slug, organizationId);
  }

  @Post('services')
  @UseGuards(RolesGuard)
  @Roles(UserRole.user)
  @ApiOperation({ summary: 'Create service' })
  createService(@Body() data: any, @CurrentUser('id') userId: string, @RequiredOrganizationId() organizationId: string) {
    return this.scService.createService(data, userId, organizationId);
  }

  @Patch('services/:id')
  @UseGuards(RolesGuard)
  @Roles(UserRole.user)
  @ApiOperation({ summary: 'Update service' })
  updateService(@Param('id') id: string, @Body() data: any, @RequiredOrganizationId() organizationId: string) {
    return this.scService.updateService(id, data, organizationId);
  }

  @Post('services/:id/activate')
  @ApiOperation({ summary: 'Activate service' })
  activateService(@Param('id') id: string, @RequiredOrganizationId() organizationId: string) {
    return this.scService.activateService(id, organizationId);
  }

  @Post('services/:id/deactivate')
  @ApiOperation({ summary: 'Deactivate service' })
  deactivateService(@Param('id') id: string, @RequiredOrganizationId() organizationId: string) {
    return this.scService.deactivateService(id, organizationId);
  }

  // Categories
  @Get('categories')
  @CacheControl('long')
  @ApiOperation({ summary: 'List service categories' })
  findAllCategories(@RequiredOrganizationId() organizationId: string) {
    return this.scService.findAllCategories(organizationId);
  }

  @Post('categories')
  @UseGuards(RolesGuard)
  @Roles(UserRole.user)
  @ApiOperation({ summary: 'Create service category' })
  createCategory(@Body() data: any, @RequiredOrganizationId() organizationId: string) {
    return this.scService.createCategory(data, organizationId);
  }

  @Patch('categories/:id')
  @UseGuards(RolesGuard)
  @Roles(UserRole.user)
  @ApiOperation({ summary: 'Update service category' })
  updateCategory(@Param('id') id: string, @Body() data: any, @RequiredOrganizationId() organizationId: string) {
    return this.scService.updateCategory(id, data, organizationId);
  }

  @Delete('categories/:id')
  @UseGuards(RolesGuard)
  @Roles(UserRole.user)
  @ApiOperation({ summary: 'Delete service category' })
  deleteCategory(@Param('id') id: string, @RequiredOrganizationId() organizationId: string) {
    return this.scService.deleteCategory(id, organizationId);
  }

  // Requests - don't cache (user-specific, frequently changing)
  @Get('requests')
  @ApiOperation({ summary: 'List service requests' })
  findAllRequests(
    @RequiredOrganizationId() organizationId: string,
    @Query() query: ServiceRequestQueryDto,
    @CurrentUser() user?: any,
  ) {
    // Transform status: if string, convert to array; if array, use as-is
    let statusArray: string[] | undefined = undefined;
    const statusValue = query.status as any;
    if (statusValue) {
      if (typeof statusValue === 'string') {
        statusArray = statusValue.split(',').map((s: string) => s.trim()).filter((s: string) => s);
      } else if (Array.isArray(statusValue)) {
        statusArray = statusValue;
      }
    }
    console.log('[ServiceCatalogController] findAllRequests - statusArray:', statusArray);

    return this.scService.findAllRequests({
      status: statusArray as any,
      serviceId: query.serviceId,
      requesterId: query.requesterId,
      page: query.page,
      limit: query.limit,
      organizationId,
    });
  }

  @Get('requests/:id')
  @ApiOperation({ summary: 'Get request by ID' })
  findRequest(@Param('id') id: string, @RequiredOrganizationId() organizationId: string) {
    return this.scService.findRequestById(id, organizationId);
  }

  @Post('requests')
  @ApiOperation({ summary: 'Create service request' })
  createRequest(@Body() data: any, @CurrentUser('id') userId: string, @RequiredOrganizationId() organizationId: string) {
    return this.scService.createRequest(data, userId, organizationId);
  }

  @Post('requests/:id/submit')
  @ApiOperation({ summary: 'Submit request' })
  submitRequest(@Param('id') id: string, @RequiredOrganizationId() organizationId: string) {
    return this.scService.submitRequest(id, organizationId);
  }

  @Post('requests/:id/approve')
  @UseGuards(RolesGuard)
  @Roles(UserRole.user)
  @ApiOperation({ summary: 'Approve request' })
  approveRequest(
    @Param('id') id: string,
    @Body() data: { comments?: string },
    @CurrentUser('id') userId: string,
    @RequiredOrganizationId() organizationId: string,
  ) {
    return this.scService.approveRequest(id, userId, data.comments, organizationId);
  }

  @Post('requests/:id/reject')
  @UseGuards(RolesGuard)
  @Roles(UserRole.user)
  @ApiOperation({ summary: 'Reject request' })
  rejectRequest(
    @Param('id') id: string,
    @Body() data: { comments: string },
    @CurrentUser('id') userId: string,
    @RequiredOrganizationId() organizationId: string,
  ) {
    return this.scService.rejectRequest(id, userId, data.comments, organizationId);
  }

  @Post('requests/:id/complete')
  @UseGuards(RolesGuard)
  @Roles(UserRole.user)
  @ApiOperation({ summary: 'Complete request' })
  completeRequest(
    @Param('id') id: string,
    @Body() data: { notes?: string; rating?: number; feedback?: string },
    @RequiredOrganizationId() organizationId: string,
  ) {
    return this.scService.completeRequest(id, data.notes, data.rating, data.feedback, organizationId);
  }

  @Post('requests/:id/cancel')
  @ApiOperation({ summary: 'Cancel request' })
  cancelRequest(@Param('id') id: string, @RequiredOrganizationId() organizationId: string) {
    return this.scService.cancelRequest(id, organizationId);
  }

  // Stats - user-specific, don't cache
  @Get('stats/dashboard')
  @ApiOperation({ summary: 'Get catalog statistics' })
  getStats(@RequiredOrganizationId() organizationId: string, @CurrentUser('id') userId?: string) {
    return this.scService.getStats(userId, organizationId);
  }

  @Get('stats/pending-approvals')
  @ApiOperation({ summary: 'Get pending approvals' })
  getPendingApprovals(@RequiredOrganizationId() organizationId: string) {
    return this.scService.findAllRequests({
      status: [ServiceRequestStatus.PENDING_APPROVAL],
      organizationId,
    });
  }

  @Get('stats/my-requests')
  @ApiOperation({ summary: 'Get my requests' })
  getMyRequests(@CurrentUser('id') userId: string, @RequiredOrganizationId() organizationId: string) {
    return this.scService.getStats(userId, organizationId);
  }
}
