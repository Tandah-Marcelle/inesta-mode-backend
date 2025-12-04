import { DataSource } from 'typeorm';
import { Category } from '../entities/category.entity';
import { getDatabaseConfig } from '../config/database.config';
import { ConfigService } from '@nestjs/config';
import * as dotenv from 'dotenv';

// Load environment variables
dotenv.config();

const configService = new ConfigService(process.env);

const categoriesData = [
  {
    name: 'Rose Noir',
    description: 'Collection élégante rose noir sophistiquées.',
    color: '#1f2937',
    sortOrder: 1,
  },
  {
    name: 'Homme',
    description: 'Collection de vêtements pour hommes stylée pour le gentleman moderne.',
    color: '#3b82f6',
    sortOrder: 2,
  },
  {
    name: 'Dame Nature',
    description: 'Designs inspirés de la nature célébrant la beauté organique.',
    color: '#10b981',
    sortOrder: 3,
  },
  {
    name: 'Enfants',
    description: 'Adorable collection de vêtements pour enfants.',
    color: '#f59e0b',
    sortOrder: 4,
  },
  {
    name: 'Mariage',
    description: 'Collection nuptiale exquise pour votre jour spécial.',
    color: '#ec4899',
    sortOrder: 5,
  },
  {
    name: 'Tenues Traditionnelles',
    description: 'Collection de tenues traditionnelles pour célébrer la culture.',
    color: '#8b5cf6',
    sortOrder: 6,
  },
  {
    name: 'Special Miss',
    description: 'Collection spéciale pour les reines et les miss.',
    color: '#ef4444',
    sortOrder: 7,
  },
  {
    name: 'Belle Fleure',
    description: 'Collection d\'accessoires luxueux ornés de perles.',
    color: '#06b6d4',
    sortOrder: 8,
  },
  {
    name: 'Country Flag',
    description: 'Collection patriotique avec des designs inspirés des drapeaux.',
    color: '#84cc16',
    sortOrder: 9,
  }
];

function generateSlug(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');
}

async function seedCategories() {
  const dataSource = new DataSource(getDatabaseConfig(configService) as any);
  
  try {
    await dataSource.initialize();
    console.log('Database connection established');

    const categoryRepository = dataSource.getRepository(Category);

    // Check if categories already exist
    const existingCount = await categoryRepository.count();
    if (existingCount > 0) {
      console.log(`Categories already exist (${existingCount} found). Skipping seed.`);
      return;
    }

    // Create categories
    for (const categoryData of categoriesData) {
      const slug = generateSlug(categoryData.name);
      
      const category = categoryRepository.create({
        ...categoryData,
        slug,
        isActive: true,
      });

      await categoryRepository.save(category);
      console.log(`Created category: ${category.name} (${category.slug})`);
    }

    console.log('Categories seeded successfully!');
  } catch (error) {
    console.error('Error seeding categories:', error);
    throw error;
  } finally {
    await dataSource.destroy();
  }
}

if (require.main === module) {
  seedCategories()
    .then(() => {
      console.log('Seeding completed');
      process.exit(0);
    })
    .catch((error) => {
      console.error('Seeding failed:', error);
      process.exit(1);
    });
}

export { seedCategories };
