import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { PartnersService } from './partners.service';
import { CreatePartnerDto } from './dto/create-partner.dto';
import { UpdatePartnerDto } from './dto/update-partner.dto';
import { FilterPartnersDto } from './dto/filter-partners.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PermissionsGuard } from '../auth/guards/permissions.guard';
import { RequirePermissions, Permission } from '../auth/decorators/permissions.decorator';

@ApiTags('Partners')
@Controller('partners')
export class PartnersController {
  constructor(private readonly partnersService: PartnersService) {}

  @Post()
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @RequirePermissions(Permission('partners', 'create'))
  @ApiOperation({ summary: 'Create humanitarian partner' })
  create(@Body() createPartnerDto: CreatePartnerDto) {
    return this.partnersService.create(createPartnerDto);
  }

  @Get()
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @RequirePermissions(Permission('partners', 'view'))
  @ApiOperation({ summary: 'Get all partners with filters' })
  findAll(@Query() filterDto: FilterPartnersDto) {
    return this.partnersService.findAll(filterDto);
  }

  @Get('active')
  @ApiOperation({ summary: 'Get all active partners' })
  findActive() {
    return this.partnersService.findActive();
  }

  @Get('featured')
  @ApiOperation({ summary: 'Get featured partners' })
  findFeatured() {
    return this.partnersService.findFeatured();
  }

  @Get('type/:type')
  @ApiOperation({ summary: 'Get partners by partnership type' })
  findByType(@Param('type') type: string) {
    return this.partnersService.findByType(type);
  }

  @Get(':id')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @RequirePermissions(Permission('partners', 'view'))
  @ApiOperation({ summary: 'Get partner by ID' })
  findOne(@Param('id') id: string) {
    return this.partnersService.findOne(id);
  }

  @Patch(':id')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @RequirePermissions(Permission('partners', 'update'))
  @ApiOperation({ summary: 'Update partner' })
  update(@Param('id') id: string, @Body() updatePartnerDto: UpdatePartnerDto) {
    return this.partnersService.update(id, updatePartnerDto);
  }

  @Patch(':id/toggle-status')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @RequirePermissions(Permission('partners', 'update'))
  @ApiOperation({ summary: 'Toggle partner active status' })
  toggleStatus(@Param('id') id: string) {
    return this.partnersService.toggleStatus(id);
  }

  @Patch(':id/toggle-featured')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @RequirePermissions(Permission('partners', 'update'))
  @ApiOperation({ summary: 'Toggle partner featured status' })
  toggleFeatured(@Param('id') id: string) {
    return this.partnersService.toggleFeatured(id);
  }

  @Delete(':id')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @RequirePermissions(Permission('partners', 'delete'))
  @ApiOperation({ summary: 'Delete partner' })
  remove(@Param('id') id: string) {
    return this.partnersService.remove(id);
  }
}