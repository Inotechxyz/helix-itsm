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
import { AssetsService } from './assets.service';
import {
  CreateAssetDto,
  UpdateAssetDto,
  AssetQueryDto,
  CreateAssetTypeDto,
  UpdateAssetTypeDto,
  CreateAssetRelationshipDto,
  UpdateAssetRelationshipDto,
  CreateMaintenanceDto,
  UpdateMaintenanceDto,
  LinkAssetTicketDto,
} from './dto/asset.dto';

@ApiTags('Assets')
@ApiBearerAuth()
@UseGuards(ModuleLicenseGuard)
@RequiredModule('assets')
@Controller({ path: 'assets', version: '1' })
export class AssetsController {
  constructor(private readonly assetsService: AssetsService) {}

  // ============ Asset Types ============

  @Get('types')
  @Roles('admin', 'manager', 'agent')
  @ApiOperation({ summary: 'Get all asset types' })
  findAllTypes(@OrganizationId() organizationId?: string) {
    return this.assetsService.findAllTypes(organizationId);
  }

  @Get('types/:id')
  @Roles('admin', 'manager', 'agent')
  @ApiOperation({ summary: 'Get asset type by ID' })
  findTypeById(@Param('id', ParseUUIDPipe) id: string, @OrganizationId() organizationId?: string) {
    return this.assetsService.findTypeById(id, organizationId);
  }

  @Post('types')
  @Roles('admin')
  @ApiOperation({ summary: 'Create asset type' })
  createType(@Body() dto: CreateAssetTypeDto, @OrganizationId() organizationId?: string) {
    return this.assetsService.createType(dto, organizationId);
  }

  @Put('types/:id')
  @Roles('admin')
  @ApiOperation({ summary: 'Update asset type' })
  updateType(@Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateAssetTypeDto, @OrganizationId() organizationId?: string) {
    return this.assetsService.updateType(id, dto, organizationId);
  }

  @Delete('types/:id')
  @Roles('admin')
  @ApiOperation({ summary: 'Delete asset type' })
  deleteType(@Param('id', ParseUUIDPipe) id: string, @OrganizationId() organizationId?: string) {
    return this.assetsService.deleteType(id, organizationId);
  }

  // ============ Assets ============

  @Get()
  @Roles('admin', 'manager', 'agent')
  @ApiOperation({ summary: 'Get all assets with filtering and pagination' })
  findAll(@Query() query: AssetQueryDto, @OrganizationId() organizationId?: string) {
    return this.assetsService.findAll(query, organizationId);
  }

  @Get('stats')
  @Roles('admin', 'manager', 'agent')
  @ApiOperation({ summary: 'Get asset statistics' })
  getStats(@OrganizationId() organizationId?: string) {
    return this.assetsService.getStats(organizationId);
  }

  @Get('tag/:assetTag')
  @Roles('admin', 'manager', 'agent')
  @ApiOperation({ summary: 'Get asset by asset tag' })
  findByAssetTag(@Param('assetTag') assetTag: string, @OrganizationId() organizationId?: string) {
    return this.assetsService.findByAssetTag(assetTag, organizationId);
  }

  @Get('impact/:id')
  @Roles('admin', 'manager', 'agent')
  @ApiOperation({ summary: 'Get asset impact analysis' })
  getAssetImpact(@Param('id', ParseUUIDPipe) id: string, @OrganizationId() organizationId?: string) {
    return this.assetsService.getAssetImpact(id, 3, organizationId);
  }

  @Get('tree/:id')
  @Roles('admin', 'manager', 'agent')
  @ApiOperation({ summary: 'Get asset hierarchy tree' })
  getAssetTree(@Param('id', ParseUUIDPipe) id: string, @OrganizationId() organizationId?: string) {
    return this.assetsService.getAssetTree(id, 3, organizationId);
  }

  @Get(':id')
  @Roles('admin', 'manager', 'agent')
  @ApiOperation({ summary: 'Get asset by ID' })
  findById(@Param('id', ParseUUIDPipe) id: string, @OrganizationId() organizationId?: string) {
    return this.assetsService.findById(id, organizationId);
  }

  @Post()
  @Roles('admin', 'manager')
  @ApiOperation({ summary: 'Create new asset' })
  create(@Body() dto: CreateAssetDto, @OrganizationId() organizationId?: string) {
    return this.assetsService.create(dto, organizationId);
  }

  @Put(':id')
  @Roles('admin', 'manager')
  @ApiOperation({ summary: 'Update asset' })
  update(@Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateAssetDto, @OrganizationId() organizationId?: string) {
    return this.assetsService.update(id, dto, organizationId);
  }

  @Delete(':id')
  @Roles('admin')
  @ApiOperation({ summary: 'Delete asset (soft delete)' })
  delete(@Param('id', ParseUUIDPipe) id: string, @OrganizationId() organizationId?: string) {
    return this.assetsService.delete(id, organizationId);
  }

  // ============ Relationships ============

  @Get('relationships/:id')
  @Roles('admin', 'manager', 'agent')
  @ApiOperation({ summary: 'Get relationship by ID' })
  getRelationshipById(@Param('id', ParseUUIDPipe) id: string, @OrganizationId() organizationId?: string) {
    return this.assetsService.getRelationshipById(id, organizationId);
  }

  @Post('relationships')
  @Roles('admin', 'manager')
  @ApiOperation({ summary: 'Create asset relationship' })
  createRelationship(@Body() dto: CreateAssetRelationshipDto, @OrganizationId() organizationId?: string) {
    return this.assetsService.createRelationship(dto, organizationId);
  }

  @Put('relationships/:id')
  @Roles('admin', 'manager')
  @ApiOperation({ summary: 'Update asset relationship' })
  updateRelationship(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateAssetRelationshipDto,
    @OrganizationId() organizationId?: string,
  ) {
    return this.assetsService.updateRelationship(id, dto, organizationId);
  }

  @Delete('relationships/:id')
  @Roles('admin', 'manager')
  @ApiOperation({ summary: 'Delete asset relationship' })
  deleteRelationship(@Param('id', ParseUUIDPipe) id: string, @OrganizationId() organizationId?: string) {
    return this.assetsService.deleteRelationship(id, organizationId);
  }

  // ============ Maintenance ============

  @Get(':id/maintenance')
  @Roles('admin', 'manager', 'agent')
  @ApiOperation({ summary: 'Get maintenance records for asset' })
  findMaintenanceRecords(@Param('id', ParseUUIDPipe) id: string, @OrganizationId() organizationId?: string) {
    return this.assetsService.findMaintenanceRecords(id, organizationId);
  }

  @Post('maintenance')
  @Roles('admin', 'manager')
  @ApiOperation({ summary: 'Create maintenance record' })
  createMaintenance(@Body() dto: CreateMaintenanceDto, @OrganizationId() organizationId?: string) {
    return this.assetsService.createMaintenance(dto, organizationId);
  }

  @Put('maintenance/:id')
  @Roles('admin', 'manager')
  @ApiOperation({ summary: 'Update maintenance record' })
  updateMaintenance(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateMaintenanceDto,
    @OrganizationId() organizationId?: string,
  ) {
    return this.assetsService.updateMaintenance(id, dto, organizationId);
  }

  @Delete('maintenance/:id')
  @Roles('admin', 'manager')
  @ApiOperation({ summary: 'Delete maintenance record' })
  deleteMaintenance(@Param('id', ParseUUIDPipe) id: string, @OrganizationId() organizationId?: string) {
    return this.assetsService.deleteMaintenance(id, organizationId);
  }

  // ============ CMDB Enhancement: Dependency Graph ============

  @Get('graph/dependency')
  @Roles('admin', 'manager', 'agent')
  @ApiOperation({ summary: 'Get dependency graph for visualization' })
  getDependencyGraph(@OrganizationId() organizationId?: string) {
    return this.assetsService.getDependencyGraph(organizationId);
  }

  @Get('stats/ci')
  @Roles('admin', 'manager', 'agent')
  @ApiOperation({ summary: 'Get CI classification statistics' })
  getCiStats(@OrganizationId() organizationId?: string) {
    return this.assetsService.getCiStats(organizationId);
  }

  @Get('analysis/impact/:id')
  @Roles('admin', 'manager', 'agent')
  @ApiOperation({ summary: 'Get detailed impact analysis with cascade' })
  getImpactAnalysis(@Param('id', ParseUUIDPipe) id: string, @OrganizationId() organizationId?: string) {
    return this.assetsService.getImpactAnalysis(id, 2, organizationId);
  }

  // ============ Ticket Linking ============

  @Post(':assetId/tickets/:ticketId')
  @Roles('admin', 'manager', 'agent')
  @ApiOperation({ summary: 'Link asset to ticket' })
  linkTicket(
    @Param('assetId', ParseUUIDPipe) assetId: string,
    @Param('ticketId', ParseUUIDPipe) ticketId: string,
    @Body() dto: LinkAssetTicketDto,
    @OrganizationId() organizationId?: string,
  ) {
    return this.assetsService.linkTicket(assetId, dto, ticketId, organizationId);
  }

  @Delete(':assetId/tickets/:linkedAssetId')
  @Roles('admin', 'manager', 'agent')
  @ApiOperation({ summary: 'Unlink asset from ticket' })
  unlinkTicket(
    @Param('assetId', ParseUUIDPipe) assetId: string,
    @Param('linkedAssetId', ParseUUIDPipe) linkedAssetId: string,
    @OrganizationId() organizationId?: string,
  ) {
    return this.assetsService.unlinkTicket(assetId, linkedAssetId, organizationId);
  }
}
