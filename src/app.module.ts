import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AuthModule } from '@module/auth/auth.module';
import { PrismaModule } from '@/infrastructure/prisma/prisma.module';
import { UsersModule } from './modules/users/users.module';
import { SessionsModule } from './modules/sessions/sessions.module';

@Module({
  imports: [
    AuthModule,
    PrismaModule,
    UsersModule,
    SessionsModule,
    ConfigModule.forRoot({
      isGlobal: true,
    }),
  ],
})
export class AppModule {}
