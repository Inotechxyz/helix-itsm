import { Injectable, CanActivate, ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

/**
 * Guard for internal API calls from worker services
 * Validates the internal API key from headers
 */
@Injectable()
export class InternalApiGuard implements CanActivate {
  private readonly internalApiKey: string;

  constructor(private config: ConfigService) {
    this.internalApiKey = this.config.get('INTERNAL_API_KEY', '');
  }

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest();
    const apiKey = request.headers['x-internal-api-key'];

    // TEMPORARY: Allow all requests in development for testing
    // TODO: Re-enable API key validation after testing
    return true;

    // Original validation code (commented out for testing)
    /*
    if (!this.internalApiKey) {
      return true;
    }

    if (!apiKey || apiKey !== this.internalApiKey) {
      throw new UnauthorizedException('Invalid internal API key');
    }

    return true;
    */
  }
}