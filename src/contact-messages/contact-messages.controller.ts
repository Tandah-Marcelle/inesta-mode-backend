import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  Req,
  Res,
  HttpCode,
  HttpStatus,
  ValidationPipe,
  UsePipes,
} from '@nestjs/common';
import { Request, Response } from 'express';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PermissionsGuard } from '../auth/guards/permissions.guard';
import { RequirePermissions, Permission } from '../auth/decorators/permissions.decorator';
import { ContactMessagesService } from './contact-messages.service';
import { CreateContactMessageDto } from './dto/create-contact-message.dto';
import { UpdateContactMessageDto } from './dto/update-contact-message.dto';
import { QueryContactMessagesDto } from './dto/query-contact-messages.dto';

@Controller()
export class ContactMessagesController {
  constructor(
    private readonly contactMessagesService: ContactMessagesService,
  ) {}

  // Public endpoint for contact form submissions
  @Post('contact/submit')
  @HttpCode(HttpStatus.CREATED)
  @UsePipes(new ValidationPipe({ transform: true }))
  async submitContactForm(
    @Body() createContactMessageDto: CreateContactMessageDto,
    @Req() request: Request,
  ) {
    const ipAddress = (request.ip || 
      request.connection?.remoteAddress || 
      request.headers['x-forwarded-for'] as string ||
      request.headers['x-real-ip'] as string
    )?.split(',')[0]?.trim();
    
    const userAgent = request.headers['user-agent'];

    const message = await this.contactMessagesService.create(
      createContactMessageDto,
      ipAddress,
      userAgent,
    );

    return {
      success: true,
      message: 'Your message has been sent successfully. We will get back to you soon!',
      data: {
        id: message.id,
        createdAt: message.createdAt,
      },
    };
  }

  // Admin endpoints (require authentication)
  @Get('messages')
  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @RequirePermissions(Permission('contact_messages', 'view'))
  @UsePipes(new ValidationPipe({ transform: true }))
  async findAll(@Query() queryDto: QueryContactMessagesDto) {
    return await this.contactMessagesService.findAll(queryDto);
  }

  @Get('messages/stats')
  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @RequirePermissions(Permission('contact_messages', 'view'))
  async getStats() {
    return await this.contactMessagesService.getStats();
  }

  @Get('messages/export')
  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @RequirePermissions(Permission('contact_messages', 'view'))
  @UsePipes(new ValidationPipe({ transform: true }))
  async exportMessages(
    @Query() queryDto: QueryContactMessagesDto,
    @Res() response: Response,
  ) {
    const csvContent = await this.contactMessagesService.exportToCSV(queryDto);
    const filename = `contact-messages-${new Date().toISOString().split('T')[0]}.csv`;
    
    response.setHeader('Content-Type', 'text/csv');
    response.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    response.send(csvContent);
  }

  @Get('messages/:id')
  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @RequirePermissions(Permission('contact_messages', 'view'))
  async findOne(@Param('id') id: string) {
    return await this.contactMessagesService.findOne(id);
  }

  @Patch('messages/:id')
  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @RequirePermissions(Permission('contact_messages', 'update'))
  @UsePipes(new ValidationPipe({ transform: true }))
  async update(
    @Param('id') id: string,
    @Body() updateContactMessageDto: UpdateContactMessageDto,
  ) {
    return await this.contactMessagesService.update(id, updateContactMessageDto);
  }

  @Delete('messages/:id')
  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @RequirePermissions(Permission('contact_messages', 'delete'))
  @HttpCode(HttpStatus.NO_CONTENT)
  async remove(@Param('id') id: string) {
    await this.contactMessagesService.remove(id);
  }

  @Patch('messages/bulk-update')
  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @RequirePermissions(Permission('contact_messages', 'update'))
  @UsePipes(new ValidationPipe({ transform: true }))
  async bulkUpdate(
    @Body() body: { ids: string[] } & UpdateContactMessageDto,
  ) {
    const { ids, ...updateData } = body;
    return await this.contactMessagesService.bulkUpdate(ids, updateData);
  }

  // Convenience endpoints
  @Patch('messages/:id/mark-read')
  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @RequirePermissions(Permission('contact_messages', 'update'))
  async markAsRead(@Param('id') id: string) {
    return await this.contactMessagesService.markAsRead(id);
  }

  @Patch('messages/:id/mark-replied')
  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @RequirePermissions(Permission('contact_messages', 'update'))
  @UsePipes(new ValidationPipe({ transform: true }))
  async markAsReplied(
    @Param('id') id: string,
    @Body() body: { adminNotes?: string },
  ) {
    return await this.contactMessagesService.markAsReplied(id, body.adminNotes);
  }

  @Patch('messages/:id/priority')
  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @RequirePermissions(Permission('contact_messages', 'update'))
  @UsePipes(new ValidationPipe({ transform: true }))
  async setPriority(
    @Param('id') id: string,
    @Body() body: { priority: string },
  ) {
    return await this.contactMessagesService.setPriority(id, body.priority as any);
  }
}