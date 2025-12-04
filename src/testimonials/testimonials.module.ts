import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuthModule } from '../auth/auth.module';
import { TestimonialsService } from './testimonials.service';
import { TestimonialsController } from './testimonials.controller';
import { Testimonial } from '../entities/testimonial.entity';
import { UserPermission } from '../entities/user-permission.entity';

@Module({
  imports: [AuthModule, TypeOrmModule.forFeature([Testimonial, UserPermission])],
  controllers: [TestimonialsController],
  providers: [TestimonialsService],
})
export class TestimonialsModule {}