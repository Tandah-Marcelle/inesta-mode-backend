import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

// Import entities
import { Product, ProductStatus } from '../entities/product.entity';
import { Category } from '../entities/category.entity';
import { User } from '../entities/user.entity';
import { News } from '../entities/news.entity';
import { Partner } from '../entities/partner.entity';
import { ContactMessage, MessageStatus } from '../entities/contact-message.entity';
import { Testimonial } from '../entities/testimonial.entity';

@Injectable()
export class DashboardService {
  constructor(
    @InjectRepository(Product)
    private productRepository: Repository<Product>,
    @InjectRepository(Category)
    private categoryRepository: Repository<Category>,
    @InjectRepository(User)
    private userRepository: Repository<User>,
    @InjectRepository(News)
    private newsRepository: Repository<News>,
    @InjectRepository(Partner)
    private partnerRepository: Repository<Partner>,
    @InjectRepository(ContactMessage)
    private messageRepository: Repository<ContactMessage>,
    @InjectRepository(Testimonial)
    private testimonialRepository: Repository<Testimonial>,
  ) {}

  async getStats() {
    try {
      // Get all data in parallel using COUNT queries for better performance
      const [
        products,
        categories,
        users,
        news,
        partners,
        messages,
        testimonials,
        // Additional stats queries
        totalProducts,
        activeProducts,
        featuredProducts,
        totalCategories,
        activeCategories,
        totalUsers,
        activeUsers,
        totalNews,
        publishedNews,
        eventNews,
        totalPartners,
        activePartners,
        featuredPartners,
        totalMessages,
        unreadMessages,
        repliedMessages,
        totalTestimonials,
        activeTestimonials
      ] = await Promise.all([
        // Get actual data (minimal for processing)
        this.productRepository.find({ 
          select: ['id', 'status', 'isFeatured', 'categoryId'],
          relations: ['category'] 
        }),
        this.categoryRepository.find({ select: ['id', 'name', 'isActive'] }),
        this.userRepository.find({ select: ['id', 'isActive'] }),
        this.newsRepository.find({ select: ['id', 'isActive', 'category'] }),
        this.partnerRepository.find({ select: ['id', 'isActive', 'isFeatured'] }),
        this.messageRepository.find({ select: ['id', 'status'] }),
        this.testimonialRepository.find({ select: ['id', 'isActive', 'sortOrder'] }),
        
        // Count queries for better performance
        this.productRepository.count(),
this.productRepository.count({ where: { status: ProductStatus.PUBLISHED } }),
        this.productRepository.count({ where: { isFeatured: true } }),
        this.categoryRepository.count(),
        this.categoryRepository.count({ where: { isActive: true } }),
        this.userRepository.count(),
        this.userRepository.count({ where: { isActive: true } }),
        this.newsRepository.count(),
        this.newsRepository.count({ where: { isActive: true } }),
        this.newsRepository.count({ where: { category: 'event' } }),
        this.partnerRepository.count(),
        this.partnerRepository.count({ where: { isActive: true } }),
        this.partnerRepository.count({ where: { isFeatured: true } }),
        this.messageRepository.count(),
this.messageRepository.count({ where: { status: MessageStatus.UNREAD } }),
this.messageRepository.count({ where: { status: MessageStatus.REPLIED } }),
        this.testimonialRepository.count(),
        this.testimonialRepository.count({ where: { isActive: true } })
      ]);

      // Process products by category efficiently
      const productsByCategory = categories.map(category => ({
        categoryId: category.id,
        categoryName: category.name,
        count: products.filter(product => product.categoryId === category.id).length,
      })).filter(item => item.count > 0);

      // Return optimized stats using count queries
      return {
        products: {
          total: totalProducts,
          active: activeProducts,
          featured: featuredProducts,
          byCategory: productsByCategory,
        },
        categories: {
          total: totalCategories,
          active: activeCategories,
        },
        users: {
          total: totalUsers,
          active: activeUsers,
        },
        news: {
          total: totalNews,
          published: publishedNews,
          events: eventNews,
        },
        partners: {
          total: totalPartners,
          active: activePartners,
          featured: featuredPartners,
        },
        messages: {
          total: totalMessages,
          unread: unreadMessages,
          resolved: repliedMessages,
        },
        testimonials: {
          total: totalTestimonials,
          published: activeTestimonials,
          featured: testimonials.filter(t => t.isActive && t.sortOrder <= 3).length,
        },
      };
    } catch (error) {
      console.error('Error getting dashboard stats:', error);
      // Return fallback data
      return {
        products: { total: 0, active: 0, featured: 0, byCategory: [] },
        categories: { total: 0, active: 0 },
        users: { total: 0, active: 0 },
        news: { total: 0, published: 0, events: 0 },
        partners: { total: 0, active: 0, featured: 0 },
        messages: { total: 0, unread: 0, resolved: 0 },
        testimonials: { total: 0, published: 0, featured: 0 },
      };
    }
  }

  async getProductsOverTime() {
    try {
      // Get products created in the last 6 months
      const sixMonthsAgo = new Date();
      sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);

      const products = await this.productRepository.find({
        where: {
          // createdAt: MoreThan(sixMonthsAgo), // Uncomment if you want to filter by date
        },
        order: { createdAt: 'DESC' }
      });

      // Group by month
      const monthNames = ['Jan', 'Fév', 'Mar', 'Avr', 'Mai', 'Jun', 'Jul', 'Août', 'Sep', 'Oct', 'Nov', 'Déc'];
      const now = new Date();
      const result: { month: string; count: number }[] = [];

      for (let i = 5; i >= 0; i--) {
        const date = new Date(now.getFullYear(), now.getMonth() - i, 1);
        const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
        
        const monthProducts = products.filter(product => {
          const productDate = new Date(product.createdAt);
          const productKey = `${productDate.getFullYear()}-${String(productDate.getMonth() + 1).padStart(2, '0')}`;
          return productKey === monthKey;
        });

        result.push({
          month: monthNames[date.getMonth()],
          count: monthProducts.length,
        });
      }

      return result;
    } catch (error) {
      console.error('Error getting products over time:', error);
      // Return fallback data with current months
      const monthNames = ['Jan', 'Fév', 'Mar', 'Avr', 'Mai', 'Jun', 'Jul', 'Août', 'Sep', 'Oct', 'Nov', 'Déc'];
      const now = new Date();
      const result: { month: string; count: number }[] = [];

      for (let i = 5; i >= 0; i--) {
        const date = new Date(now.getFullYear(), now.getMonth() - i, 1);
        result.push({
          month: monthNames[date.getMonth()],
          count: 0,
        });
      }

      return result;
    }
  }
}