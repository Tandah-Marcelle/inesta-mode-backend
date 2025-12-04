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
import { ApiTags, ApiBearerAuth, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { NewsService } from './news.service';
import { CreateNewsDto } from './dto/create-news.dto';
import { UpdateNewsDto } from './dto/update-news.dto';
import { FilterNewsDto } from './dto/filter-news.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PermissionsGuard } from '../auth/guards/permissions.guard';
import { RequirePermissions, Permission } from '../auth/decorators/permissions.decorator';

@ApiTags('News')
@Controller('news')
export class NewsController {
  constructor(private readonly newsService: NewsService) {}

  @Post()
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @RequirePermissions(Permission('news', 'create'))
  @ApiOperation({ summary: 'Create news or event' })
  create(@Body() createNewsDto: CreateNewsDto) {
    return this.newsService.create(createNewsDto);
  }

  @Get()
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @RequirePermissions(Permission('news', 'view'))
  @ApiOperation({ summary: 'Get all news and events with filters' })
  findAll(@Query() filterDto: FilterNewsDto) {
    return this.newsService.findAll(filterDto);
  }

  @Get('active')
  @ApiOperation({ summary: 'Get all active news and events' })
  findActive() {
    return this.newsService.findActive();
  }

  @Get('featured')
  @ApiOperation({ summary: 'Get featured news and events' })
  findFeatured() {
    return this.newsService.findFeatured();
  }

  @Get('slug/:slug')
  @ApiOperation({ summary: 'Get news by slug' })
  findBySlug(@Param('slug') slug: string) {
    return this.newsService.findBySlug(slug);
  }

  @Get(':id')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @RequirePermissions(Permission('news', 'view'))
  @ApiOperation({ summary: 'Get news by ID' })
  findOne(@Param('id') id: string) {
    return this.newsService.findOne(id);
  }

  @Patch(':id')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @RequirePermissions(Permission('news', 'update'))
  @ApiOperation({ summary: 'Update news or event' })
  update(@Param('id') id: string, @Body() updateNewsDto: UpdateNewsDto) {
    return this.newsService.update(id, updateNewsDto);
  }

  @Patch(':id/toggle-status')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @RequirePermissions(Permission('news', 'update'))
  @ApiOperation({ summary: 'Toggle news active status' })
  toggleStatus(@Param('id') id: string) {
    return this.newsService.toggleStatus(id);
  }

  @Patch(':id/toggle-featured')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @RequirePermissions(Permission('news', 'update'))
  @ApiOperation({ summary: 'Toggle news featured status' })
  toggleFeatured(@Param('id') id: string) {
    return this.newsService.toggleFeatured(id);
  }

  @Delete(':id')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @RequirePermissions(Permission('news', 'delete'))
  @ApiOperation({ summary: 'Delete news or event' })
  remove(@Param('id') id: string) {
    return this.newsService.remove(id);
  }
}