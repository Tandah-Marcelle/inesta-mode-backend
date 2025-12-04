import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';

export enum PermissionAction {
  VIEW = 'view',
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
}

export enum PermissionResource {
  DASHBOARD = 'dashboard',
  PRODUCTS = 'products',
  CATEGORIES = 'categories',
  USERS = 'users',
  ORDERS = 'orders',
  SETTINGS = 'settings',
  NEWS = 'news',
  PARTNERS = 'partners',
  TESTIMONIALS = 'testimonials',
  CONTACT_MESSAGES = 'contact_messages',
  AUTH = 'auth',
  PERMISSIONS = 'permissions',
}

@Entity('permissions')
export class Permission {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({
    type: 'enum',
    enum: PermissionResource,
  })
  resource: PermissionResource;

  @Column({
    type: 'enum',
    enum: PermissionAction,
  })
  action: PermissionAction;

  @Column({ type: 'varchar', length: 255 })
  name: string;

  @Column({ type: 'text', nullable: true })
  description: string;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}