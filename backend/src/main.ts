import "./config/load-env";
import { ValidationPipe } from "@nestjs/common";
import { NestFactory } from "@nestjs/core";
import * as compression from "compression";
import * as cookieParser from "cookie-parser";
import helmet from "helmet";
import { AppModule } from "./app.module";
import { getCorsOrigins } from "./common/cors-origins";
import { HttpExceptionFilter } from "./common/filters/http-exception.filter";
import { ResponseEnvelopeInterceptor } from "./common/interceptors/response-envelope.interceptor";
import { TimingInterceptor } from "./common/interceptors/timing.interceptor";
import { correlationIdMiddleware } from "./common/middleware/correlation-id.middleware";
import { validateEnv } from "./config/validate-env";

function resolveCorsOrigin():
  | boolean
  | string[]
  | ((
      origin: string | undefined,
      callback: (err: Error | null, allow?: boolean) => void
    ) => void) {
  const origins = getCorsOrigins();
  if (origins === false) {
    return false;
  }
  if (Array.isArray(origins)) {
    return (origin, callback) => {
      if (!origin || origins.includes(origin)) {
        callback(null, true);
        return;
      }
      callback(new Error("Not allowed by CORS"), false);
    };
  }
  return origins;
}

async function bootstrap() {
  validateEnv();

  const app = await NestFactory.create(AppModule);
  const expressApp = app.getHttpAdapter().getInstance() as {
    disable: (name: string) => void;
  };
  expressApp.disable("x-powered-by");

  app.setGlobalPrefix("api");
  app.use(correlationIdMiddleware);
  app.use(
    helmet({
      contentSecurityPolicy: {
        directives: {
          defaultSrc: ["'self'"],
          scriptSrc: ["'self'"],
          styleSrc: ["'self'", "'unsafe-inline'"],
          imgSrc: ["'self'", "data:", "https:"],
          connectSrc: ["'self'"],
          objectSrc: ["'none'"],
          frameAncestors: ["'none'"]
        }
      },
      hsts: {
        maxAge: 31536000,
        includeSubDomains: true,
        preload: true
      },
      frameguard: { action: "deny" }
    })
  );
  app.enableCors({
    origin: resolveCorsOrigin(),
    credentials: true
  });
  app.use(cookieParser());
  app.use(
    compression({
      filter: (req, res) => {
        if (req.headers["x-no-compression"]) return false;
        const type = String(res.getHeader("Content-Type") ?? "");
        if (
          type.includes("spreadsheetml") ||
          type.includes("application/vnd.ms-excel") ||
          type.includes("application/octet-stream")
        ) {
          return false;
        }
        return compression.filter(req, res);
      }
    })
  );
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      forbidNonWhitelisted: true
    })
  );
  app.useGlobalFilters(new HttpExceptionFilter());
  app.useGlobalInterceptors(new TimingInterceptor(), new ResponseEnvelopeInterceptor());

  await app.listen(process.env.PORT ?? 3000);
}

void bootstrap();
