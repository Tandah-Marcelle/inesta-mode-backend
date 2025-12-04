import { Injectable } from '@nestjs/common';

export interface SkeletonData {
  type: 'card' | 'list' | 'table' | 'chart' | 'stats';
  count?: number;
  loading?: boolean;
}

@Injectable()
export class SkeletonService {
  /**
   * Generate skeleton data for dashboard stats
   */
  getDashboardStatsSkeleton(): any {
    return {
      products: {
        total: 0,
        active: 0,
        featured: 0,
        byCategory: [],
        loading: true,
      },
      categories: {
        total: 0,
        active: 0,
        loading: true,
      },
      users: {
        total: 0,
        active: 0,
        loading: true,
      },
      news: {
        total: 0,
        published: 0,
        events: 0,
        loading: true,
      },
      partners: {
        total: 0,
        active: 0,
        featured: 0,
        loading: true,
      },
      messages: {
        total: 0,
        unread: 0,
        resolved: 0,
        loading: true,
      },
      testimonials: {
        total: 0,
        published: 0,
        featured: 0,
        loading: true,
      },
      loading: true,
    };
  }

  /**
   * Generate skeleton data for products over time chart
   */
  getProductsOverTimeSkeleton(): any {
    const monthNames = ['Jan', 'Fév', 'Mar', 'Avr', 'Mai', 'Jun'];
    return monthNames.map(month => ({
      month,
      count: 0,
      loading: true,
    }));
  }

  /**
   * Generate skeleton data for table listings
   */
  getTableSkeleton(rows: number = 10): any[] {
    return Array.from({ length: rows }, (_, index) => ({
      id: `skeleton-${index}`,
      loading: true,
    }));
  }

  /**
   * Generate skeleton data for card layouts
   */
  getCardSkeleton(count: number = 6): any[] {
    return Array.from({ length: count }, (_, index) => ({
      id: `skeleton-${index}`,
      title: '',
      description: '',
      image: '',
      loading: true,
    }));
  }

  /**
   * Check if data is still loading (has skeleton properties)
   */
  isLoading(data: any): boolean {
    return data && (data.loading === true || data.some?.((item: any) => item.loading === true));
  }

  /**
   * Remove skeleton properties from data
   */
  cleanSkeletonData(data: any): any {
    if (!data) return data;

    if (Array.isArray(data)) {
      return data.map(item => this.cleanSkeletonData(item));
    }

    if (typeof data === 'object') {
      const cleaned = { ...data };
      delete cleaned.loading;
      
      for (const key in cleaned) {
        if (cleaned.hasOwnProperty(key)) {
          cleaned[key] = this.cleanSkeletonData(cleaned[key]);
        }
      }
      
      return cleaned;
    }

    return data;
  }
}