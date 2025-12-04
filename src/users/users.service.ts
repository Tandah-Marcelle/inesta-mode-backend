import { Injectable, NotFoundException, ConflictException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Like, In } from 'typeorm';
import * as bcrypt from 'bcryptjs';
import { User, UserRole } from '../entities/user.entity';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto, UpdateUserPasswordDto, UpdateUserRoleDto } from './dto/update-user.dto';
import { FilterUsersDto } from './dto/filter-users.dto';
import { PermissionsService } from '../permissions/permissions.service';

@Injectable()
export class UsersService {
  constructor(
    @InjectRepository(User)
    private usersRepository: Repository<User>,
    private permissionsService: PermissionsService,
  ) {}

  async create(createUserDto: CreateUserDto): Promise<User> {
    // Check if user already exists
    const existingUser = await this.usersRepository.findOne({
      where: { email: createUserDto.email },
    });

    if (existingUser) {
      throw new ConflictException('User with this email already exists');
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(createUserDto.password, 10);

    // Create user
    const user = this.usersRepository.create({
      ...createUserDto,
      password: hashedPassword,
      role: createUserDto.role || UserRole.USER,
    });

    const savedUser = await this.usersRepository.save(user);

    // Set permissions if provided
    if (createUserDto.permissions && createUserDto.permissions.length > 0) {
      await this.permissionsService.updateUserPermissions(savedUser.id, createUserDto.permissions);
    }

    return savedUser;
  }

  async findAll(filterDto: FilterUsersDto) {
    const { page = 1, limit = 10, search, role, isActive, sortBy = 'createdAt', sortOrder = 'DESC' } = filterDto;
    
    const queryBuilder = this.usersRepository.createQueryBuilder('user');

    // Apply search filter
    if (search) {
      queryBuilder.where(
        '(user.firstName LIKE :search OR user.lastName LIKE :search OR user.email LIKE :search)',
        { search: `%${search}%` }
      );
    }

    // Apply role filter
    if (role) {
      queryBuilder.andWhere('user.role = :role', { role });
    }

    // Apply active status filter
    if (typeof isActive === 'boolean') {
      queryBuilder.andWhere('user.isActive = :isActive', { isActive });
    }

    // Apply sorting
    queryBuilder.orderBy(`user.${sortBy}`, sortOrder);

    // Apply pagination
    const skip = (page - 1) * limit;
    queryBuilder.skip(skip).take(limit);

    const [users, total] = await queryBuilder.getManyAndCount();

    return {
      users,
      total,
      page,
      totalPages: Math.ceil(total / limit),
    };
  }

  async findOne(id: string): Promise<User> {
    const user = await this.usersRepository.findOne({ 
      where: { id },
      relations: ['userPermissions', 'userPermissions.permission']
    });
    if (!user) {
      throw new NotFoundException('User not found');
    }
    return user;
  }

  async findByEmail(email: string): Promise<User | null> {
    return this.usersRepository.findOne({ where: { email } });
  }

  async update(id: string, updateUserDto: UpdateUserDto): Promise<User> {
    const user = await this.findOne(id);

    // Check if email is being changed and if it already exists
    if (updateUserDto.email && updateUserDto.email !== user.email) {
      const existingUser = await this.usersRepository.findOne({
        where: { email: updateUserDto.email },
      });
      if (existingUser) {
        throw new ConflictException('Email already exists');
      }
    }

    // Hash password if provided
    if (updateUserDto.password) {
      updateUserDto.password = await bcrypt.hash(updateUserDto.password, 10);
    }

    Object.assign(user, updateUserDto);
    const updatedUser = await this.usersRepository.save(user);

    // Update permissions if provided
    if (updateUserDto.permissions !== undefined) {
      await this.permissionsService.updateUserPermissions(id, updateUserDto.permissions);
    }

    return updatedUser;
  }

  async updatePassword(id: string, updatePasswordDto: UpdateUserPasswordDto): Promise<void> {
    const user = await this.findOne(id);
    const hashedPassword = await bcrypt.hash(updatePasswordDto.password, 10);
    
    await this.usersRepository.update(id, { password: hashedPassword });
  }

  async updateRole(id: string, updateRoleDto: UpdateUserRoleDto): Promise<User> {
    const user = await this.findOne(id);
    user.role = updateRoleDto.role;
    return this.usersRepository.save(user);
  }

  async toggleStatus(id: string): Promise<User> {
    const user = await this.findOne(id);
    user.isActive = !user.isActive;
    return this.usersRepository.save(user);
  }

  async remove(id: string): Promise<void> {
    const user = await this.findOne(id);
    
    // Check if this is the last admin user
    if (user.role === UserRole.SUPER_ADMIN) {
      const superAdminCount = await this.usersRepository.count({
        where: { role: UserRole.SUPER_ADMIN, isActive: true },
      });
      if (superAdminCount <= 1) {
        throw new BadRequestException('Cannot delete the last super admin user');
      }
    }

    await this.usersRepository.remove(user);
  }

  async getStats() {
    const [total, active, superAdmins, admins, users] = await Promise.all([
      this.usersRepository.count(),
      this.usersRepository.count({ where: { isActive: true } }),
      this.usersRepository.count({ where: { role: UserRole.SUPER_ADMIN } }),
      this.usersRepository.count({ where: { role: UserRole.ADMIN } }),
      this.usersRepository.count({ where: { role: UserRole.USER } }),
    ]);

    return {
      total,
      active,
      inactive: total - active,
      superAdmins,
      admins,
      users,
    };
  }

  async bulkUpdateStatus(ids: string[], isActive: boolean): Promise<void> {
    // If deactivating, check if any admin users would be affected
    if (!isActive) {
      const superAdminUsers = await this.usersRepository.find({
        where: { id: In(ids), role: UserRole.SUPER_ADMIN },
      });
      
      if (superAdminUsers.length > 0) {
        const totalActiveSuperAdmins = await this.usersRepository.count({
          where: { role: UserRole.SUPER_ADMIN, isActive: true },
        });
        
        if (totalActiveSuperAdmins <= superAdminUsers.length) {
          throw new BadRequestException('Cannot deactivate all super admin users');
        }
      }
    }

    await this.usersRepository.update({ id: In(ids) }, { isActive });
  }

  async bulkDelete(ids: string[]): Promise<void> {
    // Check if any admin users would be deleted
    const superAdminUsers = await this.usersRepository.find({
      where: { id: In(ids), role: UserRole.SUPER_ADMIN },
    });
    
    if (superAdminUsers.length > 0) {
      const totalSuperAdmins = await this.usersRepository.count({
        where: { role: UserRole.SUPER_ADMIN },
      });
      
      if (totalSuperAdmins <= superAdminUsers.length) {
        throw new BadRequestException('Cannot delete all super admin users');
      }
    }

    await this.usersRepository.delete({ id: In(ids) });
  }
}