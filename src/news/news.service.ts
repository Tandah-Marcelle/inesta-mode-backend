import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Like, ILike } from 'typeorm';
import { News } from '../entities/news.entity';
import { CreateNewsDto } from './dto/create-news.dto';
import { UpdateNewsDto } from './dto/update-news.dto';
import { FilterNewsDto } from './dto/filter-news.dto';

@Injectable()
export class NewsService {
  constructor(
    @InjectRepository(News)
    private newsRepository: Repository<News>,
  ) {}

  async create(createNewsDto: CreateNewsDto): Promise<News> {
    // Generate slug from title if not provided
    if (!createNewsDto.slug) {
      createNewsDto.slug = this.generateSlug(createNewsDto.title);
    }

    // DTO transformation already handles invalid dates

    const news = this.newsRepository.create(createNewsDto);
    return this.newsRepository.save(news);
  }

  async findAll(filterDto: FilterNewsDto): Promise<{ data: News[]; total: number; page: number; limit: number }> {
    const { page = 1, limit = 10, search, category, isActive, isFeatured, tag, sortBy = 'createdAt', sortOrder = 'DESC' } = filterDto;
    
    const queryBuilder = this.newsRepository.createQueryBuilder('news');

    // Apply filters
    if (search) {
      queryBuilder.andWhere(
        '(news.title ILIKE :search OR news.content ILIKE :search OR news.excerpt ILIKE :search)',
        { search: `%${search}%` }
      );
    }

    if (category) {
      queryBuilder.andWhere('news.category = :category', { category });
    }

    if (typeof isActive === 'boolean') {
      queryBuilder.andWhere('news.isActive = :isActive', { isActive });
    }

    if (typeof isFeatured === 'boolean') {
      queryBuilder.andWhere('news.isFeatured = :isFeatured', { isFeatured });
    }

    if (tag) {
      queryBuilder.andWhere('news.tags @> :tag', { tag: JSON.stringify([tag]) });
    }

    // Apply sorting - handle special field names
    const orderField = sortBy === 'createdAt' ? 'news.created_at' : `news.${sortBy}`;
    queryBuilder.orderBy(orderField, sortOrder);

    // Apply pagination
    const offset = (page - 1) * limit;
    queryBuilder.skip(offset).take(limit);

    const [data, total] = await queryBuilder.getManyAndCount();

    return {
      data,
      total,
      page,
      limit,
    };
  }

  async findActive(): Promise<News[]> {
    return this.newsRepository.find({
      where: { isActive: true },
      order: { isFeatured: 'DESC', createdAt: 'DESC' },
    });
  }

  async findFeatured(): Promise<News[]> {
    return this.newsRepository.find({
      where: { isActive: true, isFeatured: true },
      order: { createdAt: 'DESC' },
    });
  }

  async findOne(id: string): Promise<News> {
    const news = await this.newsRepository.findOne({ where: { id } });
    if (!news) {
      throw new NotFoundException('News item not found');
    }
    return news;
  }

  async findBySlug(slug: string): Promise<News> {
    const news = await this.newsRepository.findOne({ where: { slug, isActive: true } });
    if (!news) {
      throw new NotFoundException('News item not found');
    }

    // Increment view count
    await this.newsRepository.increment({ id: news.id }, 'viewCount', 1);
    news.viewCount += 1;

    return news;
  }

  async update(id: string, updateNewsDto: UpdateNewsDto): Promise<News> {
    // Generate new slug if title is being updated
    if (updateNewsDto.title && !updateNewsDto.slug) {
      updateNewsDto.slug = this.generateSlug(updateNewsDto.title);
    }

    // DTO transformation already handles invalid dates

    await this.newsRepository.update(id, updateNewsDto);
    const updatedNews = await this.findOne(id);
    return updatedNews;
  }

  async remove(id: string): Promise<void> {
    const news = await this.findOne(id);
    await this.newsRepository.remove(news);
  }

  async toggleStatus(id: string): Promise<News> {
    const news = await this.findOne(id);
    news.isActive = !news.isActive;
    return this.newsRepository.save(news);
  }

  async toggleFeatured(id: string): Promise<News> {
    const news = await this.findOne(id);
    news.isFeatured = !news.isFeatured;
    return this.newsRepository.save(news);
  }

  private generateSlug(title: string): string {
    return title
      .toLowerCase()
      .replace(/[^a-z0-9\s-]/g, '')
      .replace(/\s+/g, '-')
      .replace(/-+/g, '-')
      .trim();
  }
}