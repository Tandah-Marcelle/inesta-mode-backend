import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  Query,
  ParseUUIDPipe,
  HttpStatus,
  HttpCode,
  UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiQuery, ApiBearerAuth } from '@nestjs/swagger';
import { UsersService } from './users.service';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto, UpdateUserPasswordDto, UpdateUserRoleDto } from './dto/update-user.dto';
import { FilterUsersDto } from './dto/filter-users.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PermissionsGuard } from '../auth/guards/permissions.guard';
import { RequirePermissions, Permission } from '../auth/decorators/permissions.decorator';
import { UserRole } from '../entities/user.entity';
import { PermissionsService } from '../permissions/permissions.service';

@ApiTags('Users')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller('users')
export class UsersController {
  constructor(
    private readonly usersService: UsersService,
    private readonly permissionsService: PermissionsService,
  ) {}

  @Post()
  @RequirePermissions(Permission('users', 'create'))
  @ApiOperation({ summary: 'Create a new user' })
  @ApiResponse({ status: 201, description: 'User has been successfully created.' })
  @ApiResponse({ status: 409, description: 'User with this email already exists.' })
  create(@Body() createUserDto: CreateUserDto) {
    return this.usersService.create(createUserDto);
  }

  @Get()
  @RequirePermissions(Permission('users', 'view'))
  @ApiOperation({ summary: 'Get all users with filtering and pagination' })
  @ApiResponse({ status: 200, description: 'Return paginated users list.' })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  @ApiQuery({ name: 'search', required: false, type: String })
  @ApiQuery({ name: 'role', required: false, enum: UserRole })
  @ApiQuery({ name: 'isActive', required: false, type: Boolean })
  @ApiQuery({ name: 'sortBy', required: false, type: String })
  @ApiQuery({ name: 'sortOrder', required: false, enum: ['ASC', 'DESC'] })
  findAll(@Query() filterDto: FilterUsersDto) {
    return this.usersService.findAll(filterDto);
  }

  @Get('stats')
  @RequirePermissions(Permission('users', 'view'))
  @ApiOperation({ summary: 'Get user statistics' })
  @ApiResponse({ status: 200, description: 'Return user statistics.' })
  getStats() {
    return this.usersService.getStats();
  }

  @Get(':id')
  @RequirePermissions(Permission('users', 'view'))
  @ApiOperation({ summary: 'Get a user by ID' })
  @ApiResponse({ status: 200, description: 'Return the user.' })
  @ApiResponse({ status: 404, description: 'User not found.' })
  findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.usersService.findOne(id);
  }

  @Patch(':id')
  @RequirePermissions(Permission('users', 'update'))
  @ApiOperation({ summary: 'Update a user' })
  @ApiResponse({ status: 200, description: 'User has been successfully updated.' })
  @ApiResponse({ status: 404, description: 'User not found.' })
  @ApiResponse({ status: 409, description: 'Email already exists.' })
  update(@Param('id', ParseUUIDPipe) id: string, @Body() updateUserDto: UpdateUserDto) {
    return this.usersService.update(id, updateUserDto);
  }

  @Patch(':id/password')
  @RequirePermissions(Permission('users', 'update'))
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Update user password' })
  @ApiResponse({ status: 204, description: 'Password has been successfully updated.' })
  @ApiResponse({ status: 404, description: 'User not found.' })
  updatePassword(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() updatePasswordDto: UpdateUserPasswordDto,
  ) {
    return this.usersService.updatePassword(id, updatePasswordDto);
  }

  @Patch(':id/role')
  @RequirePermissions(Permission('users', 'update'))
  @ApiOperation({ summary: 'Update user role' })
  @ApiResponse({ status: 200, description: 'User role has been successfully updated.' })
  @ApiResponse({ status: 404, description: 'User not found.' })
  updateRole(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() updateRoleDto: UpdateUserRoleDto,
  ) {
    return this.usersService.updateRole(id, updateRoleDto);
  }

  @Patch(':id/toggle-status')
  @RequirePermissions(Permission('users', 'update'))
  @ApiOperation({ summary: 'Toggle user active status' })
  @ApiResponse({ status: 200, description: 'User status has been successfully toggled.' })
  @ApiResponse({ status: 404, description: 'User not found.' })
  toggleStatus(@Param('id', ParseUUIDPipe) id: string) {
    return this.usersService.toggleStatus(id);
  }

  @Delete(':id')
  @RequirePermissions(Permission('users', 'delete'))
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete a user' })
  @ApiResponse({ status: 204, description: 'User has been successfully deleted.' })
  @ApiResponse({ status: 404, description: 'User not found.' })
  @ApiResponse({ status: 400, description: 'Cannot delete the last admin user.' })
  remove(@Param('id', ParseUUIDPipe) id: string) {
    return this.usersService.remove(id);
  }

  @Patch('bulk/status')
  @RequirePermissions(Permission('users', 'update'))
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Bulk update user status' })
  @ApiResponse({ status: 204, description: 'Users status has been successfully updated.' })
  @ApiResponse({ status: 400, description: 'Cannot deactivate all admin users.' })
  bulkUpdateStatus(@Body() { ids, isActive }: { ids: string[]; isActive: boolean }) {
    return this.usersService.bulkUpdateStatus(ids, isActive);
  }

  @Delete('bulk')
  @RequirePermissions(Permission('users', 'delete'))
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Bulk delete users' })
  @ApiResponse({ status: 204, description: 'Users have been successfully deleted.' })
  @ApiResponse({ status: 400, description: 'Cannot delete all admin users.' })
  bulkDelete(@Body() { ids }: { ids: string[] }) {
    return this.usersService.bulkDelete(ids);
  }

  @Get('permissions/all')
  @RequirePermissions(Permission('users', 'view'))
  @ApiOperation({ summary: 'Get all available permissions' })
  @ApiResponse({ status: 200, description: 'Return all permissions.' })
  getAllPermissions() {
    return this.permissionsService.findAll();
  }

  @Get(':id/permissions')
  @RequirePermissions(Permission('users', 'view'))
  @ApiOperation({ summary: 'Get user permissions' })
  @ApiResponse({ status: 200, description: 'Return user permissions.' })
  getUserPermissions(@Param('id', ParseUUIDPipe) id: string) {
    return this.permissionsService.getUserPermissions(id);
  }

  @Patch(':id/permissions')
  @RequirePermissions(Permission('users', 'update'))
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Update user permissions' })
  @ApiResponse({ status: 204, description: 'User permissions have been successfully updated.' })
  updateUserPermissions(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() { permissions }: { permissions: string[] },
  ) {
    return this.permissionsService.updateUserPermissions(id, permissions);
  }
}
