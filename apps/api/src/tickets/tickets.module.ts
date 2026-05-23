import { Module } from '@nestjs/common';
import { TicketsController } from './tickets.controller';
import { TicketsService } from './tickets.service';
import { SlaModule } from '../sla/sla.module';
import { EmailModule } from '../email/email.module';
import { AuthModule } from '../auth/auth.module';
import { LicenseModule } from '../license/license.module';

@Module({
  imports: [SlaModule, EmailModule, AuthModule, LicenseModule],
  controllers: [TicketsController],
  providers: [TicketsService],
  exports: [TicketsService],
})
export class TicketsModule {}
