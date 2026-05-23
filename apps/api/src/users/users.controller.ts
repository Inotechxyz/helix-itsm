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
  Req,
  Headers,
} from '@nestjs/common';
import { Request } from 'express';
import { ApiTags, ApiBearerAuth, ApiOperation, ApiHeader } from '@nestjs/swagger';
import { UsersService } from './users.service';
import { CreateUserDto, UpdateUserDto, AssignTeamsDto, UserQueryDto } from './dto/user.dto';
import { JwtAuthWithOrgGuard } from '../auth/guards/jwt-auth-with-org.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../decorators/roles.decorator';
import { UserRole } from '@helix/shared';

@ApiTags('users')
@Controller('users')
@UseGuards(JwtAuthWithOrgGuard)
@ApiBearerAuth()
export class UsersController {
  constructor(private usersService: UsersService) {}

  @Get()
  @UseGuards(RolesGuard)
  @Roles(UserRole.user)  // Any authenticated user can list users
  @ApiOperation({ summary: 'List all users (optionally filtered by organization)' })
  @ApiHeader({ name: 'x-organization-id', required: false, description: 'Filter users by organization' })
  async findAll(@Query() query: UserQueryDto, @Headers('x-organization-id') organizationId?: string) {
    return this.usersService.findAll(query, organizationId);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get user by ID' })
  @ApiHeader({ name: 'x-organization-id', required: false, description: 'Organization context' })
  async findOne(@Param('id') id: string, @Headers('x-organization-id') organizationId?: string) {
    return this.usersService.findOne(id, organizationId);
  }

  @Post()
  @UseGuards(RolesGuard)
  @Roles(UserRole.superadmin)  // Only superadmin can create users
  @ApiOperation({ summary: 'Create a new user' })
  async create(@Body() dto: CreateUserDto) {
    return this.usersService.create(dto);
  }

  @Patch(':id')
  @UseGuards(RolesGuard)
  @Roles(UserRole.superadmin)  // Only superadmin can update users
  @ApiOperation({ summary: 'Update a user' })
  async update(@Param('id') id: string, @Body() dto: UpdateUserDto) {
    return this.usersService.update(id, dto);
  }

  @Post(':id/assign-teams')
  @UseGuards(RolesGuard)
  @Roles(UserRole.user)  // Any authenticated user can assign teams
  @ApiOperation({ summary: 'Assign user to teams' })
  async assignTeams(@Param('id') id: string, @Body() dto: AssignTeamsDto) {
    return this.usersService.assignTeams(id, dto);
  }

  @Delete(':id')
  @UseGuards(RolesGuard)
  @Roles(UserRole.superadmin)  // Only superadmin can delete users
  @ApiOperation({ summary: 'Delete a user (soft delete)' })
  async delete(@Param('id') id: string) {
    return this.usersService.delete(id);
  }
}
