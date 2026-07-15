import { Injectable, UnauthorizedException } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { PassportStrategy } from "@nestjs/passport";
import { Role } from "@prisma/client";
import { Request } from "express";
import { ExtractJwt, Strategy } from "passport-jwt";
import type { AuthUserPayload } from "../common/types/auth-user";
import { PrismaService } from "../prisma/prisma.service";
import { NOT_DELETED } from "../common/utils/soft-delete";
import { extractAccessToken } from "./extract-access-token";
import { JWT_ALGORITHMS } from "./jwt.constants";
import { TokenBlacklistService } from "./token-blacklist.service";

type JwtPayload = AuthUserPayload & { purpose?: string };

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(
    configService: ConfigService,
    private readonly prisma: PrismaService,
    private readonly tokenBlacklist: TokenBlacklistService
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromExtractors([
        (request: Request) => extractAccessToken(request)
      ]),
      ignoreExpiration: false,
      secretOrKey: configService.getOrThrow<string>("JWT_ACCESS_SECRET"),
      algorithms: [...JWT_ALGORITHMS],
      passReqToCallback: true
    });
  }

  async validate(req: Request, payload: JwtPayload): Promise<AuthUserPayload> {
    if (!payload.sub || payload.purpose === "password_reset") {
      throw new UnauthorizedException();
    }

    const token = extractAccessToken(req);
    if (token && (await this.tokenBlacklist.isRevoked(token))) {
      throw new UnauthorizedException();
    }

    const user = await this.prisma.user.findFirst({
      where: { id: payload.sub, ...NOT_DELETED },
      select: {
        id: true,
        email: true,
        role: true,
        assignedLocationId: true,
        mustChangePassword: true,
        isActive: true
      }
    });

    if (!user || !user.isActive) {
      throw new UnauthorizedException();
    }

    let act: AuthUserPayload["act"];
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
      if (!actor) {
        throw new UnauthorizedException();
      }
      act = { sub: actor.id };
    }

    return {
      sub: user.id,
      email: user.email,
      role: user.role,
      assignedLocationId: user.assignedLocationId,
      mustChangePassword: user.mustChangePassword,
      act
    };
  }
}
