import { Module } from "@nestjs/common";
import { ConfigModule, ConfigService } from "@nestjs/config";
import { JwtModule } from "@nestjs/jwt";
import { AuthController } from "./auth.controller";
import { AuthService } from "./auth.service";
import { JwtStrategy } from "./jwt.strategy";
import { BrevoService } from "./mail/brevo.service";
import { MustChangePasswordGuard } from "./must-change-password.guard";
import { TokenBlacklistService } from "./token-blacklist.service";

@Module({
  imports: [
    ConfigModule,
    JwtModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => ({
        secret: configService.getOrThrow<string>("JWT_ACCESS_SECRET"),
        signOptions: { algorithm: "HS256" },
        verifyOptions: { algorithms: ["HS256"] }
      })
    })
  ],
  controllers: [AuthController],
  providers: [
    AuthService,
    JwtStrategy,
    BrevoService,
    MustChangePasswordGuard,
    TokenBlacklistService
  ],
  exports: [AuthService, JwtModule, MustChangePasswordGuard, TokenBlacklistService]
})
export class AuthModule {}
