import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Request, Response } from 'express';
import { Prisma } from '@prisma/client';

@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(HttpExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    let status = HttpStatus.INTERNAL_SERVER_ERROR;
    let message: string | string[] = 'Internal server error';
    let error = 'Internal Server Error';

    // HTTP Exception 처리
    if (exception instanceof HttpException) {
      status = exception.getStatus();
      const exceptionResponse = exception.getResponse();

      if (typeof exceptionResponse === 'object') {
        message = (exceptionResponse as any).message || message;
        error = (exceptionResponse as any).error || error;
      } else {
        message = exceptionResponse;
      }
    }
    // Prisma 에러 처리
    else if (exception instanceof Prisma.PrismaClientKnownRequestError) {
      status = HttpStatus.BAD_REQUEST;

      switch (exception.code) {
        case 'P2002':
          message = 'Unique constraint violation';
          error = 'Conflict';
          status = HttpStatus.CONFLICT;
          break;
        case 'P2025':
          message = 'Record not found';
          error = 'Not Found';
          status = HttpStatus.NOT_FOUND;
          break;
        case 'P2003':
          message = 'Foreign key constraint failed';
          error = 'Bad Request';
          break;
        default:
          message = 'Database operation failed';
      }

      // 민감한 DB 정보는 프로덕션에서 숨김
      if (process.env.NODE_ENV === 'production') {
        message = 'Database error occurred';
      }
    }
    // Prisma Validation 에러
    else if (exception instanceof Prisma.PrismaClientValidationError) {
      status = HttpStatus.BAD_REQUEST;
      message = 'Invalid data provided';
      error = 'Validation Error';

      if (process.env.NODE_ENV === 'production') {
        message = 'Invalid request data';
      }
    }
    // 기타 에러
    else if (exception instanceof Error) {
      message = exception.message;

      // 프로덕션에서는 일반적인 에러 메시지만 노출
      if (process.env.NODE_ENV === 'production') {
        message = 'An unexpected error occurred';
      }
    }

    // 에러 로깅 (민감 정보 제외)
    this.logger.error({
      statusCode: status,
      timestamp: new Date().toISOString(),
      path: request.url,
      method: request.method,
      message,
      userId: (request as any).user?.sub,
      // 스택 트레이스는 개발 환경에서만
      ...(process.env.NODE_ENV === 'development' && {
        stack: exception instanceof Error ? exception.stack : undefined,
      }),
    });

    // 응답
    response.status(status).json({
      statusCode: status,
      timestamp: new Date().toISOString(),
      path: request.url,
      error,
      message,
    });
  }
}
