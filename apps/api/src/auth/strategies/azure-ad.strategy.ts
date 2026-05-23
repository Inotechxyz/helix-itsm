import { Injectable, Logger, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { OIDCStrategy } from 'passport-azure-ad';
import { ConfigService } from '@nestjs/config';

/**
 * Azure AD user profile returned from passport strategy
 */
export interface AzureAdUserProfile {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  displayName?: string;
}

/**
 * Azure AD Strategy for Microsoft SSO
 *
 * This strategy is conditionally registered in AuthModule only when real
 * AZURE_AD_* environment variables are configured (not placeholder values).
 *
 * The AzureAdAuthGuard checks configuration before allowing access to this strategy.
 */
@Injectable()
export class AzureAdStrategy extends PassportStrategy(OIDCStrategy, 'azure-ad') {
  private readonly logger = new Logger(AzureAdStrategy.name);

  constructor(private readonly config: ConfigService) {
    // Read config - if not configured, the AuthModule won't register this provider
    const tenantId = config.get('AZURE_AD_TENANT_ID')!;
    const clientID = config.get('AZURE_AD_CLIENT_ID')!;
    const clientSecret = config.get('AZURE_AD_CLIENT_SECRET')!;
    const redirectUrl = config.get('AZURE_AD_REDIRECT_URI')!;

    // Build identity metadata URL using tenant ID
    const identityMetadata = `https://login.microsoftonline.com/${tenantId}/v2.0/.well-known/openid-configuration`;

    // Configure the OIDC strategy with real values from env vars
    super({
      identityMetadata,
      clientID,
      clientSecret,
      redirectUrl,
      responseType: 'code',
      responseMode: 'query',
      scope: ['openid', 'profile', 'email'],
      allowHttpForRedirectUrl: process.env.NODE_ENV !== 'production',
    });

    this.logger.log('Azure AD SSO strategy initialized');
  }

  /**
   * Validate Azure AD user and return profile
   */
  async validate(_iss: string, sub: string, profile: any): Promise<AzureAdUserProfile> {
    return {
      id: sub,
      email: profile.email || profile.upn,
      firstName: profile.given_name || profile.name?.split(' ')[0] || '',
      lastName: profile.family_name || profile.name?.split(' ').slice(1).join(' ') || '',
      displayName: profile.displayName,
    };
  }
}
