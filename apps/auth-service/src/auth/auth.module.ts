import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { AuthService } from './auth.service';
import { AuthController } from './auth.controller';
import { RecruiterAuthController } from './recruiter-auth.controller';
import { RecruiterAuthService } from './recruiter-auth.service';
import { JwtStrategy } from './strategies/jwt.strategy';
import { GoogleStrategy } from './strategies/google.strategy';
import { MicrosoftStrategy } from './strategies/microsoft.strategy';
import { TenantsModule } from '../tenants/tenants.module';
import { RabbitMQModule } from '../messaging/rabbitmq.module';

@Module({
  imports: [
    PassportModule,
    JwtModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => ({
        secret: configService.getOrThrow<string>('JWT_SECRET'),
        signOptions: { expiresIn: '15m' },
      }),
    }),
    TenantsModule,
    RabbitMQModule,
  ],
  controllers: [AuthController, RecruiterAuthController],
  providers: [
    AuthService,
    RecruiterAuthService,
    JwtStrategy,
    GoogleStrategy,
    MicrosoftStrategy,
  ],
  exports: [AuthService, JwtModule],
})
export class AuthModule {}
