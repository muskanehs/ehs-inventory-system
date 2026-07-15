import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  UnauthorizedException
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { JwtService } from "@nestjs/jwt";
import { Role } from "@prisma/client";
import * as bcrypt from "bcrypt";
import { PrismaService } from "../prisma/prisma.service";
import { LoginDto } from "./dto/login.dto";
import {
  ChangePasswordDto,
  ForgotPasswordDto,
  ResetPasswordDto,
  VerifyOtpDto
} from "./dto/password.dto";
import { BrevoService } from "./mail/brevo.service";
import {
  GENERIC_OTP_MESSAGE,
  OTP_MAX_ATTEMPTS,
  OTP_TTL_MS,
  assertPasswordsMatch,
  generateOtp,
  generateResetSecret,
  hashOtp,
  hashPassword,
  validatePasswordStrength,
  verifyOtp
} from "./password.util";
import type { AuthUserPayload } from "../common/types/auth-user";
import { NOT_DELETED } from "../common/utils/soft-delete";
import { JWT_ALGORITHMS } from "./jwt.constants";
import { TokenBlacklistService } from "./token-blacklist.service";

type JwtPayload = {
  sub: string;
  email: string;
  role: Role;
  assignedLocationId?: string | null;
  mustChangePassword?: boolean;
  act?: { sub: string };
};

type PasswordResetPayload = {
  sub: string;
  email: string;
  purpose: "password_reset";
  rst: string;
};

function toAuthUser(
  user: {
    id: string;
    name: string;
    email: string;
    role: Role;
    assignedLocationId: string | null;
    mustChangePassword: boolean;
    assignedLocation: { id: string; name: string; type: string } | null;
  },
  options?: { canSwitchUsers?: boolean }
) {
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role,
    assignedLocationId: user.assignedLocationId,
    mustChangePassword: user.mustChangePassword,
    assignedLocation: user.assignedLocation
      ? {
          id: user.assignedLocation.id,
          name: user.assignedLocation.name,
          type: user.assignedLocation.type
        }
      : null,
    canSwitchUsers: options?.canSwitchUsers ?? false
  };
}

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
    private readonly brevoService: BrevoService,
    private readonly tokenBlacklist: TokenBlacklistService
  ) {}

  private async issueTokens(
    user: {
      id: string;
      email: string;
      role: Role;
      assignedLocationId: string | null;
      mustChangePassword: boolean;
    },
    options?: { act?: { sub: string } }
  ) {
    const payload: JwtPayload = {
      sub: user.id,
      email: user.email,
      role: user.role,
      assignedLocationId: user.assignedLocationId,
      mustChangePassword: user.mustChangePassword
    };
    if (options?.act?.sub) {
      payload.act = { sub: options.act.sub };
    }

    const accessToken = await this.jwtService.signAsync(payload, {
      secret: this.configService.getOrThrow<string>("JWT_ACCESS_SECRET"),
      algorithm: "HS256",
      expiresIn: "15m"
    });
    const refreshToken = await this.jwtService.signAsync(payload, {
      secret: this.configService.getOrThrow<string>("JWT_REFRESH_SECRET"),
      algorithm: "HS256",
      expiresIn: "7d"
    });

    const tokenHash = await bcrypt.hash(refreshToken, 10);
    await this.prisma.refreshToken.create({
      data: {
        userId: user.id,
        tokenHash,
        expiresAt: new Date(Date.now() + 7 * 86400000)
      }
    });

    return { accessToken, refreshToken };
  }

  private async resolveCanSwitchUsers(role: Role, act?: { sub: string } | null) {
    if (role === Role.ADMIN) return true;
    if (!act?.sub) return false;
    const actor = await this.prisma.user.findFirst({
      where: {
        id: act.sub,
        role: Role.ADMIN,
        isActive: true,
        ...NOT_DELETED
      },
      select: { id: true }
    });
    return !!actor;
  }

  private async assertCanSwitchUsers(requester: AuthUserPayload) {
    const allowed = await this.resolveCanSwitchUsers(requester.role, requester.act);
    if (!allowed) {
      throw new ForbiddenException("Only administrators can switch users");
    }
  }

  private async resolveActorId(requester: AuthUserPayload) {
    if (requester.act?.sub) return requester.act.sub;
    if (requester.role === Role.ADMIN) return requester.sub;
    return null;
  }

  private async revokeUserSessions(userId: string) {
    await this.prisma.refreshToken.updateMany({
      where: { userId, revokedAt: null },
      data: { revokedAt: new Date() }
    });
  }

  private clearOtpData() {
    return {
      otpHash: null,
      otpExpiresAt: null,
      otpAttempts: 0
    };
  }

  async login(dto: LoginDto) {
    const user = await this.prisma.user.findFirst({
      where: { email: dto.email, ...NOT_DELETED },
      include: { assignedLocation: true }
    });
    if (!user || !user.isActive) throw new UnauthorizedException("Invalid credentials");
    const isMatch = await bcrypt.compare(dto.password, user.passwordHash);
    if (!isMatch) throw new UnauthorizedException("Invalid credentials");

    if (user.role === Role.GODOWN_MANAGER && !user.assignedLocationId) {
      throw new ForbiddenException(
        "Godown manager account has no assigned location. Contact an administrator."
      );
    }

    const tokens = await this.issueTokens(user);
    return {
      ...tokens,
      user: toAuthUser(user, {
        canSwitchUsers: user.role === Role.ADMIN
      })
    };
  }

  async getProfile(userId: string, act?: { sub: string } | null) {
    const user = await this.prisma.user.findFirst({
      where: { id: userId, ...NOT_DELETED },
      include: { assignedLocation: true }
    });
    if (!user || !user.isActive) throw new UnauthorizedException();
    const canSwitchUsers = await this.resolveCanSwitchUsers(user.role, act);
    const profileUser = act?.sub ? { ...user, mustChangePassword: false } : user;
    return toAuthUser(profileUser, { canSwitchUsers });
  }

  async listSwitchableUsers(requester: AuthUserPayload) {
    await this.assertCanSwitchUsers(requester);
    return this.prisma.user.findMany({
      where: { isActive: true, ...NOT_DELETED },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        assignedLocation: { select: { id: true, name: true } }
      },
      orderBy: [{ role: "asc" }, { name: "asc" }]
    });
  }

  async switchUser(requester: AuthUserPayload, targetUserId: string) {
    await this.assertCanSwitchUsers(requester);

    const actorId = await this.resolveActorId(requester);
    if (!actorId) {
      throw new ForbiddenException("Only administrators can switch users");
    }

    const actor = await this.prisma.user.findFirst({
      where: {
        id: actorId,
        role: Role.ADMIN,
        isActive: true,
        ...NOT_DELETED
      },
      select: { id: true }
    });
    if (!actor) {
      throw new ForbiddenException("Only administrators can switch users");
    }

    const target = await this.prisma.user.findFirst({
      where: { id: targetUserId, ...NOT_DELETED },
      include: { assignedLocation: true }
    });
    if (!target || !target.isActive) {
      throw new BadRequestException("User not found");
    }

    if (target.role === Role.GODOWN_MANAGER && !target.assignedLocationId) {
      throw new ForbiddenException(
        "Godown manager account has no assigned location. Contact an administrator."
      );
    }

    const act = target.id === actor.id ? undefined : { sub: actor.id };
    const tokens = await this.issueTokens(
      act
        ? {
            ...target,
            // Impersonation should not force the admin into the target's password-change gate.
            mustChangePassword: false
          }
        : target,
      act ? { act } : undefined
    );
    return {
      ...tokens,
      user: toAuthUser(
        act ? { ...target, mustChangePassword: false } : target,
        { canSwitchUsers: true }
      )
    };
  }

  async changePassword(userId: string, dto: ChangePasswordDto) {
    assertPasswordsMatch(dto.newPassword, dto.confirmPassword);
    validatePasswordStrength(dto.newPassword);

    const user = await this.prisma.user.findFirst({
      where: { id: userId, ...NOT_DELETED },
      include: { assignedLocation: true }
    });
    if (!user || !user.isActive) throw new UnauthorizedException();

    const matchesCurrent = await bcrypt.compare(dto.newPassword, user.passwordHash);
    if (matchesCurrent) {
      throw new BadRequestException("New password must be different from your current password");
    }

    const passwordHash = await hashPassword(dto.newPassword);
    await this.revokeUserSessions(user.id);

    const updated = await this.prisma.user.update({
      where: { id: user.id },
      data: {
        passwordHash,
        mustChangePassword: false,
        ...this.clearOtpData()
      },
      include: { assignedLocation: true }
    });

    const tokens = await this.issueTokens(updated);
    return {
      ...tokens,
      user: toAuthUser(updated, {
        canSwitchUsers: updated.role === Role.ADMIN
      })
    };
  }

  async forgotPassword(dto: ForgotPasswordDto) {
    const email = dto.email.trim().toLowerCase();
    const user = await this.prisma.user.findFirst({
      where: { email: { equals: email, mode: "insensitive" }, ...NOT_DELETED }
    });

    if (user?.isActive) {
      const otp = generateOtp();
      const otpHash = await hashOtp(otp);
      // Persist OTP before send so local DEV fallback (logged OTP) remains usable
      // if Brevo is not configured.
      await this.prisma.user.update({
        where: { id: user.id },
        data: {
          otpHash,
          otpExpiresAt: new Date(Date.now() + OTP_TTL_MS),
          otpAttempts: 0
        }
      });
      try {
        await this.brevoService.sendPasswordResetOtp(user.email, otp);
      } catch (error) {
        await this.prisma.user.update({
          where: { id: user.id },
          data: this.clearOtpData()
        });
        throw error;
      }
    }

    return { message: GENERIC_OTP_MESSAGE };
  }

  async verifyOtp(dto: VerifyOtpDto) {
    const email = dto.email.trim().toLowerCase();
    const genericFailure = () => {
      throw new BadRequestException("Invalid or expired OTP");
    };

    const user = await this.prisma.user.findFirst({
      where: { email: { equals: email, mode: "insensitive" }, ...NOT_DELETED }
    });

    if (!user || !user.isActive || !user.otpHash || !user.otpExpiresAt) {
      genericFailure();
    }

    const activeUser = user!;

    if (activeUser.otpAttempts >= OTP_MAX_ATTEMPTS) {
      genericFailure();
    }

    if (activeUser.otpExpiresAt!.getTime() < Date.now()) {
      genericFailure();
    }

    const matches = await verifyOtp(dto.otp, activeUser.otpHash!);
    if (!matches) {
      await this.prisma.user.update({
        where: { id: activeUser.id },
        data: { otpAttempts: { increment: 1 } }
      });
      genericFailure();
    }

    // Replace OTP hash with one-time reset secret (token reusable only once)
    const resetSecret = generateResetSecret();
    const resetSecretHash = await hashOtp(resetSecret);
    await this.prisma.user.update({
      where: { id: activeUser.id },
      data: {
        otpHash: resetSecretHash,
        otpExpiresAt: new Date(Date.now() + OTP_TTL_MS),
        otpAttempts: 0
      }
    });

    const resetPayload: PasswordResetPayload = {
      sub: activeUser.id,
      email: activeUser.email,
      purpose: "password_reset",
      rst: resetSecret
    };

    const resetToken = await this.jwtService.signAsync(resetPayload, {
      secret: this.configService.getOrThrow<string>("JWT_ACCESS_SECRET"),
      algorithm: "HS256",
      expiresIn: "10m"
    });

    return { resetToken };
  }

  async resetPassword(dto: ResetPasswordDto) {
    assertPasswordsMatch(dto.newPassword, dto.confirmPassword);
    validatePasswordStrength(dto.newPassword);

    let payload: PasswordResetPayload;
    try {
      payload = await this.jwtService.verifyAsync<PasswordResetPayload>(dto.resetToken, {
        secret: this.configService.getOrThrow<string>("JWT_ACCESS_SECRET"),
        algorithms: [...JWT_ALGORITHMS]
      });
    } catch {
      throw new BadRequestException("Invalid or expired reset token");
    }

    if (payload.purpose !== "password_reset" || !payload.sub || !payload.rst) {
      throw new BadRequestException("Invalid or expired reset token");
    }

    const user = await this.prisma.user.findFirst({
      where: { id: payload.sub, ...NOT_DELETED }
    });
    if (!user || !user.isActive || !user.otpHash || !user.otpExpiresAt) {
      throw new BadRequestException("Invalid or expired reset token");
    }

    if (user.otpExpiresAt.getTime() < Date.now()) {
      throw new BadRequestException("Invalid or expired reset token");
    }

    const secretMatches = await verifyOtp(payload.rst, user.otpHash);
    if (!secretMatches) {
      throw new BadRequestException("Invalid or expired reset token");
    }

    const passwordHash = await hashPassword(dto.newPassword);
    await this.revokeUserSessions(user.id);
    await this.prisma.user.update({
      where: { id: user.id },
      data: {
        passwordHash,
        mustChangePassword: false,
        ...this.clearOtpData()
      }
    });

    return { message: "Password has been reset. You can now sign in." };
  }

  async refreshSession(refreshToken: string) {
    let payload: JwtPayload;
    try {
      payload = await this.jwtService.verifyAsync<JwtPayload>(refreshToken, {
        secret: this.configService.getOrThrow<string>("JWT_REFRESH_SECRET"),
        algorithms: [...JWT_ALGORITHMS]
      });
    } catch {
      throw new UnauthorizedException();
    }

    if (!payload.sub) {
      throw new UnauthorizedException();
    }

    const storedTokens = await this.prisma.refreshToken.findMany({
      where: {
        userId: payload.sub,
        revokedAt: null,
        expiresAt: { gt: new Date() }
      }
    });

    let matched = false;
    for (const stored of storedTokens) {
      if (await bcrypt.compare(refreshToken, stored.tokenHash)) {
        matched = true;
        await this.prisma.refreshToken.update({
          where: { id: stored.id },
          data: { revokedAt: new Date() }
        });
        break;
      }
    }

    if (!matched) {
      throw new UnauthorizedException();
    }

    const user = await this.prisma.user.findFirst({
      where: { id: payload.sub, ...NOT_DELETED },
      include: { assignedLocation: true }
    });
    if (!user || !user.isActive) {
      throw new UnauthorizedException();
    }

    let act: { sub: string } | undefined;
    if (payload.act?.sub) {
      const actor = await this.prisma.user.findFirst({
        where: {
          id: payload.act.sub,
          role: Role.ADMIN,
          isActive: true,
          ...NOT_DELETED
        },
        select: { id: true }
      });
      if (actor) {
        act = { sub: actor.id };
      }
    }

    const sessionUser = act ? { ...user, mustChangePassword: false } : user;
    const tokens = await this.issueTokens(sessionUser, act ? { act } : undefined);
    const canSwitchUsers = await this.resolveCanSwitchUsers(user.role, act);
    return {
      ...tokens,
      user: toAuthUser(sessionUser, { canSwitchUsers })
    };
  }

  async logout(userId: string, accessToken?: string | null) {
    await this.revokeUserSessions(userId);
    if (accessToken) {
      try {
        const decoded = await this.jwtService.verifyAsync<{ exp?: number }>(accessToken, {
          secret: this.configService.getOrThrow<string>("JWT_ACCESS_SECRET"),
          algorithms: [...JWT_ALGORITHMS]
        });
        await this.tokenBlacklist.revokeAccessToken(accessToken, decoded.exp);
      } catch {
        await this.tokenBlacklist.revokeAccessToken(accessToken);
      }
    }
    return { message: "Signed out" };
  }
}
