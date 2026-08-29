/* eslint-disable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access */

import request from "supertest";

import { PrismaService } from "./../../src/infrastructure/prisma/prisma.service";
import { createE2EApp } from "./../e2e-app";

describe("Auth API (e2e)", () => {
  let prisma: PrismaService;
  let agent: ReturnType<typeof request.agent>;
  let close: () => Promise<void>;
  const email = `auth-e2e-${Date.now()}@example.test`;
  const password = "password123";
  let userId: string;

  beforeAll(async () => {
    ({ prisma, agent, close } = await createE2EApp());
    await prisma.user.deleteMany({ where: { email } });
  });

  afterAll(async () => {
    if (prisma) await prisma.user.deleteMany({ where: { email } });
    await close?.();
  });

  it("rejects malformed registration input", async () => {
    await agent.post("/api/auth/register").send({}).expect(400);
  });

  it("registers a user, creates a session, and sets an HttpOnly refresh cookie", async () => {
    const response = await agent
      .post("/api/auth/register")
      .send({ email, username: "auth-e2e", password })
      .expect(201);

    userId = response.body.data.user.id;
    expect(response.body).toMatchObject({
      data: {
        user: { id: userId, email, username: "auth-e2e" },
        accessToken: expect.any(String),
      },
    });
    expect(response.body.data).not.toHaveProperty("refreshToken");
    expect(response.headers["set-cookie"][0]).toContain("refreshToken=");
    expect(response.headers["set-cookie"][0]).toContain("HttpOnly");
    expect(await prisma.session.count({ where: { userId } })).toBe(1);
  });

  it("rejects a duplicate registration and invalid credentials", async () => {
    await agent
      .post("/api/auth/register")
      .send({ email, username: "auth-e2e", password })
      .expect(409);
    await agent
      .post("/api/auth/login")
      .send({ email, password: "wrong-password" })
      .expect(401);
    await agent
      .post("/api/auth/login")
      .send({ email: "nobody@example.test", password })
      .expect(401);
  });

  it("login creates another session and refresh rotates only its active session", async () => {
    const login = await agent
      .post("/api/auth/login")
      .send({ email, password })
      .expect(201);
    const sessionCount = await prisma.session.count({ where: { userId } });
    expect(sessionCount).toBe(2);
    expect(login.headers["set-cookie"][0]).toContain("refreshToken=");

    const beforeRefresh = await prisma.session.findMany({
      where: { userId },
      orderBy: { createdAt: "asc" },
    });
    const refresh = await agent.post("/api/auth/refresh").expect(201);
    const afterRefresh = await prisma.session.findMany({
      where: { userId },
      orderBy: { createdAt: "asc" },
    });

    expect(refresh.body).toEqual({ data: { accessToken: expect.any(String) } });
    expect(refresh.headers["set-cookie"][0]).toContain("refreshToken=");
    expect(afterRefresh).toHaveLength(2);
    expect(
      afterRefresh.some(
        (current, index) =>
          current.refreshTokenHash !== beforeRefresh[index].refreshTokenHash,
      ),
    ).toBe(true);
  });

  it("returns the authenticated user from me and rejects absent or invalid access tokens", async () => {
    const login = await agent
      .post("/api/auth/login")
      .send({ email, password })
      .expect(201);
    const accessToken = login.body.data.accessToken;

    const response = await agent
      .get("/api/auth/me")
      .set("Authorization", `Bearer ${accessToken}`)
      .expect(200);
    expect(response.body).toMatchObject({
      data: { user: { id: userId, email, username: "auth-e2e" } },
    });
    expect(response.body.data.user).not.toHaveProperty("password");
    await agent.get("/api/auth/me").expect(401);
    await agent
      .get("/api/auth/me")
      .set("Authorization", "Bearer invalid")
      .expect(401);
  });

  it("logs out by deleting the active session and clearing the cookie", async () => {
    const beforeLogout = await prisma.session.count({ where: { userId } });
    const response = await agent.post("/api/auth/logout").expect(201);

    expect(response.body).toEqual({ message: "Logged out successfully" });
    expect(response.headers["set-cookie"][0]).toContain("refreshToken=;");
    expect(await prisma.session.count({ where: { userId } })).toBe(
      beforeLogout - 1,
    );
  });

  it("returns 401 rather than 500 for repeated logout or a missing refresh token", async () => {
    await agent.post("/api/auth/logout").expect(401);
  });
});
