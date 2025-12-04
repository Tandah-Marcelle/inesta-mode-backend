import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Like, ILike } from 'typeorm';
import { Partner } from '../entities/partner.entity';
import { CreatePartnerDto } from './dto/create-partner.dto';
import { UpdatePartnerDto } from './dto/update-partner.dto';
import { FilterPartnersDto } from './dto/filter-partners.dto';

@Injectable()
export class PartnersService {
  constructor(
    @InjectRepository(Partner)
    private partnersRepository: Repository<Partner>,
  ) {}

  async create(createPartnerDto: CreatePartnerDto): Promise<Partner> {
    const partner = this.partnersRepository.create(createPartnerDto);
    return this.partnersRepository.save(partner);
  }

  async findAll(filterDto: FilterPartnersDto): Promise<{ data: Partner[]; total: number; page: number; limit: number }> {
    const { page = 1, limit = 10, search, partnershipType, isActive, isFeatured, location, sortBy = 'sortOrder', sortOrder = 'ASC' } = filterDto;
    
    const queryBuilder = this.partnersRepository.createQueryBuilder('partner');

    // Apply filters
    if (search) {
      queryBuilder.andWhere(
        '(partner.name ILIKE :search OR partner.description ILIKE :search OR partner.achievements ILIKE :search)',
        { search: `%${search}%` }
      );
    }

    if (partnershipType) {
      queryBuilder.andWhere('partner.partnershipType = :partnershipType', { partnershipType });
    }

    if (typeof isActive === 'boolean') {
      queryBuilder.andWhere('partner.isActive = :isActive', { isActive });
    }

    if (typeof isFeatured === 'boolean') {
      queryBuilder.andWhere('partner.isFeatured = :isFeatured', { isFeatured });
    }

    if (location) {
      queryBuilder.andWhere('partner.location ILIKE :location', { location: `%${location}%` });
    }

    // Apply sorting - handle special field names
    const orderField = sortBy === 'createdAt' ? 'partner.created_at' : `partner.${sortBy}`;
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

  async findActive(): Promise<Partner[]> {
    return this.partnersRepository.find({
      where: { isActive: true },
      order: { sortOrder: 'ASC', isFeatured: 'DESC', createdAt: 'DESC' },
    });
  }

  async findFeatured(): Promise<Partner[]> {
    return this.partnersRepository.find({
      where: { isActive: true, isFeatured: true },
      order: { sortOrder: 'ASC', createdAt: 'DESC' },
    });
  }

  async findByType(partnershipType: string): Promise<Partner[]> {
    return this.partnersRepository.find({
      where: { isActive: true, partnershipType },
      order: { sortOrder: 'ASC', isFeatured: 'DESC', createdAt: 'DESC' },
    });
  }

  async findOne(id: string): Promise<Partner> {
    const partner = await this.partnersRepository.findOne({ where: { id } });
    if (!partner) {
      throw new NotFoundException('Partner not found');
    }
    return partner;
  }

  async update(id: string, updatePartnerDto: UpdatePartnerDto): Promise<Partner> {
    await this.partnersRepository.update(id, updatePartnerDto);
    const updatedPartner = await this.findOne(id);
    return updatedPartner;
  }

  async remove(id: string): Promise<void> {
    const partner = await this.findOne(id);
    await this.partnersRepository.remove(partner);
  }

  async toggleStatus(id: string): Promise<Partner> {
    const partner = await this.findOne(id);
    partner.isActive = !partner.isActive;
    return this.partnersRepository.save(partner);
  }

  async toggleFeatured(id: string): Promise<Partner> {
    const partner = await this.findOne(id);
    partner.isFeatured = !partner.isFeatured;
    return this.partnersRepository.save(partner);
  }
}