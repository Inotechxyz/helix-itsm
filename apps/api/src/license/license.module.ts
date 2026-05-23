import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { LicenseController } from './license.controller';
import { LicenseGuard } from './license.guard';
import { LicenseDatabaseAdapter, LicenseCacheAdapter } from './license-adapter';
import { LicenseService } from '@inotechxyz/protected-license';

// Re-export for backward compatibility
export { LicenseService };
export { LicenseGuard };

@Module({
  providers: [
    // Adapters for @inotechxyz/protected-license
    LicenseDatabaseAdapter,
    LicenseCacheAdapter,
    // License service from npm package
    {
      provide: LicenseService,
      useFactory: (
        config: ConfigService<Record<string | symbol, unknown>>,
        database: LicenseDatabaseAdapter,
        cache: LicenseCacheAdapter,
      ) => new LicenseService(config as any, database, cache),
      inject: [ConfigService, LicenseDatabaseAdapter, LicenseCacheAdapter],
    },
    // License guard (local implementation for API)
    LicenseGuard,
  ],
  controllers: [LicenseController],
  exports: [LicenseService],
})
export class LicenseModule {}