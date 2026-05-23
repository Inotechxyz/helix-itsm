import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PrismaService } from '../prisma.service';
import { EmailService } from './email.service';
import { NotificationType } from '@helix/shared';

@Injectable()
export class SlaService {
  private readonly logger = new Logger(SlaService.name);

  constructor(
    private prisma: PrismaService,
    private emailService: EmailService,
  ) {}

  @Cron('0 */15 * * * *')
  async checkSlaDeadlines() {
    this.logger.log('Checking SLA deadlines...');

    const now = new Date();
    const warningThreshold = new Date(now.getTime() + 30 * 60 * 1000); // 30 minutes

    // Find tickets approaching SLA deadline
    const approachingTickets = await this.prisma.ticket.findMany({
      where: {
        status: { notIn: ['resolved', 'closed'] },
        slaDeadline: {
          lte: warningThreshold,
          gt: now,
        },
        slaBreachNotified: false,
      },
      include: {
        assignedAgent: true,
        requester: true,
      },
    });

    for (const ticket of approachingTickets) {
      // Send warning notification
      if (ticket.assignedAgent?.email) {
        await this.emailService.sendEmail(
          ticket.assignedAgent.email,
          `[${ticket.ticketNumber}] SLA Warning`,
          `<h2>SLA Warning</h2>
          <p>The ticket <strong>${ticket.ticketNumber}</strong> is approaching its SLA deadline.</p>
          <p><strong>Title:</strong> ${ticket.title}</p>
          <p><strong>Deadline:</strong> ${ticket.slaDeadline?.toISOString()}</p>`,
        );
      }

      await this.prisma.ticket.update({
        where: { id: ticket.id },
        data: { slaBreachNotified: true },
      });
    }

    // Find breached tickets
    const breachedTickets = await this.prisma.ticket.findMany({
      where: {
        status: { notIn: ['resolved', 'closed'] },
        slaDeadline: { lte: now },
        slaBreached: false,
      },
      include: {
        assignedAgent: true,
        requester: true,
      },
    });

    for (const ticket of breachedTickets) {
      await this.prisma.ticket.update({
        where: { id: ticket.id },
        data: { slaBreached: true },
      });

      // Send breach notification
      if (ticket.assignedAgent?.email) {
        await this.emailService.sendEmail(
          ticket.assignedAgent.email,
          `[${ticket.ticketNumber}] SLA Breached`,
          `<h2>SLA Breached</h2>
          <p>The ticket <strong>${ticket.ticketNumber}</strong> has breached its SLA.</p>
          <p><strong>Title:</strong> ${ticket.title}</p>
          <p><strong>Deadline:</strong> ${ticket.slaDeadline?.toISOString()}</p>`,
        );
      }

      this.logger.warn(`Ticket ${ticket.ticketNumber} has breached SLA`);
    }
  }
}
