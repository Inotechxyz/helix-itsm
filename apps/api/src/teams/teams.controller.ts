import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { TeamsService } from './teams.service';
import { CreateTeamDto, UpdateTeamDto, AddMemberDto } from './dto/team.dto';
import { JwtAuthWithOrgGuard } from '../auth/guards/jwt-auth-with-org.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../decorators/roles.decorator';
import { OrganizationRoles } from '../decorators/organization-roles.decorator';
import { OrganizationId, UserOrgRole } from '../decorators/organization.decorator';
import { UserRole, OrganizationRole } from '@helix/shared';
import { CacheControl } from '../cache/cache-control.decorator';

@ApiTags('teams')
@Controller('teams')
@UseGuards(JwtAuthWithOrgGuard)
@ApiBearerAuth()
export class TeamsController {
  constructor(private teamsService: TeamsService) {}

  @Get()
  @CacheControl('long')
  @ApiOperation({ summary: 'List all teams' })
  findAll(
    @OrganizationId() organizationId: string | undefined,
    @UserOrgRole() userOrgRole: string | undefined,
  ) {
    return this.teamsService.findAll({
      organizationId,
      userRole: userOrgRole as any,
    });
  }

  @Get(':id')
  @CacheControl('medium')
  @ApiOperation({ summary: 'Get team by ID' })
  findOne(
    @Param('id') id: string,
    @OrganizationId() organizationId: string | undefined,
    @UserOrgRole() userOrgRole: string | undefined,
  ) {
    return this.teamsService.findOne(id, {
      organizationId,
      userRole: userOrgRole as any,
    });
  }

  @Post()
  @UseGuards(RolesGuard)
  @Roles(UserRole.user)
  @OrganizationRoles(OrganizationRole.ORGADMIN, OrganizationRole.MANAGER)
  @ApiOperation({ summary: 'Create a new team' })
  create(
    @Body() dto: CreateTeamDto,
    @OrganizationId() organizationId: string | undefined,
  ) {
    if (!organizationId) {
      throw new Error('Organization context required');
    }
    return this.teamsService.create(dto, organizationId);
  }

  @Patch(':id')
  @UseGuards(RolesGuard)
  @Roles(UserRole.user)
  @OrganizationRoles(OrganizationRole.ORGADMIN, OrganizationRole.MANAGER)
  @ApiOperation({ summary: 'Update a team' })
  update(
    @Param('id') id: string,
    @Body() dto: UpdateTeamDto,
    @OrganizationId() organizationId: string | undefined,
  ) {
    return this.teamsService.update(id, dto, organizationId);
  }

  @Get(':id/members')
  @ApiOperation({ summary: 'Get team members' })
  getMembers(
    @Param('id') id: string,
    @OrganizationId() organizationId: string | undefined,
  ) {
    return this.teamsService.getMembers(id, organizationId);
  }

  @Post(':id/members')
  @UseGuards(RolesGuard)
  @Roles(UserRole.user)
  @OrganizationRoles(OrganizationRole.ORGADMIN, OrganizationRole.MANAGER)
  @ApiOperation({ summary: 'Add member to team' })
  addMember(
    @Param('id') id: string,
    @Body() dto: AddMemberDto,
    @OrganizationId() organizationId: string | undefined,
  ) {
    return this.teamsService.addMember(id, dto.userId, dto.isPrimary, organizationId);
  }

  @Delete(':id/members/:userId')
  @UseGuards(RolesGuard)
  @Roles(UserRole.user)
  @OrganizationRoles(OrganizationRole.ORGADMIN, OrganizationRole.MANAGER)
  @ApiOperation({ summary: 'Remove member from team' })
  removeMember(
    @Param('id') id: string,
    @Param('userId') userId: string,
    @OrganizationId() organizationId: string | undefined,
  ) {
    return this.teamsService.removeMember(id, userId, organizationId);
  }

  @Delete(':id')
  @UseGuards(RolesGuard)
  @Roles(UserRole.superadmin)
  @OrganizationRoles(OrganizationRole.ORGADMIN)
  @ApiOperation({ summary: 'Delete a team' })
  delete(
    @Param('id') id: string,
    @OrganizationId() organizationId: string | undefined,
  ) {
    return this.teamsService.update(id, { isActive: false }, organizationId);
  }
}
