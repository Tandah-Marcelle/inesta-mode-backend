import { Controller, Get, UseGuards, Query } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation, ApiQuery } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PermissionsGuard } from '../auth/guards/permissions.guard';
import { RequirePermissions, Permission } from '../auth/decorators/permissions.decorator';
import { DashboardService } from './dashboard.service';
import { SkeletonService } from '../common/skeleton.service';

interface DashboardStats {
  products: {
    total: number;
    active: number;
    featured: number;
    byCategory: Array<{
      categoryId: string;
      categoryName: string;
      count: number;
    }>;
  };
  categories: {
    total: number;
    active: number;
  };
  users: {
    total: number;
    active: number;
  };
  news: {
    total: number;
    published: number;
    events: number;
  };
  partners: {
    total: number;
    active: number;
    featured: number;
  };
  messages: {
    total: number;
    unread: number;
    resolved: number;
  };
  testimonials: {
    total: number;
    published: number;
    featured: number;
  };
}

interface ProductsOverTime {
  month: string;
  count: number;
  sales?: number;
}

@ApiTags('Dashboard')
@Controller('dashboard')
export class DashboardController {
  constructor(
    private readonly dashboardService: DashboardService,
    private readonly skeletonService: SkeletonService,
  ) {}

  @Get('stats')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @RequirePermissions(Permission('dashboard', 'view'))
  @ApiOperation({ summary: 'Get dashboard statistics' })
  @ApiQuery({ name: 'skeleton', required: false, type: Boolean, description: 'Return skeleton data for loading states' })
  async getStats(@Query('skeleton') skeleton?: boolean): Promise<DashboardStats> {
    if (skeleton) {
      return this.skeletonService.getDashboardStatsSkeleton();
    }
    return await this.dashboardService.getStats();
  }

  @Get('products-over-time')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @RequirePermissions(Permission('dashboard', 'view'))
  @ApiOperation({ summary: 'Get products over time for dashboard' })
  @ApiQuery({ name: 'skeleton', required: false, type: Boolean, description: 'Return skeleton data for loading states' })
  async getProductsOverTime(@Query('skeleton') skeleton?: boolean): Promise<ProductsOverTime[]> {
    if (skeleton) {
      return this.skeletonService.getProductsOverTimeSkeleton();
    }
    return await this.dashboardService.getProductsOverTime();
  }
}