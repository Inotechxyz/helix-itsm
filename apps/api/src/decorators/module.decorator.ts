import { SetMetadata } from '@nestjs/common';

/**
 * Decorator to mark endpoints or controllers as requiring specific modules.
 * The module must be enabled in the organization's license for access.
 *
 * @example
 * @RequiredModule('service_catalog')
 * @Controller('service-catalog')
 * export class ServiceCatalogController { }
 *
 * @example
 * @RequiredModule('knowledge_base')
 * @Get('articles')
 * getArticles() { }
 */
export const MODULE_KEY = 'required_module';
export const RequiredModule = (module: string) => SetMetadata(MODULE_KEY, module);