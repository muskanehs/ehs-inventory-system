import { Injectable, OnModuleInit } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { PrismaClient } from "@prisma/client";

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit {
  constructor(private readonly configService: ConfigService) {
    const slowQueryMs = Number(configService.get("SLOW_QUERY_MS") ?? 200);
    const isProduction = configService.get<string>("NODE_ENV") === "production";
    const enableQueryEvents = slowQueryMs > 0 && !isProduction;

    super({
      log: enableQueryEvents
        ? [
            { emit: "event", level: "query" },
            { emit: "stdout", level: "warn" },
            { emit: "stdout", level: "error" }
          ]
        : [
            { emit: "stdout", level: "warn" },
            { emit: "stdout", level: "error" }
          ]
    });

    if (enableQueryEvents) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (this as any).$on("query", (event: { duration: number; query: string }) => {
        if (event.duration >= slowQueryMs) {
          console.warn(`[Prisma slow query ${event.duration}ms] ${event.query}`);
        }
      });
    }
  }

  async onModuleInit() {
    await this.$connect();
  }
}
