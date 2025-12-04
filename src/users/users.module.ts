import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuthModule } from '../auth/auth.module';
import { UsersService } from './users.service';
import { UsersController } from './users.controller';
import { User } from '../entities/user.entity';
import { UserPermission } from '../entities/user-permission.entity';
import { PermissionsModule } from '../permissions/permissions.module';

@Module({
  imports: [AuthModule, TypeOrmModule.forFeature([User, UserPermission]), PermissionsModule],
  controllers: [UsersController],
  providers: [UsersService],
  exports: [UsersService],
})
export class UsersModule {}
