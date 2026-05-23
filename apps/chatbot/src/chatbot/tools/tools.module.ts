import { Module } from '@nestjs/common';
import { ToolExecutorService } from './tool-executor.service';
import { TicketsToolPlugin } from './modules/tickets.tool';
import { KnowledgeBaseToolPlugin } from './modules/knowledge-base.tool';
import { ServiceCatalogToolPlugin } from './modules/service-catalog.tool';
import { UsersToolPlugin } from './modules/users.tool';

@Module({
  providers: [
    ToolExecutorService,
    TicketsToolPlugin,
    KnowledgeBaseToolPlugin,
    ServiceCatalogToolPlugin,
    UsersToolPlugin,
  ],
  exports: [ToolExecutorService],
})
export class ToolsModule {}