import { Injectable, Logger, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma.service';
import * as nodemailer from 'nodemailer';
import * as crypto from 'crypto';
import * as path from 'path';
import * as https from 'https';
import * as http from 'http';
// eslint-disable-next-line @typescript-eslint/no-var-requires
const Imap = require('imap');
import { simpleParser, ParsedMail } from 'mailparser';

interface OrganizationImapConfig {
  organizationId: string;
  organizationName: string;
  imapConfig: {
    host: string;
    port: number;
    secure: boolean;
    auth: { user: string; pass: string };
    inboxFolder: string;
  };
  smtpConfig: {
    host: string;
    port: number;
    secure: boolean;
    auth: { user: string; pass: string };
    fromAddress?: string;
    fromName?: string;
  };
}

interface ProcessedEmail {
  messageId: string;
  subject: string;
  from: string;
  ticketId?: string;
  createdAt: Date;
}

interface UploadResponse {
  id: string;
  filename: string;
  url: string;
}

@Injectable()
export class MultiOrgEmailPollerService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(MultiOrgEmailPollerService.name);

  // Configuration
  private readonly POLL_INTERVAL_MS = 60000; // Check every 60 seconds
  private readonly MAX_RECONNECT_ATTEMPTS = 10;
  private readonly BASE_RECONNECT_DELAY = 5000; // 5 seconds base delay

  // Per-organization IMAP connections
  private orgConnections: Map<string, {
    imap: InstanceType<typeof Imap>;
    transporter: nodemailer.Transporter;
    isConnected: boolean;
    reconnectAttempts: number;
    isReconnecting: boolean;
    lastProcessedDate: Date | null;
    processedEmails: Map<string, ProcessedEmail>;
    pollTimer: NodeJS.Timeout | null;
    organizationName: string;
  }> = new Map();

  // API configuration for storage
  private readonly API_URL: string;
  private readonly INTERNAL_API_KEY: string;

  // Global poll timer
  private globalPollTimer: NodeJS.Timeout | null = null;
  private isShuttingDown: boolean = false;

  // Email domain filtering
  private readonly ALLOWED_EMAIL_DOMAINS: string[];

  constructor(
    private config: ConfigService,
    private prisma: PrismaService,
  ) {
    this.API_URL = this.config.get('API_URL', 'http://localhost:3000');
    this.INTERNAL_API_KEY = this.config.get('INTERNAL_API_KEY', '');

    // Load allowed email domains configuration
    const domainsConfig = this.config.get('ALLOWED_EMAIL_DOMAINS', '');
    this.ALLOWED_EMAIL_DOMAINS = domainsConfig
      ? domainsConfig.split(',').map(d => d.trim().toLowerCase()).filter(d => d.length > 0)
      : [];
    if (this.ALLOWED_EMAIL_DOMAINS.length > 0) {
      this.logger.log(`Email domain filtering enabled. Allowed domains: ${this.ALLOWED_EMAIL_DOMAINS.join(', ')}`);
    } else {
      this.logger.log('Email domain filtering disabled. All domains are allowed.');
    }
  }

  async onModuleInit() {
    this.logger.log('Initializing Multi-Organization Email Poller Service...');
    await this.initializeAllOrganizationConnections();
    this.startGlobalPolling();
  }

  async onModuleDestroy() {
    this.isShuttingDown = true;
    this.logger.log('Shutting down Multi-Organization Email Poller...');

    // Clear global poll timer
    if (this.globalPollTimer) {
      clearInterval(this.globalPollTimer);
    }

    // Close all organization connections
    for (const [orgId, connection] of this.orgConnections.entries()) {
      if (connection.pollTimer) {
        clearInterval(connection.pollTimer);
      }
      if (connection.isConnected) {
        connection.imap.end();
      }
      this.logger.log(`Closed connection for organization: ${orgId}`);
    }

    this.orgConnections.clear();
  }

  /**
   * Get all organizations that have IMAP email settings configured
   */
  private async getOrganizationsWithImap(): Promise<OrganizationImapConfig[]> {
    const organizations = await this.prisma.organization.findMany({
      where: {
        status: 'active',
        emailSettings: {
          not: null,
        },
      },
      select: {
        id: true,
        name: true,
        emailSettings: true as any,
      },
    });

    const orgConfigs: OrganizationImapConfig[] = [];

    for (const org of organizations) {
      const emailSettings = (org as any).emailSettings as {
        imap?: {
          host?: string;
          port?: number;
          secure?: boolean;
          user?: string;
          pass?: string;
          inboxFolder?: string;
        };
        smtp?: {
          host?: string;
          port?: number;
          secure?: boolean;
          user?: string;
          pass?: string;
          fromAddress?: string;
          fromName?: string;
        };
      };

      if (emailSettings?.imap?.host && emailSettings?.imap?.user) {
        orgConfigs.push({
          organizationId: org.id,
          organizationName: org.name,
          imapConfig: {
            host: emailSettings.imap.host,
            port: emailSettings.imap.port || 993,
            secure: emailSettings.imap.secure ?? true,
            auth: {
              user: emailSettings.imap.user,
              pass: emailSettings.imap.pass || '',
            },
            inboxFolder: emailSettings.imap.inboxFolder || 'INBOX',
          },
          smtpConfig: {
            host: emailSettings.smtp?.host || '',
            port: emailSettings.smtp?.port || 587,
            secure: emailSettings.smtp?.secure ?? false,
            auth: {
              user: emailSettings.smtp?.user || '',
              pass: emailSettings.smtp?.pass || '',
            },
            fromAddress: emailSettings.smtp?.fromAddress,
            fromName: emailSettings.smtp?.fromName,
          },
        });
      }
    }

    return orgConfigs;
  }

  /**
   * Initialize IMAP connections for all organizations with email settings
   */
  private async initializeAllOrganizationConnections(): Promise<void> {
    const orgConfigs = await this.getOrganizationsWithImap();

    if (orgConfigs.length === 0) {
      this.logger.warn('No organizations found with IMAP email settings configured');
      return;
    }

    this.logger.log(`Found ${orgConfigs.length} organizations with IMAP configured`);

    for (const orgConfig of orgConfigs) {
      await this.initializeOrganizationConnection(orgConfig);
    }
  }

  /**
   * Initialize IMAP connection for a single organization
   */
  private async initializeOrganizationConnection(orgConfig: OrganizationImapConfig): Promise<void> {
    const { organizationId, imapConfig, smtpConfig } = orgConfig;

    this.logger.log(`Initializing IMAP connection for org: ${orgConfig.organizationName} (${organizationId})`);

    // Create IMAP connection
    const imap = new Imap({
      user: imapConfig.auth.user,
      password: imapConfig.auth.pass,
      host: imapConfig.host,
      port: imapConfig.port,
      tls: imapConfig.secure,
      tlsOptions: { rejectUnauthorized: false },
      connTimeout: 30000,
      authTimeout: 30000,
      keepalive: {
        interval: 30000,
        idleInterval: 30000,
        force: true,
      },
    });

    // Create SMTP transporter for this org (only if SMTP is configured)
    let transporter: nodemailer.Transporter | null = null;
    if (smtpConfig.host && smtpConfig.auth.user) {
      transporter = nodemailer.createTransport({
        host: smtpConfig.host,
        port: smtpConfig.port,
        secure: smtpConfig.secure,
        auth: {
          user: smtpConfig.auth.user,
          pass: smtpConfig.auth.pass || '',
        },
        connectionTimeout: 15000,
      });
      this.logger.log(`SMTP configured for org ${orgConfig.organizationName}: ${smtpConfig.host}:${smtpConfig.port}`);
    } else {
      this.logger.warn(`No SMTP configured for org ${orgConfig.organizationName} - confirmation emails will not be sent`);
    }

    // Load previously processed emails from DB for this org
    const processedEmails = await this.loadProcessedEmailsForOrg(organizationId);

    // Store connection info
    const connectionInfo = {
      imap,
      transporter,
      isConnected: false,
      reconnectAttempts: 0,
      isReconnecting: false,
      lastProcessedDate: null,
      processedEmails,
      pollTimer: null,
      organizationName: orgConfig.organizationName,
    };

    this.orgConnections.set(organizationId, connectionInfo);

    // Set up event handlers
    this.setupImapEventHandlers(organizationId, orgConfig);
  }

  /**
   * Load processed emails from DB for deduplication
   */
  private async loadProcessedEmailsForOrg(organizationId: string): Promise<Map<string, ProcessedEmail>> {
    const processedEmails = new Map<string, ProcessedEmail>();

    try {
      const tickets = await this.prisma.ticket.findMany({
        where: {
          organizationId,
          channel: 'email',
          externalId: { not: null },
        },
        select: {
          externalId: true,
          ticketNumber: true,
          createdAt: true,
        },
        orderBy: { createdAt: 'desc' },
        take: 100,
      });

      for (const ticket of tickets) {
        if (ticket.externalId) {
          processedEmails.set(ticket.externalId, {
            messageId: ticket.externalId,
            subject: ticket.ticketNumber,
            from: '',
            ticketId: ticket.ticketNumber,
            createdAt: ticket.createdAt,
          });
        }
      }

      this.logger.debug(`Loaded ${processedEmails.size} processed emails for org ${organizationId} for deduplication`);
    } catch (error) {
      this.logger.warn(`Failed to load processed emails for org ${organizationId}`, error);
    }

    return processedEmails;
  }

  /**
   * Set up IMAP event handlers for an organization
   */
  private setupImapEventHandlers(organizationId: string, orgConfig: OrganizationImapConfig): void {
    const connection = this.orgConnections.get(organizationId);
    if (!connection) return;

    const { imap } = connection;

    // Remove existing listeners to prevent duplicates
    imap.removeAllListeners('ready');
    imap.removeAllListeners('error');
    imap.removeAllListeners('end');

    imap.once('ready', () => {
      connection.isConnected = true;
      connection.isReconnecting = false;
      connection.reconnectAttempts = 0;
      this.logger.log(`IMAP connection ready for org: ${orgConfig.organizationName}`);

      // Clear existing poll timer
      if (connection.pollTimer) {
        clearInterval(connection.pollTimer);
      }

      // Set up polling for this organization
      connection.pollTimer = setInterval(() => {
        if (connection.isConnected && !this.isShuttingDown) {
          this.checkEmailsForOrg(organizationId, orgConfig);
        }
      }, this.POLL_INTERVAL_MS);

      // Immediate check
      this.checkEmailsForOrg(organizationId, orgConfig);
    });

    imap.once('error', (err) => {
      this.logger.error(`IMAP error for org ${orgConfig.organizationName}: ${err.message}`);
      connection.isConnected = false;

      if (connection.pollTimer) {
        clearInterval(connection.pollTimer);
        connection.pollTimer = null;
      }

      if (connection.isReconnecting) {
        return;
      }

      connection.isReconnecting = true;
      connection.reconnectAttempts++;

      const delay = Math.min(
        this.BASE_RECONNECT_DELAY * Math.pow(2, connection.reconnectAttempts - 1),
        60000
      );

      this.logger.log(`Reconnecting to IMAP for org ${orgConfig.organizationName} in ${delay / 1000}s (attempt ${connection.reconnectAttempts}/${this.MAX_RECONNECT_ATTEMPTS})`);

      setTimeout(() => {
        if (connection.reconnectAttempts <= this.MAX_RECONNECT_ATTEMPTS) {
          try {
            imap.connect();
          } catch (error) {
            this.logger.error(`Failed to reconnect to IMAP for org ${orgConfig.organizationName}`, error);
          }
        } else {
          this.logger.error(`Max reconnection attempts reached for org ${orgConfig.organizationName}`);
          connection.reconnectAttempts = 0;
        }
        connection.isReconnecting = false;
      }, delay);
    });

    imap.once('end', () => {
      connection.isConnected = false;
      this.logger.log(`IMAP connection ended for org: ${orgConfig.organizationName}`);

      if (connection.pollTimer) {
        clearInterval(connection.pollTimer);
        connection.pollTimer = null;
      }
    });

    try {
      imap.connect();
    } catch (error) {
      this.logger.error(`Failed to connect to IMAP for org ${orgConfig.organizationName}`, error);
      connection.isReconnecting = true;
      setTimeout(() => {
        connection.isReconnecting = false;
        this.setupImapEventHandlers(organizationId, orgConfig);
      }, 5000);
    }
  }

  /**
   * Start global polling that periodically refreshes organization connections
   * and checks for new/changed IMAP configurations
   */
  private startGlobalPolling(): void {
    // Poll every 5 minutes to check for new organizations or configuration changes
    const REFRESH_INTERVAL_MS = 5 * 60 * 1000;

    this.globalPollTimer = setInterval(async () => {
      if (this.isShuttingDown) return;

      try {
        await this.refreshOrganizationConnections();
      } catch (error) {
        this.logger.error('Error refreshing organization connections', error);
      }
    }, REFRESH_INTERVAL_MS);
  }

  /**
   * Refresh organization connections - add new ones, remove deleted ones
   */
  private async refreshOrganizationConnections(): Promise<void> {
    const currentOrgIds = new Set(this.orgConnections.keys());
    const configuredOrgs = await this.getOrganizationsWithImap();
    const configuredOrgIds = new Set(configuredOrgs.map(o => o.organizationId));

    // Remove connections for organizations that no longer have IMAP configured
    for (const orgId of currentOrgIds) {
      if (!configuredOrgIds.has(orgId)) {
        const connection = this.orgConnections.get(orgId);
        if (connection) {
          if (connection.pollTimer) {
            clearInterval(connection.pollTimer);
          }
          if (connection.isConnected) {
            connection.imap.end();
          }
          this.orgConnections.delete(orgId);
          this.logger.log(`Removed IMAP connection for org: ${orgId} (no longer configured)`);
        }
      }
    }

    // Add connections for new organizations
    for (const orgConfig of configuredOrgs) {
      if (!this.orgConnections.has(orgConfig.organizationId)) {
        this.logger.log(`New organization detected with IMAP: ${orgConfig.organizationName}`);
        await this.initializeOrganizationConnection(orgConfig);
      }
    }
  }

  /**
   * Check emails for a specific organization
   */
  private async checkEmailsForOrg(organizationId: string, orgConfig: OrganizationImapConfig): Promise<void> {
    const connection = this.orgConnections.get(organizationId);
    if (!connection || !connection.isConnected) {
      return;
    }

    const { imap, lastProcessedDate } = connection;

    try {
      const inboxFolder = orgConfig.imapConfig.inboxFolder || 'INBOX';

      imap.openBox(inboxFolder, false, async (err, box) => {
        if (err) {
          this.logger.error(`Error opening inbox for org ${orgConfig.organizationName}`, err);
          return;
        }

        try {
          if (lastProcessedDate) {
            // IMAP library expects nested array format: [['SINCE', '09-May-2026']]
            const formattedDate = this.formatDateForImap(lastProcessedDate);
            this.logger.debug(`Org ${orgConfig.organizationName}: Searching emails SINCE ${formattedDate}`);

            imap.search([['SINCE', formattedDate]], (err: Error | null, results: number[]) => {
              if (err) {
                this.logger.error(`Error searching emails for org ${orgConfig.organizationName}`, err);
                return;
              }

              if (!results || results.length === 0) {
                this.logger.debug(`Org ${orgConfig.organizationName}: No new emails found`);
                return;
              }

              this.logger.log(`Org ${orgConfig.organizationName}: Found ${results.length} email(s) to process`);
              this.processEmailsByUid(organizationId, orgConfig, results);
            });
          } else {
            this.logger.log(`Org ${orgConfig.organizationName}: First run - checking recent emails`);

            imap.search([['ALL']], (err: Error | null, results: number[]) => {
              if (err) {
                this.logger.error(`Error searching emails for org ${orgConfig.organizationName}`, err);
                return;
              }

              if (!results || results.length === 0) {
                this.logger.debug(`Org ${orgConfig.organizationName}: No emails found`);
                return;
              }

              this.logger.log(`Org ${orgConfig.organizationName}: Found ${results.length} email(s) to process`);
              this.processEmailsByUid(organizationId, orgConfig, results);
            });
          }
        } catch (error) {
          this.logger.error(`Error searching emails for org ${orgConfig.organizationName}`, error);
        }
      });
    } catch (error) {
      this.logger.error(`Error checking emails for org ${orgConfig.organizationName}`, error);
    }
  }

  private processEmailsByUid(organizationId: string, orgConfig: OrganizationImapConfig, uids: number[]): void {
    if (uids.length === 0) return;

    const connection = this.orgConnections.get(organizationId);
    if (!connection) return;

    this.logger.debug(`Org ${orgConfig.organizationName}: Processing ${uids.length} UIDs`);

    let processedCount = 0;

    const processNext = (index: number) => {
      if (index >= uids.length) {
        this.logger.debug(`Org ${orgConfig.organizationName}: All emails processed`);
        return;
      }

      const uid = uids[index];

      this.fetchEmailByUid(organizationId, uid).then((emailInfo) => {
        if (!emailInfo) {
          processedCount++;
          processNext(index + 1);
          return;
        }

        const { messageId, subject, emailDate } = emailInfo;

        // Skip if already processed by Message-ID
        if (messageId && connection.processedEmails.has(messageId)) {
          this.logger.debug(`Org ${orgConfig.organizationName}: Email ${messageId} already processed, skipping`);
          processedCount++;
          processNext(index + 1);
          return;
        }

        this.logger.log(`Org ${orgConfig.organizationName}: Processing: ${subject} (UID: ${uid})`);

        this.fetchAndProcessEmail(organizationId, orgConfig, uid, messageId).then(async () => {
          processedCount++;

          // Archive the email
          await this.archiveEmail(organizationId, uid, subject);

          // Update lastProcessedDate
          if (emailDate && emailDate > (connection.lastProcessedDate || new Date(0))) {
            connection.lastProcessedDate = emailDate;
          }

          processNext(index + 1);
        }).catch((error) => {
          this.logger.error(`Org ${orgConfig.organizationName}: Error processing email ${uid}`, error);
          processedCount++;
          processNext(index + 1);
        });
      });
    };

    processNext(0);
  }

  private fetchEmailByUid(organizationId: string, uid: number): Promise<{ messageId: string | null; subject: string; emailDate: Date | null } | null> {
    const connection = this.orgConnections.get(organizationId);
    if (!connection) return Promise.resolve(null);

    return new Promise((resolve) => {
      const fetch = connection.imap.fetch(uid, {
        bodies: 'HEADER',
        struct: true,
      });

      fetch.on('message', (msg) => {
        msg.on('body', (headerStream) => {
          const chunks: Buffer[] = [];
          headerStream.on('data', (chunk: Buffer) => {
            chunks.push(chunk);
          });
          headerStream.on('end', () => {
            const headerStr = Buffer.concat(chunks).toString('utf8');

            const messageIdMatch = headerStr.match(/Message-ID: <([^>]+)>/i);
            const subjectMatch = headerStr.match(/^Subject: (.*)$/mi);
            const dateMatch = headerStr.match(/^Date: (.*)$/mi);

            const messageId = messageIdMatch ? messageIdMatch[1] : null;
            const subject = subjectMatch ? subjectMatch[1].trim() : 'No Subject';
            const emailDate = dateMatch ? this.parseEmailDate(dateMatch[1]) : null;

            resolve({ messageId, subject, emailDate });
          });
        });
      });

      fetch.on('error', (err) => {
        this.logger.error(`Error fetching email headers for UID ${uid}`, err);
        resolve(null);
      });
    });
  }

  private fetchAndProcessEmail(organizationId: string, orgConfig: OrganizationImapConfig, uid: number, messageId: string): Promise<void> {
    const connection = this.orgConnections.get(organizationId);
    if (!connection) return Promise.reject(new Error('Connection not found'));

    return new Promise((resolve, reject) => {
      const fetch = connection.imap.fetch(uid, {
        bodies: '',
        struct: true,
        markSeen: false,
      });

      let rawEmail = '';
      let gotData = false;

      fetch.on('message', async (msg) => {
        msg.on('body', async (stream) => {
          gotData = true;
          const chunks: Buffer[] = [];
          stream.on('data', (chunk: Buffer) => {
            chunks.push(chunk);
          });
          stream.on('end', () => {
            rawEmail = Buffer.concat(chunks).toString('binary');
          });
        });

        msg.once('end', async () => {
          if (!gotData || !rawEmail) {
            this.logger.warn(`Org ${orgConfig.organizationName}: No data received for email ${uid}`);
            resolve();
            return;
          }

          try {
            const parsed = await simpleParser(rawEmail, {
              skipImageLinks: false,
              skipTextToHtml: false,
              skipTextLinks: false,
            });

            if (!parsed.messageId) {
              (parsed as any).messageId = messageId;
            }

            // Extract attachments
            const attachments = this.extractAttachments(rawEmail, parsed);
            (parsed as any).attachments = attachments;

            await this.processInboundEmail(organizationId, orgConfig, parsed);
            resolve();
          } catch (error) {
            this.logger.error(`Org ${orgConfig.organizationName}: Error parsing email ${uid}`, error);
            reject(error);
          }
        });
      });

      fetch.once('error', (err) => {
        this.logger.error(`Org ${orgConfig.organizationName}: Error fetching email ${uid}`, err);
        reject(err);
      });
    });
  }

  /**
   * Extract attachments from raw email
   */
  private extractAttachments(rawEmail: string, parsed: ParsedMail): any[] {
    const attachments: any[] = [];

    if (parsed.attachments && parsed.attachments.length > 0) {
      attachments.push(...parsed.attachments);
    }

    const manuallyExtracted = this.manualExtractAttachments(rawEmail);

    // Deduplicate
    const seenFilenames = new Set<string>();
    for (const att of attachments) {
      seenFilenames.add(att.filename?.toLowerCase() || '');
    }

    for (const att of manuallyExtracted) {
      const filename = att.filename?.toLowerCase() || '';
      if (!seenFilenames.has(filename)) {
        attachments.push(att);
        seenFilenames.add(filename);
      }
    }

    return attachments;
  }

  /**
   * Manually extract attachments from raw MIME email
   */
  private manualExtractAttachments(rawEmail: string): any[] {
    const attachments: any[] = [];

    try {
      const boundaryMatch = rawEmail.match(/boundary="([^"]+)"/i);
      if (!boundaryMatch) {
        return attachments;
      }

      const boundary = boundaryMatch[1];
      const parts = rawEmail.split(`--${boundary}`);

      for (const part of parts) {
        if (!part.trim() || part.trim() === '--') {
          continue;
        }

        const contentDispMatch = part.match(/Content-Disposition:\s*([^;\r\n]+)/i);
        const disposition = contentDispMatch ? contentDispMatch[1].toLowerCase() : '';

        if (disposition !== 'attachment') {
          continue;
        }

        const filenameMatch = part.match(/filename\*?=\s*"?([^";\r\n]+)"?/i) ||
                              part.match(/filename\*?=(?:UTF-8''|en-US'')?([^;\r\n]+)/i);
        const filename = filenameMatch ? this.decodeHeaderValue(filenameMatch[1]) : 'unknown';

        const contentTypeMatch = part.match(/Content-Type:\s*([^;\r\n]+)/i);
        const contentType = contentTypeMatch ? contentTypeMatch[1].trim() : 'application/octet-stream';

        const encodingMatch = part.match(/Content-Transfer-Encoding:\s*([^;\r\n]+)/i);
        const encoding = encodingMatch ? encodingMatch[1].trim().toLowerCase() : '7bit';

        const headerEndIndex = part.indexOf('\r\n\r\n');
        if (headerEndIndex === -1) continue;

        const content = part.substring(headerEndIndex + 4).trim();

        let decodedContent: Buffer;
        if (encoding === 'base64') {
          decodedContent = Buffer.from(content.replace(/\s/g, ''), 'base64');
        } else if (encoding === 'quoted-printable') {
          decodedContent = Buffer.from(this.decodeQuotedPrintable(content), 'utf-8');
        } else {
          decodedContent = Buffer.from(content);
        }

        if (decodedContent.length > 0) {
          attachments.push({
            filename,
            contentType,
            content: decodedContent,
            size: decodedContent.length,
            checksum: crypto.createHash('md5').update(decodedContent).digest('hex'),
          });
        }
      }
    } catch (error) {
      this.logger.error('Error in manual attachment extraction', error);
    }

    return attachments;
  }

  private decodeHeaderValue(value: string): string {
    const encodedWordMatch = value.match(/=\?([^?]+)\?([BQ])\?([^?]+)\?=/i);
    if (encodedWordMatch) {
      const charset = encodedWordMatch[1];
      const encoding = encodedWordMatch[2].toUpperCase();
      const encoded = encodedWordMatch[3];

      try {
        if (encoding === 'B') {
          return new TextDecoder(charset, { fatal: false }).decode(Buffer.from(encoded, 'base64'));
        } else if (encoding === 'Q') {
          return new TextDecoder(charset, { fatal: false }).decode(Buffer.from(encoded.replace(/_/g, ' ').replace(/=([0-9A-Fa-f]{2})/g, '%$1'), 'hex'));
        }
      } catch {}
    }

    try {
      return decodeURIComponent(value.replace(/%([0-9A-Fa-f]{2})/g, '%$1'));
    } catch {
      return value;
    }
  }

  private decodeQuotedPrintable(content: string): string {
    return content
      .replace(/=([0-9A-Fa-f]{2})/g, (_, hex) => String.fromCharCode(parseInt(hex, 16)))
      .replace(/=\r?\n/g, '');
  }

  private async processInboundEmail(organizationId: string, orgConfig: OrganizationImapConfig, parsed: ParsedMail): Promise<void> {
    const connection = this.orgConnections.get(organizationId);
    if (!connection) return;

    try {
      const messageId = parsed.messageId || `unknown-${Date.now()}`;
      const from = parsed.from?.value?.[0]?.address || '';
      const fromName = parsed.from?.value?.[0]?.name || '';
      const subject = parsed.subject || 'No Subject';
      const textBody = parsed.text || '';
      const htmlBody = parsed.html || '';
      const date = parsed.date || new Date();
      const attachments: any[] = (parsed as any).attachments || parsed.attachments || [];

      this.logger.log(`Org ${orgConfig.organizationName}: Processing email: ${subject}`);
      this.logger.log(`Org ${orgConfig.organizationName}: From: ${from}`);

      // Skip if already processed
      if (connection.processedEmails.has(messageId)) {
        this.logger.debug(`Org ${orgConfig.organizationName}: Email ${messageId} already processed, skipping`);
        return;
      }

      if (!from) {
        this.logger.warn(`Org ${orgConfig.organizationName}: Email without sender, skipping`);
        return;
      }

      // Check allowed email domains
      if (this.ALLOWED_EMAIL_DOMAINS.length > 0) {
        const emailDomain = from.split('@')[1]?.toLowerCase();
        if (!emailDomain || !this.ALLOWED_EMAIL_DOMAINS.includes(emailDomain)) {
          this.logger.warn(`Org ${orgConfig.organizationName}: Email domain '${emailDomain}' not in allowed list, skipping. From: ${from}`);
          return;
        }
      }

      // Check if this is a reply to an existing ticket
      const ticketReply = this.parseTicketReply(subject);

      if (ticketReply) {
        await this.processTicketReply(organizationId, orgConfig, ticketReply.ticketNumber, {
          messageId,
          from,
          fromName,
          subject,
          textBody,
          htmlBody,
          date,
          attachments,
        });
      } else {
        // New ticket creation
        await this.createTicketFromEmail(organizationId, orgConfig, {
          messageId,
          from,
          fromName,
          subject,
          textBody,
          htmlBody,
          date,
          attachments,
        });
      }

      // Mark as processed
      connection.processedEmails.set(messageId, {
        messageId,
        subject,
        from,
        createdAt: new Date(),
      });

    } catch (error) {
      this.logger.error(`Org ${orgConfig.organizationName}: Error processing inbound email`, error);
      throw error;
    }
  }

  private parseTicketReply(subject: string): { ticketNumber: string } | null {
    const patterns = [
      /\[([A-Z]+-\d+)\]/i,
      /^([A-Z]+-\d+):/i,
      /^(?:Re:|RE:|re:)\s*\[?([A-Z]+-\d+)\]?:?/i,
    ];

    for (const pattern of patterns) {
      const match = subject.match(pattern);
      if (match) {
        return { ticketNumber: match[1].toUpperCase() };
      }
    }

    return null;
  }

  private async createTicketFromEmail(
    organizationId: string,
    orgConfig: OrganizationImapConfig,
    email: {
      messageId: string;
      from: string;
      fromName: string;
      subject: string;
      textBody: string;
      htmlBody: string;
      date: Date;
      attachments: any[];
    },
  ): Promise<string> {
    // Find or create user
    let user = await this.prisma.user.findUnique({
      where: { email: email.from },
    });

    if (!user) {
      this.logger.log(`Org ${orgConfig.organizationName}: Creating new user from email: ${email.from}`);

      // Check if user exists in this organization
      const existingOrgUser = await this.prisma.organizationUser.findFirst({
        where: {
          organizationId,
          user: { email: email.from },
        },
        include: { user: true },
      });

      if (existingOrgUser) {
        user = existingOrgUser.user;
      } else {
        // Create new user
        const nameParts = email.fromName.split(' ');
        const firstName = nameParts[0] || email.from.split('@')[0];
        const lastName = nameParts.slice(1).join(' ') || 'User';

        user = await this.prisma.user.create({
          data: {
            email: email.from,
            firstName,
            lastName,
            role: 'user',
            authProvider: 'local',
            isActive: true,
          },
        });

        // Add user to organization with requester role
        await this.prisma.organizationUser.create({
          data: {
            organizationId,
            userId: user.id,
            orgRole: 'requester',
          },
        });
      }
    }

    // Generate ticket number for this organization
    const lastTicket = await this.prisma.ticket.findFirst({
      where: { organizationId },
      orderBy: { ticketNumber: 'desc' },
      select: { ticketNumber: true },
    });

    let nextNumber = 1;
    if (lastTicket) {
      const match = lastTicket.ticketNumber.match(/(\d+)$/);
      if (match) {
        nextNumber = parseInt(match[1], 10) + 1;
      }
    }
    const ticketNumber = `INC-${String(nextNumber).padStart(5, '0')}`;

    // Determine priority
    const priority = this.determinePriority(email.subject, email.textBody);

    // Calculate SLA deadline (24 hours for incidents)
    const slaDeadline = new Date();
    slaDeadline.setHours(slaDeadline.getHours() + 24);

    // Clean description
    const description = this.cleanEmailBody(email.textBody);

    // Create the ticket
    const ticket = await this.prisma.ticket.create({
      data: {
        ticketNumber,
        channel: 'email',
        type: 'incident',
        status: 'new',
        priority,
        title: this.cleanSubject(email.subject),
        description,
        requesterId: user.id,
        organizationId,
        slaDeadline,
        externalId: email.messageId,
      },
    });

    this.logger.log(`Org ${orgConfig.organizationName}: Created ticket ${ticketNumber} from email by ${email.from}`);

    // Save attachments
    if (email.attachments && email.attachments.length > 0) {
      await this.saveEmailAttachments(ticket.id, user.id, organizationId, email.attachments, ticketNumber, orgConfig);
    }

    // Send confirmation email
    await this.sendTicketConfirmation(organizationId, orgConfig, user, ticketNumber, email.subject);

    return ticketNumber;
  }

  private async processTicketReply(
    organizationId: string,
    orgConfig: OrganizationImapConfig,
    ticketNumber: string,
    email: {
      messageId: string;
      from: string;
      fromName: string;
      subject: string;
      textBody: string;
      htmlBody: string;
      date: Date;
      attachments: any[];
    },
  ): Promise<void> {
    // Find the existing ticket in this organization
    const ticket = await this.prisma.ticket.findFirst({
      where: { ticketNumber, organizationId },
      include: { requester: true },
    });

    if (!ticket) {
      this.logger.warn(`Org ${orgConfig.organizationName}: Ticket ${ticketNumber} not found, creating new ticket`);
      await this.createTicketFromEmail(organizationId, orgConfig, email);
      return;
    }

    // Verify the reply is from the requester or an agent
    const isRequester = ticket.requester.email === email.from;

    if (!isRequester) {
      this.logger.warn(`Org ${orgConfig.organizationName}: Reply to ${ticketNumber} from unknown email ${email.from}, ignoring`);
      return;
    }

    // Find or create the author
    const author = await this.prisma.user.findUnique({
      where: { email: email.from },
    });

    if (!author) {
      this.logger.warn(`Org ${orgConfig.organizationName}: User ${email.from} not found for comment`);
      return;
    }

    // Check for duplicate comment
    const commentBody = this.cleanEmailBody(email.textBody);
    const existingComment = await this.prisma.comment.findFirst({
      where: {
        ticketId: ticket.id,
        authorId: author.id,
        content: commentBody,
        isInternal: false,
      },
    });

    if (existingComment) {
      this.logger.debug(`Org ${orgConfig.organizationName}: Comment already exists for ticket ${ticketNumber}, skipping`);
      return;
    }

    // Create comment
    await this.prisma.comment.create({
      data: {
        ticketId: ticket.id,
        authorId: author.id,
        content: commentBody,
        isInternal: false,
        channel: 'email',
        replyToAddresses: email.from,
        originalMessageId: email.messageId,
        originalSubject: email.subject,
        organizationId,
      },
    });

    // Update ticket
    await this.prisma.ticket.update({
      where: { id: ticket.id },
      data: {
        lastActivityAt: new Date(),
        status: ticket.status === 'pending' ? 'in_progress' : undefined,
      },
    });

    this.logger.log(`Org ${orgConfig.organizationName}: Added comment to ticket ${ticketNumber} from ${email.from}`);

    // Save attachments
    if (email.attachments && email.attachments.length > 0) {
      await this.saveEmailAttachments(ticket.id, author.id, organizationId, email.attachments, ticketNumber, orgConfig);
    }
  }

  private determinePriority(subject: string, body: string): 'low' | 'medium' | 'high' | 'critical' {
    const text = `${subject} ${body}`.toLowerCase();

    const criticalKeywords = ['urgent', 'critical', 'emergency', 'down', 'outage', 'production', 'asap'];
    if (criticalKeywords.some(kw => text.includes(kw))) {
      return 'critical';
    }

    const highKeywords = ['important', 'priority', 'high', 'deadline', 'soon', 'broke', 'broken'];
    if (highKeywords.some(kw => text.includes(kw))) {
      return 'high';
    }

    const lowKeywords = ['low', 'minor', 'when you have time', 'when possible', 'nice to have'];
    if (lowKeywords.some(kw => text.includes(kw))) {
      return 'low';
    }

    return 'medium';
  }

  private cleanSubject(subject: string): string {
    let cleaned = subject.replace(/^(?:Re:|RE:|re:|Fwd:|FW:)\s*/g, '');
    cleaned = cleaned.replace(/\[([A-Z]+-\d+)\]\s*/g, '');
    cleaned = cleaned.trim();
    return cleaned || 'No Subject';
  }

  private cleanEmailBody(body: string): string {
    let cleaned = body.replace(/\n{3,}/g, '\n\n');
    cleaned = cleaned.replace(/--\s*\n[\s\S]*$/m, '');
    cleaned = cleaned.replace(/On .+ wrote:\s*$/gm, '');
    cleaned = cleaned.split('\n').filter(line => !line.trim().startsWith('>')).join('\n');
    return cleaned.trim();
  }

  private formatDateForImap(date: Date): string {
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const day = date.getDate().toString().padStart(2, '0');
    const month = months[date.getMonth()];
    const year = date.getFullYear();
    return `${day}-${month}-${year}`;
  }

  private parseEmailDate(dateStr: string): Date | null {
    try {
      const date = new Date(dateStr);
      if (!isNaN(date.getTime())) {
        return date;
      }
      const parsed = Date.parse(dateStr);
      if (!isNaN(parsed)) {
        return new Date(parsed);
      }
    } catch {}
    return null;
  }

  private async sendTicketConfirmation(
    organizationId: string,
    orgConfig: OrganizationImapConfig,
    user: { email: string; firstName: string },
    ticketNumber: string,
    subject: string,
  ): Promise<void> {
    const connection = this.orgConnections.get(organizationId);
    if (!connection) return;

    // Check if SMTP is configured
    if (!connection.transporter) {
      this.logger.warn(`Org ${orgConfig.organizationName}: No SMTP configured, skipping confirmation email for ${ticketNumber}`);
      return;
    }

    try {
      const baseUrl = this.config.get('APP_URL', 'http://localhost:5173');
      const fromAddress = orgConfig.smtpConfig.fromAddress || this.config.get('SMTP_FROM', 'noreply@helix.helpdesk');

      await connection.transporter.sendMail({
        from: fromAddress,
        to: user.email,
        subject: `[${ticketNumber}] Ticket Received: ${subject}`,
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <h2 style="color: #333;">Hello ${user.firstName},</h2>
            <p>We have received your request and created a ticket:</p>
            <div style="background: #f5f5f5; padding: 15px; border-radius: 5px; margin: 20px 0;">
              <p style="margin: 0;"><strong>Ticket Number:</strong> ${ticketNumber}</p>
              <p style="margin: 5px 0 0;"><strong>Subject:</strong> ${subject}</p>
            </div>
            <p>Our support team will review your request and respond as soon as possible.</p>
            <p>You can track your ticket status here:</p>
            <p><a href="${baseUrl}/tickets/${ticketNumber}" style="color: #0066cc;">${baseUrl}/tickets/${ticketNumber}</a></p>
            <p style="margin-top: 30px; color: #666; font-size: 12px;">
              To add additional information, simply reply to this email or use the link above.
            </p>
          </div>
        `,
        text: `
Hello ${user.firstName},

We have received your request and created a ticket:

Ticket Number: ${ticketNumber}
Subject: ${subject}

Our support team will review your request and respond as soon as possible.

You can track your ticket status here:
${baseUrl}/tickets/${ticketNumber}

To add additional information, simply reply to this email.
        `,
      });

      this.logger.log(`Org ${orgConfig.organizationName}: Sent confirmation email for ${ticketNumber} to ${user.email}`);
    } catch (error) {
      this.logger.error(`Org ${orgConfig.organizationName}: Failed to send confirmation email for ${ticketNumber}`, error);
    }
  }

  private async saveEmailAttachments(
    ticketId: string,
    uploadedById: string,
    organizationId: string,
    attachments: any[],
    ticketNumber: string,
    orgConfig: OrganizationImapConfig,
  ): Promise<void> {
    const savedAttachments: string[] = [];

    const existingAttachments = await this.prisma.attachment.findMany({
      where: { ticketId },
      select: { originalName: true },
    });

    const existingNames = new Set(existingAttachments.map(a => a.originalName.toLowerCase()));

    for (const attachment of attachments) {
      try {
        const originalName = attachment.filename || 'attachment';
        const originalNameLower = originalName.toLowerCase();

        if (existingNames.has(originalNameLower)) {
          this.logger.debug(`Skipping duplicate attachment: ${originalName}`);
          continue;
        }

        let fileBuffer: Buffer | null = null;

        if (attachment.content) {
          if (Buffer.isBuffer(attachment.content)) {
            fileBuffer = attachment.content;
          } else if (typeof attachment.content === 'string') {
            try {
              fileBuffer = Buffer.from(attachment.content, 'base64');
            } catch {
              fileBuffer = Buffer.from(attachment.content);
            }
          }
        }

        if (!fileBuffer) {
          this.logger.warn(`No content available for attachment: ${originalName}`);
          continue;
        }

        const timestamp = Date.now();
        const randomSuffix = crypto.randomBytes(8).toString('hex');
        const ext = path.extname(originalName);
        const baseName = path.basename(originalName, ext);
        const safeName = `${baseName.replace(/[^a-zA-Z0-9]/g, '_')}_${timestamp}_${randomSuffix}${ext}`;

        const mimeType = attachment.contentType || 'application/octet-stream';

        const uploadResult = await this.uploadToApi(ticketId, uploadedById, safeName, originalName, mimeType, fileBuffer);

        if (uploadResult) {
          savedAttachments.push(originalName);
          existingNames.add(originalNameLower);
          this.logger.log(`Saved attachment: ${originalName} for ticket ${ticketNumber}`);
        }
      } catch (error) {
        this.logger.error(`Failed to save attachment: ${attachment?.filename}`, error);
      }
    }

    if (savedAttachments.length > 0) {
      this.logger.log(`Saved ${savedAttachments.length} attachment(s) for ticket ${ticketNumber}`);
    }
  }

  private async uploadToApi(
    ticketId: string,
    userId: string,
    filename: string,
    originalName: string,
    mimeType: string,
    content: Buffer,
  ): Promise<UploadResponse | null> {
    return new Promise((resolve) => {
      const url = new URL(`${this.API_URL}/v1/storage/internal/upload`);
      const isHttps = url.protocol === 'https:';
      const client = isHttps ? https : http;

      const body = JSON.stringify({
        ticketId,
        userId,
        filename,
        originalName,
        mimeType,
        content: content.toString('base64'),
      });

      const options = {
        hostname: url.hostname,
        port: url.port || (isHttps ? 443 : 3000),
        path: url.pathname,
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(body),
          'x-internal-api-key': this.INTERNAL_API_KEY,
        },
      };

      const req = client.request(options, (res) => {
        let data = '';
        res.on('data', (chunk) => {
          data += chunk;
        });
        res.on('end', () => {
          if (res.statusCode === 200 || res.statusCode === 201) {
            try {
              resolve(JSON.parse(data));
            } catch {
              this.logger.error('Failed to parse API response', data);
              resolve(null);
            }
          } else {
            this.logger.error(`API upload failed with status ${res.statusCode}: ${data}`);
            resolve(null);
          }
        });
      });

      req.on('error', (error) => {
        this.logger.error(`Failed to upload to API: ${error.message}`);
        resolve(null);
      });

      req.write(body);
      req.end();
    });
  }

  private archiveEmail(organizationId: string, uid: number, subject: string): Promise<void> {
    const connection = this.orgConnections.get(organizationId);
    if (!connection) return Promise.resolve();

    const archiveFolder = this.config.get('IMAP_ARCHIVE_FOLDER', 'Archive');

    if (!archiveFolder || archiveFolder.trim() === '') {
      return Promise.resolve();
    }

    return new Promise((resolve) => {
      // Ensure archive folder exists
      connection.imap.status(archiveFolder, (err, mailbox) => {
        if (err || !mailbox) {
          // Create the folder
          connection.imap.addBox(archiveFolder, (createErr) => {
            if (createErr) {
              this.logger.warn(`Failed to create archive folder "${archiveFolder}"`, createErr);
              resolve();
              return;
            }
            this.logger.log(`Created archive folder: "${archiveFolder}"`);
            this.doArchive(organizationId, uid, subject, archiveFolder, resolve);
          });
        } else {
          this.doArchive(organizationId, uid, subject, archiveFolder, resolve);
        }
      });
    });
  }

  private doArchive(organizationId: string, uid: number, subject: string, archiveFolder: string, resolve: () => void): void {
    const connection = this.orgConnections.get(organizationId);
    if (!connection) {
      resolve();
      return;
    }

    connection.imap.move(uid, archiveFolder, (moveErr) => {
      if (moveErr) {
        this.logger.warn(`Move failed for email ${uid}, trying copy + delete`, moveErr);

        connection.imap.copy(uid, archiveFolder, (copyErr) => {
          if (copyErr) {
            this.logger.error(`Failed to copy email ${uid} to archive`, copyErr);
            resolve();
            return;
          }

          connection.imap.addFlags(uid, '\\Deleted', (delErr) => {
            if (delErr) {
              this.logger.warn(`Failed to add Deleted flag to email ${uid}`, delErr);
            }
            this.logger.log(`Archived email (copied): ${subject} (UID: ${uid})`);
            resolve();
          });
        });
      } else {
        this.logger.log(`Archived email: ${subject} (UID: ${uid})`);
        resolve();
      }
    });
  }

  /**
   * Get status of all organization connections (for health checks)
   */
  getStatus(): { organizationId: string; organizationName: string; isConnected: boolean; processedEmails: number }[] {
    const status: { organizationId: string; organizationName: string; isConnected: boolean; processedEmails: number }[] = [];

    for (const [orgId, connection] of this.orgConnections.entries()) {
      status.push({
        organizationId: orgId,
        organizationName: connection.organizationName,
        isConnected: connection.isConnected,
        processedEmails: connection.processedEmails.size,
      });
    }

    return status;
  }
}
