import { Injectable, ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';

/**
 * Guard for Azure AD authentication
 *
 * This guard checks if Azure AD is properly configured before attempting authentication.
 * - If Azure AD is NOT configured or has placeholder values: Throws 401 Unauthorized
 * - If Azure AD IS configured with real values: Proceeds with passport Azure AD authentication
 */
@Injectable()
export class AzureAdAuthGuard extends AuthGuard('azure-ad') {
  canActivate(context: ExecutionContext) {
    // Check if Azure AD is properly configured
    if (!this.isAzureAdConfigured()) {
      // Throw 401 Unauthorized - Azure SSO not available
      throw new UnauthorizedException(
        'Azure AD SSO is not configured. Please contact your administrator or sign in with email/password.',
      );
    }

    // Azure AD is configured, proceed with authentication
    return super.canActivate(context);
  }

  handleRequest(err: any, user: any, info: any) {
    if (err || !user) {
      // Return null instead of throwing - let the controller handle the error
      return null;
    }
    return user;
  }

  /**
   * Check if Azure AD is properly configured with real values (not placeholders)
   */
  private isAzureAdConfigured(): boolean {
    const clientID = process.env.AZURE_AD_CLIENT_ID;
    const clientSecret = process.env.AZURE_AD_CLIENT_SECRET;
    const tenantId = process.env.AZURE_AD_TENANT_ID;
    const redirectUri = process.env.AZURE_AD_REDIRECT_URI;

    // Must have real values, not placeholders
    const hasRealConfig =
      clientID && clientID !== 'your-azure-client-id' &&
      clientSecret && clientSecret !== 'your-azure-client-secret' &&
      tenantId && tenantId !== 'your-azure-tenant-id' &&
      redirectUri && redirectUri.startsWith('http');

    return !!hasRealConfig;
  }
}
