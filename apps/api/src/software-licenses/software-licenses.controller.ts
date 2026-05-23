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
  Request,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiBearerAuth,
  ApiResponse,
} from '@nestjs/swagger';
import { ModuleLicenseGuard, RequiredModule } from '../auth/guards/module-license.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../decorators/roles.decorator';
import { OrganizationId } from '../decorators/organization.decorator';
import { SoftwareLicensesService } from './software-licenses.service';
import {
  CreateSoftwareDto,
  UpdateSoftwareDto,
  CreateSoftwareLicenseDto,
  UpdateSoftwareLicenseDto,
  CreateLicenseAssignmentDto,
  SoftwareQueryDto,
  LicenseQueryDto,
  AssignmentQueryDto,
} from './software-licenses.dto';

@ApiTags('Software Licenses')
@ApiBearerAuth()
@UseGuards(ModuleLicenseGuard)
@RequiredModule('software_licenses')
@Controller('software-licenses')
export class SoftwareLicensesController {
  constructor(private readonly service: SoftwareLicensesService) {}

  // ==================== Software ====================

  @Post('software')
  @Roles('agent', 'manager', 'superadmin')
  @ApiOperation({ summary: 'Create new software' })
  createSoftware(@Body() dto: CreateSoftwareDto, @OrganizationId() organizationId?: string) {
    return this.service.createSoftware(dto, organizationId);
  }

  @Get('software')
  @Roles('agent', 'manager', 'superadmin')
  @ApiOperation({ summary: 'List all software' })
  findAllSoftware(@Query() query: SoftwareQueryDto, @OrganizationId() organizationId?: string) {
    return this.service.findAllSoftware(query, organizationId);
  }

  @Get('software/:id')
  @Roles('agent', 'manager', 'superadmin')
  @ApiOperation({ summary: 'Get software by ID' })
  findSoftwareById(@Param('id') id: string, @OrganizationId() organizationId?: string) {
    return this.service.findSoftwareById(id, organizationId);
  }

  @Patch('software/:id')
  @Roles('agent', 'manager', 'superadmin')
  @ApiOperation({ summary: 'Update software' })
  updateSoftware(@Param('id') id: string, @Body() dto: UpdateSoftwareDto, @OrganizationId() organizationId?: string) {
    return this.service.updateSoftware(id, dto, organizationId);
  }

  @Delete('software/:id')
  @Roles('manager', 'superadmin')
  @ApiOperation({ summary: 'Delete software' })
  deleteSoftware(@Param('id') id: string, @OrganizationId() organizationId?: string) {
    return this.service.deleteSoftware(id, organizationId);
  }

  // ==================== Software Licenses ====================

  @Post('licenses')
  @Roles('agent', 'manager', 'superadmin')
  @ApiOperation({ summary: 'Create new license' })
  createLicense(@Body() dto: CreateSoftwareLicenseDto, @OrganizationId() organizationId?: string) {
    return this.service.createLicense(dto, organizationId);
  }

  @Get('licenses')
  @Roles('agent', 'manager', 'superadmin')
  @ApiOperation({ summary: 'List all licenses' })
  findAllLicenses(@Query() query: LicenseQueryDto, @OrganizationId() organizationId?: string) {
    return this.service.findAllLicenses(query, organizationId);
  }

  @Get('licenses/:id')
  @Roles('agent', 'manager', 'superadmin')
  @ApiOperation({ summary: 'Get license by ID' })
  findLicenseById(@Param('id') id: string, @OrganizationId() organizationId?: string) {
    return this.service.findLicenseById(id, organizationId);
  }

  @Patch('licenses/:id')
  @Roles('agent', 'manager', 'superadmin')
  @ApiOperation({ summary: 'Update license' })
  updateLicense(@Param('id') id: string, @Body() dto: UpdateSoftwareLicenseDto, @OrganizationId() organizationId?: string) {
    return this.service.updateLicense(id, dto, organizationId);
  }

  @Delete('licenses/:id')
  @Roles('manager', 'superadmin')
  @ApiOperation({ summary: 'Delete license' })
  deleteLicense(@Param('id') id: string, @OrganizationId() organizationId?: string) {
    return this.service.deleteLicense(id, organizationId);
  }

  // ==================== Assignments ====================

  @Post('assignments')
  @Roles('agent', 'manager', 'superadmin')
  @ApiOperation({ summary: 'Create license assignment' })
  createAssignment(@Body() dto: CreateLicenseAssignmentDto, @Request() req: any, @OrganizationId() organizationId?: string) {
    return this.service.createAssignment(dto, req.user.id, organizationId);
  }

  @Get('assignments')
  @Roles('agent', 'manager', 'superadmin')
  @ApiOperation({ summary: 'List all assignments' })
  findAllAssignments(@Query() query: AssignmentQueryDto, @OrganizationId() organizationId?: string) {
    return this.service.findAllAssignments(query, organizationId);
  }

  @Post('assignments/:id/revoke')
  @Roles('agent', 'manager', 'superadmin')
  @ApiOperation({ summary: 'Revoke license assignment' })
  revokeAssignment(@Param('id') id: string, @Request() req: any, @OrganizationId() organizationId?: string) {
    return this.service.revokeAssignment(id, req.user.id, organizationId);
  }

  @Delete('assignments/:id')
  @Roles('manager', 'superadmin')
  @ApiOperation({ summary: 'Delete assignment' })
  deleteAssignment(@Param('id') id: string, @OrganizationId() organizationId?: string) {
    return this.service.deleteAssignment(id, organizationId);
  }

  // ==================== Statistics ====================

  @Get('stats')
  @Roles('agent', 'manager', 'superadmin')
  @ApiOperation({ summary: 'Get license statistics' })
  getStats(@OrganizationId() organizationId?: string) {
    return this.service.getStats(organizationId);
  }
}
