import { Injectable, BadRequestException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as path from 'path';
import * as fs from 'fs/promises';
import * as crypto from 'crypto';

export interface UploadedFile {
  originalName: string;
  filename: string;
  path: string;
  url: string;
  mimeType: string;
  size: number;
}

@Injectable()
export class UploadService {
  private readonly uploadPath: string;
  private readonly maxFileSize: number;
  private readonly allowedMimeTypes = [
    'image/jpeg',
    'image/jpg',
    'image/png',
    'image/webp',
    'image/gif'
  ];

  constructor(private readonly configService: ConfigService) {
    this.uploadPath = this.configService.get<string>('UPLOAD_DEST', './uploads');
    this.maxFileSize = this.configService.get<number>('MAX_FILE_SIZE', 5242880); // 5MB
  }

  async saveFile(file: Express.Multer.File, folder = 'images'): Promise<UploadedFile> {
    // Validate file
    this.validateFile(file);

    // Create directory if it doesn't exist
    const uploadDir = path.join(this.uploadPath, folder);
    await this.ensureDirectoryExists(uploadDir);

    // Generate unique filename
    const filename = await this.generateUniqueFilename(file.originalname);
    const filePath = path.join(uploadDir, filename);

    try {
      // Save file
      await fs.writeFile(filePath, file.buffer);

      return {
        originalName: file.originalname,
        filename,
        path: filePath,
        url: `/uploads/${folder}/${filename}`,
        mimeType: file.mimetype,
        size: file.size,
      };
    } catch (error) {
      throw new BadRequestException('Failed to save file');
    }
  }

  async saveMultipleFiles(
    files: Express.Multer.File[],
    folder = 'images'
  ): Promise<UploadedFile[]> {
    const uploadPromises = files.map(file => this.saveFile(file, folder));
    return Promise.all(uploadPromises);
  }

  async deleteFile(filePath: string): Promise<void> {
    try {
      // Convert URL to file system path
      const systemPath = filePath.startsWith('/uploads/')
        ? path.join(this.uploadPath, filePath.replace('/uploads/', ''))
        : filePath;

      await fs.unlink(systemPath);
    } catch (error) {
      // File might not exist, which is okay
      console.warn(`Could not delete file: ${filePath}`, error.message);
    }
  }

  async deleteMultipleFiles(filePaths: string[]): Promise<void> {
    const deletePromises = filePaths.map(filePath => this.deleteFile(filePath));
    await Promise.allSettled(deletePromises);
  }

  private validateFile(file: Express.Multer.File): void {
    if (!file) {
      throw new BadRequestException('No file provided');
    }

    if (file.size > this.maxFileSize) {
      throw new BadRequestException(
        `File size too large. Maximum allowed size is ${this.maxFileSize / 1024 / 1024}MB`
      );
    }

    if (!this.allowedMimeTypes.includes(file.mimetype)) {
      throw new BadRequestException(
        `Invalid file type. Allowed types: ${this.allowedMimeTypes.join(', ')}`
      );
    }
  }

  private async generateUniqueFilename(originalName: string): Promise<string> {
    const ext = path.extname(originalName);
    const name = path.basename(originalName, ext);
    const timestamp = Date.now();
    const random = crypto.randomBytes(6).toString('hex');
    
    return `${name}-${timestamp}-${random}${ext}`;
  }

  private async ensureDirectoryExists(dirPath: string): Promise<void> {
    try {
      await fs.access(dirPath);
    } catch {
      await fs.mkdir(dirPath, { recursive: true });
    }
  }

  // Utility methods for different upload types
  async uploadProductImages(files: Express.Multer.File[]): Promise<UploadedFile[]> {
    return this.saveMultipleFiles(files, 'products');
  }

  async uploadCategoryImage(file: Express.Multer.File): Promise<UploadedFile> {
    return this.saveFile(file, 'categories');
  }
}
