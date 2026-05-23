import {
  Controller,
  Post,
  Body,
  Get,
  Patch,
  Req,
  Res,
  UseGuards,
  HttpCode,
  HttpStatus,
  BadRequestException,
  Param,
  ForbiddenException,
  Query,
  Inject,
} from '@nestjs/common';
import { Request, Response } from 'express';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiResponse } from '@nestjs/swagger';
import { Throttle, SkipThrottle } from '@nestjs/throttler';
import { AuthService, AuthResponse } from './auth.service';
import { OrganizationAuthService, OrgAuthResponse } from './organization-auth.service';
import {
  RegisterDto,
  LoginDto,
  ChangePasswordDto,
} from './dto/auth.dto';
import { UpdateProfileDto } from './dto/update-profile.dto';
import {
  OrgLoginDto,
  OrgLoginByIdDto,
  SwitchOrganizationDto,
  OrgRegisterDto,
} from './dto/org-auth.dto';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { JwtAuthWithOrgGuard } from './guards/jwt-auth-with-org.guard';
import { AzureAdAuthGuard } from './guards/azure-ad-auth.guard';
import { CurrentUser } from '../decorators/current-user.decorator';
import { Public } from '../decorators/public.decorator';
import { PrismaService } from '../common/prisma.service';

// Cookie configuration constants
const REFRESH_TOKEN_COOKIE_NAME = 'helix_refresh_token';
const COOKIE_MAX_AGE = 7 * 24 * 60 * 60 * 1000; // 7 days in milliseconds

interface CookieOptions {
  httpOnly: boolean;
  secure: boolean;
  sameSite: 'strict' | 'lax' | 'none';
  maxAge: number;
  path: string;
}

@ApiTags('auth')
@Controller('auth')
@SkipThrottle() // Skip global throttling, use custom limits below
export class AuthController {
  constructor(
    private authService: AuthService,
    private orgAuthService: OrganizationAuthService,
    private prisma: PrismaService,
  ) {}

  /**
   * Set refresh token cookie with secure defaults
   */
  private setRefreshTokenCookie(
    res: Response,
    refreshToken: string,
    isProduction: boolean,
  ): void {
    const cookieOptions: CookieOptions = {
      httpOnly: true, // Not accessible to JavaScript - prevents XSS token theft
      secure: isProduction, // HTTPS only in production
      sameSite: isProduction ? 'strict' : 'lax', // CSRF protection - 'lax' for development
      maxAge: COOKIE_MAX_AGE,
      path: '/',
    };

    res.cookie(REFRESH_TOKEN_COOKIE_NAME, refreshToken, cookieOptions);
  }

  /**
   * Clear refresh token cookie (for logout)
   */
  private clearRefreshTokenCookie(res: Response): void {
    res.clearCookie(REFRESH_TOKEN_COOKIE_NAME, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      path: '/',
    });
  }

  /**
   * Get refresh token from cookie
   */
  private getRefreshTokenFromCookie(req: Request): string {
    const cookieValue = req.cookies?.[REFRESH_TOKEN_COOKIE_NAME];
    if (!cookieValue) {
      throw new BadRequestException('Refresh token cookie not found');
    }
    return cookieValue;
  }

  @Public()
  @Post('register')
  @Throttle({ short: { limit: 10, ttl: 60000 }, long: { limit: 50, ttl: 3600000 } })
  @ApiOperation({ summary: 'Register a new user' })
  @ApiResponse({ status: 201, description: 'User registered successfully' })
  @ApiResponse({ status: 409, description: 'User already exists' })
  async register(
    @Body() dto: RegisterDto,
    @Res({ passthrough: true }) res: Response,
  ): Promise<AuthResponse> {
    const isProduction = process.env.NODE_ENV === 'production';
    const result = await this.authService.register(dto);

    // Set refresh token in HttpOnly cookie
    this.setRefreshTokenCookie(res, result.refreshToken, isProduction);

    // Return response without refresh token in body (it's in the cookie now)
    const { refreshToken, ...responseWithoutRefresh } = result;
    return responseWithoutRefresh as AuthResponse;
  }

  @Public()
  @Post('login')
  @HttpCode(HttpStatus.OK)
  @Throttle({ short: { limit: 10, ttl: 60000 }, long: { limit: 50, ttl: 3600000 } })
  @ApiOperation({ summary: 'Login with email and password' })
  @ApiResponse({ status: 200, description: 'Login successful' })
  @ApiResponse({ status: 401, description: 'Invalid credentials' })
  async login(
    @Body() dto: LoginDto,
    @Res({ passthrough: true }) res: Response,
  ): Promise<AuthResponse> {
    const isProduction = process.env.NODE_ENV === 'production';
    const result = await this.authService.login(dto);

    // Set refresh token in HttpOnly cookie
    this.setRefreshTokenCookie(res, result.refreshToken, isProduction);

    // Return response without refresh token in body (it's in the cookie now)
    const { refreshToken, ...responseWithoutRefresh } = result;
    return responseWithoutRefresh as AuthResponse;
  }

  @Public()
  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  @Throttle({ short: { limit: 60, ttl: 60000 }, long: { limit: 500, ttl: 3600000 } })
  @ApiOperation({ summary: 'Refresh access token' })
  @ApiResponse({ status: 200, description: 'Tokens refreshed' })
  @ApiResponse({ status: 401, description: 'Invalid refresh token' })
  async refresh(
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ): Promise<AuthResponse> {
    const isProduction = process.env.NODE_ENV === 'production';
    // Read refresh token from cookie
    const refreshToken = this.getRefreshTokenFromCookie(req);
    const result = await this.authService.refreshTokens(refreshToken);

    // Update refresh token cookie with new token
    this.setRefreshTokenCookie(res, result.refreshToken, isProduction);

    // Return response without refresh token in body
    const { refreshToken: _, ...responseWithoutRefresh } = result;
    return responseWithoutRefresh as AuthResponse;
  }

  @Public()
  @Post('logout')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Logout and invalidate refresh token' })
  @ApiResponse({ status: 204, description: 'Logged out successfully' })
  async logout(
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ): Promise<void> {
    try {
      const refreshToken = this.getRefreshTokenFromCookie(req);
      await this.authService.logout(refreshToken);
    } catch {
      // Continue with logout even if token validation fails
    }
    this.clearRefreshTokenCookie(res);

    // Clear the user context cookie to prevent stale user data
    const userContextCookie = 'helix_user_context';
    res.clearCookie(userContextCookie, { path: '/' });
  }

  @Post('change-password')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Change password' })
  @ApiResponse({ status: 204, description: 'Password changed successfully' })
  async changePassword(
    @CurrentUser('id') userId: string,
    @Body() dto: ChangePasswordDto,
  ): Promise<void> {
    return this.authService.changePassword(userId, dto);
  }

  @Get('me')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get current user profile' })
  @ApiResponse({ status: 200, description: 'Current user profile' })
  async getMe(@CurrentUser('id') userId: string) {
    return this.authService.getMe(userId);
  }

  @Patch('me')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Update current user profile' })
  @ApiResponse({ status: 200, description: 'Profile updated successfully' })
  @ApiResponse({ status: 400, description: 'Invalid input' })
  async updateProfile(
    @CurrentUser('id') userId: string,
    @Body() dto: UpdateProfileDto,
  ) {
    return this.authService.updateProfile(userId, dto);
  }

  // ============================================
  // Organization-Aware Authentication
  // ============================================

  @Public()
  @Post('org/login')
  @HttpCode(HttpStatus.OK)
  @Throttle({ short: { limit: 10, ttl: 60000 }, long: { limit: 50, ttl: 3600000 } })
  @ApiOperation({ summary: 'Login to a specific organization' })
  @ApiResponse({ status: 200, description: 'Login successful with organization context' })
  @ApiResponse({ status: 401, description: 'Invalid credentials' })
  @ApiResponse({ status: 400, description: 'Organization not found or inactive' })
  async orgLogin(
    @Body() dto: OrgLoginDto,
    @Res({ passthrough: true }) res: Response,
  ): Promise<OrgAuthResponse> {
    const isProduction = process.env.NODE_ENV === 'production';

    // Get organization by slug first
    const org = await this.orgAuthService.getOrganizationBySlug(dto.organizationSlug);

    // Login to the organization
    const result = await this.orgAuthService.loginToOrganization(
      dto.email,
      dto.password,
      org.id,
    );

    // Set refresh token in HttpOnly cookie
    this.setRefreshTokenCookie(res, result.refreshToken, isProduction);

    // Return response without refresh token in body
    const { refreshToken, ...responseWithoutRefresh } = result;
    return responseWithoutRefresh as OrgAuthResponse;
  }

  @Post('org/switch')
  @UseGuards(JwtAuthWithOrgGuard)
  @ApiBearerAuth()
  @HttpCode(HttpStatus.OK)
  @Throttle({ short: { limit: 30, ttl: 60000 }, long: { limit: 100, ttl: 3600000 } })
  @ApiOperation({ summary: 'Switch to a different organization' })
  @ApiResponse({ status: 200, description: 'Organization switched successfully' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 400, description: 'Not a member of organization' })
  async switchOrganization(
    @CurrentUser('id') userId: string,
    @Body() dto: SwitchOrganizationDto,
    @Res({ passthrough: true }) res: Response,
  ): Promise<OrgAuthResponse> {
    const isProduction = process.env.NODE_ENV === 'production';
    const result = await this.orgAuthService.switchOrganization(userId, dto.organizationId);

    // Update refresh token cookie
    this.setRefreshTokenCookie(res, result.refreshToken, isProduction);

    // Return response without refresh token in body
    const { refreshToken, ...responseWithoutRefresh } = result;
    return responseWithoutRefresh as OrgAuthResponse;
  }

  @Get('org/me')
  @UseGuards(JwtAuthWithOrgGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get current user with organization info' })
  @ApiResponse({ status: 200, description: 'User profile with organization context' })
  async getMeWithOrg(@CurrentUser('id') userId: string) {
    const user = await this.authService.getMe(userId);
    const organizations = await this.orgAuthService.getUserOrganizations(userId);

    return {
      ...user,
      organizations,
    };
  }

  @Public()
  @Get('org/:slug')
  @ApiOperation({ summary: 'Get organization info by slug (for login page)' })
  @ApiResponse({ status: 200, description: 'Organization info' })
  @ApiResponse({ status: 404, description: 'Organization not found' })
  async getOrganizationBySlug(@Param('slug') slug: string) {
    const org = await this.orgAuthService.getOrganizationBySlug(slug);

    return {
      id: org.id,
      name: org.name,
      slug: org.slug,
      logoUrl: org.logoUrl,
      primaryColor: org.primaryColor,
      authProviderType: org.authProviderType,
    };
  }

  // ============================================
  // Azure AD SSO Authentication
  // ============================================

  @Public()
  @Get('azure/login')
  @ApiOperation({ summary: 'Initiate Azure AD login flow' })
  @ApiResponse({ status: 302, description: 'Redirects to Azure AD login' })
  async azureLogin(
    @Res() res: Response,
    @Query('redirect') redirectUrl?: string,
    @Query('org') orgSlug?: string,
  ) {
    // Get Azure AD configuration - either from organization or global env
    let clientID: string;
    let clientSecret: string;
    let tenantId: string;
    let redirectUri: string;

    if (orgSlug) {
      // Use organization-specific Azure AD config
      const org = await this.prisma.organization.findUnique({
        where: { slug: orgSlug },
      });

      if (!org) {
        const frontendUrl = process.env.APP_URL || 'http://localhost:5173';
        res.redirect(302, `${frontendUrl}/login?error=organization_not_found`);
        return;
      }

      if (!org.azureAdEnabled || !org.azureAdClientId || !org.azureAdClientSecret || !org.azureAdTenantId || !org.azureAdRedirectUri) {
        const frontendUrl = process.env.APP_URL || 'http://localhost:5173';
        res.redirect(302, `${frontendUrl}/login?error=azure_not_configured_for_org`);
        return;
      }

      clientID = org.azureAdClientId;
      clientSecret = org.azureAdClientSecret;
      tenantId = org.azureAdTenantId;
      redirectUri = org.azureAdRedirectUri;
    } else {
      // Use global env config (legacy/fallback)
      clientID = process.env.AZURE_AD_CLIENT_ID || '';
      clientSecret = process.env.AZURE_AD_CLIENT_SECRET || '';
      tenantId = process.env.AZURE_AD_TENANT_ID || '';
      redirectUri = process.env.AZURE_AD_REDIRECT_URI || '';

      const hasRealConfig =
        clientID && clientID !== 'your-azure-client-id' &&
        clientSecret && clientSecret !== 'your-azure-client-secret' &&
        tenantId && tenantId !== 'your-azure-tenant-id' &&
        redirectUri && redirectUri.startsWith('http');

      if (!hasRealConfig) {
        const frontendUrl = process.env.APP_URL || 'http://localhost:5173';
        res.redirect(302, `${frontendUrl}/login?error=azure_not_configured`);
        return;
      }
    }

    // Generate PKCE code verifier and challenge
    const codeVerifier = this.generateCodeVerifier();
    const codeChallenge = await this.generateCodeChallenge(codeVerifier);

    // Store code verifier in a cookie for callback
    res.cookie('pkce_verifier', codeVerifier, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      maxAge: 600000, // 10 minutes
      path: '/',
      sameSite: 'none', // Required for cross-site POST requests
    });

    // Build Azure AD authorization URL with PKCE
    const encodedRedirectUri = encodeURIComponent(redirectUri!);
    // Pass PKCE verifier, post-login redirect, and org slug in state parameter
    const state = Buffer.from(JSON.stringify({
      ts: Date.now(),
      verifier: codeVerifier,
      redirect: redirectUrl || null,
      org: orgSlug || null,
    })).toString('base64');

    const authUrl = `https://login.microsoftonline.com/${tenantId}/oauth2/v2.0/authorize?` +
      `client_id=${clientID}` +
      `&response_type=code` +
      `&redirect_uri=${encodedRedirectUri}` +
      `&scope=openid%20profile%20email` +
      `&response_mode=form_post` +
      `&state=${state}` +
      `&code_challenge=${codeChallenge}` +
      `&code_challenge_method=S256`;

    // Redirect to Azure AD login page
    res.redirect(302, authUrl);
  }

  @Public()
  @Post('azure/callback')
  @ApiOperation({ summary: 'Handle Azure AD callback' })
  @ApiResponse({ status: 302, description: 'Login successful - redirects to frontend' })
  @ApiResponse({ status: 401, description: 'Authentication failed' })
  async azureCallback(
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ): Promise<void> {
    // Debug: Log the raw body and cookies
    console.log('Azure AD callback received:');
    console.log('  Body:', JSON.stringify(req.body));
    console.log('  Cookies:', JSON.stringify(req.cookies));
    console.log('  Content-Type:', req.headers['content-type']);

    const { code, error, error_description, state } = req.body as any;

    // Handle error from Azure AD
    if (error) {
      console.error('Azure AD OAuth error:', error, error_description);
      const frontendUrl = process.env.APP_URL || 'http://localhost:5173';
      res.clearCookie('pkce_verifier', { path: '/', sameSite: 'none' });
      res.redirect(302, `${frontendUrl}/login?error=azure_auth_failed&message=${encodeURIComponent(error_description || error)}`);
      return;
    }

    if (!code) {
      console.error('Azure AD callback missing authorization code');
      const frontendUrl = process.env.APP_URL || 'http://localhost:5173';
      res.clearCookie('pkce_verifier', { path: '/', sameSite: 'none' });
      res.redirect(302, `${frontendUrl}/login?error=missing_code`);
      return;
    }

    // Get PKCE code verifier from cookie OR from state parameter (fallback)
    let codeVerifier = req.cookies?.pkce_verifier;

    // If no cookie, try to extract from state parameter
    if (!codeVerifier && state) {
      try {
        const stateData = JSON.parse(Buffer.from(state, 'base64').toString('utf-8'));
        codeVerifier = stateData.verifier;
        console.log('Using PKCE verifier from state parameter');
      } catch (e) {
        console.error('Failed to parse state parameter:', e);
      }
    }

    if (!codeVerifier) {
      console.error('PKCE code verifier not found in cookies or state');
      console.error('Available cookies:', Object.keys(req.cookies || {}));
      const frontendUrl = process.env.APP_URL || 'http://localhost:5173';
      res.clearCookie('pkce_verifier', { path: '/', sameSite: 'none' });
      res.redirect(302, `${frontendUrl}/login?error=missing_pkce_verifier`);
      return;
    }

    // Clear the PKCE verifier cookie
    res.clearCookie('pkce_verifier', { path: '/', sameSite: 'none' });

    // Extract org info and Azure AD config from state parameter
    let orgSlug: string | null = null;
    let azureAdConfig: {
      tenantId: string;
      clientId: string;
      clientSecret: string;
      redirectUri: string;
    } | undefined;

    if (state) {
      try {
        const stateData = JSON.parse(Buffer.from(state, 'base64').toString('utf-8'));
        orgSlug = stateData.org || null;
      } catch (e) {
        console.error('Failed to parse state for org info:', e);
      }
    }

    // Get organization-specific Azure AD config if org is specified
    if (orgSlug) {
      const org = await this.prisma.organization.findUnique({
        where: { slug: orgSlug },
      });

      if (org && org.azureAdEnabled && org.azureAdClientId && org.azureAdClientSecret && org.azureAdTenantId && org.azureAdRedirectUri) {
        azureAdConfig = {
          tenantId: org.azureAdTenantId,
          clientId: org.azureAdClientId,
          clientSecret: org.azureAdClientSecret,
          redirectUri: org.azureAdRedirectUri,
        };
      }
    }

    try {
      // Exchange authorization code for tokens with PKCE verifier (and org-specific config if available)
      console.log('Exchanging authorization code for tokens...');
      const tokens = await this.authService.exchangeAzureCode(code as string, codeVerifier, azureAdConfig);
      console.log('Token exchange successful');

      // Set refresh token in HttpOnly cookie
      this.setRefreshTokenCookie(res, tokens.refreshToken, process.env.NODE_ENV === 'production');

      // Get redirect URL from state parameter (if any)
      let postLoginRedirect = '/dashboard';
      if (state) {
        try {
          const stateData = JSON.parse(Buffer.from(state, 'base64').toString('utf-8'));
          if (stateData.redirect) {
            postLoginRedirect = stateData.redirect;
            console.log('Post-login redirect:', postLoginRedirect);
          }
        } catch (e) {
          console.error('Failed to parse state for redirect:', e);
        }
      }

      // Redirect to frontend with access token in URL
      const frontendUrl = process.env.APP_URL || 'http://localhost:5173';
      const redirectUrl = `${frontendUrl}/auth/azure/callback?token=${encodeURIComponent(tokens.accessToken)}&redirect=${encodeURIComponent(postLoginRedirect)}`;

      res.redirect(302, redirectUrl);
    } catch (err) {
      console.error('Azure AD token exchange error:', err);
      const frontendUrl = process.env.APP_URL || 'http://localhost:5173';
      res.redirect(302, `${frontendUrl}/login?error=token_exchange_failed`);
    }
  }

  /**
   * Generate a random code verifier for PKCE
   */
  private generateCodeVerifier(): string {
    const array = new Uint8Array(32);
    require('crypto').randomFillSync(array);
    return Buffer.from(array)
      .toString('base64')
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=/g, '');
  }

  /**
   * Generate code challenge from code verifier for PKCE
   */
  private async generateCodeChallenge(codeVerifier: string): Promise<string> {
    const crypto = require('crypto');
    const hash = crypto.createHash('sha256').update(codeVerifier).digest();
    return Buffer.from(hash)
      .toString('base64')
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=/g, '');
  }

  @Public()
  @Post('azure/logout')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Logout from Azure AD session' })
  @ApiResponse({ status: 204, description: 'Logged out successfully' })
  async azureLogout(
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ): Promise<void> {
    try {
      const refreshToken = this.getRefreshTokenFromCookie(req);
      await this.authService.logout(refreshToken);
    } catch {
      // Continue with logout even if token validation fails
    }
    this.clearRefreshTokenCookie(res);

    // Clear the user context cookie
    const userContextCookie = 'helix_user_context';
    res.clearCookie(userContextCookie, { path: '/' });
  }
}
