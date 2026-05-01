import { Module } from '@nestjs/common';
import { CategoriesController } from './categories.controller';
import { MediaController } from './media.controller';
import { ProductsController } from './products.controller';
import { CatalogRepository } from './repositories/catalog.repository';
import { CatalogService } from './catalog.service';

@Module({
  controllers: [CategoriesController, ProductsController, MediaController],
  providers: [CatalogRepository, CatalogService],
  exports: [CatalogService],
})
export class CatalogModule {}
