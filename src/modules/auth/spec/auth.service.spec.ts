import {
  ConflictException,
  InternalServerErrorException,
  UnauthorizedException,
} from "@nestjs/common";
import { Test } from "@nestjs/testing";
import { JwtService } from "@nestjs/jwt";

jest.mock("@module/users/users.service", () => ({
  UsersService: class UsersService {},
}));
jest.mock("@module/sessions/sessions.service", () => ({
  SessionsService: class SessionsService {},
}));

import { AuthService } from "../auth.service";
import { UsersService } from "@module/users/users.service";
import { SessionsService } from "@module/sessions/sessions.service";

jest.mock("@/utils/passport.utils", () => ({
  hashValue: jest.fn().mockResolvedValue("hashed-token"),
  compareHash: jest.fn(),
}));

import { compareHash, hashValue } from "@/utils/passport.utils";

const user = {
  id: "user-1",
  email: "user@example.com",
  username: "user",
  password: "hashed-password",
};
const session = {
  id: "session-1",
  userId: user.id,
  refreshTokenHash: "old-hash",
  expiresAt: new Date(),
};

describe("AuthService session lifecycle", () => {
  let service: AuthService;
  const users = {
    findUserByEmail: jest.fn(),
    findUserById: jest.fn(),
    createUser: jest.fn(),
  };
  const sessions = {
    createSession: jest.fn(),
    updateSession: jest.fn(),
    findSessionById: jest.fn(),
    logoutSession: jest.fn(),
  };
  const jwt = { signAsync: jest.fn(), verifyAsync: jest.fn() };

  beforeEach(async () => {
    jest.resetAllMocks();
    jest.mocked(hashValue).mockResolvedValue("hashed-token");
    jwt.signAsync
      .mockResolvedValueOnce("access-token")
      .mockResolvedValueOnce("refresh-token");
    sessions.createSession.mockResolvedValue(session);
    sessions.updateSession.mockResolvedValue(session);

    const module = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: UsersService, useValue: users },
        { provide: SessionsService, useValue: sessions },
        { provide: JwtService, useValue: jwt },
      ],
    }).compile();
    service = module.get(AuthService);
  });

  it("register creates a user and session, hashes the refresh token, and returns tokens without password", async () => {
    users.findUserByEmail.mockResolvedValue(null);
    users.createUser.mockResolvedValue(user);

    const result = await service.register({
      email: user.email,
      username: user.username,
      password: "password123",
    });

    expect(users.createUser).toHaveBeenCalledWith({
      email: user.email,
      username: user.username,
      password: "hashed-token",
    });
    expect(sessions.createSession).toHaveBeenCalledWith(user.id);
    expect(hashValue).toHaveBeenCalledWith("refresh-token");
    expect(sessions.updateSession).toHaveBeenCalledWith(
      session.id,
      "hashed-token",
    );
    expect(result).toEqual({
      data: {
        user: { id: user.id, email: user.email, username: user.username },
        accessToken: "access-token",
        refreshToken: "refresh-token",
      },
    });
  });

  it("register rejects an existing email without creating a user or session", async () => {
    users.findUserByEmail.mockResolvedValue(user);

    await expect(
      service.register({
        email: user.email,
        username: user.username,
        password: "password123",
      }),
    ).rejects.toThrow(ConflictException);
    expect(users.createUser).not.toHaveBeenCalled();
    expect(sessions.createSession).not.toHaveBeenCalled();
  });

  it("login creates a new session only after valid credentials", async () => {
    users.findUserByEmail.mockResolvedValue(user);
    jest.mocked(compareHash).mockResolvedValue(true);

    await expect(
      service.login({ email: user.email, password: "password123" }),
    ).resolves.toMatchObject({
      data: { user: { id: user.id }, refreshToken: "refresh-token" },
    });
    expect(sessions.createSession).toHaveBeenCalledWith(user.id);
    expect(sessions.updateSession).toHaveBeenCalledWith(
      session.id,
      "hashed-token",
    );
  });

  it("login rejects missing users and invalid passwords without creating sessions", async () => {
    users.findUserByEmail
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(user);
    jest.mocked(compareHash).mockResolvedValue(false);

    await expect(
      service.login({ email: user.email, password: "password123" }),
    ).rejects.toThrow(UnauthorizedException);
    await expect(
      service.login({ email: user.email, password: "password123" }),
    ).rejects.toThrow(UnauthorizedException);
    expect(sessions.createSession).not.toHaveBeenCalled();
  });

  it("refresh verifies the token, uses the existing session, and updates its hash", async () => {
    jwt.verifyAsync.mockResolvedValue({ sub: user.id, sessionId: session.id });
    sessions.findSessionById.mockResolvedValue(session);
    jest.mocked(compareHash).mockResolvedValue(true);

    const result = await service.refreshTokens("refresh-token");

    expect(sessions.findSessionById).toHaveBeenCalledWith(session.id);
    expect(sessions.updateSession).toHaveBeenCalledWith(
      session.id,
      "hashed-token",
    );
    expect(result.data.accessToken).toBe("access-token");
  });

  it("refresh rejects a missing session or a refresh token whose hash does not match", async () => {
    jwt.verifyAsync.mockResolvedValue({ sub: user.id, sessionId: session.id });
    sessions.findSessionById
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(session);
    jest.mocked(compareHash).mockResolvedValue(false);

    await expect(service.refreshTokens("refresh-token")).rejects.toThrow(
      UnauthorizedException,
    );
    await expect(service.refreshTokens("refresh-token")).rejects.toThrow(
      UnauthorizedException,
    );
    expect(sessions.updateSession).not.toHaveBeenCalled();
  });

  it("refresh propagates an expired or invalid JWT without updating the session", async () => {
    jwt.verifyAsync.mockRejectedValue(
      new UnauthorizedException("Invalid refresh token"),
    );

    await expect(service.refreshTokens("expired-token")).rejects.toThrow(
      UnauthorizedException,
    );
    expect(sessions.findSessionById).not.toHaveBeenCalled();
    expect(sessions.updateSession).not.toHaveBeenCalled();
  });

  it("logout verifies the refresh token and deletes precisely its session", async () => {
    jwt.verifyAsync.mockResolvedValue({ sub: user.id, sessionId: session.id });
    sessions.logoutSession.mockResolvedValue(session);

    await expect(service.logout("refresh-token")).resolves.toEqual({
      message: "Logged out successfully",
    });
    expect(sessions.logoutSession).toHaveBeenCalledWith(session.id);
  });

  it("exposes the current production bug: a missing session on repeated logout becomes HTTP 500", async () => {
    jwt.verifyAsync.mockResolvedValue({ sub: user.id, sessionId: session.id });
    sessions.logoutSession.mockRejectedValue(
      new InternalServerErrorException("Failed to delete session"),
    );

    await expect(service.logout("already-revoked-token")).rejects.toMatchObject(
      { status: 500 },
    );
  });

  it("getCurrentUser returns a user without its password and rejects a missing user", async () => {
    users.findUserById.mockResolvedValueOnce(user).mockResolvedValueOnce(null);

    await expect(service.getCurrentUser(user.id)).resolves.toEqual({
      data: {
        user: { id: user.id, email: user.email, username: user.username },
      },
    });
    await expect(service.getCurrentUser(user.id)).rejects.toThrow(
      UnauthorizedException,
    );
  });
});
