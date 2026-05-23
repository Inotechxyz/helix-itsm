/**
 * HTTP Module
 *
 * Provides HTTP client service for calling the main API app.
 * Uses @nestjs/axios for HTTP requests with automatic dependency injection.
 */
import { Module, Global } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { ApiClientService } from './api-client.service';

@Global()
@Module({
  imports: [
    HttpModule.registerAsync({
      imports: [ConfigModule],
      useFactory: async (config: ConfigService) => ({
        timeout: 30000,
        maxRedirects: 5,
      }),
      inject: [ConfigService],
    }),
  ],
  providers: [ApiClientService],
  exports: [ApiClientService, HttpModule],
})
export class HttpClientModule {}