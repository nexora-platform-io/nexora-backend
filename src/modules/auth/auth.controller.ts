import { ApiOperation, ApiCreatedResponse, ApiBadRequestResponse, ApiConflictResponse, ApiTags, ApiUnauthorizedResponse, ApiOkResponse, ApiBearerAuth, ApiCookieAuth } from "@nestjs/swagger";
import { Controller, Body, Post, Get, UseGuards, Req, Res } from "@nestjs/common";
import type { Request, Response } from "express";

import { JwtAuthGuard } from "./strategies/jwt-auth.guard";
import type { AuthenticatedRequest } from "./types/auth.types";

import { AuthService } from "./auth.service";
import { RegisterDto, LoginDto, AuthSessionEnvelope, AccessTokenEnvelope, AuthUserEnvelopeResponse, MessageResponse } from "./dto/index";

@Controller("auth")
@ApiTags("Authentication")
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post("register")
  @ApiCreatedResponse({
    description: "User registered successfully",
    type: AuthSessionEnvelope,
    headers: {
      "Set-Cookie": {
        description: "HttpOnly refreshToken cookie for the authenticated session.",
        schema: { type: "string" },
      },
    },
  })
  @ApiBadRequestResponse({
    description: "Invalid request data",
  })
  @ApiConflictResponse({
    description: "User with this email already exists",
  })
  @ApiOperation({
    summary: "Register a user",
    description: "Creates a user account and starts an authenticated session.",
  })
  async register(@Body() dto: RegisterDto, @Res({ passthrough: true }) res: Response) {
    const { data } = await this.authService.register(dto);

    res.cookie("refreshToken", data.refreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "none",
      path: "/api/auth",
      maxAge: 1000 * 60 * 60 * 24 * 7,
    });

    return {
      data: {
        user: data.user,
        accessToken: data.accessToken,
      },
    };
  }

  @Post("login")
  @ApiOperation({
    summary: "Sign in",
    description: "Authenticates a user and rotates the refresh-token cookie.",
  })
  @ApiOkResponse({
    description: "User signed in successfully",
    type: AuthSessionEnvelope,
    headers: {
      "Set-Cookie": {
        description: "HttpOnly refreshToken cookie for the authenticated session.",
        schema: { type: "string" },
      },
    },
  })
  @ApiBadRequestResponse({ description: "Invalid request data" })
  @ApiUnauthorizedResponse({ description: "Invalid email or password" })
  async login(@Body() dto: LoginDto, @Res({ passthrough: true }) res: Response) {
    const { data } = await this.authService.login(dto);

    res.cookie("refreshToken", data.refreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "none",
      path: "/api/auth",
      maxAge: 1000 * 60 * 60 * 24 * 7,
    });

    return {
      data: {
        user: data.user,
        accessToken: data.accessToken,
      },
    };
  }

  @Post("logout")
  @ApiOperation({
    summary: "Sign out",
    description: "Revokes the current refresh-token session.",
  })
  @ApiCookieAuth("refresh-token")
  @ApiOkResponse({
    description: "User signed out successfully",
    type: MessageResponse,
    headers: {
      "Set-Cookie": {
        description: "Clears the HttpOnly refreshToken cookie.",
        schema: { type: "string" },
      },
    },
  })
  @ApiUnauthorizedResponse({ description: "Invalid or expired refresh token" })
  async logout(@Req() req: Request, @Res({ passthrough: true }) res: Response) {
    console.log(req.cookies);
    console.log(req.cookies.refreshToken);
    const refreshToken = req.cookies.refreshToken;
    const result = this.authService.logout(refreshToken);
    res.clearCookie("refreshToken", {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "none",
      path: "/api/auth",
      maxAge: 1000 * 60 * 60 * 24 * 7,
    });

    return result;
  }

  @UseGuards(JwtAuthGuard)
  @Get("me")
  @ApiBearerAuth("access-token")
  @ApiOperation({ summary: "Get the current user" })
  @ApiOkResponse({
    description: "Current user returned successfully",
    type: AuthUserEnvelopeResponse,
  })
  @ApiUnauthorizedResponse({ description: "Missing or invalid access token" })
  getCurrentUser(@Req() req: AuthenticatedRequest) {
    return this.authService.getCurrentUser(req.user.userId);
  }

  @Post("refresh")
  @ApiCookieAuth("refresh-token")
  @ApiOperation({ summary: "Refresh access tokens" })
  @ApiOkResponse({
    description: "Tokens refreshed successfully",
    type: AccessTokenEnvelope,
    headers: {
      "Set-Cookie": {
        description: "Rotated HttpOnly refreshToken cookie.",
        schema: { type: "string" },
      },
    },
  })
  @ApiBadRequestResponse({ description: "Invalid request data" })
  @ApiUnauthorizedResponse({ description: "Invalid or expired refresh token" })
  async refreshTokens(@Req() req: Request, @Res({ passthrough: true }) res: Response) {
    const refreshToken = req.cookies.refreshToken;
    const { data } = await this.authService.refreshTokens(refreshToken);

    res.cookie("refreshToken", data.refreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "none",
      path: "/api/auth",
      maxAge: 1000 * 60 * 60 * 24 * 7,
    });

    return {
      data: {
        accessToken: data.accessToken,
      },
    };
  }
}
