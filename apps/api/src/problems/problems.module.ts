import { Module } from '@nestjs/common';
import { ProblemsController } from './problems.controller';
import { ProblemsService } from './problems.service';
import { AuthModule } from '../auth/auth.module';
import { LicenseModule } from '../license/license.module';

@Module({
  imports: [AuthModule, LicenseModule],
  controllers: [ProblemsController],
  providers: [ProblemsService],
  exports: [ProblemsService],
})
export class ProblemsModule {}
