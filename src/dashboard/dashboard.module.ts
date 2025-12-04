import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuthModule } from '../auth/auth.module';
import { DashboardController } from './dashboard.controller';
import { DashboardService } from './dashboard.service';
import { SkeletonService } from '../common/skeleton.service';

// Import entities
import { Product } from '../entities/product.entity';
import { Category } from '../entities/category.entity';
import { User } from '../entities/user.entity';
import { UserPermission } from '../entities/user-permission.entity';
import { News } from '../entities/news.entity';
import { Partner } from '../entities/partner.entity';
import { ContactMessage } from '../entities/contact-message.entity';
import { Testimonial } from '../entities/testimonial.entity';

@Module({
  imports: [
    AuthModule,
    TypeOrmModule.forFeature([
      Product,
      Category,
      User,
      UserPermission,
      News,
      Partner,
      ContactMessage,
      Testimonial,
    ]),
  ],
  controllers: [DashboardController],
  providers: [DashboardService, SkeletonService],
  exports: [DashboardService, SkeletonService],
})
export class DashboardModule {}