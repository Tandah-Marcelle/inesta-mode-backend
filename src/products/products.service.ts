import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ConflictException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, SelectQueryBuilder, In } from 'typeorm';
import { Product, ProductStatus } from '../entities/product.entity';
import { ProductImage } from '../entities/product-image.entity';
import { Category } from '../entities/category.entity';
import { CreateProductDto } from './dto/create-product.dto';
import { UpdateProductDto } from './dto/update-product.dto';
import { FilterProductsDto, ProductSortBy } from './dto/filter-products.dto';
import { UploadService } from '../upload/upload.service';

export interface PaginatedProducts {
  products: Product[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

@Injectable()
export class ProductsService {
  constructor(
    @InjectRepository(Product)
    private productsRepository: Repository<Product>,
    @InjectRepository(ProductImage)
    private productImagesRepository: Repository<ProductImage>,
    @InjectRepository(Category)
    private categoriesRepository: Repository<Category>,
    private uploadService: UploadService,
  ) {}

  async create(createProductDto: CreateProductDto): Promise<Product> {
    // Check if category exists
    const category = await this.categoriesRepository.findOne({
      where: { id: createProductDto.categoryId },
    });
    if (!category) {
      throw new NotFoundException('Category not found');
    }

    // Check if slug already exists
    const existingProduct = await this.productsRepository.findOne({
      where: { slug: createProductDto.slug },
    });
    if (existingProduct) {
      throw new ConflictException('Product with this slug already exists');
    }

    // Check if SKU already exists (if provided)
    if (createProductDto.sku) {
      const existingSku = await this.productsRepository.findOne({
        where: { sku: createProductDto.sku },
      });
      if (existingSku) {
        throw new ConflictException('Product with this SKU already exists');
      }
    }

    // Create product
    const product = this.productsRepository.create({
      ...createProductDto,
      category,
      status: createProductDto.status || ProductStatus.PUBLISHED,
    });

    const savedProduct = await this.productsRepository.save(product);

    // Handle images if provided
    if (createProductDto.images && createProductDto.images.length > 0) {
      const images = createProductDto.images.map((imageDto, index) =>
        this.productImagesRepository.create({
          ...imageDto,
          product: savedProduct,
          sortOrder: imageDto.sortOrder || index,
        }),
      );

      await this.productImagesRepository.save(images);
      savedProduct.images = images;
    }

    // Handle Supabase image URLs if provided
    if (createProductDto.imageUrls && createProductDto.imageUrls.length > 0) {
      const images = createProductDto.imageUrls.map((url, index) =>
        this.productImagesRepository.create({
          url,
          thumbnailUrl: url,
          alt: `${savedProduct.name} image ${index + 1}`,
          sortOrder: index,
          isPrimary: index === 0,
          product: savedProduct,
        }),
      );

      await this.productImagesRepository.save(images);
      savedProduct.images = images;
    }

    return this.findOne(savedProduct.id);
  }

  async findAll(filterDto: FilterProductsDto): Promise<PaginatedProducts> {
    const {
      page = 1,
      limit = 10,
      search,
      categoryId,
      status,
      isFeatured,
      isNew,
      minPrice,
      maxPrice,
      sizes,
      colors,
      materials,
      tags,
      inStock,
      onSale,
      sortBy = ProductSortBy.CREATED_AT,
      sortOrder = 'DESC',
    } = filterDto;

    const queryBuilder = this.productsRepository
      .createQueryBuilder('product')
      .leftJoinAndSelect('product.category', 'category')
      .leftJoinAndSelect('product.images', 'images');

    // Search functionality
    if (search) {
      queryBuilder.andWhere(
        '(product.name ILIKE :search OR product.description ILIKE :search OR product.shortDescription ILIKE :search OR product.sku ILIKE :search)',
        { search: `%${search}%` },
      );
    }

    // Filter by category
    if (categoryId) {
      queryBuilder.andWhere('product.categoryId = :categoryId', { categoryId });
    }

    // Filter by status
    if (status) {
      queryBuilder.andWhere('product.status = :status', { status });
    }

    // Filter by featured
    if (isFeatured !== undefined) {
      queryBuilder.andWhere('product.isFeatured = :isFeatured', { isFeatured });
    }

    // Filter by new
    if (isNew !== undefined) {
      queryBuilder.andWhere('product.isNew = :isNew', { isNew });
    }

    // Price range filter
    if (minPrice !== undefined) {
      queryBuilder.andWhere('product.price >= :minPrice', { minPrice });
    }
    if (maxPrice !== undefined) {
      queryBuilder.andWhere('product.price <= :maxPrice', { maxPrice });
    }

    // Filter by sizes
    if (sizes && sizes.length > 0) {
      queryBuilder.andWhere('product.sizes && :sizes', { sizes });
    }

    // Filter by colors
    if (colors && colors.length > 0) {
      queryBuilder.andWhere('product.colors && :colors', { colors });
    }

    // Filter by materials
    if (materials && materials.length > 0) {
      queryBuilder.andWhere('product.materials && :materials', { materials });
    }

    // Filter by tags
    if (tags && tags.length > 0) {
      queryBuilder.andWhere('product.tags && :tags', { tags });
    }

    // Filter by stock
    if (inStock !== undefined) {
      if (inStock) {
        queryBuilder.andWhere(
          'product.stockQuantity > 0 AND product.status != :outOfStock',
          { outOfStock: ProductStatus.OUT_OF_STOCK },
        );
      } else {
        queryBuilder.andWhere(
          'product.stockQuantity = 0 OR product.status = :outOfStock',
          { outOfStock: ProductStatus.OUT_OF_STOCK },
        );
      }
    }

    // Filter by sale
    if (onSale !== undefined) {
      if (onSale) {
        queryBuilder.andWhere(
          'product.comparePrice IS NOT NULL AND product.comparePrice > product.price',
        );
      }
    }

    // Sorting
    this.applySorting(queryBuilder, sortBy, sortOrder);

    // Get total count
    const total = await queryBuilder.getCount();

    // Apply pagination
    const skip = (page - 1) * limit;
    queryBuilder.skip(skip).take(limit);

    const products = await queryBuilder.getMany();

    return {
      products,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  private applySorting(
    queryBuilder: SelectQueryBuilder<Product>,
    sortBy: ProductSortBy,
    sortOrder: string,
  ): void {
    switch (sortBy) {
      case ProductSortBy.NAME:
        queryBuilder.orderBy('product.name', sortOrder as 'ASC' | 'DESC');
        break;
      case ProductSortBy.PRICE:
        queryBuilder.orderBy('product.price', sortOrder as 'ASC' | 'DESC');
        break;
      case ProductSortBy.STOCK_QUANTITY:
        queryBuilder.orderBy('product.stockQuantity', sortOrder as 'ASC' | 'DESC');
        break;
      case ProductSortBy.VIEW_COUNT:
        queryBuilder.orderBy('product.viewCount', sortOrder as 'ASC' | 'DESC');
        break;
      case ProductSortBy.SOLD_COUNT:
        queryBuilder.orderBy('product.soldCount', sortOrder as 'ASC' | 'DESC');
        break;
      case ProductSortBy.AVERAGE_RATING:
        queryBuilder.orderBy('product.averageRating', sortOrder as 'ASC' | 'DESC');
        break;
      case ProductSortBy.UPDATED_AT:
        queryBuilder.orderBy('product.updatedAt', sortOrder as 'ASC' | 'DESC');
        break;
      case ProductSortBy.CREATED_AT:
      default:
        queryBuilder.orderBy('product.createdAt', sortOrder as 'ASC' | 'DESC');
        break;
    }
  }

  async findOne(id: string): Promise<Product> {
    const product = await this.productsRepository.findOne({
      where: { id },
      relations: ['category', 'images'],
    });

    if (!product) {
      throw new NotFoundException('Product not found');
    }

    return product;
  }

  async findBySlug(slug: string): Promise<Product> {
    const product = await this.productsRepository.findOne({
      where: { slug },
      relations: ['category', 'images'],
    });

    if (!product) {
      throw new NotFoundException('Product not found');
    }

    // Increment view count
    await this.productsRepository.increment({ id: product.id }, 'viewCount', 1);

    return product;
  }

  async update(id: string, updateProductDto: UpdateProductDto): Promise<Product> {
    const existingProduct = await this.findOne(id);

    // Extract newImageUrls and remove it from the main update
    const { newImageUrls, ...productUpdateData } = updateProductDto;

    // Check if category exists (if being updated)
    if (updateProductDto.categoryId) {
      const category = await this.categoriesRepository.findOne({
        where: { id: updateProductDto.categoryId },
      });
      if (!category) {
        throw new NotFoundException('Category not found');
      }
    }

    // Check if slug already exists (if being updated and different)
    if (updateProductDto.slug && updateProductDto.slug !== existingProduct.slug) {
      const existingSlug = await this.productsRepository.findOne({
        where: { slug: updateProductDto.slug },
      });
      if (existingSlug) {
        throw new ConflictException('Product with this slug already exists');
      }
    }

    // Check if SKU already exists (if being updated and different)
    if (updateProductDto.sku && updateProductDto.sku !== existingProduct.sku) {
      const existingSku = await this.productsRepository.findOne({
        where: { sku: updateProductDto.sku },
      });
      if (existingSku) {
        throw new ConflictException('Product with this SKU already exists');
      }
    }

    // Update product (without newImageUrls)
    await this.productsRepository.update(id, productUpdateData);

    // Handle new image URLs if provided
    if (newImageUrls && newImageUrls.length > 0) {
      const images = newImageUrls.map((url, index) =>
        this.productImagesRepository.create({
          url,
          thumbnailUrl: url,
          alt: `${existingProduct.name} image ${existingProduct.images.length + index + 1}`,
          sortOrder: existingProduct.images.length + index,
          isPrimary: index === 0 && existingProduct.images.length === 0,
          productId: id,
        }),
      );

      await this.productImagesRepository.save(images);
    }

    // Handle images if provided
    if (updateProductDto.images) {
      // Remove existing images
      await this.productImagesRepository.delete({ productId: id });

      // Add new images
      if (updateProductDto.images.length > 0) {
        const images = updateProductDto.images.map((imageDto, index) =>
          this.productImagesRepository.create({
            ...imageDto,
            productId: id,
            sortOrder: imageDto.sortOrder || index,
          }),
        );

        await this.productImagesRepository.save(images);
      }
    }

    return this.findOne(id);
  }

  async remove(id: string): Promise<void> {
    const product = await this.findOne(id);

    // Delete associated images from filesystem
    if (product.images && product.images.length > 0) {
      const imagePaths = product.images.map(image => image.url);
      await this.uploadService.deleteMultipleFiles(imagePaths);
    }

    await this.productsRepository.remove(product);
  }

  async uploadImages(
    productId: string,
    files: Express.Multer.File[],
  ): Promise<Product> {
    const product = await this.findOne(productId);

    if (!files || files.length === 0) {
      throw new BadRequestException('No files provided');
    }

    // Upload files
    const uploadedFiles = await this.uploadService.uploadProductImages(files);

    // Create product images
    const images = uploadedFiles.map((file, index) =>
      this.productImagesRepository.create({
        url: file.url,
        thumbnailUrl: file.url, // You might want to generate thumbnails
        alt: `${product.name} image ${index + 1}`,
        sortOrder: index,
        isPrimary: index === 0 && product.images.length === 0,
        originalName: file.originalName,
        mimeType: file.mimeType,
        size: file.size,
        productId: product.id,
      }),
    );

    const savedImages = await this.productImagesRepository.save(images);
    product.images = [...product.images, ...savedImages];

    return product;
  }

  async addImageUrls(productId: string, imageUrls: string[]): Promise<Product> {
    const product = await this.findOne(productId);

    if (!imageUrls || imageUrls.length === 0) {
      throw new BadRequestException('No image URLs provided');
    }

    // Create product images from URLs
    const images = imageUrls.map((url, index) =>
      this.productImagesRepository.create({
        url,
        thumbnailUrl: url,
        alt: `${product.name} image ${product.images.length + index + 1}`,
        sortOrder: product.images.length + index,
        isPrimary: index === 0 && product.images.length === 0,
        productId: product.id,
      }),
    );

    const savedImages = await this.productImagesRepository.save(images);
    product.images = [...product.images, ...savedImages];

    return product;
  }

  async deleteImage(productId: string, imageId: string): Promise<void> {
    const image = await this.productImagesRepository.findOne({
      where: { id: imageId, productId },
    });

    if (!image) {
      throw new NotFoundException('Image not found');
    }

    // Delete image record (Supabase images are handled separately)
    await this.productImagesRepository.remove(image);
  }

  async updateStock(id: string, quantity: number): Promise<Product> {
    const product = await this.findOne(id);

    await this.productsRepository.update(id, {
      stockQuantity: quantity,
      status: quantity > 0 ? ProductStatus.PUBLISHED : ProductStatus.OUT_OF_STOCK,
    });

    return this.findOne(id);
  }

  async incrementViewCount(id: string): Promise<void> {
    await this.productsRepository.increment({ id }, 'viewCount', 1);
  }

  async getFeaturedProducts(limit: number = 10): Promise<Product[]> {
    return this.productsRepository.find({
      where: {
        isFeatured: true,
        status: ProductStatus.PUBLISHED,
      },
      relations: ['category', 'images'],
      order: { createdAt: 'DESC' },
      take: limit,
    });
  }

  async getNewProducts(limit: number = 10): Promise<Product[]> {
    return this.productsRepository.find({
      where: {
        isNew: true,
        status: ProductStatus.PUBLISHED,
      },
      relations: ['category', 'images'],
      order: { createdAt: 'DESC' },
      take: limit,
    });
  }

  async getRelatedProducts(productId: string, limit: number = 5): Promise<Product[]> {
    const product = await this.findOne(productId);

    return this.productsRepository
      .createQueryBuilder('product')
      .leftJoinAndSelect('product.category', 'category')
      .leftJoinAndSelect('product.images', 'images')
      .where('product.categoryId = :categoryId', { categoryId: product.categoryId })
      .andWhere('product.id != :productId', { productId })
      .andWhere('product.status = :status', { status: ProductStatus.PUBLISHED })
      .orderBy('product.createdAt', 'DESC')
      .limit(limit)
      .getMany();
  }
}
