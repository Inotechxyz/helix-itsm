import { Module, NestModule, MiddlewareConsumer, RequestMethod } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { BullModule } from '@nestjs/bull';
import { ScheduleModule } from '@nestjs/schedule';
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler';
import { APP_GUARD, APP_INTERCEPTOR } from '@nestjs/core';
import { PrismaModule } from './common/prisma.module';
import { CacheModule } from './cache/cache.module';
import { HealthModule } from './health/health.module';
import { AuthModule } from './auth/auth.module';
import { UsersModule } from './users/users.module';
import { TeamsModule } from './teams/teams.module';
import { TicketsModule } from './tickets/tickets.module';
import { CategoriesModule } from './categories/categories.module';
import { KnowledgeBaseModule } from './knowledge-base/knowledge-base.module';
import { ServiceCatalogModule } from './service-catalog/service-catalog.module';
import { ReportsModule } from './reports/reports.module';
import { StorageModule } from './storage/storage.module';
import { EmailModule } from './email/email.module';
import { AssetsModule } from './assets/assets.module';
import { ProblemsModule } from './problems/problems.module';
import { ChangesModule } from './changes/changes.module';
import { SlaModule } from './sla/sla.module';
import { SoftwareLicensesModule } from './software-licenses/software-licenses.module';
import { LicenseModule } from './license/license.module';
import { CsatModule } from './csat/csat.module';
import { OrganizationsModule } from './organizations/organizations.module';
import { DashboardModule } from './dashboard/dashboard.module';
import { AuditModule } from './audit/audit.module';
import { AuditInterceptor } from './audit/audit.interceptor';
import { OrganizationContextGuard } from './common/organization-context.guard';

@Module({
  imports: [
    // Configuration
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: ['.env.local', '.env'],
    }),

    // Database
    PrismaModule,

    // Redis Cache (server-side caching)
    CacheModule,

    // Rate limiting - global guard (configured for 300 users)
    ThrottlerModule.forRoot([
      {
        name: 'short',
        ttl: 60000, // 1 minute
        limit: 300, // 300 requests per minute (allows 1 req/user/sec for 300 users)
      },
      {
        name: 'long',
        ttl: 3600000, // 1 hour
        limit: 15000, // 15000 requests per hour (50 req/user/hour)
      },
    ]),

    // Bull queues for background jobs
    BullModule.forRootAsync({
      imports: [ConfigModule],
      useFactory: (config: ConfigService) => ({
        redis: {
          host: config.get('REDIS_HOST', 'localhost'),
          port: config.get('REDIS_PORT', 6379),
          password: config.get('REDIS_PASSWORD'),
        },
      }),
      inject: [ConfigService],
    }),

    // Scheduled tasks
    ScheduleModule.forRoot(),

    // Feature modules
    HealthModule,
    AuthModule,
    UsersModule,
    TeamsModule,
    TicketsModule,
    CategoriesModule,
    KnowledgeBaseModule,
    ServiceCatalogModule,
    ReportsModule,
    StorageModule,
    EmailModule,
    AssetsModule,
    ProblemsModule,
    ChangesModule,
    SlaModule,
    SoftwareLicensesModule,
    LicenseModule,
    CsatModule,
    OrganizationsModule,
    DashboardModule,
    AuditModule,
    // NOTE: ChatbotModule moved to separate apps/chatbot service
  ],
  providers: [
    {
      provide: APP_GUARD,
      useClass: ThrottlerGuard,
    },
    {
      provide: APP_INTERCEPTOR,
      useClass: AuditInterceptor,
    },
  ],
})
export class AppModule {}
