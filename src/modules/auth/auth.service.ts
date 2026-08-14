import {
  Injectable,
  ConflictException,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';

import { UsersService } from '@module/users/users.service';
import { SessionsService } from '@module/sessions/sessions.service';

import { RegisterDto, LoginDto } from './dto/index';

import { hashValue, compareHash } from '@/utils/passport.utils';

@Injectable()
export class AuthService {
  constructor(
    private readonly usersService: UsersService,
    private readonly sessionService: SessionsService,
    private readonly jwtService: JwtService,
  ) {}

  private async createTokens(userId: string, sessionId: string) {
    const accessToken = await this.jwtService.signAsync(
      {
        sub: userId,
      },
      {
        secret: process.env.JWT_ACCESS_SECRET,
        expiresIn: '15m',
      },
    );

    const refreshToken = await this.jwtService.signAsync(
      {
        sub: userId,
        sessionId,
      },
      {
        secret: process.env.JWT_REFRESH_SECRET,
        expiresIn: '7d',
      },
    );

    return {
      accessToken,
      refreshToken,
    };
  }

  async register(dto: RegisterDto) {
    const { email, username, password } = dto;
    const user = await this.usersService.findUserByEmail(email);

    if (user)
      throw new ConflictException('User with this email already exists');

    const hashedPassword = await hashValue(password);
    const createdUser = await this.usersService.createUser({
      email,
      username,
      password: hashedPassword,
    });

    const { password: _password, ...userWithoutPassword } = createdUser;
    const session = await this.sessionService.createSession(createdUser.id);

    const { accessToken, refreshToken } = await this.createTokens(
      createdUser.id,
      session.id,
    );

    const refreshTokenHash = await hashValue(refreshToken);
    await this.sessionService.updateSession(session.id, refreshTokenHash);

    return {
      data: {
        user: userWithoutPassword,
        accessToken,
        refreshToken,
      },
    };
  }

  async login(dto: LoginDto) {
    const { email, password } = dto;
    const user = await this.usersService.findUserByEmail(email);
    if (!user) throw new UnauthorizedException('Invalid email or password');

    const isValidPassword = await compareHash(password, user.password);
    if (!isValidPassword)
      throw new UnauthorizedException('Invalid email or password');

    const { password: _password, ...userWithoutPassword } = user;
    const session = await this.sessionService.createSession(user.id);
    const { accessToken, refreshToken } = await this.createTokens(
      user.id,
      session.id,
    );

    const refreshTokenHash = await hashValue(refreshToken);
    await this.sessionService.updateSession(session.id, refreshTokenHash);

    return {
      data: {
        user: userWithoutPassword,
        accessToken,
        refreshToken,
      },
    };
  }

  async logout(refreshToken: string) {
    const payload = await this.jwtService.verifyAsync(refreshToken, {
      secret: process.env.JWT_REFRESH_SECRET,
    });
    await this.sessionService.logoutSession(payload.sessionId);

    return {
      message: 'Logged out successfully',
    };
  }

  async getCurrentUser(userId: string) {
    const user = await this.usersService.findUserById(userId);

    if (!user) {
      throw new UnauthorizedException();
    }

    const { password: _password, ...userWithoutPassword } = user;

    return {
      data: {
        user: userWithoutPassword,
      },
    };
  }

  async refreshTokens(refreshToken: string) {
    const payload = await this.jwtService.verifyAsync(refreshToken, {
      secret: process.env.JWT_REFRESH_SECRET,
    });

    const session = await this.sessionService.findSessionById(
      payload.sessionId,
    );
    if (!session) {
      throw new UnauthorizedException('Invalid refresh token');
    }
    const isValidRefreshToken = await compareHash(
      refreshToken,
      session.refreshTokenHash,
    );

    if (!isValidRefreshToken) {
      throw new UnauthorizedException('Invalid refresh token');
    }

    const { accessToken, refreshToken: newRefreshToken } =
      await this.createTokens(payload.sub, session.id);

    const newRefreshTokenHash = await hashValue(newRefreshToken);

    await this.sessionService.updateSession(session.id, newRefreshTokenHash);

    return {
      data: {
        accessToken,
        refreshToken: newRefreshToken,
      },
    };
  }
}
