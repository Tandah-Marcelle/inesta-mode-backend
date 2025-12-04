import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuthModule } from '../auth/auth.module';
import { ProductsService } from './products.service';
import { ProductsController } from './products.controller';
import { Product } from '../entities/product.entity';
import { ProductImage } from '../entities/product-image.entity';
import { Category } from '../entities/category.entity';
import { UserPermission } from '../entities/user-permission.entity';
import { UploadService } from '../upload/upload.service';

@Module({
  imports: [AuthModule, TypeOrmModule.forFeature([Product, ProductImage, Category, UserPermission])],
  controllers: [ProductsController],
  providers: [ProductsService, UploadService],
  exports: [ProductsService],
})
export class ProductsModule {}

