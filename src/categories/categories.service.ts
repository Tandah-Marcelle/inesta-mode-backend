import {
  Injectable,
  NotFoundException,
  ConflictException,
  BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Category } from '../entities/category.entity';
import { CreateCategoryDto, UpdateCategoryDto } from './dto/category.dto';

@Injectable()
export class CategoriesService {
  constructor(
    @InjectRepository(Category)
    private readonly categoryRepository: Repository<Category>,
  ) {}

  // Generate slug from name
  private generateSlug(name: string): string {
    return name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/(^-|-$)/g, '');
  }

  // Check if slug is unique
  private async ensureUniqueSlug(
    name: string,
    excludeId?: string,
  ): Promise<string> {
    let slug = this.generateSlug(name);
    let counter = 1;

    while (true) {
      let existing;
      if (excludeId) {
        existing = await this.categoryRepository
          .createQueryBuilder('category')
          .where('category.slug = :slug', { slug })
          .andWhere('category.id != :excludeId', { excludeId })
          .getOne();
      } else {
        existing = await this.categoryRepository.findOne({
          where: { slug },
        });
      }

      if (!existing) break;

      slug = `${this.generateSlug(name)}-${counter}`;
      counter++;
    }

    return slug;
  }

  async create(createCategoryDto: CreateCategoryDto): Promise<Category> {
    const { name, ...rest } = createCategoryDto;

    // Check if category with same name exists
    const existingCategory = await this.categoryRepository.findOne({
      where: { name },
    });

    if (existingCategory) {
      throw new ConflictException('Category with this name already exists');
    }

    // Generate unique slug
    const slug = await this.ensureUniqueSlug(name);

    const category = this.categoryRepository.create({
      name,
      slug,
      ...rest,
    });

    return await this.categoryRepository.save(category);
  }

  async findAll(): Promise<Category[]> {
    return await this.categoryRepository.find({
      order: { sortOrder: 'ASC', name: 'ASC' },
    });
  }

  async findActive(): Promise<Category[]> {
    return await this.categoryRepository.find({
      where: { isActive: true },
      order: { sortOrder: 'ASC', name: 'ASC' },
    });
  }

  async findOne(id: string): Promise<Category> {
    const category = await this.categoryRepository.findOne({
      where: { id },
      relations: ['products'],
    });

    if (!category) {
      throw new NotFoundException('Category not found');
    }

    return category;
  }

  async findBySlug(slug: string): Promise<Category> {
    const category = await this.categoryRepository.findOne({
      where: { slug, isActive: true },
      relations: ['products'],
    });

    if (!category) {
      throw new NotFoundException('Category not found');
    }

    return category;
  }

  async update(
    id: string,
    updateCategoryDto: UpdateCategoryDto,
  ): Promise<Category> {
    const category = await this.findOne(id);
    const { name, ...rest } = updateCategoryDto;

    // If name is being updated, check uniqueness and regenerate slug
    if (name && name !== category.name) {
      const existingCategory = await this.categoryRepository.findOne({
        where: { name },
      });

      if (existingCategory && existingCategory.id !== id) {
        throw new ConflictException('Category with this name already exists');
      }

      const slug = await this.ensureUniqueSlug(name, id);
      Object.assign(category, { name, slug, ...rest });
    } else {
      Object.assign(category, rest);
    }

    return await this.categoryRepository.save(category);
  }

  async remove(id: string): Promise<void> {
    const category = await this.categoryRepository.findOne({
      where: { id },
      relations: ['products'],
    });

    if (!category) {
      throw new NotFoundException('Category not found');
    }

    // Check if category has products
    if (category.products && category.products.length > 0) {
      throw new BadRequestException(
        'Cannot delete category with associated products. Move products to another category first.',
      );
    }

    await this.categoryRepository.remove(category);
  }

  async getCategoriesWithProductCount(): Promise<Category[]> {
    return await this.categoryRepository
      .createQueryBuilder('category')
      .leftJoinAndSelect('category.products', 'product')
      .loadRelationCountAndMap('category.productCount', 'category.products')
      .where('category.isActive = :isActive', { isActive: true })
      .orderBy('category.sortOrder', 'ASC')
      .addOrderBy('category.name', 'ASC')
      .getMany();
  }
}
