import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuthModule } from '../auth/auth.module';
import { NewsService } from './news.service';
import { NewsController } from './news.controller';
import { News } from '../entities/news.entity';
import { UserPermission } from '../entities/user-permission.entity';

@Module({
  imports: [AuthModule, TypeOrmModule.forFeature([News, UserPermission])],
  controllers: [NewsController],
  providers: [NewsService],
  exports: [NewsService],
})
export class NewsModule {}