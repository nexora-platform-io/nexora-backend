import { Injectable } from "@nestjs/common";
import { PrismaService } from "@/infrastructure/prisma/prisma.service";
import { InternalServerErrorException } from "@nestjs/common";

@Injectable()
export class SessionsService {
  constructor(private readonly prisma: PrismaService) {}

  async createSession(userId: string) {
    try {
      return await this.prisma.session.create({
        data: {
          userId,
          refreshTokenHash: "",
          expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
        },
      });
    } catch {
      throw new InternalServerErrorException("Failed to create session");
    }
  }

  async updateSession(sessionId: string, sessionHash: string) {
    try {
      return await this.prisma.session.update({
        where: {
          id: sessionId,
        },
        data: {
          refreshTokenHash: sessionHash,
          expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
        },
      });
    } catch {
      throw new InternalServerErrorException("Failed to update session");
    }
  }

  async findSessionById(sessiondId: string) {
    try {
      return await this.prisma.session.findUnique({
        where: {
          id: sessiondId,
        },
      });
    } catch {
      throw new InternalServerErrorException("Failed to find session");
    }
  }

  async logoutSession(sessionId: string) {
    try {
      return await this.prisma.session.delete({
        where: {
          id: sessionId,
        },
      });
    } catch {
      throw new InternalServerErrorException("Failed to delete session");
    }
  }
}
