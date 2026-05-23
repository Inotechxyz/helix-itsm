import { Module } from '@nestjs/common';
import { ChangesController } from './changes.controller';
import { ChangesService } from './changes.service';
import { ChangeCategoriesController } from './change-categories.controller';
import { ChangeCategoriesService } from './change-categories.service';
import { CacheModule } from '../cache/cache.module';
import { AuthModule } from '../auth/auth.module';
import { LicenseModule } from '../license/license.module';

@Module({
  imports: [CacheModule, AuthModule, LicenseModule],
  controllers: [ChangesController, ChangeCategoriesController],
  providers: [ChangesService, ChangeCategoriesService],
  exports: [ChangesService, ChangeCategoriesService],
})
export class ChangesModule {}