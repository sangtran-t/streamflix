import { Controller, Param, Post, Req, Res, UseGuards } from '@nestjs/common';
import { Request, Response } from 'express';

import { User } from '../database/entities/user.entity';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { PlaybackService, PlaybackUrlResponse } from './playback.service';

@Controller({ version: '1', path: 'playback' })
export class PlaybackController {
  constructor(private readonly playback: PlaybackService) {}

  @Post(':assetId/url')
  @UseGuards(JwtAuthGuard)
  async getPlaybackUrl(
    @Param('assetId') assetId: string,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ): Promise<PlaybackUrlResponse> {
    const user = req.user as User;
    const { cookieValue, cookiePath, response } = await this.playback.getPlaybackUrl(
      user.id,
      assetId,
    );

    res.cookie('sf_play', cookieValue, {
      path: cookiePath,
      httpOnly: true,
      sameSite: 'lax',
      maxAge: 3600 * 1000, // ms
    });

    return response;
  }
}
