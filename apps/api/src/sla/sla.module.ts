import { Module } from '@nestjs/common';
import { SlaController } from './sla.controller';
import { SlaService } from './sla.service';
import { AuthModule } from '../auth/auth.module';
import { LicenseModule } from '../license/license.module';

@Module({
  imports: [AuthModule, LicenseModule],
  controllers: [SlaController],
  providers: [SlaService],
  exports: [SlaService],
})
export class SlaModule {}
