import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { HttpModule } from '@nestjs/axios';
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler';
import { PassportModule } from '@nestjs/passport';
import { APP_GUARD } from '@nestjs/core';
import { PrismaModule } from './common/prisma.module';
import { ChatbotModule } from './chatbot/chatbot.module';
import { JwtStrategy } from './auth/strategies/jwt.strategy';
import { HttpClientModule } from './chatbot/http/http.module';
import { ChatbotPromptConfigModule } from './config/chatbot-prompt-config.module';

@Module({
  imports: [
    // Configuration
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: ['.env.local', '.env'],
    }),

    // HTTP module for API calls
    HttpModule.register({
      timeout: 30000,
      maxRedirects: 5,
    }),

    // HTTP client module for API calls (Global - provides ApiClientService)
    HttpClientModule,

    // Chatbot prompt configuration (Global - provides ChatbotPromptConfigService)
    ChatbotPromptConfigModule,

    // Passport for JWT authentication
    PassportModule.register({ defaultStrategy: 'jwt' }),

    // Database
    PrismaModule,

    // Rate limiting
    ThrottlerModule.forRoot([
      {
        name: 'short',
        ttl: 60000,
        limit: 300,
      },
      {
        name: 'long',
        ttl: 3600000,
        limit: 15000,
      },
    ]),

    // Chatbot module
    ChatbotModule,
  ],
  providers: [
    JwtStrategy,
    {
      provide: APP_GUARD,
      useClass: ThrottlerGuard,
    },
  ],
})
export class AppModule {}