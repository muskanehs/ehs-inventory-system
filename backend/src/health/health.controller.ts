import { Controller, Get } from "@nestjs/common";
import { SkipThrottle } from "@nestjs/throttler";
import { PrismaService } from "../prisma/prisma.service";
import { RedisService } from "../common/types/redis.service";

@Controller("health")
@SkipThrottle()
export class HealthController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService
  ) {}

  /** Liveness — process is up. */
  @Get()
  check() {
    return {
      status: "ok",
      timestamp: new Date().toISOString()
    };
  }

  /** Readiness — dependencies reachable. */
  @Get("ready")
  async ready() {
    const checks: Record<string, "up" | "down"> = {
      database: "down",
      redis: "down"
    };

    try {
      await this.prisma.$queryRaw`SELECT 1`;
      checks.database = "up";
    } catch {
      checks.database = "down";
    }

    try {
      const pong = await this.redis.client.ping();
      checks.redis = pong === "PONG" ? "up" : "down";
    } catch {
      checks.redis = "down";
    }

    const healthy = Object.values(checks).every((value) => value === "up");
    return {
      status: healthy ? "ok" : "degraded",
      timestamp: new Date().toISOString(),
      checks
    };
  }
}
