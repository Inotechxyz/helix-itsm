import { Controller, Get, Post, Patch, Delete, Body, Param, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { CategoriesService } from './categories.service';
import { JwtAuthWithOrgGuard } from '../auth/guards/jwt-auth-with-org.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../decorators/roles.decorator';
import { RequiredOrganizationId } from '../decorators/organization.decorator';
import { UserRole } from '@helix/shared';
import { CacheControl } from '../cache/cache-control.decorator';

@ApiTags('categories')
@Controller('categories')
@UseGuards(JwtAuthWithOrgGuard)
@ApiBearerAuth()
export class CategoriesController {
  constructor(private categoriesService: CategoriesService) {}

  @Get()
  @CacheControl('long')
  @ApiOperation({ summary: 'List all categories' })
  findAll(@RequiredOrganizationId() organizationId: string) {
    return this.categoriesService.findAll(organizationId);
  }

  @Get('tree')
  @CacheControl('long')
  @ApiOperation({ summary: 'Get category tree structure' })
  findTree(@RequiredOrganizationId() organizationId: string) {
    return this.categoriesService.findTree(organizationId);
  }

  @Get(':id')
  @CacheControl('medium')
  @ApiOperation({ summary: 'Get category by ID' })
  findOne(@Param('id') id: string, @RequiredOrganizationId() organizationId: string) {
    return this.categoriesService.findOne(id, organizationId);
  }

  @Post()
  @UseGuards(RolesGuard)
  @Roles(UserRole.user)
  @ApiOperation({ summary: 'Create a new category' })
  create(
    @Body() data: { name: string; description?: string; parentId?: string; defaultTeamId?: string },
    @RequiredOrganizationId() organizationId: string,
  ) {
    return this.categoriesService.create(data, organizationId);
  }

  @Patch(':id')
  @UseGuards(RolesGuard)
  @Roles(UserRole.user)
  @ApiOperation({ summary: 'Update a category' })
  update(
    @Param('id') id: string,
    @Body() data: { name?: string; description?: string; defaultTeamId?: string; sortOrder?: number; isActive?: boolean },
    @RequiredOrganizationId() organizationId: string,
  ) {
    return this.categoriesService.update(id, data, organizationId);
  }

  @Delete(':id')
  @UseGuards(RolesGuard)
  @Roles(UserRole.superadmin)
  @ApiOperation({ summary: 'Delete a category' })
  delete(@Param('id') id: string, @RequiredOrganizationId() organizationId: string) {
    return this.categoriesService.delete(id, organizationId);
  }
}
