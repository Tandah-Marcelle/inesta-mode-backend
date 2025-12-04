import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Like, Between } from 'typeorm';
import { ContactMessage, MessageStatus, MessagePriority } from '../entities/contact-message.entity';
import { CreateContactMessageDto } from './dto/create-contact-message.dto';
import { UpdateContactMessageDto } from './dto/update-contact-message.dto';
import { QueryContactMessagesDto } from './dto/query-contact-messages.dto';

export interface MessageStats {
  total: number;
  unread: number;
  read: number;
  replied: number;
  urgent: number;
  todayCount: number;
  weekCount: number;
  monthCount: number;
}

export interface PaginatedMessages {
  data: ContactMessage[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

@Injectable()
export class ContactMessagesService {
  constructor(
    @InjectRepository(ContactMessage)
    private readonly contactMessageRepository: Repository<ContactMessage>,
  ) {}

  async create(createContactMessageDto: CreateContactMessageDto, ipAddress?: string, userAgent?: string): Promise<ContactMessage> {
    const contactMessage = this.contactMessageRepository.create({
      ...createContactMessageDto,
      ipAddress,
      userAgent,
    });

    return await this.contactMessageRepository.save(contactMessage);
  }

  async findAll(queryDto: QueryContactMessagesDto): Promise<PaginatedMessages> {
    const {
      page = 1,
      limit = 15,
      status,
      priority,
      search,
      sortBy = 'createdAt',
      sortOrder = 'DESC',
      dateFrom,
      dateTo,
    } = queryDto;

    const queryBuilder = this.contactMessageRepository
      .createQueryBuilder('message')
      .skip((page - 1) * limit)
      .take(limit)
      .orderBy(`message.${sortBy}`, sortOrder);

    // Apply filters
    if (status) {
      queryBuilder.andWhere('message.status = :status', { status });
    }

    if (priority) {
      queryBuilder.andWhere('message.priority = :priority', { priority });
    }

    if (search) {
      queryBuilder.andWhere(
        '(message.firstName ILIKE :search OR message.lastName ILIKE :search OR message.email ILIKE :search OR message.subject ILIKE :search OR message.message ILIKE :search)',
        { search: `%${search}%` }
      );
    }

    if (dateFrom) {
      queryBuilder.andWhere('message.createdAt >= :dateFrom', { dateFrom });
    }

    if (dateTo) {
      queryBuilder.andWhere('message.createdAt <= :dateTo', { dateTo });
    }

    const [data, total] = await queryBuilder.getManyAndCount();
    const totalPages = Math.ceil(total / limit);

    return {
      data,
      total,
      page,
      limit,
      totalPages,
    };
  }

  async findOne(id: string): Promise<ContactMessage> {
    const contactMessage = await this.contactMessageRepository.findOne({
      where: { id },
    });

    if (!contactMessage) {
      throw new NotFoundException(`Contact message with ID ${id} not found`);
    }

    return contactMessage;
  }

  async update(id: string, updateContactMessageDto: UpdateContactMessageDto): Promise<ContactMessage> {
    const contactMessage = await this.findOne(id);

    // Update timestamps based on status changes
    if (updateContactMessageDto.status) {
      if (updateContactMessageDto.status === MessageStatus.READ && !contactMessage.readAt) {
        updateContactMessageDto['readAt'] = new Date();
      }
      if (updateContactMessageDto.status === MessageStatus.REPLIED && !contactMessage.repliedAt) {
        updateContactMessageDto['repliedAt'] = new Date();
      }
    }

    Object.assign(contactMessage, updateContactMessageDto);
    return await this.contactMessageRepository.save(contactMessage);
  }

  async remove(id: string): Promise<void> {
    const contactMessage = await this.findOne(id);
    await this.contactMessageRepository.remove(contactMessage);
  }

  async bulkUpdate(ids: string[], updateData: UpdateContactMessageDto): Promise<ContactMessage[]> {
    const messages = await this.contactMessageRepository.findByIds(ids);
    
    if (messages.length === 0) {
      throw new NotFoundException('No messages found with the provided IDs');
    }

    // Update timestamps based on status changes
    const updateObject = { ...updateData };
    if (updateData.status === MessageStatus.READ) {
      updateObject['readAt'] = new Date();
    }
    if (updateData.status === MessageStatus.REPLIED) {
      updateObject['repliedAt'] = new Date();
    }

    await this.contactMessageRepository.update({ id: { $in: ids } as any }, updateObject);
    
    return await this.contactMessageRepository.findByIds(ids);
  }

  async markAsRead(id: string): Promise<ContactMessage> {
    return await this.update(id, { status: MessageStatus.READ });
  }

  async markAsReplied(id: string, adminNotes?: string): Promise<ContactMessage> {
    return await this.update(id, { 
      status: MessageStatus.REPLIED,
      adminNotes,
    });
  }

  async setPriority(id: string, priority: MessagePriority): Promise<ContactMessage> {
    return await this.update(id, { priority });
  }

  async getStats(): Promise<MessageStats> {
    const total = await this.contactMessageRepository.count();
    const unread = await this.contactMessageRepository.count({ 
      where: { status: MessageStatus.UNREAD } 
    });
    const read = await this.contactMessageRepository.count({ 
      where: { status: MessageStatus.READ } 
    });
    const replied = await this.contactMessageRepository.count({ 
      where: { status: MessageStatus.REPLIED } 
    });
    const urgent = await this.contactMessageRepository.count({ 
      where: { priority: MessagePriority.URGENT } 
    });

    // Today's count
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);
    
    const todayCount = await this.contactMessageRepository.count({
      where: {
        createdAt: Between(today, tomorrow),
      },
    });

    // Week's count
    const weekStart = new Date(today);
    weekStart.setDate(today.getDate() - today.getDay());
    const weekEnd = new Date(weekStart);
    weekEnd.setDate(weekStart.getDate() + 7);

    const weekCount = await this.contactMessageRepository.count({
      where: {
        createdAt: Between(weekStart, weekEnd),
      },
    });

    // Month's count
    const monthStart = new Date(today.getFullYear(), today.getMonth(), 1);
    const monthEnd = new Date(today.getFullYear(), today.getMonth() + 1, 1);

    const monthCount = await this.contactMessageRepository.count({
      where: {
        createdAt: Between(monthStart, monthEnd),
      },
    });

    return {
      total,
      unread,
      read,
      replied,
      urgent,
      todayCount,
      weekCount,
      monthCount,
    };
  }

  async exportToCSV(queryDto: QueryContactMessagesDto): Promise<string> {
    const { data } = await this.findAll({ ...queryDto, limit: 10000 }); // Get all records for export
    
    const headers = [
      'ID',
      'First Name',
      'Last Name', 
      'Email',
      'Phone',
      'Company',
      'Subject',
      'Message',
      'Status',
      'Priority',
      'Source',
      'Created At',
      'Read At',
      'Replied At',
    ];

    const rows = data.map(message => [
      message.id,
      message.firstName,
      message.lastName,
      message.email,
      message.phone || '',
      message.company || '',
      message.subject,
      `"${message.message.replace(/"/g, '""')}"`, // Escape quotes
      message.status,
      message.priority,
      message.source,
      message.createdAt.toISOString(),
      message.readAt?.toISOString() || '',
      message.repliedAt?.toISOString() || '',
    ]);

    const csvContent = [
      headers.join(','),
      ...rows.map(row => row.join(','))
    ].join('\n');

    return csvContent;
  }
}