import { Controller, Get, Param, Query, Post, Res, UseGuards, ParseUUIDPipe, HttpCode, HttpStatus } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation, ApiHeader } from '@nestjs/swagger';
import { Response } from 'express';
import { AuditService } from './audit.service';
import { AuditLogQueryDto, AuditLogExportDto } from './dto/audit-log.dto';
import { JwtAuthWithOrgGuard } from '../auth/guards/jwt-auth-with-org.guard';
import { OrganizationRoles } from '../decorators/organization-roles.decorator';
import { OrganizationId } from '../decorators/organization.decorator';
import { OrganizationRole } from '@helix/shared';

@ApiTags('audit')
@Controller('audit-logs')
@UseGuards(JwtAuthWithOrgGuard)
@ApiBearerAuth()
@ApiHeader({ name: 'x-organization-id', required: false, description: 'Organization ID for scoped access' })
export class AuditController {
  constructor(private readonly auditService: AuditService) {}

  @Get()
  @OrganizationRoles(OrganizationRole.ORGADMIN)
  @ApiOperation({ summary: 'Get audit logs with filters and pagination' })
  async findAll(
    @Query() query: AuditLogQueryDto,
    @OrganizationId() organizationId?: string,
  ) {
    // For superadmins, allow seeing all orgs' logs
    // For orgadmins, restrict to their organization
    return this.auditService.findAll(query, undefined, organizationId);
  }

  @Get(':id')
  @OrganizationRoles(OrganizationRole.ORGADMIN)
  @ApiOperation({ summary: 'Get a single audit log entry by ID' })
  async findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.auditService.findOne(id);
  }

  @Get('entity/:entityType/:entityId')
  @OrganizationRoles(OrganizationRole.ORGADMIN)
  @ApiOperation({ summary: 'Get audit logs for a specific entity' })
  async findByEntity(
    @Param('entityType') entityType: string,
    @Param('entityId') entityId: string,
  ) {
    return this.auditService.findByEntity(entityType, entityId);
  }

  @Get('stats/summary')
  @OrganizationRoles(OrganizationRole.ORGADMIN)
  @ApiOperation({ summary: 'Get audit log statistics for a time period' })
  async getStats(
    @Query('startDate') startDate: string,
    @Query('endDate') endDate: string,
    @Query('organizationId') organizationId?: string,
  ) {
    return this.auditService.getStats(startDate, endDate, organizationId);
  }

  @Post('export')
  @HttpCode(HttpStatus.OK)
  @OrganizationRoles(OrganizationRole.ORGADMIN)
  @ApiOperation({ summary: 'Export audit logs to CSV or JSON' })
  async exportLogs(
    @Query() query: AuditLogExportDto,
    @Res() res: Response,
  ) {
    const { format, data } = await this.auditService.exportLogs(query);

    if (format === 'csv') {
      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', 'attachment; filename=audit-logs.csv');
    } else {
      res.setHeader('Content-Type', 'application/json');
      res.setHeader('Content-Disposition', 'attachment; filename=audit-logs.json');
    }

    res.send(data);
  }
}