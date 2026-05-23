import { Controller, Get, Post, Patch, Delete, Body, Param, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { CsatService } from './csat.service';
import { JwtAuthWithOrgGuard } from '../auth/guards/jwt-auth-with-org.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../decorators/roles.decorator';
import { UserRole, CsatQuestionType } from '@prisma/client';

@ApiTags('CSAT')
@Controller('csat')
@UseGuards(JwtAuthWithOrgGuard, RolesGuard)
@ApiBearerAuth()
export class CsatController {
  constructor(private readonly csatService: CsatService) {}

  // ==================== Configuration ====================

  @Get('config')
  @Roles(UserRole.user)
  @ApiOperation({ summary: 'Get active CSAT survey configuration' })
  async getActiveConfig() {
    return this.csatService.getActiveConfig();
  }

  @Get('config/:id')
  @Roles(UserRole.user)
  @ApiOperation({ summary: 'Get CSAT survey configuration by ID' })
  async getConfig(@Param('id') id: string) {
    return this.csatService.getConfig(id);
  }

  @Get('configs')
  @Roles(UserRole.superadmin)
  @ApiOperation({ summary: 'List all CSAT survey configurations' })
  async listConfigs(
    @Query('skip') skip?: number,
    @Query('take') take?: number,
  ) {
    return this.csatService.listConfigs({ skip, take });
  }

  @Post('config')
  @Roles(UserRole.superadmin)
  @ApiOperation({ summary: 'Create a new CSAT survey configuration' })
  async createConfig(
    @Body()
    data: {
      name: string;
      description?: string;
      sendDelayHours?: number;
      reminderDelayHours?: number;
      maxReminders?: number;
      minTicketAgeHours?: number;
      requireComment?: boolean;
      questions?: {
        questionText: string;
        questionType?: CsatQuestionType;
        isRequired?: boolean;
        scaleMin?: number;
        scaleMax?: number;
        orderIndex?: number;
      }[];
    },
  ) {
    return this.csatService.createConfig(data);
  }

  @Patch('config/:id')
  @Roles(UserRole.superadmin)
  @ApiOperation({ summary: 'Update CSAT survey configuration' })
  async updateConfig(
    @Param('id') id: string,
    @Body()
    data: Partial<{
      name: string;
      description: string;
      isActive: boolean;
      sendDelayHours: number;
      reminderDelayHours: number;
      maxReminders: number;
      minTicketAgeHours: number;
      requireComment: boolean;
    }>,
  ) {
    return this.csatService.updateConfig(id, data);
  }

  // ==================== Questions ====================

  @Post('config/:configId/questions')
  @Roles(UserRole.superadmin)
  @ApiOperation({ summary: 'Add a question to a CSAT configuration' })
  async addQuestion(
    @Param('configId') configId: string,
    @Body()
    data: {
      questionText: string;
      questionType?: CsatQuestionType;
      isRequired?: boolean;
      scaleMin?: number;
      scaleMax?: number;
    },
  ) {
    return this.csatService.addQuestion(configId, data);
  }

  @Patch('questions/:questionId')
  @Roles(UserRole.superadmin)
  @ApiOperation({ summary: 'Update a CSAT question' })
  async updateQuestion(
    @Param('questionId') questionId: string,
    @Body()
    data: Partial<{
      questionText: string;
      questionType: CsatQuestionType;
      isRequired: boolean;
      scaleMin: number;
      scaleMax: number;
      orderIndex: number;
      isActive: boolean;
    }>,
  ) {
    return this.csatService.updateQuestion(questionId, data);
  }

  @Delete('questions/:questionId')
  @Roles(UserRole.superadmin)
  @ApiOperation({ summary: 'Delete a CSAT question' })
  async deleteQuestion(@Param('questionId') questionId: string) {
    return this.csatService.deleteQuestion(questionId);
  }

  // ==================== Surveys ====================

  @Get('surveys')
  @Roles(UserRole.user)
  @ApiOperation({ summary: 'List CSAT surveys' })
  async listSurveys(
    @Query('skip') skip?: number,
    @Query('take') take?: number,
    @Query('status') status?: string,
  ) {
    const where = status ? { status: status as any } : undefined;
    return this.csatService.listSurveys({ skip, take, where });
  }

  @Get('surveys/ticket/:ticketId')
  @Roles(UserRole.user)
  @ApiOperation({ summary: 'Get survey by ticket ID' })
  async getSurveyByTicket(@Param('ticketId') ticketId: string) {
    return this.csatService.getSurveyByTicket(ticketId);
  }

  @Get('surveys/:id')
  @Roles(UserRole.user)
  @ApiOperation({ summary: 'Get survey by ID' })
  async getSurveyById(@Param('id') id: string) {
    return this.csatService.getSurveyById(id);
  }

  @Post('surveys/ticket/:ticketId')
  @Roles(UserRole.superadmin)
  @ApiOperation({ summary: 'Create a survey for a ticket (admin only)' })
  async createSurvey(@Param('ticketId') ticketId: string) {
    return this.csatService.createSurvey(ticketId);
  }

  // ==================== Survey Response (Public) ====================

  @Get('respond/:surveyId')
  @ApiOperation({ summary: 'Get survey for responding (public)' })
  async getSurveyForResponse(@Param('surveyId') surveyId: string) {
    // Mark as viewed when accessed
    await this.csatService.markSurveyViewed(surveyId);
    return this.csatService.getSurveyById(surveyId);
  }

  @Post('respond/:surveyId')
  @ApiOperation({ summary: 'Submit survey response (public)' })
  async submitSurvey(
    @Param('surveyId') surveyId: string,
    @Body()
    data: {
      rating: number;
      comment?: string;
      responses?: {
        questionId: string;
        ratingValue?: number;
        textValue?: string;
      }[];
    },
  ) {
    return this.csatService.submitSurvey(surveyId, data);
  }

  @Post('ticket/:ticketId/rate')
  @ApiOperation({ summary: 'Submit survey for a ticket (creates survey if needed)' })
  async submitSurveyForTicket(
    @Param('ticketId') ticketId: string,
    @Body()
    data: {
      rating: number;
      comment?: string;
    },
  ) {
    return this.csatService.submitSurveyForTicket(ticketId, data);
  }

  @Post('opt-out/:ticketId')
  @ApiOperation({ summary: 'Opt out of survey for a ticket' })
  async optOutOfSurvey(@Param('ticketId') ticketId: string) {
    return this.csatService.optOutOfSurvey(ticketId);
  }

  // ==================== Analytics ====================

  @Get('analytics')
  @Roles(UserRole.user)
  @ApiOperation({ summary: 'Get CSAT analytics' })
  async getAnalytics(
    @Query('dateFrom') dateFrom?: string,
    @Query('dateTo') dateTo?: string,
    @Query('teamId') teamId?: string,
  ) {
    return this.csatService.getAnalytics({ dateFrom, dateTo, teamId });
  }

  @Get('dashboard')
  @Roles(UserRole.user)
  @ApiOperation({ summary: 'Get CSAT dashboard stats' })
  async getDashboardStats() {
    return this.csatService.getDashboardStats();
  }
}
