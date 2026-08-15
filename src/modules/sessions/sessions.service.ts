import { Injectable } from "@nestjs/common";
import { PrismaService } from "@/infrastructure/prisma/prisma.service";

@Injectable()
export class SessionsService {
  constructor(private readonly prisma: PrismaService) {}

  async createSession(userId: string) {
    return this.prisma.session.create({
      data: {
        userId,
        refreshTokenHash: "",
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      },
    });
  }

  async updateSession(sessionId: string, sessionHash: string) {
    return this.prisma.session.update({
      where: {
        id: sessionId,
      },
      data: {
        refreshTokenHash: sessionHash,
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      },
    });
  }

  async findSessionById(sessiondId: string) {
    return this.prisma.session.findUnique({
      where: {
        id: sessiondId,
      },
    });
  }

  async logoutSession(sessionId: string) {
    return this.prisma.session.delete({
      where: {
        id: sessionId,
      },
    });
  }
}
