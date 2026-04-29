import { Controller, Get } from '@nestjs/common';
import { CatalogService } from './catalog.service';
import { CategoryResponseDto } from './dto/category-response.dto';

@Controller('categories')
export class CategoriesController {
  constructor(private readonly catalogService: CatalogService) {}

  @Get()
  listCategories(): Promise<CategoryResponseDto[]> {
    return this.catalogService.getCategories();
  }
}
