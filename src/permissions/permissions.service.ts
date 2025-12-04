import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Permission, PermissionResource, PermissionAction } from '../entities/permission.entity';
import { UserPermission } from '../entities/user-permission.entity';

@Injectable()
export class PermissionsService {
  constructor(
    @InjectRepository(Permission)
    private permissionRepository: Repository<Permission>,
    @InjectRepository(UserPermission)
    private userPermissionRepository: Repository<UserPermission>,
  ) {}

  async findAll(): Promise<Permission[]> {
    return this.permissionRepository.find();
  }

  async getUserPermissions(userId: string): Promise<UserPermission[]> {
    return this.userPermissionRepository.find({
      where: { userId, isGranted: true },
      relations: ['permission'],
    });
  }

  async updateUserPermissions(userId: string, permissionIds: string[]): Promise<void> {
    // Remove existing permissions
    await this.userPermissionRepository.delete({ userId });

    // Add new permissions
    const userPermissions = permissionIds.map(permissionId => ({
      userId,
      permissionId,
      isGranted: true,
    }));

    await this.userPermissionRepository.save(userPermissions);
  }

  async hasPermission(userId: string, resource: PermissionResource, action: PermissionAction): Promise<boolean> {
    const userPermission = await this.userPermissionRepository
      .createQueryBuilder('up')
      .innerJoin('up.permission', 'p')
      .where('up.userId = :userId', { userId })
      .andWhere('p.resource = :resource', { resource })
      .andWhere('p.action = :action', { action })
      .andWhere('up.isGranted = true')
      .getOne();

    return !!userPermission;
  }

  async seedPermissions(): Promise<void> {
    const permissions = [
      // Dashboard
      { resource: PermissionResource.DASHBOARD, action: PermissionAction.VIEW, name: 'Voir le tableau de bord', description: 'Accès au tableau de bord principal' },
      
      // Products
      { resource: PermissionResource.PRODUCTS, action: PermissionAction.VIEW, name: 'Voir les produits', description: 'Consulter la liste des produits' },
      { resource: PermissionResource.PRODUCTS, action: PermissionAction.CREATE, name: 'Créer des produits', description: 'Ajouter de nouveaux produits' },
      { resource: PermissionResource.PRODUCTS, action: PermissionAction.UPDATE, name: 'Modifier les produits', description: 'Modifier les produits existants' },
      { resource: PermissionResource.PRODUCTS, action: PermissionAction.DELETE, name: 'Supprimer les produits', description: 'Supprimer des produits' },
      
      // Categories
      { resource: PermissionResource.CATEGORIES, action: PermissionAction.VIEW, name: 'Voir les catégories', description: 'Consulter la liste des catégories' },
      { resource: PermissionResource.CATEGORIES, action: PermissionAction.CREATE, name: 'Créer des catégories', description: 'Ajouter de nouvelles catégories' },
      { resource: PermissionResource.CATEGORIES, action: PermissionAction.UPDATE, name: 'Modifier les catégories', description: 'Modifier les catégories existantes' },
      { resource: PermissionResource.CATEGORIES, action: PermissionAction.DELETE, name: 'Supprimer les catégories', description: 'Supprimer des catégories' },
      
      // Users
      { resource: PermissionResource.USERS, action: PermissionAction.VIEW, name: 'Voir les utilisateurs', description: 'Consulter la liste des utilisateurs' },
      { resource: PermissionResource.USERS, action: PermissionAction.CREATE, name: 'Créer des utilisateurs', description: 'Ajouter de nouveaux utilisateurs' },
      { resource: PermissionResource.USERS, action: PermissionAction.UPDATE, name: 'Modifier les utilisateurs', description: 'Modifier les utilisateurs existants' },
      { resource: PermissionResource.USERS, action: PermissionAction.DELETE, name: 'Supprimer les utilisateurs', description: 'Supprimer des utilisateurs' },
      
      // Orders
      { resource: PermissionResource.ORDERS, action: PermissionAction.VIEW, name: 'Voir les commandes', description: 'Consulter la liste des commandes' },
      { resource: PermissionResource.ORDERS, action: PermissionAction.UPDATE, name: 'Modifier les commandes', description: 'Modifier le statut des commandes' },
      
      // Settings
      { resource: PermissionResource.SETTINGS, action: PermissionAction.VIEW, name: 'Voir les paramètres', description: 'Accès aux paramètres système' },
      { resource: PermissionResource.SETTINGS, action: PermissionAction.UPDATE, name: 'Modifier les paramètres', description: 'Modifier les paramètres système' },
    ];

    for (const permissionData of permissions) {
      const existing = await this.permissionRepository.findOne({
        where: { resource: permissionData.resource, action: permissionData.action },
      });

      if (!existing) {
        await this.permissionRepository.save(permissionData);
      }
    }
  }
}