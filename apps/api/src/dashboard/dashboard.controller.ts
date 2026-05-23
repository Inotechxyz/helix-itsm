import { Controller, Get, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation, ApiHeader } from '@nestjs/swagger';
import { JwtAuthWithOrgGuard } from '../auth/guards/jwt-auth-with-org.guard';
import { OrganizationId } from '../decorators/organization.decorator';
import { TicketsService } from '../tickets/tickets.service';

@ApiTags('dashboard')
@Controller('dashboard')
@UseGuards(JwtAuthWithOrgGuard)
@ApiBearerAuth()
@ApiHeader({ name: 'x-organization-id', required: false, description: 'Organization ID for scoped access' })
export class DashboardController {
  constructor(private ticketsService: TicketsService) {}

  @Get()
  @ApiOperation({ summary: 'Get basic dashboard statistics (available for all tiers)' })
  getDashboard(@OrganizationId() organizationId?: string) {
    if (!organizationId) {
      return {
        totalTickets: 0,
        openTickets: 0,
        resolvedToday: 0,
        slaBreached: 0,
        ticketsByStatus: {},
        recentTickets: [],
        totalServiceRequests: 0,
        openServiceRequests: 0,
        resolvedServiceRequestsToday: 0,
      };
    }
    return this.ticketsService.getDashboardStats(organizationId);
  }
}