import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuthModule } from '../auth/auth.module';
import { PartnersService } from './partners.service';
import { PartnersController } from './partners.controller';
import { Partner } from '../entities/partner.entity';
import { UserPermission } from '../entities/user-permission.entity';

@Module({
  imports: [AuthModule, TypeOrmModule.forFeature([Partner, UserPermission])],
  controllers: [PartnersController],
  providers: [PartnersService],
  exports: [PartnersService],
})
export class PartnersModule {}