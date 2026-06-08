import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Put,
  Request,
  UseGuards,
} from '@nestjs/common';

import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { User } from '../database/entities/user.entity';
import { ProgressItem, ProgressService } from './progress.service';

interface AuthRequest extends Request {
  user: User;
}

@Controller({ version: '1', path: 'me/progress' })
@UseGuards(JwtAuthGuard)
export class ProgressController {
  constructor(private readonly progressSvc: ProgressService) {}

  @Get()
  getProgress(@Request() req: AuthRequest): Promise<ProgressItem[]> {
    return this.progressSvc.getProgress(req.user.id);
  }

  @Put(':titleId')
  @HttpCode(HttpStatus.NO_CONTENT)
  async upsertProgress(
    @Request() req: AuthRequest,
    @Param('titleId', ParseUUIDPipe) titleId: string,
    @Body() body: { positionSeconds: number },
  ): Promise<void> {
    await this.progressSvc.upsertProgress(req.user.id, titleId, body.positionSeconds);
  }
}
