import { Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { JwtService } from "@nestjs/jwt";
import {
  ConnectedSocket,
  MessageBody,
  OnGatewayConnection,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer
} from "@nestjs/websockets";
import { Server, Socket } from "socket.io";
import { getCorsOrigins } from "../common/cors-origins";
import { JWT_ALGORITHMS } from "../auth/jwt.constants";
import { TokenBlacklistService } from "../auth/token-blacklist.service";
import { PrismaService } from "../prisma/prisma.service";
import { NOT_DELETED } from "../common/utils/soft-delete";
import type { AuthUserPayload } from "../common/types/auth-user";

function resolveSocketOrigin(
  origin: string | undefined,
  callback: (err: Error | null, allow?: boolean) => void
) {
  const allowed = getCorsOrigins();
  if (allowed === false) {
    callback(new Error("Not allowed by CORS"), false);
    return;
  }
  if (allowed === true || !origin || (Array.isArray(allowed) && allowed.includes(origin))) {
    callback(null, true);
    return;
  }
  callback(new Error("Not allowed by CORS"), false);
}

@WebSocketGateway({
  cors: {
    origin: resolveSocketOrigin,
    credentials: true
  }
})
export class NotificationsGateway implements OnGatewayConnection {
  private readonly logger = new Logger(NotificationsGateway.name);

  @WebSocketServer()
  server!: Server;

  constructor(
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
    private readonly prisma: PrismaService,
    private readonly tokenBlacklist: TokenBlacklistService
  ) {}

  private extractToken(client: Socket): string | null {
    const authToken = client.handshake.auth?.token;
    if (typeof authToken === "string" && authToken.trim()) {
      return authToken.trim();
    }
    const header = client.handshake.headers.authorization;
    if (typeof header === "string" && header.startsWith("Bearer ")) {
      return header.slice(7).trim();
    }
    const cookieHeader = client.handshake.headers.cookie;
    if (typeof cookieHeader === "string") {
      const match = cookieHeader.match(/(?:^|;\s*)access_token=([^;]+)/);
      if (match?.[1]) {
        return decodeURIComponent(match[1]);
      }
    }
    return null;
  }

  async handleConnection(client: Socket) {
    try {
      const token = this.extractToken(client);
      if (!token) {
        client.disconnect(true);
        return;
      }

      if (await this.tokenBlacklist.isRevoked(token)) {
        client.disconnect(true);
        return;
      }

      const payload = await this.jwtService.verifyAsync<AuthUserPayload & { purpose?: string }>(
        token,
        {
          secret: this.configService.getOrThrow<string>("JWT_ACCESS_SECRET"),
          algorithms: [...JWT_ALGORITHMS]
        }
      );

      if (!payload.sub || payload.purpose === "password_reset") {
        client.disconnect(true);
        return;
      }

      const user = await this.prisma.user.findFirst({
        where: { id: payload.sub, ...NOT_DELETED, isActive: true },
        select: { id: true, role: true }
      });
      if (!user) {
        client.disconnect(true);
        return;
      }

      client.data.user = { sub: user.id, role: user.role };
      await client.join(`role:${user.role}`);
      await client.join(`user:${user.id}`);
    } catch (error) {
      this.logger.warn(`Socket auth failed: ${error instanceof Error ? error.message : "unknown"}`);
      client.disconnect(true);
    }
  }

  notifyRole(role: string, event: string, payload: unknown) {
    this.server.to(`role:${role}`).emit(event, payload);
  }

  @SubscribeMessage("join")
  join(@ConnectedSocket() client: Socket, @MessageBody() data: { room?: string }) {
    const user = client.data.user as { sub: string; role: string } | undefined;
    if (!user) {
      return { error: "Unauthorized" };
    }

    const room = data?.room?.trim();
    if (!room) {
      return { error: "Invalid room" };
    }

    // Only allow joining the caller's own user/role rooms
    const allowed = new Set([`role:${user.role}`, `user:${user.sub}`]);
    if (!allowed.has(room)) {
      return { error: "Forbidden" };
    }

    void client.join(room);
    return { joined: room };
  }
}
