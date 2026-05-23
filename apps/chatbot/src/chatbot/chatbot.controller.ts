import {
  Controller,
  Get,
  Post,
  Patch,
  Body,
  Param,
  UseGuards,
  Req,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation, ApiHeader } from '@nestjs/swagger';
import { Request } from 'express';
import { ChatbotService } from './chatbot.service';
import {
  SendMessageDto,
  CreateSessionDto,
  UpdateChatbotConfigDto,
  MessageFeedbackDto,
  StreamMessageDto,
} from './dto/chatbot.dto';
import { JwtAuthWithOrgGuard } from '../auth/guards/jwt-auth-with-org.guard';

interface AuthenticatedRequest extends Request {
  user: {
    id: string;
    email: string;
    firstName: string;
    lastName: string;
    role: string;
    organizationId: string;
    orgRole?: string;
    tier?: string;
  };
  organizationId?: string;  // Set by JwtAuthWithOrgGuard from header (for superadmin cross-org access)
}

@ApiTags('chatbot')
@Controller('chatbot')
@UseGuards(JwtAuthWithOrgGuard)
@ApiBearerAuth()
export class ChatbotController {
  constructor(private chatbotService: ChatbotService) {}

  // Helper to get organization ID (supports both user context and header context for superadmins)
  private getOrgId(req: AuthenticatedRequest): string {
    // For superadmins accessing via header, use request.organizationId
    // For regular users, use user.organizationId
    return (req as any).organizationId || req.user.organizationId;
  }

  @Post('sessions')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Create a new chat session' })
  @ApiHeader({ name: 'x-organization-id', required: true })
  async createSession(
    @Body() dto: CreateSessionDto,
    @Req() req: AuthenticatedRequest,
  ) {
    const orgId = this.getOrgId(req);
    const userContext = {
      email: req.user.email,
      firstName: req.user.firstName,
      lastName: req.user.lastName,
      role: req.user.role,
      orgRole: (req as any).userOrgRole || req.user.orgRole,
      tier: req.user.tier,
    };

    return this.chatbotService.createSession(
      req.user.id,
      orgId,
      dto,
      userContext,
    );
  }

  @Get('sessions/:sessionId')
  @ApiOperation({ summary: 'Get session info' })
  @ApiHeader({ name: 'x-organization-id', required: true })
  async getSession(@Param('sessionId') sessionId: string, @Req() req: AuthenticatedRequest) {
    return this.chatbotService.getSession(sessionId, req.user.id, this.getOrgId(req));
  }

  @Get('sessions/:sessionId/messages')
  @ApiOperation({ summary: 'Get session with messages' })
  @ApiHeader({ name: 'x-organization-id', required: true })
  async getSessionWithMessages(
    @Param('sessionId') sessionId: string,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.chatbotService.getSessionWithMessages(sessionId, req.user.id, this.getOrgId(req));
  }

  @Post('sessions/:sessionId/messages')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Send a message and get AI response' })
  @ApiHeader({ name: 'x-organization-id', required: true })
  async sendMessage(
    @Param('sessionId') sessionId: string,
    @Body() dto: SendMessageDto,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.chatbotService.processMessage(
      sessionId,
      req.user.id,
      this.getOrgId(req),
      dto,
    );
  }

  @Post('sessions/:sessionId/close')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Close a chat session' })
  @ApiHeader({ name: 'x-organization-id', required: true })
  async closeSession(@Param('sessionId') sessionId: string, @Req() req: AuthenticatedRequest) {
    return this.chatbotService.closeSession(sessionId, req.user.id, this.getOrgId(req));
  }

  @Post('messages/:messageId/feedback')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Submit feedback for a message' })
  @ApiHeader({ name: 'x-organization-id', required: true })
  async submitFeedback(
    @Param('messageId') messageId: string,
    @Body() dto: MessageFeedbackDto,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.chatbotService.submitFeedback(messageId, this.getOrgId(req), dto);
  }

  @Get('config')
  @ApiOperation({ summary: 'Get chatbot configuration' })
  @ApiHeader({ name: 'x-organization-id', required: true })
  async getConfig(@Req() req: AuthenticatedRequest) {
    return this.chatbotService.getConfig(this.getOrgId(req));
  }

  @Patch('config')
  @ApiOperation({ summary: 'Update chatbot configuration' })
  @ApiHeader({ name: 'x-organization-id', required: true })
  async updateConfig(
    @Body() dto: UpdateChatbotConfigDto,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.chatbotService.updateConfig(this.getOrgId(req), dto);
  }

  @Get('status')
  @ApiOperation({ summary: 'Check if AI chatbot is enabled' })
  @ApiHeader({ name: 'x-organization-id', required: true })
  async getStatus(@Req() req: AuthenticatedRequest) {
    const orgId = this.getOrgId(req);

    // Check if organization context exists
    if (!orgId) {
      return {
        aiEnabled: false,
        aiModel: null,
        error: 'No organization context',
      };
    }

    const isEnabled = await this.chatbotService.isAIEnabled(orgId);
    const aiModel = await this.chatbotService.getAIModel(orgId);

    return {
      aiEnabled: isEnabled,
      aiModel,
    };
  }
}