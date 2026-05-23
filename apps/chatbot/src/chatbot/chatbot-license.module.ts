import { Module, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../common/prisma.service';
import { RedisCacheService } from '../common/redis-cache.service';
import { LicenseService, DatabaseAdapter } from '@inotechxyz/protected-license';

/**
 * Prisma-based Database Adapter for @inotechxyz/protected-license
 */
@Injectable()
class ChatbotLicenseDatabaseAdapter implements DatabaseAdapter {
  constructor(private prisma: PrismaService) {}

  async findOrganization(id: string): Promise<{ slug: string; licenseToken: string | null } | null> {
    const org = await this.prisma.organization.findUnique({
      where: { id },
      select: { slug: true, licenseToken: true },
    });
    return org;
  }
}

@Module({
  providers: [
    // Adapters
    ChatbotLicenseDatabaseAdapter,
    RedisCacheService,
    // License service
    {
      provide: LicenseService,
      useFactory: (
        config: ConfigService<Record<string | symbol, unknown>>,
        database: ChatbotLicenseDatabaseAdapter,
        cache: RedisCacheService,
      ) => new LicenseService(config as any, database, cache),
      inject: [ConfigService, ChatbotLicenseDatabaseAdapter, RedisCacheService],
    },
  ],
  exports: [LicenseService],
})
export class ChatbotLicenseModule {}