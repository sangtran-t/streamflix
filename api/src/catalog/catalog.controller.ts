import { Controller, Get, Param } from '@nestjs/common';

import { CatalogService, TitleSummary } from './catalog.service';

@Controller({ version: '1', path: 'catalog' })
export class CatalogController {
  constructor(private readonly catalog: CatalogService) {}

  @Get('titles')
  listTitles(): Promise<TitleSummary[]> {
    return this.catalog.listTitles();
  }

  @Get('titles/:slug')
  getTitle(@Param('slug') slug: string): Promise<TitleSummary> {
    return this.catalog.getTitleBySlug(slug);
  }
}
