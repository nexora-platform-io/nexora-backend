import { NestFactory } from "@nestjs/core";
import cookieParser from "cookie-parser";
import { DocumentBuilder, SwaggerModule } from "@nestjs/swagger";
import { AppModule } from "./app.module";
async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  app.use(cookieParser());
  app.setGlobalPrefix("api");

  app.enableCors({
    origin: process.env.NEXT_PUBLIC_FRONTEND_URL,
    credentials: true,
  });

  const swaggerConfig = new DocumentBuilder()
    .setTitle("Codeflow API")
    .setDescription("Authentication and workspace API for Codeflow.")
    .setVersion("1.0.0")
    .setContact("Codeflow", "https://github.com/codeflow-io", "support@codeflow.io")
    .addBearerAuth(
      {
        type: "http",
        scheme: "bearer",
        bearerFormat: "JWT",
        description: "Access token returned by sign-in or token refresh.",
      },
      "access-token",
    )
    .addCookieAuth(
      "refreshToken",
      {
        type: "apiKey",
        in: "cookie",
        name: "refreshToken",
        description: "HttpOnly refresh-token cookie.",
      },
      "refresh-token",
    )
    .build();
  const document = SwaggerModule.createDocument(app, swaggerConfig);
  SwaggerModule.setup("api/docs", app, document);

  await app.listen(process.env.PORT ?? 3000);
}
bootstrap();
