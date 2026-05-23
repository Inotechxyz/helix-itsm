import { Injectable, BadRequestException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../common/prisma.service';
import { v4 as uuidv4 } from 'uuid';
import * as fs from 'fs';
import * as path from 'path';
import { S3Client, PutObjectCommand, GetObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';

export interface UploadedFile {
  id: string;
  filename: string;
  originalName: string;
  fileSize: number;
  mimeType: string;
  url: string;
  storagePath: string;
}

@Injectable()
export class StorageService {
  private storageType: 'local' | 's3' | 'azure';
  private localPath: string;

  // S3 client
  private s3Client!: S3Client;
  private s3Bucket: string;
  private s3Region: string;
  private s3Prefix: string;

  constructor(
    private prisma: PrismaService,
    private config: ConfigService,
  ) {
    this.storageType = this.config.get<'local' | 's3' | 'azure'>('STORAGE_TYPE', 'local');
    this.localPath = this.config.get('STORAGE_LOCAL_PATH', './uploads');

    // Initialize S3 client
    this.s3Region = this.config.get('AWS_REGION', 'us-east-1');
    this.s3Bucket = this.config.get('AWS_S3_BUCKET', '');
    this.s3Prefix = this.config.get('AWS_S3_PREFIX', '');

    if (this.storageType === 's3') {
      this.s3Client = new S3Client({
        region: this.s3Region,
        credentials: {
          accessKeyId: this.config.get('AWS_ACCESS_KEY_ID', ''),
          secretAccessKey: this.config.get('AWS_SECRET_ACCESS_KEY', ''),
        },
      });
    }
  }

  async uploadFile(
    file: Express.Multer.File,
    ticketId: string,
    userId: string,
    description?: string,
  ): Promise<UploadedFile> {
    if (!file) {
      throw new BadRequestException('No file provided');
    }

    const { originalname, size, mimetype, buffer } = file;
    const id = uuidv4();
    const ext = path.extname(originalname);
    const storedFilename = `${id}${ext}`;
    // Relative path for database storage (ticketId/filename)
    const relativePath = path.posix.join(ticketId, storedFilename);
    // Full S3 path with prefix: ticket-attachments/ticketId/filename
    const s3Key = this.s3Prefix
      ? path.posix.join(this.s3Prefix, relativePath)
      : relativePath;

    // Upload based on storage type
    if (this.storageType === 's3') {
      await this.uploadToS3(buffer, s3Key, mimetype);
    } else if (this.storageType === 'local') {
      const fullPath = path.join(this.localPath, ticketId);
      if (!fs.existsSync(fullPath)) {
        fs.mkdirSync(fullPath, { recursive: true });
      }
      fs.writeFileSync(path.join(fullPath, storedFilename), buffer);
    }

    // Generate URL (with S3 prefix included)
    // Note: We pass relativePath, NOT s3Key, because getFileUrl will add the prefix
    const url = this.getFileUrl(relativePath);

    // Save to database with relative path (without prefix) for compatibility
    const attachment = await this.prisma.attachment.create({
      data: {
        ticketId,
        uploadedById: userId,
        filename: storedFilename,
        originalName: originalname,
        fileSize: size,
        mimeType: mimetype,
        storagePath: relativePath,
        url,
        description,
      },
    });

    return {
      id: attachment.id,
      filename: attachment.filename,
      originalName: attachment.originalName,
      fileSize: attachment.fileSize,
      mimeType: attachment.mimeType,
      url: attachment.url,
      storagePath: attachment.storagePath,
    };
  }

  private async uploadToS3(buffer: Buffer, key: string, contentType: string): Promise<void> {
    const command = new PutObjectCommand({
      Bucket: this.s3Bucket,
      Key: key,
      Body: buffer,
      ContentType: contentType,
    });

    await this.s3Client.send(command);
  }

  async deleteFile(attachmentId: string, userId: string): Promise<void> {
    const attachment = await this.prisma.attachment.findUnique({
      where: { id: attachmentId },
    });

    if (!attachment) {
      throw new BadRequestException('Attachment not found');
    }

    // Note: We only delete the database record, not the actual file from storage.
    // This is intentional to preserve audit trail and in case files need to be recovered.
    // The actual file cleanup can be handled by a separate process or S3 lifecycle rules.

    // Delete from database only
    await this.prisma.attachment.delete({
      where: { id: attachmentId },
    });
  }

  async getFile(attachmentId: string): Promise<{ file: Express.Multer.File; attachment: any }> {
    const attachment = await this.prisma.attachment.findUnique({
      where: { id: attachmentId },
    });

    if (!attachment) {
      throw new BadRequestException('Attachment not found');
    }

    let fileBuffer: Buffer;
    // Full S3 key with prefix
    const s3Key = this.s3Prefix
      ? path.posix.join(this.s3Prefix, attachment.storagePath)
      : attachment.storagePath;

    if (this.storageType === 's3') {
      fileBuffer = await this.getFromS3(s3Key);
    } else if (this.storageType === 'local') {
      const fullPath = path.join(this.localPath, attachment.storagePath);
      fileBuffer = fs.readFileSync(fullPath);
    } else {
      throw new BadRequestException('Cloud storage not implemented');
    }

    return {
      file: {
        buffer: fileBuffer,
        originalname: attachment.originalName,
        mimetype: attachment.mimeType,
        size: attachment.fileSize,
      } as Express.Multer.File,
      attachment,
    };
  }

  private async getFromS3(key: string): Promise<Buffer> {
    const command = new GetObjectCommand({
      Bucket: this.s3Bucket,
      Key: key,
    });

    const response = await this.s3Client.send(command);

    if (!response.Body) {
      throw new BadRequestException('Failed to download file from S3');
    }

    // Convert the streamed body to a Buffer
    const chunks: Uint8Array[] = [];
    for await (const chunk of response.Body as any) {
      chunks.push(chunk);
    }

    return Buffer.concat(chunks);
  }

  async getTicketAttachments(ticketId: string) {
    return this.prisma.attachment.findMany({
      where: { ticketId },
      include: {
        uploadedBy: {
          select: { id: true, firstName: true, lastName: true },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  private getFileUrl(storagePath: string): string {
    if (this.storageType === 'local') {
      // Return API endpoint URL for local storage
      return `/v1/storage/download/${storagePath}`;
    } else if (this.storageType === 's3') {
      // For S3, return the S3 URL directly with prefix
      // The full S3 key is: prefix/ticketId/filename
      const fullS3Key = this.s3Prefix
        ? `${this.s3Prefix}/${storagePath}`
        : storagePath;
      return `https://${this.s3Bucket}.s3.${this.s3Region}.amazonaws.com/${fullS3Key}`;
    } else {
      const container = this.config.get('AZURE_STORAGE_CONTAINER');
      return `https://${this.config.get('AZURE_STORAGE_ACCOUNT')}.blob.core.windows.net/${container}/${storagePath}`;
    }
  }

  /**
   * Generate a pre-signed URL for downloading a file from S3
   * This is useful for private S3 buckets
   */
  async getPresignedDownloadUrl(storagePath: string, expiresIn = 3600): Promise<string> {
    if (this.storageType !== 's3') {
      throw new BadRequestException('Pre-signed URLs are only available for S3 storage');
    }

    // Full S3 key with prefix
    const s3Key = this.s3Prefix
      ? path.posix.join(this.s3Prefix, storagePath)
      : storagePath;

    const command = new GetObjectCommand({
      Bucket: this.s3Bucket,
      Key: s3Key,
    });

    return getSignedUrl(this.s3Client, command, { expiresIn });
  }

  /**
   * Upload file for chatbot - creates temporary attachment without ticket
   * The attachment can later be linked to a ticket or knowledge base article
   */
  async uploadFileForChatbot(
    file: Express.Multer.File,
    userId: string,
    organizationId: string,
  ): Promise<UploadedFile> {
    if (!file) {
      throw new BadRequestException('No file provided');
    }

    const { originalname, size, mimetype, buffer } = file;
    const id = uuidv4();
    const ext = path.extname(originalname);
    const storedFilename = `${id}${ext}`;
    // Use 'chatbot' as a placeholder for ticketId (no ticket yet)
    const relativePath = path.posix.join('chatbot', storedFilename);
    // Full S3 path with prefix
    const s3Key = this.s3Prefix
      ? path.posix.join(this.s3Prefix, relativePath)
      : relativePath;

    // Upload based on storage type
    if (this.storageType === 's3') {
      await this.uploadToS3(buffer, s3Key, mimetype);
    } else if (this.storageType === 'local') {
      const fullPath = path.join(this.localPath, 'chatbot');
      if (!fs.existsSync(fullPath)) {
        fs.mkdirSync(fullPath, { recursive: true });
      }
      fs.writeFileSync(path.join(fullPath, storedFilename), buffer);
    }

    // Generate URL
    const url = this.getFileUrl(relativePath);

    // Save to database with special marker for chatbot attachments
    // ticketId will remain undefined until linked to a ticket or KB article
    const attachment = await this.prisma.attachment.create({
      data: {
        uploadedById: userId,
        filename: storedFilename,
        originalName: originalname,
        fileSize: size,
        mimeType: mimetype,
        storagePath: relativePath,
        url,
        description: 'Chatbot attachment',
      },
    });

    return {
      id: attachment.id,
      filename: attachment.filename,
      originalName: attachment.originalName,
      fileSize: attachment.fileSize,
      mimeType: attachment.mimeType,
      url: attachment.url,
      storagePath: attachment.storagePath,
    };
  }

  /**
   * Link an existing attachment to a ticket
   * This is used by the chatbot to attach uploaded files to tickets
   */
  async linkAttachmentToTicket(
    ticketId: string,
    attachmentId: string,
    userId: string,
    description?: string,
  ): Promise<{ success: boolean; message: string }> {
    const attachment = await this.prisma.attachment.findUnique({
      where: { id: attachmentId },
    });

    if (!attachment) {
      throw new BadRequestException('Attachment not found');
    }

    // Update the attachment to link to the ticket
    await this.prisma.attachment.update({
      where: { id: attachmentId },
      data: {
        ticketId,
        description: description || attachment.description,
      },
    });

    return {
      success: true,
      message: 'Attachment linked to ticket successfully',
    };
  }
}
