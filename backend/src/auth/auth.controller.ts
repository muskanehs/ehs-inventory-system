import {
  Body,
  Controller,
  Get,
  Post,
  Req,
  Res,
  UnauthorizedException,
  UseGuards
} from "@nestjs/common";
import { Throttle } from "@nestjs/throttler";
import { Request, Response } from "express";
import type { AuthUserPayload } from "../common/types/auth-user";
import { AuthService } from "./auth.service";
import {
  REFRESH_TOKEN_COOKIE,
  clearAuthCookies,
  logAuthCookiesFromRequest,
  readCookieToken,
  setAuthCookies
} from "./auth-cookies";
import { LoginDto } from "./dto/login.dto";
import {
  ChangePasswordDto,
  ForgotPasswordDto,
  ResetPasswordDto,
  VerifyOtpDto
} from "./dto/password.dto";
import { SwitchUserDto } from "./dto/switch-user.dto";
import { AllowDuringPasswordChange } from "./decorators/allow-during-password-change.decorator";
import { extractAccessToken } from "./extract-access-token";
import { JwtAuthGuard } from "./jwt-auth.guard";

@Controller("auth")
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post("login")
  @Throttle({ default: { limit: 5, ttl: 60000 } })
  async login(
    @Body() dto: LoginDto,
    @Res({ passthrough: true }) res: Response
  ) {
    const result = await this.authService.login(dto);
    setAuthCookies(res, result);
    return result;
  }

  @Get("me")
  @UseGuards(JwtAuthGuard)
  @AllowDuringPasswordChange()
  me(@Req() req: Request & { user: AuthUserPayload }) {
    logAuthCookiesFromRequest(req, "auth/me");
    return this.authService.getProfile(req.user.sub, req.user.act);
  }

  @Get("switchable-users")
  @UseGuards(JwtAuthGuard)
  @AllowDuringPasswordChange()
  listSwitchableUsers(@Req() req: { user: AuthUserPayload }) {
    return this.authService.listSwitchableUsers(req.user);
  }

  @Post("switch-user")
  @UseGuards(JwtAuthGuard)
  @AllowDuringPasswordChange()
  @Throttle({ default: { limit: 30, ttl: 60000 } })
  async switchUser(
    @Req() req: { user: AuthUserPayload },
    @Body() dto: SwitchUserDto,
    @Res({ passthrough: true }) res: Response
  ) {
    const result = await this.authService.switchUser(req.user, dto.userId);
    setAuthCookies(res, result);
    return result;
  }

  @Post("change-password")
  @UseGuards(JwtAuthGuard)
  @AllowDuringPasswordChange()
  async changePassword(
    @Req() req: { user: { sub: string } },
    @Body() dto: ChangePasswordDto,
    @Res({ passthrough: true }) res: Response
  ) {
    const result = await this.authService.changePassword(req.user.sub, dto);
    setAuthCookies(res, result);
    return result;
  }

  @Post("refresh")
  @Throttle({ default: { limit: 30, ttl: 60000 } })
  async refresh(
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response
  ) {
    logAuthCookiesFromRequest(req, "auth/refresh");
    const refreshToken =
      readCookieToken(
        req.cookies as Record<string, string | undefined> | undefined,
        REFRESH_TOKEN_COOKIE
      ) ??
      (typeof req.body?.refreshToken === "string" ? req.body.refreshToken : null);

    if (!refreshToken) {
      clearAuthCookies(res);
      throw new UnauthorizedException();
    }

    try {
      const result = await this.authService.refreshSession(refreshToken);
      setAuthCookies(res, result);
      return result;
    } catch (error) {
      clearAuthCookies(res);
      throw error;
    }
  }

  @Post("logout")
  @UseGuards(JwtAuthGuard)
  @AllowDuringPasswordChange()
  async logout(
    @Req() req: Request & { user: { sub: string } },
    @Res({ passthrough: true }) res: Response
  ) {
    const result = await this.authService.logout(req.user.sub, extractAccessToken(req));
    clearAuthCookies(res);
    return result;
  }

  @Post("forgot-password")
  // 8 attempts / 15 minutes — enough for retries without enabling OTP spam.
  @Throttle({ default: { limit: 8, ttl: 900000 } })
  forgotPassword(@Body() dto: ForgotPasswordDto) {
    return this.authService.forgotPassword(dto);
  }

  @Post("verify-otp")
  @Throttle({ default: { limit: 10, ttl: 60000 } })
  verifyOtp(@Body() dto: VerifyOtpDto) {
    return this.authService.verifyOtp(dto);
  }

  @Post("reset-password")
  @Throttle({ default: { limit: 10, ttl: 60000 } })
  resetPassword(@Body() dto: ResetPasswordDto) {
    return this.authService.resetPassword(dto);
  }
}
