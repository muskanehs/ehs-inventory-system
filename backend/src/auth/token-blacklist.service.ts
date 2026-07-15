import { Injectable } from "@nestjs/common";
import { createHash } from "crypto";
import { RedisService } from "../common/types/redis.service";

@Injectable()
export class TokenBlacklistService {
  constructor(private readonly redis: RedisService) {}

  private key(token: string) {
    const digest = createHash("sha256").update(token).digest("hex");
    return `bl:access:${digest}`;
  }

  async revokeAccessToken(token: string, expiresAtUnixSeconds?: number) {
    const now = Math.floor(Date.now() / 1000);
    const ttl = expiresAtUnixSeconds
      ? Math.max(1, expiresAtUnixSeconds - now)
      : 15 * 60;
    await this.redis.client.set(this.key(token), "1", "EX", ttl);
  }

  async isRevoked(token: string): Promise<boolean> {
    const value = await this.redis.client.get(this.key(token));
    return value === "1";
  }
}
