import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  OneToMany,
  JoinColumn,
} from 'typeorm';
import { Category } from './category.entity';
import { ProductImage } from './product-image.entity';
import { OrderItem } from './order-item.entity';
import { Review } from './review.entity';

export enum ProductStatus {
  DRAFT = 'draft',
  PUBLISHED = 'published',
  OUT_OF_STOCK = 'out_of_stock',
  DISCONTINUED = 'discontinued',
}

@Entity('products')
export class Product {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', length: 255 })
  name: string;

  @Column({ type: 'varchar', length: 255, unique: true })
  slug: string;

  @Column({ type: 'text' })
  description: string;

  @Column({ type: 'text', nullable: true })
  shortDescription: string;

  @Column({ type: 'decimal', precision: 10, scale: 2 })
  price: number;

  @Column({ type: 'decimal', precision: 10, scale: 2, nullable: true })
  comparePrice: number; // Original price for sales

  @Column({ type: 'decimal', precision: 10, scale: 2, nullable: true })
  costPrice: number; // Cost for profit calculations

  @Column({ type: 'varchar', length: 10, default: 'USD' })
  currency: string;

  @Column({ type: 'int', default: 0 })
  stockQuantity: number;

  @Column({ type: 'int', default: 0 })
  lowStockThreshold: number;

  @Column({
    type: 'enum',
    enum: ProductStatus,
    default: ProductStatus.DRAFT,
  })
  status: ProductStatus;

  @Column({ type: 'boolean', default: false })
  isFeatured: boolean;

  @Column({ type: 'boolean', default: false })
  isNew: boolean;

  @Column({ type: 'simple-array', nullable: true })
  sizes: string[]; // ['XS', 'S', 'M', 'L', 'XL']

  @Column({ type: 'simple-array', nullable: true })
  colors: string[]; // ['Red', 'Blue', 'Green']

  @Column({ type: 'simple-array', nullable: true })
  materials: string[]; // ['Cotton', 'Silk', 'Polyester']

  @Column({ type: 'simple-array', nullable: true })
  tags: string[]; // ['Summer', 'Elegant', 'Casual']

  @Column({ type: 'decimal', precision: 5, scale: 2, nullable: true })
  weight: number; // In kg

  @Column({ type: 'varchar', length: 255, nullable: true })
  sku: string; // Stock Keeping Unit

  @Column({ type: 'varchar', length: 255, nullable: true })
  barcode: string;

  @Column({ type: 'text', nullable: true })
  careInstructions: string;

  @Column({ type: 'int', default: 0 })
  viewCount: number;

  @Column({ type: 'int', default: 0 })
  likeCount: number;

  @Column({ type: 'decimal', precision: 3, scale: 2, default: 0 })
  averageRating: number;

  @Column({ type: 'int', default: 0 })
  reviewCount: number;

  @Column({ type: 'int', default: 0 })
  soldCount: number;

  @Column({ type: 'text', nullable: true })
  metaTitle: string; // SEO

  @Column({ type: 'text', nullable: true })
  metaDescription: string; // SEO

  @Column({ type: 'simple-array', nullable: true })
  metaKeywords: string[]; // SEO

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  // Relations
  @ManyToOne(() => Category, (category) => category.products)
  @JoinColumn({ name: 'categoryId' })
  category: Category;

  @Column({ type: 'uuid' })
  categoryId: string;

  @OneToMany(() => ProductImage, (image) => image.product, {
    cascade: true,
    eager: true,
  })
  images: ProductImage[];

  @OneToMany(() => OrderItem, (orderItem) => orderItem.product)
  orderItems: OrderItem[];

  @OneToMany(() => Review, (review) => review.product)
  reviews: Review[];

  // Virtual fields
  get isOnSale(): boolean {
    return !!(this.comparePrice && this.comparePrice > this.price);
  }

  get discountPercentage(): number {
    if (!this.comparePrice || this.comparePrice <= this.price) return 0;
    return Math.round(((this.comparePrice - this.price) / this.comparePrice) * 100);
  }

  get isInStock(): boolean {
    return this.stockQuantity > 0 && this.status !== ProductStatus.OUT_OF_STOCK;
  }

  get isLowStock(): boolean {
    return this.stockQuantity <= this.lowStockThreshold && this.stockQuantity > 0;
  }
}
