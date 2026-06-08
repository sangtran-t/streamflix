import { Controller, Get, Param, Request, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';

import { User } from '../database/entities/user.entity';
import { CatalogService, HomeResponse, TitleSummary } from './catalog.service';

interface MaybeAuthRequest extends Request {
  user?: User;
}

/**
 * Optional-JWT guard: lets the request through whether or not a valid Bearer
 * token is present. When valid, req.user is populated; otherwise undefined.
 */
class OptionalJwtGuard extends AuthGuard('jwt') {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  override handleRequest(_err: any, user: any): any {
    return user ?? null;
  }
}

@Controller({ version: '1', path: 'catalog' })
export class CatalogController {
  constructor(private readonly catalog: CatalogService) {}

  @Get('home')
  @UseGuards(OptionalJwtGuard)
  getHome(@Request() req: MaybeAuthRequest): Promise<HomeResponse> {
    return this.catalog.getHome(req.user?.id);
  }

  @Get('titles')
  listTitles(): Promise<TitleSummary[]> {
    return this.catalog.listTitles();
  }

  @Get('titles/:slug')
  getTitle(@Param('slug') slug: string): Promise<TitleSummary> {
    return this.catalog.getTitleBySlug(slug);
  }
}
