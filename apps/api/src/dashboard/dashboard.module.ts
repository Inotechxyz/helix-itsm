import { Module } from '@nestjs/common';
import { DashboardController } from './dashboard.controller';
import { TicketsModule } from '../tickets/tickets.module';

@Module({
  imports: [TicketsModule],
  controllers: [DashboardController],
})
export class DashboardModule {}