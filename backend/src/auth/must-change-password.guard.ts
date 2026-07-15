import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { Reflector } from "@nestjs/core";
import { JwtService } from "@nestjs/jwt";
import { Request } from "express";
import { PrismaService } from "../prisma/prisma.service";
import { NOT_DELETED } from "../common/utils/soft-delete";
import { ALLOW_DURING_PASSWORD_CHANGE_KEY } from "./decorators/allow-during-password-change.decorator";
import { extractAccessToken } from "./extract-access-token";
import { JWT_ALGORITHMS } from "./jwt.constants";

@Injectable()
export class MustChangePasswordGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
    private readonly prisma: PrismaService
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const allowDuringChange = this.reflector.getAllAndOverride<boolean>(
      ALLOW_DURING_PASSWORD_CHANGE_KEY,
      [context.getHandler(), context.getClass()]
    );
    if (allowDuringChange) {
      return true;
    }

    const request = context.switchToHttp().getRequest<Request>();
    const token = extractAccessToken(request);
    if (!token) {
      return true;
    }

    let userId: string | undefined;
    try {
      const payload = await this.jwtService.verifyAsync<{ sub?: string; purpose?: string }>(
        token,
        {
          secret: this.configService.getOrThrow<string>("JWT_ACCESS_SECRET"),
          algorithms: [...JWT_ALGORITHMS]
        }
      );
      if (payload.purpose === "password_reset") {
        return true;
      }
      userId = payload.sub;
    } catch {
      return true;
    }

    if (!userId) {
      return true;
    }

    const user = await this.prisma.user.findFirst({
      where: { id: userId, ...NOT_DELETED },
      select: { mustChangePassword: true }
    });

    if (user?.mustChangePassword) {
      throw new ForbiddenException({
        message: "Password change required",
        code: "PASSWORD_CHANGE_REQUIRED"
      });
    }

    return true;
  }
}
