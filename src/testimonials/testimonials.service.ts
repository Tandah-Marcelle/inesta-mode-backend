import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Testimonial } from '../entities/testimonial.entity';
import { CreateTestimonialDto } from './dto/create-testimonial.dto';
import { UpdateTestimonialDto } from './dto/update-testimonial.dto';

@Injectable()
export class TestimonialsService {
  constructor(
    @InjectRepository(Testimonial)
    private testimonialsRepository: Repository<Testimonial>,
  ) {}

  async create(createTestimonialDto: CreateTestimonialDto): Promise<Testimonial> {
    const testimonial = this.testimonialsRepository.create(createTestimonialDto);
    return this.testimonialsRepository.save(testimonial);
  }

  async findAll(): Promise<Testimonial[]> {
    return this.testimonialsRepository.find({
      order: { sortOrder: 'ASC', createdAt: 'DESC' },
    });
  }

  async findActive(): Promise<Testimonial[]> {
    return this.testimonialsRepository.find({
      where: { isActive: true },
      order: { sortOrder: 'ASC', createdAt: 'DESC' },
    });
  }

  async findOne(id: string): Promise<Testimonial | null> {
    return this.testimonialsRepository.findOne({ where: { id } });
  }

  async update(id: string, updateTestimonialDto: UpdateTestimonialDto): Promise<Testimonial> {
    await this.testimonialsRepository.update(id, updateTestimonialDto);
    const testimonial = await this.findOne(id);
    if (!testimonial) {
      throw new Error('Testimonial not found');
    }
    return testimonial;
  }

  async remove(id: string): Promise<void> {
    await this.testimonialsRepository.delete(id);
  }

  async toggleStatus(id: string): Promise<Testimonial> {
    const testimonial = await this.findOne(id);
    if (!testimonial) {
      throw new Error('Testimonial not found');
    }
    testimonial.isActive = !testimonial.isActive;
    return this.testimonialsRepository.save(testimonial);
  }
}