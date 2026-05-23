import { Module } from '@nestjs/common';
import { KnowledgeBaseController } from './knowledge-base.controller';
import { KnowledgeBaseService } from './knowledge-base.service';
import { EmbeddingService } from './embedding.service';
import { AuthModule } from '../auth/auth.module';
import { LicenseModule } from '../license/license.module';

@Module({
  imports: [AuthModule, LicenseModule],
  controllers: [KnowledgeBaseController],
  providers: [KnowledgeBaseService, EmbeddingService],
  exports: [KnowledgeBaseService, EmbeddingService],
})
export class KnowledgeBaseModule {}
