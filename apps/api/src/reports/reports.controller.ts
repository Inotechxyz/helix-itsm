import { Controller, Get, Query, UseGuards, Logger } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation, ApiHeader } from '@nestjs/swagger';
import { ReportsService } from './reports.service';
import { ModuleLicenseGuard, RequiredModule } from '../auth/guards/module-license.guard';
import { CacheControl } from '../cache/cache-control.decorator';
import { OrganizationId } from '../decorators/organization.decorator';

@ApiTags('reports')
@Controller('reports')
@UseGuards(ModuleLicenseGuard)
@RequiredModule('reports')
@ApiBearerAuth()
@ApiHeader({ name: 'x-organization-id', required: false, description: 'Organization ID for scoped access' })
export class ReportsController {
  private readonly logger = new Logger(ReportsController.name);

  constructor(private reportsService: ReportsService) {}

  @Get('dashboard')
  @CacheControl('short')
  @ApiOperation({ summary: 'Get dashboard statistics' })
  getDashboard(@OrganizationId() organizationId?: string) {
    this.logger.debug(`Dashboard requested with orgId: ${organizationId}`);
    return this.reportsService.getDashboard(organizationId);
  }

  @Get('volume')
  @CacheControl('short')
  @ApiOperation({ summary: 'Get ticket volume trends' })
  getVolumeTrends(
    @Query('dateFrom') dateFrom?: string,
    @Query('dateTo') dateTo?: string,
    @Query('groupBy') groupBy?: 'day' | 'week' | 'month',
    @OrganizationId() organizationId?: string,
  ) {
    return this.reportsService.getVolumeTrends({ dateFrom, dateTo, groupBy, organizationId });
  }

  @Get('resolution-time')
  @CacheControl('short')
  @ApiOperation({ summary: 'Get resolution time statistics' })
  getResolutionTime(
    @Query('dateFrom') dateFrom?: string,
    @Query('dateTo') dateTo?: string,
    @Query('teamId') teamId?: string,
    @OrganizationId() organizationId?: string,
  ) {
    return this.reportsService.getResolutionTime({ dateFrom, dateTo, teamId, organizationId });
  }

  @Get('agent-performance')
  @CacheControl('short')
  @ApiOperation({ summary: 'Get agent performance metrics' })
  getAgentPerformance(
    @Query('dateFrom') dateFrom?: string,
    @Query('dateTo') dateTo?: string,
    @Query('teamId') teamId?: string,
    @OrganizationId() organizationId?: string,
  ) {
    return this.reportsService.getAgentPerformance({ dateFrom, dateTo, teamId, organizationId });
  }

  @Get('sla-compliance')
  @CacheControl('short')
  @ApiOperation({ summary: 'Get SLA compliance statistics' })
  getSlaCompliance(
    @Query('dateFrom') dateFrom?: string,
    @Query('dateTo') dateTo?: string,
    @OrganizationId() organizationId?: string,
  ) {
    return this.reportsService.getSlaCompliance({ dateFrom, dateTo, organizationId });
  }

  @Get('status-distribution')
  @CacheControl('short')
  @ApiOperation({ summary: 'Get ticket status distribution' })
  getStatusDistribution(@OrganizationId() organizationId?: string) {
    return this.reportsService.getStatusDistribution(organizationId);
  }

  @Get('priority-distribution')
  @CacheControl('short')
  @ApiOperation({ summary: 'Get ticket priority distribution' })
  getPriorityDistribution(@OrganizationId() organizationId?: string) {
    return this.reportsService.getPriorityDistribution(organizationId);
  }

  @Get('kpi-metrics')
  @CacheControl('short')
  @ApiOperation({ summary: 'Get comprehensive KPI metrics (MTTR, FRT, First Contact Resolution)' })
  getKpiMetrics(
    @Query('dateFrom') dateFrom?: string,
    @Query('dateTo') dateTo?: string,
    @Query('teamId') teamId?: string,
    @OrganizationId() organizationId?: string,
  ) {
    return this.reportsService.getKpiMetrics({ dateFrom, dateTo, teamId, organizationId });
  }
}
