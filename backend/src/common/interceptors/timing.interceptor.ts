import {
  CallHandler,
  ExecutionContext,
  Injectable,
  Logger,
  NestInterceptor
} from "@nestjs/common";
import { Observable, tap } from "rxjs";

const SLOW_REQUEST_MS = 500;

@Injectable()
export class TimingInterceptor implements NestInterceptor {
  private readonly logger = new Logger("HttpTiming");

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const request = context.switchToHttp().getRequest<{
      method: string;
      url: string;
      route?: { path?: string };
    }>();
    const start = Date.now();
    const route = request.route?.path ?? request.url;

    return next.handle().pipe(
      tap({
        next: () => {
          const durationMs = Date.now() - start;
          const message = `${request.method} ${route} ${durationMs}ms`;
          if (durationMs >= SLOW_REQUEST_MS) {
            this.logger.warn(message);
          } else {
            this.logger.log(message);
          }
        },
        error: () => {
          const durationMs = Date.now() - start;
          this.logger.warn(`${request.method} ${route} ${durationMs}ms (error)`);
        }
      })
    );
  }
}
