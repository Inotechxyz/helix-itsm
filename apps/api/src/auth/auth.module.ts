import { Module, Logger } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { OrganizationAuthService } from './organization-auth.service';
import { JwtStrategy } from './strategies/jwt.strategy';
import { LocalStrategy } from './strategies/local.strategy';
import { AzureAdStrategy } from './strategies/azure-ad.strategy';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { InternalApiGuard } from './guards/internal-api.guard';
import { AzureAdAuthGuard } from './guards/azure-ad-auth.guard';
import { ModuleLicenseGuard } from './guards/module-license.guard';
import { UsersModule } from '../users/users.module';
import { LicenseModule } from '../license/license.module';

/**
 * Check if Azure AD is properly configured with real values (not placeholders)
 */
function isAzureAdConfigured(): boolean {
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

@Module({
  imports: [
    PassportModule.register({ defaultStrategy: 'jwt' }),
    JwtModule.registerAsync({
      imports: [ConfigModule],
      useFactory: (config: ConfigService) => ({
        secret: config.get('JWT_SECRET'),
        signOptions: {
          expiresIn: config.get('JWT_EXPIRES_IN', '15m'),
        },
      }),
      inject: [ConfigService],
    }),
    UsersModule,
    LicenseModule,
  ],
  controllers: [AuthController],
  providers: [
    AuthService,
    OrganizationAuthService,
    JwtStrategy,
    LocalStrategy,
    JwtAuthGuard,
    InternalApiGuard,
    AzureAdAuthGuard,
    ModuleLicenseGuard,
    // Only register AzureAdStrategy if properly configured with real values
    ...(isAzureAdConfigured() ? [AzureAdStrategy] : []),
  ],
  exports: [
    AuthService,
    OrganizationAuthService,
    JwtAuthGuard,
    InternalApiGuard,
    ModuleLicenseGuard,
  ],
})
export class AuthModule {
  private readonly logger = new Logger(AuthModule.name);

  constructor(private config: ConfigService) {
    if (isAzureAdConfigured()) {
      this.logger.log('Azure AD SSO is enabled');
    } else {
      this.logger.warn('Azure AD SSO not configured. Set AZURE_AD_* env vars with real values to enable.');
    }
  }
}
