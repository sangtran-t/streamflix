import {
  Controller,
  Param,
  Post,
  Req,
  Res,
  UseGuards,
} from '@nestjs/common';
import { Request, Response } from 'express';

import { User } from '../database/entities/user.entity';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { PlaybackService, PlaybackUrlResponse } from './playback.service';

@Controller({ version: '1', path: 'playback' })
export class PlaybackController {
  constructor(private readonly playback: PlaybackService) {}

  /**
   * POST /playback/:assetId/url
   *
   * Returns the master manifest URL and sets a signed sf_play cookie scoped
   * to /hls/:assetId so the browser can reach the Go delivery edge without
   * re-authorizing on every segment.
   *
   * See COMMUNICATION.md §4 for the full cookie/signature spec.
   */
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

    // Set the signed playback cookie on the response.
    // SameSite=Lax works for same-origin requests through the dev proxy.
    // Phase 3 can tighten to Strict once the refresh flow is in place.
    res.cookie('sf_play', cookieValue, {
      path: cookiePath,
      httpOnly: true,
      sameSite: 'lax',
      maxAge: 3600 * 1000, // ms
    });

    return response;
  }
}
