import { Module } from '@nestjs/common';
import { OrganizationsController } from './organizations.controller';
import { PublicOrganizationsController } from './public-organizations.controller';
import { OrganizationsService } from './organizations.service';
import { OrganizationInvitationsService } from './organization-invitations.service';
import { OrganizationEmailTemplatesService } from './organization-email-templates.service';
import { OrganizationEmailSettingsService } from './organization-email-settings.service';
import { EmailModule } from '../email/email.module';
import { CacheModule } from '../cache/cache.module';

@Module({
  imports: [EmailModule, CacheModule],
  controllers: [OrganizationsController, PublicOrganizationsController],
  providers: [
    OrganizationsService,
    OrganizationInvitationsService,
    OrganizationEmailTemplatesService,
    OrganizationEmailSettingsService,
  ],
  exports: [
    OrganizationsService,
    OrganizationInvitationsService,
    OrganizationEmailTemplatesService,
    OrganizationEmailSettingsService,
  ],
})
export class OrganizationsModule {}
