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
  Request,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { ModuleLicenseGuard, RequiredModule } from '../auth/guards/module-license.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../decorators/roles.decorator';
import { OrganizationId } from '../decorators/organization.decorator';
import { ChangesService } from './changes.service';
import {
  CreateChangeRequestDto,
  UpdateChangeRequestDto,
  ChangeQueryDto,
  LinkAssetDto,
  LinkTicketDto,
  LinkProblemDto,
  CreateRiskAssessmentDto,
  UpdateRiskAssessmentDto,
  ApprovalDto,
  RejectionDto,
  CreateCABMeetingDto,
  UpdateCABMeetingDto,
  AddAgendaItemDto,
} from './dto/change.dto';

@ApiTags('Changes')
@ApiBearerAuth()
@UseGuards(ModuleLicenseGuard)
@RequiredModule('changes')
@Controller({ path: 'changes', version: '1' })
export class ChangesController {
  constructor(private readonly changesService: ChangesService) {}

  // ============ Change Requests ============

  @Get()
  @Roles('admin', 'manager', 'agent')
  @ApiOperation({ summary: 'Get all change requests with filtering and pagination' })
  findAll(@Query() query: ChangeQueryDto, @OrganizationId() organizationId?: string) {
    return this.changesService.findAll(query, organizationId);
  }

  @Get('stats')
  @Roles('admin', 'manager', 'agent')
  @ApiOperation({ summary: 'Get change management statistics' })
  getStats(@OrganizationId() organizationId?: string) {
    return this.changesService.getStats(organizationId);
  }

  @Get('calendar')
  @Roles('admin', 'manager', 'agent')
  @ApiOperation({ summary: 'Get changes for calendar view' })
  getCalendar(@Query('start') start?: string, @Query('end') end?: string, @OrganizationId() organizationId?: string) {
    // For now, return upcoming scheduled changes
    return this.changesService.getStats(organizationId).then((stats) => stats.upcomingSchedules);
  }

  @Get('number/:changeNumber')
  @Roles('admin', 'manager', 'agent')
  @ApiOperation({ summary: 'Get change request by number' })
  findByNumber(@Param('changeNumber') changeNumber: string, @OrganizationId() organizationId?: string) {
    return this.changesService.findByNumber(changeNumber, organizationId);
  }

  @Get(':id')
  @Roles('admin', 'manager', 'agent')
  @ApiOperation({ summary: 'Get change request by ID' })
  findById(@Param('id', ParseUUIDPipe) id: string, @OrganizationId() organizationId?: string) {
    return this.changesService.findById(id, organizationId);
  }

  @Post()
  @Roles('admin', 'manager', 'agent')
  @ApiOperation({ summary: 'Create new change request' })
  create(@Body() dto: CreateChangeRequestDto, @Request() req: any, @OrganizationId() organizationId?: string) {
    return this.changesService.create(dto, req.user?.id, organizationId);
  }

  @Put(':id')
  @Roles('admin', 'manager', 'agent')
  @ApiOperation({ summary: 'Update change request' })
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateChangeRequestDto,
    @OrganizationId() organizationId?: string,
  ) {
    return this.changesService.update(id, dto, organizationId);
  }

  @Delete(':id')
  @Roles('admin')
  @ApiOperation({ summary: 'Delete change request' })
  delete(@Param('id', ParseUUIDPipe) id: string, @OrganizationId() organizationId?: string) {
    return this.changesService.delete(id, organizationId);
  }

  @Post(':id/submit')
  @Roles('admin', 'manager', 'agent')
  @ApiOperation({ summary: 'Submit change request for approval' })
  submit(@Param('id', ParseUUIDPipe) id: string, @Request() req: any, @OrganizationId() organizationId?: string) {
    return this.changesService.submit(id, req.user?.id, organizationId);
  }

  // ============ Approval Workflow ============

  @Post(':id/approve')
  @Roles('admin', 'manager')
  @ApiOperation({ summary: 'Approve change request' })
  approve(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ApprovalDto,
    @Request() req: any,
    @OrganizationId() organizationId?: string,
  ) {
    return this.changesService.approve(id, dto, req.user?.id, organizationId);
  }

  @Post(':id/reject')
  @Roles('admin', 'manager')
  @ApiOperation({ summary: 'Reject change request' })
  reject(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: RejectionDto,
    @Request() req: any,
    @OrganizationId() organizationId?: string,
  ) {
    return this.changesService.reject(id, dto, req.user?.id, organizationId);
  }

  // ============ Asset Linking ============

  @Post(':id/assets')
  @Roles('admin', 'manager', 'agent')
  @ApiOperation({ summary: 'Link asset to change request' })
  linkAsset(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: LinkAssetDto,
    @OrganizationId() organizationId?: string,
  ) {
    return this.changesService.linkAsset(id, dto, organizationId);
  }

  @Delete(':id/assets/:assetId')
  @Roles('admin', 'manager', 'agent')
  @ApiOperation({ summary: 'Unlink asset from change request' })
  unlinkAsset(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('assetId', ParseUUIDPipe) assetId: string,
  ) {
    return this.changesService.unlinkAsset(id, assetId);
  }

  // ============ Ticket Linking ============

  @Post(':id/tickets')
  @Roles('admin', 'manager', 'agent')
  @ApiOperation({ summary: 'Link ticket to change request' })
  linkTicket(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: LinkTicketDto,
    @OrganizationId() organizationId?: string,
  ) {
    return this.changesService.linkTicket(id, dto, organizationId);
  }

  @Delete(':id/tickets/:ticketId')
  @Roles('admin', 'manager', 'agent')
  @ApiOperation({ summary: 'Unlink ticket from change request' })
  unlinkTicket(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('ticketId', ParseUUIDPipe) ticketId: string,
  ) {
    return this.changesService.unlinkTicket(id, ticketId);
  }

  // ============ Problem Linking ============

  @Post(':id/problems')
  @Roles('admin', 'manager', 'agent')
  @ApiOperation({ summary: 'Link problem to change request' })
  linkProblem(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: LinkProblemDto,
    @OrganizationId() organizationId?: string,
  ) {
    return this.changesService.linkProblem(id, dto, organizationId);
  }

  @Delete(':id/problems/:problemId')
  @Roles('admin', 'manager', 'agent')
  @ApiOperation({ summary: 'Unlink problem from change request' })
  unlinkProblem(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('problemId', ParseUUIDPipe) problemId: string,
  ) {
    return this.changesService.unlinkProblem(id, problemId);
  }

  // ============ Risk Assessment ============

  @Post(':id/risk-assessment')
  @Roles('admin', 'manager', 'agent')
  @ApiOperation({ summary: 'Create risk assessment for change request' })
  createRiskAssessment(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: CreateRiskAssessmentDto,
    @OrganizationId() organizationId?: string,
  ) {
    return this.changesService.createRiskAssessment(id, dto, organizationId);
  }

  @Put(':id/risk-assessment')
  @Roles('admin', 'manager', 'agent')
  @ApiOperation({ summary: 'Update risk assessment for change request' })
  updateRiskAssessment(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateRiskAssessmentDto,
    @OrganizationId() organizationId?: string,
  ) {
    return this.changesService.updateRiskAssessment(id, dto, organizationId);
  }

  // ============ CAB Meetings ============

  @Get('cab/meetings')
  @Roles('admin', 'manager', 'agent')
  @ApiOperation({ summary: 'Get all CAB meetings' })
  getCABMeetings(@Query('status') status?: string, @OrganizationId() organizationId?: string) {
    return this.changesService.getCABMeetings(status, organizationId);
  }

  @Get('cab/meetings/:id')
  @Roles('admin', 'manager', 'agent')
  @ApiOperation({ summary: 'Get CAB meeting by ID' })
  getCABMeetingById(@Param('id', ParseUUIDPipe) id: string, @OrganizationId() organizationId?: string) {
    return this.changesService.getCABMeetingById(id, organizationId);
  }

  @Post('cab/meetings')
  @Roles('admin', 'manager')
  @ApiOperation({ summary: 'Create new CAB meeting' })
  createCABMeeting(@Body() dto: CreateCABMeetingDto, @OrganizationId() organizationId?: string) {
    return this.changesService.createCABMeeting(dto, organizationId);
  }

  @Put('cab/meetings/:id')
  @Roles('admin', 'manager')
  @ApiOperation({ summary: 'Update CAB meeting' })
  updateCABMeeting(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateCABMeetingDto,
    @OrganizationId() organizationId?: string,
  ) {
    return this.changesService.updateCABMeeting(id, dto, organizationId);
  }

  @Delete('cab/meetings/:id')
  @Roles('admin')
  @ApiOperation({ summary: 'Delete CAB meeting' })
  deleteCABMeeting(@Param('id', ParseUUIDPipe) id: string, @OrganizationId() organizationId?: string) {
    return this.changesService.deleteCABMeeting(id, organizationId);
  }

  @Post('cab/meetings/:id/agenda')
  @Roles('admin', 'manager')
  @ApiOperation({ summary: 'Add agenda item to CAB meeting' })
  addAgendaItem(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: AddAgendaItemDto,
    @OrganizationId() organizationId?: string,
  ) {
    return this.changesService.addAgendaItem(id, dto, organizationId);
  }

  @Delete('cab/meetings/:meetingId/agenda/:agendaItemId')
  @Roles('admin', 'manager')
  @ApiOperation({ summary: 'Remove agenda item from CAB meeting' })
  removeAgendaItem(
    @Param('meetingId', ParseUUIDPipe) meetingId: string,
    @Param('agendaItemId', ParseUUIDPipe) agendaItemId: string,
    @OrganizationId() organizationId?: string,
  ) {
    return this.changesService.removeAgendaItem(meetingId, agendaItemId, organizationId);
  }
}
