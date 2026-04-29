import { Module } from '@nestjs/common';
import { CategoriesController } from './categories.controller';
import { ProductsController } from './products.controller';
import { CatalogRepository } from './repositories/catalog.repository';
import { CatalogService } from './catalog.service';

@Module({
  controllers: [CategoriesController, ProductsController],
  providers: [CatalogRepository, CatalogService],
  exports: [CatalogService],
})
export class CatalogModule {}
