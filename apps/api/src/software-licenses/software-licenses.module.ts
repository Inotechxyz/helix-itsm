import { Module } from '@nestjs/common';
import { SoftwareLicensesController } from './software-licenses.controller';
import { SoftwareLicensesService } from './software-licenses.service';
import { AuthModule } from '../auth/auth.module';
import { LicenseModule } from '../license/license.module';

@Module({
  imports: [AuthModule, LicenseModule],
  controllers: [SoftwareLicensesController],
  providers: [SoftwareLicensesService],
  exports: [SoftwareLicensesService],
})
export class SoftwareLicensesModule {}
