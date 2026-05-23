import {
  Injectable,
  UnauthorizedException,
  ConflictException,
  BadRequestException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import * as bcrypt from 'bcryptjs';
import { PrismaService } from '../common/prisma.service';
import { UserRole } from '@helix/shared';
import {
  RegisterDto,
  LoginDto,
  ChangePasswordDto,
  ForgotPasswordDto,
  ResetPasswordDto,
} from './dto/auth.dto';
import { UpdateProfileDto } from './dto/update-profile.dto';

// Re-export UserRole for backward compatibility
export { UserRole };

// Auth provider constants
const AuthProvider = {
  LOCAL: 'local' as const,
  AZURE_AD: 'azure_ad' as const,
};

export interface JwtPayload {
  sub: string;
  email: string;
  role: UserRole;
}

export interface AuthResponse {
  accessToken: string;
  refreshToken: string;
  user: {
    id: string;
    email: string;
    firstName: string;
    lastName: string;
    role: UserRole;
    avatarUrl?: string;
  };
}

@Injectable()
export class AuthService {
  constructor(
    private prisma: PrismaService,
    private jwtService: JwtService,
    private config: ConfigService,
  ) {}

  // Local registration
  async register(dto: RegisterDto): Promise<AuthResponse> {
    const existing = await this.prisma.user.findUnique({
      where: { email: dto.email },
    });

    if (existing) {
      throw new ConflictException('User with this email already exists');
    }

    const hashedPassword = await bcrypt.hash(dto.password, 12);

    const user = await this.prisma.user.create({
      data: {
        email: dto.email,
        password: hashedPassword,
        firstName: dto.firstName,
        lastName: dto.lastName,
        jobTitle: dto.jobTitle,
        department: dto.department,
        role: 'user',
        authProvider: 'local',
      },
    });

    return this.generateTokens(user);
  }

  // Local login
  async login(dto: LoginDto): Promise<AuthResponse> {
    const user = await this.prisma.user.findUnique({
      where: { email: dto.email },
    });

    if (!user || !user.password) {
      throw new UnauthorizedException('Invalid credentials');
    }

    const isPasswordValid = await bcrypt.compare(dto.password, user.password);
    if (!isPasswordValid) {
      throw new UnauthorizedException('Invalid credentials');
    }

    if (!user.isActive) {
      throw new UnauthorizedException('User account is disabled');
    }

    return this.generateTokens(user);
  }

  // Azure AD login/callback
  async validateAzureUser(azureProfile: {
    id: string;
    email: string;
    firstName: string;
    lastName: string;
    displayName?: string;
  }): Promise<AuthResponse> {
    let user = await this.prisma.user.findUnique({
      where: { azureAdId: azureProfile.id },
    });

    if (!user) {
      // Check if user exists by email
      user = await this.prisma.user.findUnique({
        where: { email: azureProfile.email },
      });

      if (user) {
        // Link Azure AD to existing account
        user = await this.prisma.user.update({
          where: { id: user.id },
          data: {
            azureAdId: azureProfile.id,
            authProvider: 'azure_ad',
          },
        });
      } else {
        // Create new user from Azure AD
        const names = (azureProfile.displayName || azureProfile.firstName).split(' ');
        user = await this.prisma.user.create({
          data: {
            email: azureProfile.email,
            azureAdId: azureProfile.id,
            firstName: azureProfile.firstName || names[0] || 'User',
            lastName: azureProfile.lastName || names.slice(1).join(' ') || '',
            role: 'user',
            authProvider: 'azure_ad',
          },
        });
      }
    }

    if (!user.isActive) {
      throw new UnauthorizedException('User account is disabled');
    }

    return this.generateTokens(user);
  }

  /**
   * Exchange Azure AD authorization code for tokens and validate/create user
   * If azureAdConfig is provided, use organization-specific Azure AD credentials
   */
  async exchangeAzureCode(
    code: string,
    codeVerifier?: string,
    azureAdConfig?: {
      tenantId: string;
      clientId: string;
      clientSecret: string;
      redirectUri: string;
    },
  ): Promise<{ accessToken: string; refreshToken: string }> {
    const tenantId = azureAdConfig?.tenantId || this.config.get('AZURE_AD_TENANT_ID');
    const clientId = azureAdConfig?.clientId || this.config.get('AZURE_AD_CLIENT_ID');
    const clientSecret = azureAdConfig?.clientSecret || this.config.get('AZURE_AD_CLIENT_SECRET');
    const redirectUri = azureAdConfig?.redirectUri || this.config.get('AZURE_AD_REDIRECT_URI');

    // Exchange code for tokens at Azure AD token endpoint
    const tokenEndpoint = `https://login.microsoftonline.com/${tenantId}/oauth2/v2.0/token`;

    const params: Record<string, string> = {
      client_id: clientId!,
      client_secret: clientSecret!, // Required for Web/confidential client apps
      code,
      redirect_uri: redirectUri!,
      grant_type: 'authorization_code',
      scope: 'openid profile email',
    };

    // Note: For Web apps (confidential clients), client_secret is required
    // For SPA apps (public clients), client_secret should NOT be sent

    // Add PKCE code verifier if provided
    if (codeVerifier) {
      params.code_verifier = codeVerifier;
    }

    const tokenResponse = await fetch(tokenEndpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams(params).toString(),
    });

    if (!tokenResponse.ok) {
      const errorData = await tokenResponse.text();
      console.error('Azure AD token exchange failed:', errorData);
      throw new UnauthorizedException('Failed to exchange authorization code with Azure AD');
    }

    const tokens = await tokenResponse.json() as {
      access_token: string;
      id_token: string;
      refresh_token?: string;
    };

    // Decode ID token to get user profile
    // ID token is a JWT: header.payload.signature
    const idTokenParts = tokens.id_token.split('.');
    if (idTokenParts.length !== 3) {
      throw new UnauthorizedException('Invalid ID token format from Azure AD');
    }

    // Decode the payload (middle part) - it's base64url encoded
    const payloadBase64 = idTokenParts[1]
      .replace(/-/g, '+')
      .replace(/_/g, '/');
    const payloadJson = Buffer.from(payloadBase64, 'base64').toString('utf-8');
    const payload = JSON.parse(payloadJson) as {
      sub: string;
      email?: string;
      preferred_username?: string;
      name?: string;
      given_name?: string;
      family_name?: string;
    };

    // Extract user info from ID token
    const azureUser = {
      id: payload.sub,
      email: payload.email || payload.preferred_username || '',
      firstName: payload.given_name || payload.name?.split(' ')[0] || '',
      lastName: payload.family_name || payload.name?.split(' ').slice(1).join(' ') || '',
      displayName: payload.name,
    };

    // Validate/create user
    const authResponse = await this.validateAzureUser(azureUser);

    return {
      accessToken: authResponse.accessToken,
      refreshToken: authResponse.refreshToken,
    };
  }

  // Refresh tokens
  async refreshTokens(refreshToken: string): Promise<AuthResponse> {
    // Extract the actual JWT token (remove UUID suffix if present)
    const actualToken = refreshToken.split('.').slice(0, 3).join('.');

    // Find token record by looking for tokens that start with the actual token
    const tokenRecord = await this.prisma.refreshToken.findFirst({
      where: { token: { startsWith: actualToken } },
    });

    if (!tokenRecord) {
      throw new UnauthorizedException('Invalid refresh token');
    }

    if (tokenRecord.isRevoked) {
      throw new UnauthorizedException('Refresh token has been revoked');
    }

    if (tokenRecord.expiresAt < new Date()) {
      throw new UnauthorizedException('Refresh token has expired');
    }

    // Revoke old token
    await this.prisma.refreshToken.update({
      where: { id: tokenRecord.id },
      data: { isRevoked: true },
    });

    // Fetch user separately since RefreshToken has no direct relation
    const user = await this.prisma.user.findUnique({
      where: { id: tokenRecord.userId },
    });

    if (!user) {
      throw new UnauthorizedException('User not found');
    }

    return this.generateTokens(user);
  }

  // Logout
  async logout(refreshToken: string): Promise<void> {
    // Extract the actual JWT token (remove UUID suffix if present)
    const actualToken = refreshToken.split('.').slice(0, 3).join('.');

    // Revoke all tokens that start with the actual token
    await this.prisma.refreshToken.updateMany({
      where: { token: { startsWith: actualToken } },
      data: { isRevoked: true },
    });
  }

  // Change password
  async changePassword(userId: string, dto: ChangePasswordDto): Promise<void> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user || !user.password) {
      throw new BadRequestException('Password not set for this account');
    }

    const isCurrentValid = await bcrypt.compare(dto.currentPassword, user.password);
    if (!isCurrentValid) {
      throw new UnauthorizedException('Current password is incorrect');
    }

    const hashedPassword = await bcrypt.hash(dto.newPassword, 12);
    await this.prisma.user.update({
      where: { id: userId },
      data: { password: hashedPassword },
    });
  }

  // Get current user - optimized query, no nested relationships
  async getMe(userId: string) {
    // Use select to only fetch needed fields, avoiding expensive joins
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        role: true,
        jobTitle: true,
        department: true,
        phone: true,
        avatarUrl: true,
        isActive: true,
        // Don't include teams or organizationUsers here - use separate endpoint
      },
    });

    if (!user) {
      throw new UnauthorizedException('User not found');
    }

    // For superadmins, include all organizations in the response
    let organizations: any[] = [];
    if (user.role === 'superadmin') {
      const allOrgs = await this.prisma.organization.findMany({
        where: { status: { not: 'suspended' } },
        select: {
          id: true,
          name: true,
          slug: true,
          status: true,
          logoUrl: true,
          primaryColor: true,
        },
        orderBy: { name: 'asc' },
      });
      organizations = allOrgs.map((org) => ({
        id: org.id,
        name: org.name,
        slug: org.slug,
        status: org.status,
        logoUrl: org.logoUrl,
        primaryColor: org.primaryColor,
        role: 'orgadmin',
        isSuperadmin: true,
      }));
    }

    // Generate a new access token for session restoration
    const payload: JwtPayload = {
      sub: user.id,
      email: user.email,
      role: user.role as UserRole,
    };
    const accessToken = this.jwtService.sign(payload);

    return {
      ...user,
      accessToken, // Include access token for frontend session restoration
      organizations, // Include orgs for superadmins
    };
  }

  // Update current user profile (email cannot be changed)
  async updateProfile(userId: string, dto: UpdateProfileDto) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      throw new UnauthorizedException('User not found');
    }

    // Update only the provided fields (email is intentionally excluded)
    const updatedUser = await this.prisma.user.update({
      where: { id: userId },
      data: {
        firstName: dto.firstName ?? user.firstName,
        lastName: dto.lastName ?? user.lastName,
        jobTitle: dto.jobTitle ?? user.jobTitle,
        department: dto.department ?? user.department,
        phone: dto.phone ?? user.phone,
        avatarUrl: dto.avatarUrl ?? user.avatarUrl,
      },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        role: true,
        jobTitle: true,
        department: true,
        phone: true,
        avatarUrl: true,
        isActive: true,
      },
    });

    return updatedUser;
  }

  // Generate JWT tokens
  private async generateTokens(user: {
    id: string;
    email: string;
    firstName: string;
    lastName: string;
    role: string;
    avatarUrl?: string | null;
  }): Promise<AuthResponse> {
    const payload: JwtPayload = {
      sub: user.id,
      email: user.email,
      role: user.role as UserRole,
    };

    const accessToken = this.jwtService.sign(payload);
    const refreshTokenValue = this.jwtService.sign(payload, {
      secret: this.config.get('JWT_REFRESH_SECRET'),
      expiresIn: this.config.get('JWT_REFRESH_EXPIRES_IN', '7d'),
    });

    // Generate a unique token ID by appending a random suffix
    // This prevents collisions when tokens are generated at the same millisecond
    const uniqueToken = `${refreshTokenValue}.${crypto.randomUUID()}`;

    // Store refresh token
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 7);

    await this.prisma.refreshToken.create({
      data: {
        userId: user.id,
        token: uniqueToken,
        expiresAt,
      },
    });

    const refreshToken = uniqueToken;

    return {
      accessToken,
      refreshToken,
      user: {
        id: user.id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        role: user.role as UserRole,
        avatarUrl: user.avatarUrl || undefined,
      },
    };
  }
}
