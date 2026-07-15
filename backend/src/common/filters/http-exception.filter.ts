import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger
} from "@nestjs/common";
import { Response } from "express";
import { RequestWithCorrelationId } from "../middleware/correlation-id.middleware";

@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(HttpExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<RequestWithCorrelationId>();
    const correlationId = request.correlationId ?? "unknown";
    const isProduction = process.env.NODE_ENV === "production";

    const status =
      exception instanceof HttpException
        ? exception.getStatus()
        : HttpStatus.INTERNAL_SERVER_ERROR;

    if (!(exception instanceof HttpException) || status >= 500) {
      this.logger.error({
        correlationId,
        path: request.url,
        method: request.method,
        status,
        error:
          exception instanceof Error
            ? { name: exception.name, message: exception.message, stack: exception.stack }
            : exception
      });
    }

    if (!(exception instanceof HttpException)) {
      response.status(status).json({
        success: false,
        statusCode: status,
        message: "An unexpected error occurred. Please try again.",
        correlationId
      });
      return;
    }

    if (isProduction && status >= 500) {
      response.status(status).json({
        success: false,
        statusCode: status,
        message: "An unexpected error occurred. Please try again.",
        correlationId
      });
      return;
    }

    const exceptionResponse = exception.getResponse();
    response.status(status).json({
      success: false,
      statusCode: status,
      timestamp: new Date().toISOString(),
      ...(isProduction ? {} : { path: request.url }),
      correlationId,
      error: exceptionResponse
    });
  }
}
