import { ConflictException, Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { InjectRepository } from '@nestjs/typeorm';
import * as bcrypt from 'bcryptjs';
import * as crypto from 'crypto';
import { Repository } from 'typeorm';
import { v4 as uuidv4 } from 'uuid';

import { RefreshToken } from '../database/entities/refresh-token.entity';
import { User, UserRole } from '../database/entities/user.entity';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';

export interface JwtPayload {
  sub: string; // userId
  email: string;
}

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
}

export interface AuthResult extends AuthTokens {
  user: { id: string; email: string; displayName: string; role: UserRole };
}

const REFRESH_TTL_DAYS = 30;

function hashToken(token: string): string {
  return crypto.createHash('sha256').update(token).digest('hex');
}

@Injectable()
export class AuthService {
  constructor(
    @InjectRepository(User)
    private readonly users: Repository<User>,
    @InjectRepository(RefreshToken)
    private readonly refreshTokens: Repository<RefreshToken>,
    private readonly jwt: JwtService,
  ) {}

  async register(dto: RegisterDto): Promise<AuthResult> {
    const existing = await this.users.findOne({ where: { email: dto.email } });
    if (existing) throw new ConflictException('Email already registered');

    const passwordHash = await bcrypt.hash(dto.password, 12);
    const user = this.users.create({
      email: dto.email,
      passwordHash,
      displayName: dto.displayName,
    });
    await this.users.save(user);
    return this.issue(user, uuidv4());
  }

  async login(dto: LoginDto): Promise<AuthResult> {
    const user = await this.users.findOne({ where: { email: dto.email } });
    if (!user) throw new UnauthorizedException('Invalid credentials');

    const valid = await bcrypt.compare(dto.password, user.passwordHash);
    if (!valid) throw new UnauthorizedException('Invalid credentials');

    return this.issue(user, uuidv4());
  }

  /**
   * Validate a refresh token cookie and rotate it. Returns new token pair.
   * If the token is already revoked (reuse), the entire family is revoked (theft detection).
   */
  async refresh(rawToken: string): Promise<AuthResult> {
    const hash = hashToken(rawToken);
    const record = await this.refreshTokens.findOne({ where: { tokenHash: hash } });

    if (!record || record.expiresAt < new Date()) {
      throw new UnauthorizedException('Invalid or expired refresh token');
    }

    if (record.revoked) {
      // Reuse detected — revoke entire family.
      await this.refreshTokens.update({ family: record.family }, { revoked: true });
      throw new UnauthorizedException('Refresh token reuse detected — please log in again');
    }

    // Revoke this token (rotate: issue a new one in the same family).
    await this.refreshTokens.update(record.id, { revoked: true });

    const user = await this.users.findOneOrFail({ where: { id: record.userId } });
    return this.issue(user, record.family);
  }

  /** Revoke the given refresh token so logout is effective across devices. */
  async logout(rawToken: string): Promise<void> {
    const hash = hashToken(rawToken);
    await this.refreshTokens.update({ tokenHash: hash }, { revoked: true });
  }

  private async issue(user: User, family: string): Promise<AuthResult> {
    const payload: JwtPayload = { sub: user.id, email: user.email };
    const accessToken = this.jwt.sign(payload);

    const rawRefresh = crypto.randomBytes(40).toString('hex');
    const expiresAt = new Date(Date.now() + REFRESH_TTL_DAYS * 86_400_000);
    await this.refreshTokens.save(
      this.refreshTokens.create({
        userId: user.id,
        tokenHash: hashToken(rawRefresh),
        family,
        revoked: false,
        expiresAt,
      }),
    );

    return {
      accessToken,
      refreshToken: rawRefresh,
      user: { id: user.id, email: user.email, displayName: user.displayName, role: user.role },
    };
  }
}
