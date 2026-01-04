import {
  Injectable,
  UnauthorizedException,
  ConflictException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';

import { PrismaService } from '../prisma/prisma.service';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { RefreshTokenDto } from './dto/refresh-token.dto';
import { EnvConfig } from '../config/env.validation';

@Injectable()
export class AuthService {
  constructor(
    private prisma: PrismaService,
    private jwtService: JwtService,
    private config: ConfigService<EnvConfig>,
  ) {}

  async register(dto: RegisterDto) {
    const existingUser = await this.prisma.user.findUnique({
      where: { email: dto.email },
    });

    if (existingUser) {
      throw new ConflictException('Email already exists');
    }

    const saltRounds =
      this.config.get('BCRYPT_SALT_ROUNDS', { infer: true }) ?? 10;
    const hashedPassword = await bcrypt.hash(dto.password, saltRounds);

    const user = await this.prisma.user.create({
      data: {
        email: dto.email,
        password: hashedPassword,
        name: dto.name,
      },
    });

    return this.generateTokens(user);
  }

  async login(dto: LoginDto) {
    const user = await this.prisma.user.findUnique({
      where: { email: dto.email },
    });

    if (!user) {
      throw new UnauthorizedException('Invalid credentials');
    }

    const isPasswordValid = await bcrypt.compare(dto.password, user.password);

    if (!isPasswordValid) {
      throw new UnauthorizedException('Invalid credentials');
    }

    return this.generateTokens(user);
  }

  async validateUser(userId: string) {
    return this.prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, email: true, name: true },
    });
  }

  private async generateTokens(user: {
    id: string;
    email: string;
    name: string;
  }) {
    const payload = { sub: user.id, email: user.email };

    // Generate access token (short-lived)
    const accessToken = this.jwtService.sign(payload, {
      secret: this.config.get('JWT_SECRET', { infer: true }),
      expiresIn: this.config.get('JWT_EXPIRES_IN', { infer: true }) ?? '15m',
    });

    // Generate refresh token as JWT (improved security)
    const refreshToken = this.jwtService.sign(
      {
        sub: user.id,
        type: 'refresh',
        tokenVersion: Date.now(), // Unique identifier
      },
      {
        secret: this.config.get('JWT_REFRESH_SECRET', { infer: true }),
        expiresIn:
          this.config.get('JWT_REFRESH_EXPIRES_IN', { infer: true }) ?? '7d',
      },
    );

    // Calculate expiration date
    const refreshExpiresIn =
      this.config.get('JWT_REFRESH_EXPIRES_IN', { infer: true }) ?? '7d';
    const expiresAt = new Date();
    const days = parseInt(refreshExpiresIn.replace('d', ''));
    expiresAt.setDate(expiresAt.getDate() + days);

    // Hash refresh token before storing (only hash stored, original sent to client)
    const hashedToken = await bcrypt.hash(refreshToken, 10);

    // Store hashed refresh token in database
    await this.prisma.refreshToken.create({
      data: {
        token: hashedToken,
        userId: user.id,
        expiresAt,
      },
    });

    return {
      accessToken,
      refreshToken,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
      },
    };
  }

  async refresh(dto: RefreshTokenDto) {
    // 1. Verify JWT signature and expiration
    let payload: any;
    try {
      payload = this.jwtService.verify(dto.refreshToken, {
        secret: this.config.get('JWT_REFRESH_SECRET', { infer: true }),
      });
    } catch (error) {
      throw new UnauthorizedException('Invalid refresh token');
    }

    // 2. Verify token type
    if (payload.type !== 'refresh') {
      throw new UnauthorizedException('Invalid token type');
    }

    const userId = payload.sub;

    // 3. Find all valid refresh tokens for user
    const storedTokens = await this.prisma.refreshToken.findMany({
      where: {
        userId,
        expiresAt: { gte: new Date() }, // Not expired
      },
      include: { user: true },
    });

    if (storedTokens.length === 0) {
      throw new UnauthorizedException('No valid refresh token found');
    }

    // 4. Check if the provided token matches any stored token (using bcrypt)
    let matchedToken: (typeof storedTokens)[0] | null = null;
    for (const stored of storedTokens) {
      const isMatch = await bcrypt.compare(dto.refreshToken, stored.token);
      if (isMatch) {
        matchedToken = stored;
        break;
      }
    }

    if (!matchedToken) {
      // Token reuse detected: valid JWT but not in DB = potential theft
      // Revoke all tokens for this user
      await this.prisma.refreshToken.deleteMany({ where: { userId } });
      throw new UnauthorizedException(
        'Token reuse detected - all sessions revoked for security',
      );
    }

    // 5. Rotation: Delete old refresh token
    await this.prisma.refreshToken.delete({
      where: { id: matchedToken.id },
    });

    // 6. Generate new tokens
    return this.generateTokens(matchedToken.user);
  }

  async logout(userId: string) {
    // Delete all refresh tokens for user
    await this.prisma.refreshToken.deleteMany({
      where: { userId },
    });

    return { message: 'Logged out successfully' };
  }
}
