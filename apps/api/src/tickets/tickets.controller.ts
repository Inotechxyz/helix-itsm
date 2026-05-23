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
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { TicketsService } from './tickets.service';
import {
  CreateTicketDto,
  UpdateTicketDto,
  AssignTicketDto,
  TransitionTicketDto,
  AddCommentDto,
  TicketQueryDto,
} from './dto/ticket.dto';
import { ModuleLicenseGuard, RequiredModule } from '../auth/guards/module-license.guard';
import { CurrentUser } from '../decorators/current-user.decorator';
import { UserOrgRole } from '../decorators/organization.decorator';
import { OrganizationId, RequiredOrganizationId } from '../decorators/organization.decorator';

@ApiTags('tickets')
@Controller('tickets')
@UseGuards(ModuleLicenseGuard)
@RequiredModule('tickets')
@ApiBearerAuth()
export class TicketsController {
  constructor(private ticketsService: TicketsService) {}

  @Get()
  @ApiOperation({ summary: 'List tickets with filters' })
  findAll(
    @Query() query: TicketQueryDto,
    @CurrentUser() user: any,
    @UserOrgRole() orgRole: string,
    @RequiredOrganizationId() organizationId: string,
  ) {
    console.log(`[TicketsController] findAll - userId=${user.id}, orgRole=${orgRole}, organizationId=${organizationId}`);
    return this.ticketsService.findAll(query, user.id, orgRole, organizationId);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get ticket by ID' })
  findOne(
    @Param('id') id: string,
    @RequiredOrganizationId() organizationId: string,
  ) {
    return this.ticketsService.findOne(id, organizationId);
  }

  @Get('number/:ticketNumber')
  @ApiOperation({ summary: 'Get ticket by ticket number' })
  findByNumber(
    @Param('ticketNumber') ticketNumber: string,
    @RequiredOrganizationId() organizationId: string,
  ) {
    return this.ticketsService.findByTicketNumber(ticketNumber, organizationId);
  }

  @Post()
  @ApiOperation({ summary: 'Create a new ticket' })
  create(
    @Body() dto: CreateTicketDto,
    @CurrentUser('id') userId: string,
    @RequiredOrganizationId() organizationId: string,
  ) {
    return this.ticketsService.create(dto, userId, organizationId);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update a ticket' })
  update(
    @Param('id') id: string,
    @Body() dto: UpdateTicketDto,
    @CurrentUser('id') userId: string,
    @RequiredOrganizationId() organizationId: string,
  ) {
    return this.ticketsService.update(id, dto, userId, organizationId);
  }

  @Post(':id/assign')
  @ApiOperation({ summary: 'Assign ticket to agent/team' })
  assign(
    @Param('id') id: string,
    @Body() dto: AssignTicketDto,
    @CurrentUser('id') userId: string,
    @RequiredOrganizationId() organizationId: string,
  ) {
    return this.ticketsService.assign(id, dto, userId, organizationId);
  }

  @Post(':id/transition')
  @ApiOperation({ summary: 'Change ticket status' })
  transition(
    @Param('id') id: string,
    @Body() dto: TransitionTicketDto,
    @CurrentUser('id') userId: string,
    @RequiredOrganizationId() organizationId: string,
  ) {
    return this.ticketsService.transition(id, dto, userId, organizationId);
  }

  @Get(':id/comments')
  @ApiOperation({ summary: 'Get ticket comments' })
  getComments(
    @Param('id') id: string,
    @RequiredOrganizationId() organizationId: string,
  ) {
    return this.ticketsService.getComments(id, organizationId);
  }

  @Post(':id/comments')
  @ApiOperation({ summary: 'Add comment to ticket' })
  addComment(
    @Param('id') id: string,
    @Body() dto: AddCommentDto,
    @CurrentUser('id') userId: string,
    @RequiredOrganizationId() organizationId: string,
  ) {
    return this.ticketsService.addComment(id, dto, userId, organizationId);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete a ticket (soft delete)' })
  delete(
    @Param('id') id: string,
    @CurrentUser('id') userId: string,
    @RequiredOrganizationId() organizationId: string,
  ) {
    return this.ticketsService.delete(id, userId, organizationId);
  }
}
