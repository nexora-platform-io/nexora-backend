import { INestApplication, ValidationPipe } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import cookieParser from "cookie-parser";
import request from "supertest";

import { AppModule } from "./../src/app.module";
import { PrismaService } from "./../src/infrastructure/prisma/prisma.service";

export const createE2EApp = async () => {
  const module = await Test.createTestingModule({
    imports: [AppModule],
  }).compile();
  const app: INestApplication = module.createNestApplication();
  app.use(cookieParser());
  app.setGlobalPrefix("api");
  app.useGlobalPipes(
    new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true }),
  );
  await app.init();

  const prisma = app.get(PrismaService);

  return {
    app,
    prisma,
    agent: request.agent(app.getHttpServer()),
    close: async () => {
      await app.close();
      await prisma.$disconnect();
    },
  };
};
