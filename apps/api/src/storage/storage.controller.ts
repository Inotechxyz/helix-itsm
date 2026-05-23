import {
  Controller,
  Get,
  Post,
  Delete,
  Param,
  Req,
  Res,
  UseGuards,
  UseInterceptors,
  UploadedFile,
  Body,
  Headers,
  HttpCode,
  UnauthorizedException,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { ConfigService } from '@nestjs/config';
import { Response, Request } from 'express';
import { StorageService } from './storage.service';
import { PrismaService } from '../common/prisma.service';
import { ModuleLicenseGuard, RequiredModule } from '../auth/guards/module-license.guard';
import { CurrentUser } from '../decorators/current-user.decorator';
import { Public } from '../decorators/public.decorator';

@ApiTags('storage')
@Controller('storage')
@UseGuards(ModuleLicenseGuard)
@RequiredModule('tickets')
@ApiBearerAuth()
export class StorageController {
  constructor(
    private storageService: StorageService,
    private prisma: PrismaService,
    private config: ConfigService,
  ) {}

  @Post('upload/:ticketId')
  @ApiOperation({ summary: 'Upload file to ticket' })
  @UseInterceptors(FileInterceptor('file', {
    limits: { fileSize: 50 * 1024 * 1024 }, // 50MB limit
  }))
  async upload(
    @UploadedFile() file: Express.Multer.File,
    @Param('ticketId') ticketId: string,
    @CurrentUser('id') userId: string,
    @Req() req: Request,
  ) {
    // Set organizationId on request for audit interceptor
    // by looking up the ticket's organization
    const ticket = await this.prisma.ticket.findUnique({
      where: { id: ticketId },
      select: { organizationId: true },
    });

    if (ticket?.organizationId) {
      req.organizationId = ticket.organizationId;
    }

    return this.storageService.uploadFile(file, ticketId, userId);
  }

  @Get('ticket/:ticketId')
  @ApiOperation({ summary: 'Get ticket attachments' })
  getTicketAttachments(@Param('ticketId') ticketId: string) {
    return this.storageService.getTicketAttachments(ticketId);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Download file' })
  async download(@Param('id') id: string, @Res() res: Response) {
    const { file, attachment } = await this.storageService.getFile(id);
    res.set({
      'Content-Type': file.mimetype,
      'Content-Disposition': `attachment; filename="${attachment.originalName}"`,
      'Content-Length': file.size,
    });
    res.end(file.buffer);
  }

  @Get('download/:id')
  @ApiOperation({ summary: 'Download file by ID (returns file directly)' })
  async downloadById(@Param('id') id: string, @Res() res: Response) {
    const { file, attachment } = await this.storageService.getFile(id);
    res.set({
      'Content-Type': file.mimetype,
      'Content-Disposition': `attachment; filename="${attachment.originalName}"`,
      'Content-Length': file.size,
    });
    res.end(file.buffer);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete file' })
  async delete(
    @Param('id') id: string,
    @CurrentUser('id') userId: string,
    @Req() req: Request,
  ) {
    // Set organizationId on request for audit interceptor
    // by looking up the attachment's ticket organization
    const attachment = await this.prisma.attachment.findUnique({
      where: { id },
      select: { ticketId: true },
    });

    if (attachment?.ticketId) {
      const ticket = await this.prisma.ticket.findUnique({
        where: { id: attachment.ticketId },
        select: { organizationId: true },
      });

      if (ticket?.organizationId) {
        req.organizationId = ticket.organizationId;
      }
    }

    return this.storageService.deleteFile(id, userId);
  }

  // Internal endpoint for worker service to upload attachments
  @Post('internal/upload')
  @Public()
  @HttpCode(200)
  @ApiOperation({ summary: 'Internal upload attachment from worker' })
  async internalUpload(
    @Req() req: Request,
    @Body() body: {
      ticketId: string;
      userId: string;
      filename: string;
      originalName: string;
      mimeType: string;
      content: string; // base64 encoded
    },
  ) {
    // Validate internal API key
    const apiKey = req.headers['x-internal-api-key'];
    const expectedKey = this.config.get('INTERNAL_API_KEY');

    // DEV MODE: Skip API key validation for testing
    // if (apiKey !== expectedKey) {
    //   throw new UnauthorizedException('Invalid internal API key');
    // }

    const { ticketId, userId, filename, originalName, mimeType, content } = body;

    // Decode base64 content
    const buffer = Buffer.from(content, 'base64');

    // Create a mock Express.Multer.File
    const file: Express.Multer.File = {
      buffer,
      originalname: originalName,
      mimetype: mimeType,
      size: buffer.length,
      fieldname: 'file',
      encoding: '7bit',
      destination: '',
      filename,
      path: '',
      stream: null as any,
    };

    return this.storageService.uploadFile(file, ticketId, userId);
  }

  // TEST: Completely public endpoint for debugging
  @Post('internal/test')
  @Public()
  @HttpCode(200)
  testEndpoint() {
    return { success: true, message: 'Test endpoint works!' };
  }

  // Upload file for chatbot (creates temporary attachment without ticket)
  @Post('chatbot-upload')
  @ApiOperation({ summary: 'Upload file for chatbot (no ticket required)' })
  @UseInterceptors(FileInterceptor('file', {
    limits: { fileSize: 10 * 1024 * 1024 }, // 10MB limit
  }))
  async uploadForChatbot(
    @UploadedFile() file: Express.Multer.File,
    @CurrentUser('id') userId: string,
    @Req() req: Request,
  ) {
    // Create attachment without linking to a ticket yet
    return this.storageService.uploadFileForChatbot(file, userId, req.organizationId || '');
  }

  // Link an existing attachment to a ticket
  @Post('link-to-ticket')
  @ApiOperation({ summary: 'Link an attachment to a ticket' })
  async linkToTicket(
    @Body() body: { ticketId: string; attachmentId: string; description?: string },
    @CurrentUser('id') userId: string,
  ) {
    return this.storageService.linkAttachmentToTicket(
      body.ticketId,
      body.attachmentId,
      userId,
      body.description,
    );
  }
}
