import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  ParseUUIDPipe,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { ModuleLicenseGuard, RequiredModule } from '../auth/guards/module-license.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../decorators/roles.decorator';
import { OrganizationId } from '../decorators/organization.decorator';
import { ProblemsService } from './problems.service';
import {
  CreateProblemDto,
  UpdateProblemDto,
  LinkIncidentDto,
  CreateRCADto,
  UpdateRCADto,
  CreateKnownErrorDto,
  UpdateKnownErrorDto,
  ProblemQueryDto,
} from './dto/problem.dto';

@ApiTags('Problems')
@ApiBearerAuth()
@UseGuards(ModuleLicenseGuard)
@RequiredModule('problems')
@Controller({ path: 'problems', version: '1' })
export class ProblemsController {
  constructor(private readonly problemsService: ProblemsService) {}

  // ============ Problems ============

  @Get()
  @Roles('admin', 'manager', 'agent')
  @ApiOperation({ summary: 'Get all problems with filtering and pagination' })
  findAll(@Query() query: ProblemQueryDto, @OrganizationId() organizationId?: string) {
    return this.problemsService.findAll(query, organizationId);
  }

  @Get('stats')
  @Roles('admin', 'manager', 'agent')
  @ApiOperation({ summary: 'Get problem statistics' })
  getStats(@OrganizationId() organizationId?: string) {
    return this.problemsService.getStats(organizationId);
  }

  @Get('known-errors')
  @Roles('admin', 'manager', 'agent')
  @ApiOperation({ summary: 'Get all known errors' })
  getAllKnownErrors(@Query('status') status?: string, @OrganizationId() organizationId?: string) {
    return this.problemsService.getAllKnownErrors(status, organizationId);
  }

  @Get('number/:problemNumber')
  @Roles('admin', 'manager', 'agent')
  @ApiOperation({ summary: 'Get problem by number' })
  findByNumber(@Param('problemNumber') problemNumber: string, @OrganizationId() organizationId?: string) {
    return this.problemsService.findByNumber(problemNumber, organizationId);
  }

  @Get(':id')
  @Roles('admin', 'manager', 'agent')
  @ApiOperation({ summary: 'Get problem by ID' })
  findById(@Param('id', ParseUUIDPipe) id: string, @OrganizationId() organizationId?: string) {
    return this.problemsService.findById(id, organizationId);
  }

  @Post()
  @Roles('admin', 'manager')
  @ApiOperation({ summary: 'Create new problem' })
  create(@Body() dto: CreateProblemDto, @OrganizationId() organizationId?: string) {
    return this.problemsService.create(dto, organizationId);
  }

  @Put(':id')
  @Roles('admin', 'manager')
  @ApiOperation({ summary: 'Update problem' })
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateProblemDto,
    @OrganizationId() organizationId?: string,
  ) {
    return this.problemsService.update(id, dto, organizationId);
  }

  @Delete(':id')
  @Roles('admin')
  @ApiOperation({ summary: 'Delete problem' })
  delete(@Param('id', ParseUUIDPipe) id: string, @OrganizationId() organizationId?: string) {
    return this.problemsService.delete(id, organizationId);
  }

  // ============ Incident Linking ============

  @Post(':id/incidents')
  @Roles('admin', 'manager')
  @ApiOperation({ summary: 'Link incident to problem' })
  linkIncident(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: LinkIncidentDto,
    @OrganizationId() organizationId?: string,
  ) {
    return this.problemsService.linkIncident(id, dto, organizationId);
  }

  @Delete(':id/incidents/:ticketId')
  @Roles('admin', 'manager')
  @ApiOperation({ summary: 'Unlink incident from problem' })
  unlinkIncident(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('ticketId', ParseUUIDPipe) ticketId: string,
    @OrganizationId() organizationId?: string,
  ) {
    return this.problemsService.unlinkIncident(id, ticketId, organizationId);
  }

  @Get(':id/incidents')
  @Roles('admin', 'manager', 'agent')
  @ApiOperation({ summary: 'Get all linked incidents' })
  getLinkedIncidents(@Param('id', ParseUUIDPipe) id: string, @OrganizationId() organizationId?: string) {
    return this.problemsService.getLinkedTickets(id, organizationId);
  }

  // ============ Root Cause Analysis ============

  @Get(':id/rca')
  @Roles('admin', 'manager', 'agent')
  @ApiOperation({ summary: 'Get RCA records for problem' })
  findRCAs(@Param('id', ParseUUIDPipe) id: string, @OrganizationId() organizationId?: string) {
    return this.problemsService.findRCAs(id, organizationId);
  }

  @Post(':id/rca')
  @Roles('admin', 'manager')
  @ApiOperation({ summary: 'Create RCA record' })
  createRCA(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: CreateRCADto,
    @OrganizationId() organizationId?: string,
  ) {
    return this.problemsService.createRCA(id, dto, organizationId);
  }

  @Put('rca/:rcaId')
  @Roles('admin', 'manager')
  @ApiOperation({ summary: 'Update RCA record' })
  updateRCA(
    @Param('rcaId', ParseUUIDPipe) rcaId: string,
    @Body() dto: UpdateRCADto,
    @OrganizationId() organizationId?: string,
  ) {
    return this.problemsService.updateRCA(rcaId, dto, organizationId);
  }

  @Delete('rca/:rcaId')
  @Roles('admin', 'manager')
  @ApiOperation({ summary: 'Delete RCA record' })
  deleteRCA(
    @Param('rcaId', ParseUUIDPipe) rcaId: string,
    @OrganizationId() organizationId?: string,
  ) {
    return this.problemsService.deleteRCA(rcaId, organizationId);
  }

  // ============ Known Error Database ============

  @Get(':id/known-error')
  @Roles('admin', 'manager', 'agent')
  @ApiOperation({ summary: 'Get known error for problem' })
  getKnownError(@Param('id', ParseUUIDPipe) id: string, @OrganizationId() organizationId?: string) {
    return this.problemsService.getKnownError(id, organizationId);
  }

  @Post(':id/known-error')
  @Roles('admin', 'manager')
  @ApiOperation({ summary: 'Create known error record' })
  createKnownError(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: CreateKnownErrorDto,
    @OrganizationId() organizationId?: string,
  ) {
    return this.problemsService.createKnownError(id, dto, organizationId);
  }

  @Put('known-error/:knownErrorId')
  @Roles('admin', 'manager')
  @ApiOperation({ summary: 'Update known error record' })
  updateKnownError(
    @Param('knownErrorId', ParseUUIDPipe) knownErrorId: string,
    @Body() dto: UpdateKnownErrorDto,
    @OrganizationId() organizationId?: string,
  ) {
    return this.problemsService.updateKnownError(knownErrorId, dto, organizationId);
  }

  @Delete('known-error/:knownErrorId')
  @Roles('admin', 'manager')
  @ApiOperation({ summary: 'Delete known error record' })
  deleteKnownError(
    @Param('knownErrorId', ParseUUIDPipe) knownErrorId: string,
    @OrganizationId() organizationId?: string,
  ) {
    return this.problemsService.deleteKnownError(knownErrorId, organizationId);
  }
}
