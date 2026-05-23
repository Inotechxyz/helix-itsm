import { Controller, Get, Post, Put, Delete, Body, Param, UseGuards, ParseUUIDPipe } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { ModuleLicenseGuard, RequiredModule } from '../auth/guards/module-license.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../decorators/roles.decorator';
import { OrganizationId } from '../decorators/organization.decorator';
import { CacheControl } from '../cache/cache-control.decorator';
import { ChangeCategoriesService } from './change-categories.service';
import { CreateChangeCategoryDto, UpdateChangeCategoryDto } from './dto/change-category.dto';

@ApiTags('Change Categories')
@ApiBearerAuth()
@UseGuards(ModuleLicenseGuard)
@RequiredModule('changes')
@Controller('change-categories')
export class ChangeCategoriesController {
  constructor(private readonly changeCategoriesService: ChangeCategoriesService) {}

  @Get()
  @CacheControl('long')
  @ApiOperation({ summary: 'List all change categories' })
  findAll(@OrganizationId() organizationId?: string) {
    return this.changeCategoriesService.findAll(organizationId);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get change category by ID' })
  findOne(@Param('id', ParseUUIDPipe) id: string, @OrganizationId() organizationId?: string) {
    return this.changeCategoriesService.findOne(id, organizationId);
  }

  @Post()
  @Roles('admin', 'manager')
  @ApiOperation({ summary: 'Create change category' })
  create(@Body() dto: CreateChangeCategoryDto, @OrganizationId() organizationId?: string) {
    return this.changeCategoriesService.create(dto, organizationId);
  }

  @Put(':id')
  @Roles('admin', 'manager')
  @ApiOperation({ summary: 'Update change category' })
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateChangeCategoryDto,
    @OrganizationId() organizationId?: string,
  ) {
    return this.changeCategoriesService.update(id, dto, organizationId);
  }

  @Delete(':id')
  @Roles('admin')
  @ApiOperation({ summary: 'Delete change category' })
  delete(@Param('id', ParseUUIDPipe) id: string, @OrganizationId() organizationId?: string) {
    return this.changeCategoriesService.delete(id, organizationId);
  }
}