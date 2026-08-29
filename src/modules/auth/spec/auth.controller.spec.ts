import {
  ConflictException,
  ExecutionContext,
  INestApplication,
  UnauthorizedException,
  ValidationPipe,
} from "@nestjs/common";
import { Test } from "@nestjs/testing";
import cookieParser from "cookie-parser";
import request from "supertest";

jest.mock("@module/users/users.service", () => ({
  UsersService: class UsersService {},
}));
jest.mock("@module/sessions/sessions.service", () => ({
  SessionsService: class SessionsService {},
}));

import { AuthController } from "../auth.controller";
import { AuthService } from "../auth.service";
import { JwtAuthGuard } from "../strategies/jwt-auth.guard";

const user = { id: "user-1", email: "user@example.com", username: "user" };
const sessionData = {
  user,
  accessToken: "access-token",
  refreshToken: "refresh-token",
};

describe("AuthController HTTP endpoints", () => {
  let app: INestApplication;
  const authService = {
    register: jest.fn(),
    login: jest.fn(),
    logout: jest.fn(),
    refreshTokens: jest.fn(),
    getCurrentUser: jest.fn(),
  };
  const jwtGuard = { canActivate: jest.fn() };

  beforeEach(async () => {
    jest.resetAllMocks();
    jwtGuard.canActivate.mockImplementation((context: ExecutionContext) => {
      const request = context.switchToHttp().getRequest<{
        headers: { authorization?: string };
        user?: { userId: string };
      }>();
      if (request.headers.authorization === "Bearer valid-access-token") {
        request.user = { userId: user.id };
        return true;
      }
      throw new UnauthorizedException("Missing or invalid access token");
    });

    const module = await Test.createTestingModule({
      controllers: [AuthController],
      providers: [{ provide: AuthService, useValue: authService }],
    })
      .overrideGuard(JwtAuthGuard)
      .useValue(jwtGuard)
      .compile();

    app = module.createNestApplication();
    app.use(cookieParser());
    app.useGlobalPipes(
      new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true }),
    );
    await app.init();
  });

  afterEach(async () => app.close());

  it("POST /auth/register returns 201, omits the refresh token body field, and sets its cookie", async () => {
    authService.register.mockResolvedValue({ data: sessionData });

    const response = await request(app.getHttpServer())
      .post("/auth/register")
      .send({
        email: user.email,
        username: user.username,
        password: "password123",
      })
      .expect(201);

    expect(response.body).toEqual({
      data: { user, accessToken: "access-token" },
    });
    expect(response.headers["set-cookie"][0]).toContain(
      "refreshToken=refresh-token",
    );
    expect(response.headers["set-cookie"][0]).toContain("HttpOnly");
    expect(response.headers["set-cookie"][0]).toContain("Path=/");
    expect(authService.register).toHaveBeenCalledWith({
      email: user.email,
      username: user.username,
      password: "password123",
    });
  });

  it("POST /auth/register rejects invalid input and duplicate users", async () => {
    await request(app.getHttpServer())
      .post("/auth/register")
      .send({})
      .expect(400);

    authService.register.mockRejectedValue(
      new ConflictException("User with this email already exists"),
    );
    await request(app.getHttpServer())
      .post("/auth/register")
      .send({
        email: user.email,
        username: user.username,
        password: "password123",
      })
      .expect(409)
      .expect({
        message: "User with this email already exists",
        error: "Conflict",
        statusCode: 409,
      });
  });

  it("POST /auth/login returns 201, its auth payload, and a refresh-token cookie", async () => {
    authService.login.mockResolvedValue({ data: sessionData });

    const response = await request(app.getHttpServer())
      .post("/auth/login")
      .send({ email: user.email, password: "password123" })
      .expect(201);

    expect(response.body).toEqual({
      data: { user, accessToken: "access-token" },
    });
    expect(response.headers["set-cookie"][0]).toContain(
      "refreshToken=refresh-token",
    );
  });

  it("POST /auth/login rejects malformed requests and invalid credentials", async () => {
    await request(app.getHttpServer())
      .post("/auth/login")
      .send({ email: "not-an-email" })
      .expect(400);

    authService.login.mockRejectedValue(
      new UnauthorizedException("Invalid email or password"),
    );
    await request(app.getHttpServer())
      .post("/auth/login")
      .send({ email: user.email, password: "wrong-password" })
      .expect(401)
      .expect({
        message: "Invalid email or password",
        error: "Unauthorized",
        statusCode: 401,
      });
  });

  it("POST /auth/refresh returns a new access token and rotates the refresh cookie", async () => {
    authService.refreshTokens.mockResolvedValue({
      data: {
        accessToken: "new-access-token",
        refreshToken: "new-refresh-token",
      },
    });

    const response = await request(app.getHttpServer())
      .post("/auth/refresh")
      .set("Cookie", "refreshToken=old-refresh-token")
      .expect(201);

    expect(authService.refreshTokens).toHaveBeenCalledWith("old-refresh-token");
    expect(response.body).toEqual({
      data: { accessToken: "new-access-token" },
    });
    expect(response.headers["set-cookie"][0]).toContain(
      "refreshToken=new-refresh-token",
    );
  });

  it("POST /auth/refresh returns 401 for absent, expired, invalid, or sessionless refresh tokens", async () => {
    authService.refreshTokens.mockRejectedValue(
      new UnauthorizedException("Invalid refresh token"),
    );

    for (const cookie of [
      undefined,
      "refreshToken=expired",
      "refreshToken=invalid",
      "refreshToken=missing-session",
    ]) {
      const endpoint = request(app.getHttpServer()).post("/auth/refresh");
      if (cookie) endpoint.set("Cookie", cookie);
      await endpoint.expect(401).expect({
        message: "Invalid refresh token",
        error: "Unauthorized",
        statusCode: 401,
      });
    }
  });

  it("POST /auth/logout deletes the current session and clears its cookie", async () => {
    authService.logout.mockResolvedValue({
      message: "Logged out successfully",
    });

    const response = await request(app.getHttpServer())
      .post("/auth/logout")
      .set("Cookie", "refreshToken=refresh-token")
      .expect(201)
      .expect({ message: "Logged out successfully" });

    expect(authService.logout).toHaveBeenCalledWith("refresh-token");
    expect(response.headers["set-cookie"][0]).toContain("refreshToken=;");
    expect(response.headers["set-cookie"][0]).toContain("Path=/");
  });

  it("POST /auth/logout returns 401, never 500, for an invalid, missing, or already-revoked token", async () => {
    authService.logout.mockRejectedValue(
      new UnauthorizedException("Invalid refresh token"),
    );

    for (const cookie of [
      undefined,
      "refreshToken=invalid",
      "refreshToken=already-revoked",
    ]) {
      const endpoint = request(app.getHttpServer()).post("/auth/logout");
      if (cookie) endpoint.set("Cookie", cookie);
      await endpoint.expect(401).expect({
        message: "Invalid refresh token",
        error: "Unauthorized",
        statusCode: 401,
      });
    }
  });

  it("GET /auth/me returns the authenticated user and rejects missing or invalid access tokens", async () => {
    authService.getCurrentUser.mockResolvedValue({ data: user });

    await request(app.getHttpServer())
      .get("/auth/me")
      .set("Authorization", "Bearer valid-access-token")
      .expect(200)
      .expect({ data: user });
    expect(authService.getCurrentUser).toHaveBeenCalledWith(user.id);

    await request(app.getHttpServer()).get("/auth/me").expect(401);
    await request(app.getHttpServer())
      .get("/auth/me")
      .set("Authorization", "Bearer invalid")
      .expect(401);
  });

  it("GET /auth/me returns 401 when the JWT user no longer exists", async () => {
    authService.getCurrentUser.mockRejectedValue(new UnauthorizedException());

    await request(app.getHttpServer())
      .get("/auth/me")
      .set("Authorization", "Bearer valid-access-token")
      .expect(401);
  });
});
