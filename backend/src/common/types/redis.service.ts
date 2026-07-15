import { Injectable, OnModuleDestroy } from "@nestjs/common";
import Redis from "ioredis";

@Injectable()
export class RedisService implements OnModuleDestroy {
  readonly client: Redis;

  constructor() {
    const redisUrl =
      process.env.REDIS_URL?.trim() ||
      (process.env.NODE_ENV === "production" ? "" : "redis://localhost:6379");

    if (!redisUrl) {
      throw new Error("[FATAL] Missing required environment variable: REDIS_URL");
    }

    this.client = new Redis(redisUrl);
  }

  async onModuleDestroy() {
    await this.client.quit();
  }
}
