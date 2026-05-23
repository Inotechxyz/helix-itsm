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
import { SlaService } from './sla.service';
import { CacheControl } from '../cache/cache-control.decorator';
import {
  CreateSlaPolicyDto,
  UpdateSlaPolicyDto,
  CreateEscalationRuleDto,
  UpdateEscalationRuleDto,
  CreateOlaPolicyDto,
  UpdateOlaPolicyDto,
  CreateOlaHandoffDto,
  UpdateOlaHandoffDto,
  SlaPolicyQueryDto,
  OlaPolicyQueryDto,
} from './dto/sla.dto';

@ApiTags('SLA')
@ApiBearerAuth()
@UseGuards(ModuleLicenseGuard)
@RequiredModule('sla_policies')
@Controller({ path: 'sla', version: '1' })
export class SlaController {
  constructor(private readonly slaService: SlaService) {}

  // ============ SLA Policies ============

  @Get('policies')
  @Roles('admin', 'manager')
  @CacheControl('medium')
  @ApiOperation({ summary: 'Get all SLA policies' })
  findAllPolicies(@Query() query: SlaPolicyQueryDto, @OrganizationId() organizationId?: string) {
    return this.slaService.findAllPolicies(query, organizationId);
  }

  @Get('policies/:id')
  @Roles('admin', 'manager', 'agent')
  @CacheControl('medium')
  @ApiOperation({ summary: 'Get SLA policy by ID' })
  findPolicyById(@Param('id', ParseUUIDPipe) id: string, @OrganizationId() organizationId?: string) {
    return this.slaService.findPolicyById(id, organizationId);
  }

  @Post('policies')
  @Roles('admin')
  @ApiOperation({ summary: 'Create new SLA policy' })
  createPolicy(@Body() dto: CreateSlaPolicyDto, @OrganizationId() organizationId?: string) {
    return this.slaService.createPolicy(dto, organizationId);
  }

  @Put('policies/:id')
  @Roles('admin')
  @ApiOperation({ summary: 'Update SLA policy' })
  updatePolicy(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateSlaPolicyDto,
    @OrganizationId() organizationId?: string,
  ) {
    return this.slaService.updatePolicy(id, dto, organizationId);
  }

  @Delete('policies/:id')
  @Roles('admin')
  @ApiOperation({ summary: 'Delete SLA policy' })
  deletePolicy(@Param('id', ParseUUIDPipe) id: string, @OrganizationId() organizationId?: string) {
    return this.slaService.deletePolicy(id, organizationId);
  }

  // ============ Escalation Rules ============

  @Get('policies/:policyId/escalation-rules')
  @Roles('admin', 'manager')
  @ApiOperation({ summary: 'Get escalation rules for a policy' })
  findEscalationRules(@Param('policyId', ParseUUIDPipe) policyId: string) {
    return this.slaService.findEscalationRules(policyId);
  }

  @Post('escalation-rules')
  @Roles('admin')
  @ApiOperation({ summary: 'Create escalation rule' })
  createEscalationRule(@Body() dto: CreateEscalationRuleDto) {
    return this.slaService.createEscalationRule(dto);
  }

  @Put('escalation-rules/:id')
  @Roles('admin')
  @ApiOperation({ summary: 'Update escalation rule' })
  updateEscalationRule(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateEscalationRuleDto,
  ) {
    return this.slaService.updateEscalationRule(id, dto);
  }

  @Delete('escalation-rules/:id')
  @Roles('admin')
  @ApiOperation({ summary: 'Delete escalation rule' })
  deleteEscalationRule(@Param('id', ParseUUIDPipe) id: string) {
    return this.slaService.deleteEscalationRule(id);
  }

  // ============ OLA Policies ============

  @Get('ola-policies')
  @Roles('admin', 'manager')
  @CacheControl('medium')
  @ApiOperation({ summary: 'Get all OLA policies' })
  findAllOlaPolicies(@Query() query: OlaPolicyQueryDto, @OrganizationId() organizationId?: string) {
    return this.slaService.findAllOlaPolicies(query, organizationId);
  }

  @Get('ola-policies/:id')
  @Roles('admin', 'manager')
  @CacheControl('medium')
  @ApiOperation({ summary: 'Get OLA policy by ID' })
  findOlaPolicyById(@Param('id', ParseUUIDPipe) id: string, @OrganizationId() organizationId?: string) {
    return this.slaService.findOlaPolicyById(id, organizationId);
  }

  @Post('ola-policies')
  @Roles('admin')
  @ApiOperation({ summary: 'Create OLA policy' })
  createOlaPolicy(@Body() dto: CreateOlaPolicyDto, @OrganizationId() organizationId?: string) {
    return this.slaService.createOlaPolicy(dto, organizationId);
  }

  @Put('ola-policies/:id')
  @Roles('admin')
  @ApiOperation({ summary: 'Update OLA policy' })
  updateOlaPolicy(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateOlaPolicyDto,
    @OrganizationId() organizationId?: string,
  ) {
    return this.slaService.updateOlaPolicy(id, dto, organizationId);
  }

  @Delete('ola-policies/:id')
  @Roles('admin')
  @ApiOperation({ summary: 'Delete OLA policy' })
  deleteOlaPolicy(@Param('id', ParseUUIDPipe) id: string, @OrganizationId() organizationId?: string) {
    return this.slaService.deleteOlaPolicy(id, organizationId);
  }

  // ============ OLA Handoffs ============

  @Get('handoffs/ticket/:ticketId')
  @Roles('admin', 'manager', 'agent')
  @ApiOperation({ summary: 'Get OLA handoffs for a ticket' })
  findOlaHandoffs(@Param('ticketId', ParseUUIDPipe) ticketId: string) {
    return this.slaService.findOlaHandoffs(ticketId);
  }

  @Post('handoffs')
  @Roles('admin', 'manager', 'agent')
  @ApiOperation({ summary: 'Create OLA handoff (team transfer)' })
  createOlaHandoff(@Body() dto: CreateOlaHandoffDto) {
    return this.slaService.createOlaHandoff(dto);
  }

  @Put('handoffs/:id')
  @Roles('admin', 'manager', 'agent')
  @ApiOperation({ summary: 'Update OLA handoff' })
  updateOlaHandoff(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateOlaHandoffDto,
  ) {
    return this.slaService.updateOlaHandoff(id, dto);
  }

  // ============ Ticket SLA Status ============

  @Get('ticket/:ticketId')
  @Roles('admin', 'manager', 'agent')
  @ApiOperation({ summary: 'Get SLA status for a ticket' })
  getTicketSlaStatus(@Param('ticketId', ParseUUIDPipe) ticketId: string) {
    return this.slaService.getTicketSlaStatus(ticketId);
  }

  // ============ Statistics ============

  @Get('stats')
  @Roles('admin', 'manager')
  @CacheControl('short')
  @ApiOperation({ summary: 'Get SLA statistics' })
  getSlaStats(@OrganizationId() organizationId?: string) {
    return this.slaService.getSlaStats(organizationId);
  }
}
