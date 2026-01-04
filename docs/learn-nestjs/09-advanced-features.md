# 09. NestJS Advanced Features ⭐⭐⭐

NestJS의 고급 기능들 (Exception Filters, Interceptors, Guards, Pipes, Middleware)을 실제 프로젝트 코드를 통해 깊이있게 학습합니다.

## 📚 목차

1. [Request/Response 생명주기](#requestresponse-생명주기)
2. [Exception Filters](#exception-filters)
3. [Interceptors](#interceptors)
4. [Guards](#guards)
5. [Pipes](#pipes)
6. [Middleware](#middleware)
7. [실행 순서 이해하기](#실행-순서-이해하기)
8. [💪 실습 과제](#-실습-과제)
9. [⚠️ 자주 하는 실수](#️-자주-하는-실수)
10. [✅ 체크리스트](#-체크리스트)

---

## Request/Response 생명주기

NestJS에서 HTTP 요청이 처리되는 전체 과정:

```
┌─────────────────────────────────────────────────────────────┐
│                      Client Request                          │
└──────────────────────┬──────────────────────────────────────┘
                       │
                       ▼
         ┌─────────────────────────┐
         │   1. Middleware         │  ← 전처리 (CORS, 로깅 등)
         └──────────┬──────────────┘
                    │
                    ▼
         ┌─────────────────────────┐
         │   2. Guards             │  ← 인증/인가 검사
         └──────────┬──────────────┘
                    │
                    ▼
         ┌─────────────────────────┐
         │   3. Interceptor        │  ← 요청 전처리
         │      (before)           │
         └──────────┬──────────────┘
                    │
                    ▼
         ┌─────────────────────────┐
         │   4. Pipes              │  ← 데이터 변환/검증
         └──────────┬──────────────┘
                    │
                    ▼
         ┌─────────────────────────┐
         │   5. Controller         │  ← 비즈니스 로직 실행
         │      Handler            │
         └──────────┬──────────────┘
                    │
                    ▼
         ┌─────────────────────────┐
         │   6. Interceptor        │  ← 응답 후처리
         │      (after)            │
         └──────────┬──────────────┘
                    │
                    ▼ (에러 발생 시)
         ┌─────────────────────────┐
         │   7. Exception Filter   │  ← 에러 처리
         └──────────┬──────────────┘
                    │
                    ▼
┌────────────────────────────────────────────────────────────┐
│                      Client Response                        │
└────────────────────────────────────────────────────────────┘
```

---

## Exception Filters

### 개념

Exception Filter는 애플리케이션에서 발생하는 모든 예외를 잡아서 일관된 형식의 응답으로 변환합니다.

**왜 필요한가요?**

- 에러 응답 형식을 통일
- 민감한 정보 노출 방지 (프로덕션 환경)
- 로깅 및 모니터링
- Prisma 에러를 HTTP 에러로 변환

### 프로젝트 구현 예제

📁 **src/common/filters/http-exception.filter.ts**

```typescript
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

@Catch() // 모든 예외를 잡습니다
export class HttpExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(HttpExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    // 1. HTTP 예외 처리
    if (exception instanceof HttpException) {
      const status = exception.getStatus();
      const exceptionResponse = exception.getResponse();

      const message =
        typeof exceptionResponse === 'string'
          ? exceptionResponse
          : (exceptionResponse as any).message || 'An error occurred';

      this.logger.error(
        `HTTP Exception: ${status} - ${message}`,
        exception.stack,
      );

      return response.status(status).json({
        statusCode: status,
        timestamp: new Date().toISOString(),
        path: request.url,
        message,
      });
    }

    // 2. Prisma 에러 처리 (데이터베이스 에러)
    if (exception instanceof Prisma.PrismaClientKnownRequestError) {
      return this.handlePrismaError(exception, request, response);
    }

    // 3. 그 외 모든 에러 (500 Internal Server Error)
    this.logger.error('Unexpected error', exception);

    response.status(HttpStatus.INTERNAL_SERVER_ERROR).json({
      statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
      timestamp: new Date().toISOString(),
      path: request.url,
      message:
        process.env.NODE_ENV === 'production'
          ? 'Internal server error' // 프로덕션: 간단한 메시지
          : (exception as Error).message, // 개발: 상세 메시지
    });
  }

  private handlePrismaError(
    exception: Prisma.PrismaClientKnownRequestError,
    request: Request,
    response: Response,
  ) {
    let status = HttpStatus.BAD_REQUEST;
    let message = 'Database error';

    switch (exception.code) {
      case 'P2002': // Unique constraint 위반
        message = 'A record with this value already exists';
        status = HttpStatus.CONFLICT;
        break;
      case 'P2025': // Record not found
        message = 'Record not found';
        status = HttpStatus.NOT_FOUND;
        break;
      case 'P2003': // Foreign key constraint 위반
        message = 'Invalid reference to related record';
        break;
    }

    this.logger.error(
      `Prisma Error: ${exception.code} - ${exception.message}`,
      exception.stack,
    );

    return response.status(status).json({
      statusCode: status,
      timestamp: new Date().toISOString(),
      path: request.url,
      message,
    });
  }
}
```

### Global Filter 등록

📁 **src/main.ts:23**

```typescript
import { HttpExceptionFilter } from './common/filters/http-exception.filter';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // Global Exception Filter 등록
  app.useGlobalFilters(new HttpExceptionFilter());

  await app.listen(3000);
}
```

### 동작 예시

**시나리오 1: 중복 이메일 등록 시도**

```typescript
// auth.service.ts에서 Prisma 에러 발생
await this.prisma.user.create({
  data: { email: 'existing@example.com' }, // 이미 존재하는 이메일
});
// → Prisma.PrismaClientKnownRequestError (P2002) 발생
```

**Filter가 변환한 응답:**

```json
{
  "statusCode": 409,
  "timestamp": "2026-01-04T10:30:00.000Z",
  "path": "/auth/register",
  "message": "A record with this value already exists"
}
```

**시나리오 2: 존재하지 않는 게시글 조회**

```typescript
// post.service.ts
const post = await this.prisma.post.findUniqueOrThrow({
  where: { id: 999 }, // 존재하지 않는 ID
});
// → Prisma.PrismaClientKnownRequestError (P2025) 발생
```

**Filter가 변환한 응답:**

```json
{
  "statusCode": 404,
  "timestamp": "2026-01-04T10:35:00.000Z",
  "path": "/posts/999",
  "message": "Record not found"
}
```

---

## Interceptors

### 개념

Interceptor는 요청/응답의 전후에 실행되는 로직을 구현합니다. AOP(Aspect-Oriented Programming) 패턴입니다.

**용도:**

- 요청/응답 로깅
- 응답 데이터 변환
- 캐싱
- 타임아웃 설정
- 실행 시간 측정

### 프로젝트 구현 예제

📁 **src/common/interceptors/logging.interceptor.ts**

```typescript
import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
  Logger,
} from '@nestjs/core';
import { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';

@Injectable()
export class LoggingInterceptor implements NestInterceptor {
  private readonly logger = new Logger(LoggingInterceptor.name);

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const request = context.switchToHttp().getRequest();
    const { method, url } = request;
    const now = Date.now();

    // 요청 전 로그
    this.logger.log(`→ ${method} ${url}`);

    return next.handle().pipe(
      tap({
        // 성공 시
        next: () => {
          const response = context.switchToHttp().getResponse();
          const delay = Date.now() - now;
          this.logger.log(
            `← ${method} ${url} ${response.statusCode} - ${delay}ms`,
          );
        },
        // 에러 시
        error: (error) => {
          const delay = Date.now() - now;
          this.logger.error(
            `✗ ${method} ${url} ${error.status || 500} - ${delay}ms`,
            error.stack,
          );
        },
      }),
    );
  }
}
```

### Global Interceptor 등록

📁 **src/main.ts:27**

```typescript
import { LoggingInterceptor } from './common/interceptors/logging.interceptor';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  app.useGlobalInterceptors(new LoggingInterceptor());

  await app.listen(3000);
}
```

### 콘솔 출력 예시

```bash
[LoggingInterceptor] → POST /auth/login
[LoggingInterceptor] ← POST /auth/login 200 - 145ms

[LoggingInterceptor] → GET /posts?page=1&limit=10
[LoggingInterceptor] ← GET /posts?page=1&limit=10 200 - 23ms

[LoggingInterceptor] → DELETE /posts/999
[LoggingInterceptor] ✗ DELETE /posts/999 404 - 12ms
```

---

## Guards

### 개념

Guard는 요청이 컨트롤러에 도달하기 전에 권한을 검사합니다. `canActivate()` 메서드가 `true`를 반환하면 요청 진행, `false`면 403 Forbidden 응답.

**용도:**

- 인증 (Authentication): 사용자가 로그인했는가?
- 인가 (Authorization): 사용자가 이 리소스에 접근 권한이 있는가?
- Role-based access control (RBAC)

### 프로젝트 구현 예제

📁 **src/auth/jwt-auth.guard.ts**

```typescript
import { Injectable, ExecutionContext } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';

@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {
  canActivate(context: ExecutionContext) {
    // Passport의 JWT Strategy를 실행
    return super.canActivate(context);
  }
}
```

📁 **src/auth/jwt.strategy.ts**

```typescript
import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(
    private configService: ConfigService,
    private prisma: PrismaService,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: configService.get<string>('JWT_SECRET'),
    });
  }

  async validate(payload: any) {
    // JWT 페이로드에서 userId 추출
    const user = await this.prisma.user.findUnique({
      where: { id: payload.sub },
    });

    if (!user) {
      throw new UnauthorizedException('User not found');
    }

    // request.user에 저장됨 (CurrentUser 데코레이터로 접근 가능)
    return { userId: user.id, email: user.email };
  }
}
```

### 사용 예시

📁 **src/post/post.controller.ts:27**

```typescript
@Post()
@UseGuards(JwtAuthGuard) // 이 라우트는 JWT 토큰 필요
@ApiOperation({ summary: 'Create a new post (requires authentication)' })
async create(
  @Body() createPostDto: CreatePostDto,
  @CurrentUser() user: { userId: number; email: string },
) {
  return this.postService.create(createPostDto, user.userId);
}
```

### 동작 과정

```
1. 클라이언트 요청: POST /posts
   Headers: Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...

2. JwtAuthGuard 실행
   ↓
3. JwtStrategy.validate() 실행
   - JWT 토큰 검증
   - 데이터베이스에서 사용자 조회
   - user 객체 반환 → request.user에 저장
   ↓
4. Controller Handler 실행
   - @CurrentUser() 데코레이터로 user 객체 접근
```

---

## Pipes

### 개념

Pipe는 컨트롤러에 도달하기 전에 입력 데이터를 **변환(transformation)** 또는 **검증(validation)** 합니다.

**내장 Pipes:**

- `ValidationPipe`: DTO 검증 (class-validator 사용)
- `ParseIntPipe`: 문자열 → 숫자 변환
- `ParseBoolPipe`: 문자열 → 불리언 변환
- `ParseUUIDPipe`: UUID 형식 검증

### 프로젝트에서 사용하는 Zod Validation Pipe

📁 **src/auth/auth.controller.ts:24**

```typescript
import { ZodValidationPipe } from '@anatine/zod-nestjs';
import { LoginDto, loginSchema } from './dto/login.dto';

@Post('login')
@UsePipes(new ZodValidationPipe(loginSchema))
@ApiOperation({ summary: 'Login with email and password' })
async login(@Body() loginDto: LoginDto) {
  return this.authService.login(loginDto);
}
```

📁 **src/auth/dto/login.dto.ts**

```typescript
import { z } from 'zod';

export const loginSchema = z.object({
  email: z.string().email('Invalid email format'),
  password: z.string().min(6, 'Password must be at least 6 characters'),
});

export type LoginDto = z.infer<typeof loginSchema>;
```

### 동작 예시

**잘못된 요청:**

```json
POST /auth/login
{
  "email": "invalid-email",
  "password": "123"
}
```

**Pipe가 반환하는 에러:**

```json
{
  "statusCode": 400,
  "message": ["Invalid email format", "Password must be at least 6 characters"],
  "error": "Bad Request"
}
```

**올바른 요청:**

```json
POST /auth/login
{
  "email": "user@example.com",
  "password": "password123"
}
```

→ Pipe 통과 → Controller Handler 실행

---

## Middleware

### 개념

Middleware는 라우트 핸들러 **이전**에 실행되는 함수입니다. Express의 미들웨어와 동일합니다.

**용도:**

- CORS 설정
- Body 파싱
- 쿠키 파싱
- 로깅
- 헤더 조작

### 프로젝트 구현 예제

NestJS는 기본적으로 Express 미들웨어를 사용할 수 있습니다.

📁 **src/main.ts:12-15**

```typescript
async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // CORS 미들웨어
  app.enableCors({
    origin: process.env.CORS_ORIGIN || 'http://localhost:3000',
    credentials: true,
  });

  await app.listen(3000);
}
```

### Custom Middleware 예제

```typescript
// logger.middleware.ts
import { Injectable, NestMiddleware } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';

@Injectable()
export class LoggerMiddleware implements NestMiddleware {
  use(req: Request, res: Response, next: NextFunction) {
    console.log(`[${new Date().toISOString()}] ${req.method} ${req.url}`);
    next(); // 다음 미들웨어/핸들러로 이동
  }
}
```

**모듈에 적용:**

```typescript
// app.module.ts
import { MiddlewareConsumer, Module, NestModule } from '@nestjs/common';

@Module({
  imports: [AuthModule, PostModule],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer.apply(LoggerMiddleware).forRoutes('*'); // 모든 라우트에 적용
  }
}
```

---

## 실행 순서 이해하기

### 전체 흐름 (성공 케이스)

```
Request: POST /posts
Authorization: Bearer <token>
Body: { "title": "Hello", "content": "World" }

1. Middleware (CORS, Body Parser)
   ↓
2. Guards (JwtAuthGuard)
   - JWT 토큰 검증
   - request.user 설정
   ↓
3. Interceptor (LoggingInterceptor - before)
   - 요청 로깅: "→ POST /posts"
   ↓
4. Pipes (ZodValidationPipe)
   - DTO 검증
   ↓
5. Controller Handler
   - @Body() createPostDto
   - @CurrentUser() user
   - postService.create(createPostDto, user.userId)
   ↓
6. Interceptor (LoggingInterceptor - after)
   - 응답 로깅: "← POST /posts 201 - 45ms"
   ↓
Response: 201 Created
```

### 에러 발생 시

```
Request: POST /posts
Authorization: Bearer <invalid-token>

1. Middleware ✓
2. Guards (JwtAuthGuard)
   - JWT 검증 실패
   - UnauthorizedException 발생
   ↓
7. Exception Filter (HttpExceptionFilter)
   - 에러 로깅
   - 일관된 응답 형식으로 변환
   ↓
Response: 401 Unauthorized
{
  "statusCode": 401,
  "timestamp": "2026-01-04T10:45:00.000Z",
  "path": "/posts",
  "message": "Unauthorized"
}
```

---

## 💪 실습 과제

### 과제 1: Custom Exception Filter 만들기

특정 HTTP 상태 코드만 잡는 Filter를 만들어보세요.

```typescript
// src/common/filters/not-found-exception.filter.ts
import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  NotFoundException,
} from '@nestjs/common';

@Catch(NotFoundException) // 404 에러만 잡기
export class NotFoundExceptionFilter implements ExceptionFilter {
  catch(exception: NotFoundException, host: ArgumentsHost) {
    // TODO: 404 에러를 친절한 메시지로 변환
    // 힌트: "요청하신 리소스를 찾을 수 없습니다" 같은 한글 메시지 추가
  }
}
```

### 과제 2: Response Transform Interceptor 만들기

모든 응답을 `{ success: true, data: ... }` 형식으로 감싸는 Interceptor를 만들어보세요.

```typescript
// src/common/interceptors/transform.interceptor.ts
import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
} from '@nestjs/core';
import { map } from 'rxjs/operators';

@Injectable()
export class TransformInterceptor implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler) {
    return next.handle().pipe(
      map((data) => ({
        success: true,
        data,
        timestamp: new Date().toISOString(),
      })),
    );
  }
}
```

### 과제 3: Role-Based Guard 만들기

사용자 역할(role)을 검사하는 Guard를 만들어보세요.

```typescript
// src/auth/roles.guard.ts
import { Injectable, CanActivate, ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    // TODO: 메타데이터에서 필요한 role 가져오기
    // TODO: request.user의 role과 비교
    // 힌트: @SetMetadata('roles', ['admin']) 데코레이터 사용
  }
}
```

---

## ⚠️ 자주 하는 실수

### 1. Exception Filter에서 에러를 다시 throw

```typescript
// ❌ 잘못된 예
catch(exception: unknown, host: ArgumentsHost) {
  console.error(exception);
  throw exception; // 무한 루프 발생!
}

// ✅ 올바른 예
catch(exception: unknown, host: ArgumentsHost) {
  const response = host.switchToHttp().getResponse();
  response.status(500).json({ message: 'Error' });
  // throw 하지 않고 응답만 반환
}
```

### 2. Guard에서 예외를 잘못 처리

```typescript
// ❌ 잘못된 예
canActivate(context: ExecutionContext): boolean {
  const user = this.getUser();
  if (!user) {
    return false; // 403 Forbidden 발생
  }
  return true;
}

// ✅ 올바른 예 (명확한 에러 메시지)
canActivate(context: ExecutionContext): boolean {
  const user = this.getUser();
  if (!user) {
    throw new UnauthorizedException('Please login first'); // 401
  }
  return true;
}
```

### 3. Interceptor에서 RxJS 연산자를 빠뜨림

```typescript
// ❌ 잘못된 예
intercept(context: ExecutionContext, next: CallHandler) {
  console.log('Before...');
  return next.handle(); // 응답 후처리 불가능!
}

// ✅ 올바른 예
intercept(context: ExecutionContext, next: CallHandler) {
  console.log('Before...');
  return next.handle().pipe(
    tap(() => console.log('After...')),
  );
}
```

### 4. Global vs. Route-level 적용 혼동

```typescript
// Global 적용 (main.ts)
app.useGlobalGuards(new JwtAuthGuard()); // 모든 라우트에 적용됨!

// Route-level 적용 (권장)
@UseGuards(JwtAuthGuard) // 특정 라우트/컨트롤러에만 적용
```

---

## ✅ 체크리스트

- [ ] Exception Filter가 모든 Prisma 에러를 적절히 처리하는가?
- [ ] 프로덕션 환경에서 민감한 정보(스택 트레이스)가 노출되지 않는가?
- [ ] Interceptor가 요청/응답을 정확히 로깅하는가?
- [ ] Guard가 인증되지 않은 요청을 올바르게 차단하는가?
- [ ] Pipe가 잘못된 DTO를 검증하고 명확한 에러 메시지를 반환하는가?
- [ ] Global Filter/Interceptor가 main.ts에 등록되어 있는가?
- [ ] RxJS 연산자(tap, map, catchError)를 Interceptor에서 올바르게 사용하는가?
- [ ] Guard의 실행 순서를 이해하는가? (Guards → Interceptors → Pipes → Controller)

---

## 다음 단계

- **[10. Security Best Practices](./10-security-best-practices.md)** ⭐⭐⭐  
  Refresh Token Rotation, bcrypt, JWT 관리, Rate Limiting 등 보안 패턴 심화 학습

- **[이전: 08. Design Patterns](./08-design-patterns.md)** ⭐⭐⭐  
  NestJS에서 사용되는 디자인 패턴 복습
