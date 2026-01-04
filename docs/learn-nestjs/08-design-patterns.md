# 🎨 NestJS 디자인 패턴

**난이도**: ⭐⭐⭐ 중급-고급  
**학습 시간**: 90분  
**이 문서에서 배울 내용**: NestJS에서 사용하는 8가지 핵심 디자인 패턴

---

## 📚 목차

- [개요](#개요)
- [1. Dependency Injection (DI) 패턴](#1-dependency-injection-di-패턴)
- [2. Repository 패턴](#2-repository-패턴)
- [3. Strategy 패턴](#3-strategy-패턴)
- [4. Factory 패턴](#4-factory-패턴)
- [5. Filter 패턴](#5-filter-패턴)
- [6. Interceptor 패턴](#6-interceptor-패턴)
- [7. Guard 패턴](#7-guard-패턴)
- [8. DTO 패턴](#8-dto-패턴)
- [패턴 조합하기](#패턴-조합하기)
- [실습 예제](#실습-예제)
- [자주 하는 실수](#자주-하는-실수)
- [체크리스트](#체크리스트)

---

## 개요

디자인 패턴은 **소프트웨어 설계에서 반복적으로 나타나는 문제를 해결하는 재사용 가능한 솔루션**입니다. NestJS는 엔터프라이즈급 애플리케이션을 위해 다양한 검증된 디자인 패턴을 내장하고 있습니다.

이 문서에서는 **현재 프로젝트에서 실제로 사용하는 8가지 핵심 패턴**을 다루며, 각 패턴의 목적, 구현 방법, 장단점을 상세히 설명합니다.

---

## 1. Dependency Injection (DI) 패턴

**난이도**: ⭐⭐ 중급  
**목적**: 클래스 간 결합도 낮추고, 테스트 용이성 향상  
**NestJS 구현**: `@Injectable()`, Constructor Injection

### 문제 상황

```typescript
// ❌ DI 없이 구현 (강한 결합)
export class AuthService {
  private prisma: PrismaService;
  private jwtService: JwtService;

  constructor() {
    this.prisma = new PrismaService(); // 직접 생성
    this.jwtService = new JwtService(); // 직접 생성
  }
}
```

**문제점**:

- `AuthService`가 `PrismaService`, `JwtService`를 직접 생성 (강한 결합)
- 테스트 시 Mock 객체로 교체 불가
- 설정 변경 시 모든 사용처 수정 필요

### DI 패턴 적용

```typescript
// ✅ DI 패턴 적용 (느슨한 결합)
// 📁 src/auth/auth.service.ts:16-22
import { Injectable } from '@nestjs/common';

@Injectable()
export class AuthService {
  constructor(
    private prisma: PrismaService, // 👈 주입됨
    private jwtService: JwtService, // 👈 주입됨
    private config: ConfigService<EnvConfig>, // 👈 주입됨
  ) {}

  async register(dto: RegisterDto) {
    // this.prisma 사용 가능
    const user = await this.prisma.user.create({
      data: {
        email: dto.email,
        password: await bcrypt.hash(dto.password, 10),
        name: dto.name,
      },
    });
    return user;
  }
}
```

### DI 컨테이너 등록

```typescript
// 📁 src/auth/auth.module.ts:10-27
@Module({
  imports: [PrismaModule, JwtModule],
  controllers: [AuthController],
  providers: [
    AuthService, // 👈 DI 컨테이너에 등록
    JwtStrategy,
  ],
  exports: [AuthService], // 👈 다른 모듈에서 사용 가능
})
export class AuthModule {}
```

### 동작 원리

```
1. @Injectable() 데코레이터
   └─> AuthService를 DI 컨테이너에 등록

2. Module의 providers 배열
   └─> 이 모듈에서 사용할 프로바이더 선언

3. Constructor
   └─> 타입 정보만으로 자동 주입
   └─> NestJS가 PrismaService, JwtService 인스턴스 찾아서 주입

4. Singleton 패턴
   └─> 기본적으로 하나의 인스턴스만 생성
   └─> 모든 곳에서 같은 인스턴스 공유
```

### 테스트 시 장점

```typescript
// 📁 src/auth/auth.service.spec.ts:50-67
describe('AuthService', () => {
  let service: AuthService;

  const mockPrismaService = {
    // 👈 Mock 객체
    user: {
      findUnique: jest.fn(),
      create: jest.fn(),
    },
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        {
          provide: PrismaService,
          useValue: mockPrismaService, // 👈 Mock으로 교체 가능!
        },
      ],
    }).compile();

    service = module.get<AuthService>(AuthService);
  });

  it('should create user', async () => {
    mockPrismaService.user.create.mockResolvedValue({
      id: '1',
      email: 'test@test.com',
    });
    // 실제 DB 없이 테스트 가능!
  });
});
```

### 장점

✅ **낮은 결합도**: 클래스 간 의존성 최소화  
✅ **높은 테스트 용이성**: Mock 객체로 쉽게 교체  
✅ **유연성**: 설정만 변경하면 구현체 교체 가능  
✅ **재사용성**: 같은 인스턴스를 여러 곳에서 공유

### 단점

⚠️ **러닝 커브**: 처음 접하면 이해하기 어려움  
⚠️ **순환 의존성**: A → B → A 형태 의존 시 에러 (forwardRef로 해결)

---

## 2. Repository 패턴

**난이도**: ⭐⭐ 중급  
**목적**: 데이터 접근 로직을 캡슐화하여 비즈니스 로직과 분리  
**NestJS 구현**: PrismaService를 Repository로 활용

### 문제 상황

```typescript
// ❌ Service에서 직접 DB 쿼리 (비즈니스 로직과 혼재)
export class PostService {
  async findAll() {
    // SQL 쿼리가 비즈니스 로직과 섞여 있음
    const posts = await prisma.$queryRaw`
      SELECT * FROM posts WHERE deleted_at IS NULL
      ORDER BY created_at DESC
    `;
    return posts;
  }
}
```

### Repository 패턴 적용

```typescript
// ✅ PrismaService를 Repository로 활용
// 📁 src/prisma/prisma.service.ts:8-32
import { Injectable, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class PrismaService
  extends PrismaClient
  implements OnModuleInit, OnModuleDestroy
{
  constructor(private configService: ConfigService) {
    super({
      datasources: {
        db: {
          url: configService.get('DATABASE_URL'),
        },
      },
      log: ['query', 'error', 'warn'], // 👈 쿼리 로깅 설정
    });
  }

  async onModuleInit() {
    await this.$connect(); // 👈 모듈 초기화 시 DB 연결
  }

  async onModuleDestroy() {
    await this.$disconnect(); // 👈 모듈 종료 시 DB 연결 해제
  }
}
```

### Service에서 Repository 사용

```typescript
// 📁 src/post/post.service.ts:10-26
@Injectable()
export class PostService {
  constructor(private prisma: PrismaService) {} // 👈 Repository 주입

  async create(authorId: string, dto: CreatePostDto) {
    return this.prisma.post.create({
      // 👈 Repository 메서드 사용
      data: {
        ...dto,
        authorId,
      },
      include: {
        author: {
          select: { id: true, name: true },
        },
      },
    });
  }

  async findAll(pagination: PaginationDto, published?: boolean) {
    const { page, limit } = pagination;
    const skip = (page - 1) * limit;

    const where = {
      deletedAt: null, // 👈 비즈니스 규칙
      ...(published !== undefined && { published }),
    };

    const [data, total] = await Promise.all([
      this.prisma.post.findMany({
        // 👈 Repository 메서드
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          author: {
            select: { id: true, name: true },
          },
        },
      }),
      this.prisma.post.count({ where }),
    ]);

    return {
      data,
      meta: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
        hasNextPage: page < Math.ceil(total / limit),
        hasPreviousPage: page > 1,
      },
    };
  }
}
```

### 계층 분리

```
Controller (HTTP 계층)
    ↓
Service (비즈니스 로직 계층)
    ↓
Repository (데이터 접근 계층)
    ↓
Database
```

**각 계층의 책임**:

- **Controller**: HTTP 요청/응답 처리
- **Service**: 비즈니스 로직 (권한 검증, 데이터 가공)
- **Repository**: 데이터 CRUD (SQL, ORM)
- **Database**: 데이터 저장

### 장점

✅ **관심사 분리**: 비즈니스 로직과 데이터 접근 로직 분리  
✅ **테스트 용이성**: Repository만 Mock으로 교체하여 테스트  
✅ **유지보수성**: DB 변경 시 Repository만 수정  
✅ **재사용성**: 여러 Service에서 같은 Repository 사용 가능

---

## 3. Strategy 패턴

**난이도**: ⭐⭐⭐ 고급  
**목적**: 알고리즘을 캡슐화하여 런타임에 교체 가능  
**NestJS 구현**: Passport Strategy

### 개념

Strategy 패턴은 **동일한 목적의 여러 알고리즘을 인터페이스로 정의**하고, **런타임에 원하는 알고리즘을 선택**할 수 있게 합니다.

### 실제 프로젝트 예제

```typescript
// 📁 src/auth/jwt.strategy.ts:7-29
import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { ConfigService } from '@nestjs/config';
import { AuthService } from './auth.service';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  // 👆 PassportStrategy를 상속하여 JWT 전략 구현

  constructor(
    configService: ConfigService,
    private authService: AuthService,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(), // 👈 토큰 추출 방법
      ignoreExpiration: false, // 👈 만료 검증
      secretOrKey: configService.get<string>('JWT_SECRET')!, // 👈 Secret Key
    });
  }

  async validate(payload: { sub: string; email: string }) {
    // 👆 JWT 검증 성공 후 실행되는 메서드
    const user = await this.authService.validateUser(payload.sub);

    if (!user) {
      throw new UnauthorizedException();
    }

    return user; // 👈 request.user에 저장됨
  }
}
```

### 다른 Strategy 예제 (LocalStrategy)

```typescript
// 다른 인증 전략도 동일한 방식으로 구현 가능
import { Strategy } from 'passport-local';
import { PassportStrategy } from '@nestjs/passport';

@Injectable()
export class LocalStrategy extends PassportStrategy(Strategy) {
  constructor(private authService: AuthService) {
    super({
      usernameField: 'email', // 👈 email을 username으로 사용
      passwordField: 'password',
    });
  }

  async validate(email: string, password: string): Promise<any> {
    const user = await this.authService.validateUser(email, password);
    if (!user) {
      throw new UnauthorizedException();
    }
    return user;
  }
}
```

### Guard와 함께 사용

```typescript
// 📁 src/auth/jwt-auth.guard.ts:1-6
import { Injectable } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';

@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {
  // 👆 'jwt'는 JwtStrategy를 가리킴
}
```

```typescript
// 📁 src/post/post.controller.ts:31-38
@Post()
@UseGuards(JwtAuthGuard)  // 👈 JwtStrategy 실행
@ApiBearerAuth()
create(@CurrentUser() user: { id: string }, @Body() dto: CreatePostDto) {
  return this.postService.create(user.id, dto);
}
```

### 동작 흐름

```
1. 클라이언트 요청 (Authorization: Bearer <token>)
   ↓
2. JwtAuthGuard 실행
   ↓
3. JwtStrategy.validate() 호출
   ↓
4. JWT 토큰 검증 & 사용자 조회
   ↓
5. request.user에 사용자 정보 저장
   ↓
6. Controller 메서드 실행
   ↓
7. @CurrentUser() 데코레이터로 user 추출
```

### 장점

✅ **유연성**: 인증 방식을 쉽게 교체 (JWT ↔ OAuth ↔ Local)  
✅ **확장성**: 새로운 인증 전략 추가 용이  
✅ **재사용성**: 여러 Guard에서 같은 Strategy 사용 가능

---

## 4. Factory 패턴

**난이도**: ⭐⭐⭐ 고급  
**목적**: 객체 생성 로직을 캡슐화하여 유연성 제공  
**NestJS 구현**: Dynamic Module (forRoot, forRootAsync)

### 정적 모듈 vs 동적 모듈

```typescript
// ❌ 정적 모듈 (설정 고정)
@Module({
  imports: [
    JwtModule.register({
      secret: 'hardcoded-secret', // 👈 하드코딩됨!
      signOptions: { expiresIn: '1d' },
    }),
  ],
})
export class AuthModule {}
```

```typescript
// ✅ 동적 모듈 (설정 동적 생성)
@Module({
  imports: [
    JwtModule.registerAsync({
      // 👈 비동기로 설정 생성
      inject: [ConfigService],
      useFactory: async (config: ConfigService) => ({
        secret: config.get('JWT_SECRET'), // 👈 환경변수에서 읽음
        signOptions: { expiresIn: config.get('JWT_EXPIRES_IN') },
      }),
    }),
  ],
})
export class AuthModule {}
```

### 실제 프로젝트 예제

```typescript
// 📁 src/app.module.ts:16-30
@Module({
  imports: [
    ConfigModule.forRoot({
      // 👈 Factory 패턴
      isGlobal: true,
      validate, // 👈 환경변수 검증 함수
      cache: true,
    }),
    ThrottlerModule.forRootAsync({
      // 👈 비동기 Factory
      inject: [ConfigService],
      useFactory: (config: ConfigService<EnvConfig>) => [
        {
          ttl: config.get('THROTTLE_TTL', { infer: true }) ?? 60000,
          limit: config.get('THROTTLE_LIMIT', { infer: true }) ?? 10,
        },
      ],
    }),
    PrismaModule,
    AuthModule,
    PostModule,
  ],
})
export class AppModule {}
```

### Factory 패턴의 장점

✅ **환경별 설정**: 개발/프로덕션 환경에 따라 다른 설정  
✅ **의존성 주입**: Factory에서 다른 서비스 주입 가능  
✅ **지연 초기화**: 필요한 시점에 객체 생성

### Custom Dynamic Module 만들기

```typescript
import { Module, DynamicModule } from '@nestjs/common';

interface DatabaseOptions {
  host: string;
  port: number;
  username: string;
  password: string;
}

@Module({})
export class DatabaseModule {
  static forRoot(options: DatabaseOptions): DynamicModule {
    return {
      module: DatabaseModule,
      providers: [
        {
          provide: 'DATABASE_OPTIONS',
          useValue: options,
        },
        DatabaseService,
      ],
      exports: [DatabaseService],
    };
  }

  static forRootAsync(
    optionsFactory: () => Promise<DatabaseOptions>,
  ): DynamicModule {
    return {
      module: DatabaseModule,
      providers: [
        {
          provide: 'DATABASE_OPTIONS',
          useFactory: optionsFactory,
        },
        DatabaseService,
      ],
      exports: [DatabaseService],
    };
  }
}
```

**사용**:

```typescript
@Module({
  imports: [
    DatabaseModule.forRoot({
      host: 'localhost',
      port: 5432,
      username: 'admin',
      password: 'secret',
    }),
  ],
})
export class AppModule {}
```

---

## 5. Filter 패턴

**난이도**: ⭐⭐ 중급  
**목적**: 예외를 가로채서 일관된 에러 응답 제공  
**NestJS 구현**: Exception Filter

### 실제 프로젝트 예제

```typescript
// 📁 src/common/filters/http-exception.filter.ts:9-107
import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';

@Catch() // 👈 모든 예외 캐치
export class HttpExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(HttpExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    let status = HttpStatus.INTERNAL_SERVER_ERROR;
    let message: string | string[] = 'Internal server error';
    let error = 'Internal Server Error';

    // 1. HTTP Exception 처리
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
    // 2. Prisma 에러 처리
    else if (exception instanceof Prisma.PrismaClientKnownRequestError) {
      status = HttpStatus.BAD_REQUEST;

      switch (exception.code) {
        case 'P2002': // Unique constraint violation
          message = 'Unique constraint violation';
          error = 'Conflict';
          status = HttpStatus.CONFLICT;
          break;
        case 'P2025': // Record not found
          message = 'Record not found';
          error = 'Not Found';
          status = HttpStatus.NOT_FOUND;
          break;
        case 'P2003': // Foreign key constraint
          message = 'Foreign key constraint failed';
          error = 'Bad Request';
          break;
        default:
          message = 'Database operation failed';
      }

      // 프로덕션에서는 상세 에러 숨김
      if (process.env.NODE_ENV === 'production') {
        message = 'Database error occurred';
      }
    }
    // 3. Prisma Validation 에러
    else if (exception instanceof Prisma.PrismaClientValidationError) {
      status = HttpStatus.BAD_REQUEST;
      message = 'Invalid data provided';
      error = 'Validation Error';

      if (process.env.NODE_ENV === 'production') {
        message = 'Invalid request data';
      }
    }
    // 4. 기타 에러
    else if (exception instanceof Error) {
      message = exception.message;

      if (process.env.NODE_ENV === 'production') {
        message = 'An unexpected error occurred';
      }
    }

    // 5. 에러 로깅 (민감 정보 제외)
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

    // 6. 응답
    response.status(status).json({
      statusCode: status,
      timestamp: new Date().toISOString(),
      path: request.url,
      error,
      message,
    });
  }
}
```

### 전역 적용

```typescript
// 📁 src/main.ts:23
app.useGlobalFilters(new HttpExceptionFilter());
```

### Before/After 비교

```typescript
// ❌ Filter 없이 (일관성 없는 에러 응답)
{
  "statusCode": 500,
  "message": "PrismaClientKnownRequestError: Unique constraint failed on the fields: (`email`)"
  // 👆 Prisma 내부 에러가 그대로 노출!
}

// ✅ Filter 적용 후 (일관된 에러 응답)
{
  "statusCode": 409,
  "timestamp": "2024-01-04T12:00:00.000Z",
  "path": "/auth/register",
  "error": "Conflict",
  "message": "Unique constraint violation"
  // 👆 사용자 친화적인 메시지!
}
```

### 장점

✅ **일관성**: 모든 에러를 동일한 형식으로 응답  
✅ **보안**: 민감한 에러 정보 숨김 (프로덕션)  
✅ **로깅**: 에러 발생 시 자동 로깅  
✅ **중앙 집중**: 에러 처리 로직을 한 곳에서 관리

---

## 6. Interceptor 패턴

**난이도**: ⭐⭐ 중급  
**목적**: 요청/응답을 가로채서 추가 로직 수행 (로깅, 변환, 캐싱)  
**NestJS 구현**: NestInterceptor

### 실제 프로젝트 예제

```typescript
// 📁 src/common/interceptors/logging.interceptor.ts:9-40
import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
  Logger,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';

@Injectable()
export class LoggingInterceptor implements NestInterceptor {
  private readonly logger = new Logger('HTTP');

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const request = context.switchToHttp().getRequest<Request>();
    const { method, url } = request;
    const now = Date.now();

    // 요청 로깅
    this.logger.log(`→ ${method} ${url}`);

    return next.handle().pipe(
      tap({
        next: () => {
          const response = context.switchToHttp().getResponse<Response>();
          const delay = Date.now() - now;
          this.logger.log(
            `← ${method} ${url} ${response.statusCode} - ${delay}ms`,
          );
        },
        error: (error) => {
          const delay = Date.now() - now;
          this.logger.error(
            `← ${method} ${url} ${error.status || 500} - ${delay}ms - ${error.message}`,
          );
        },
      }),
    );
  }
}
```

### 전역 적용

```typescript
// 📁 src/main.ts:27
app.useGlobalInterceptors(new LoggingInterceptor());
```

### 실행 로그

```
[HTTP] → GET /posts?page=1&limit=10
[HTTP] ← GET /posts?page=1&limit=10 200 - 45ms

[HTTP] → POST /auth/login
[HTTP] ← POST /auth/login 200 - 823ms

[HTTP] → GET /posts/invalid-id
[HTTP] ← GET /posts/invalid-id 404 - 12ms - Post with ID invalid-id not found
```

### 다른 Interceptor 예제

#### Transform Interceptor (응답 변환)

```typescript
@Injectable()
export class TransformInterceptor<T> implements NestInterceptor<
  T,
  Response<T>
> {
  intercept(
    context: ExecutionContext,
    next: CallHandler,
  ): Observable<Response<T>> {
    return next.handle().pipe(
      map((data) => ({
        success: true,
        timestamp: new Date().toISOString(),
        data,
      })),
    );
  }
}
```

**적용 후 응답**:

```json
{
  "success": true,
  "timestamp": "2024-01-04T12:00:00.000Z",
  "data": {
    "id": "123",
    "title": "Post Title"
  }
}
```

#### Cache Interceptor (캐싱)

```typescript
@Injectable()
export class CacheInterceptor implements NestInterceptor {
  private cache = new Map<string, any>();

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const request = context.switchToHttp().getRequest();
    const key = `${request.method}:${request.url}`;

    const cached = this.cache.get(key);
    if (cached) {
      return of(cached); // 캐시된 응답 반환
    }

    return next.handle().pipe(
      tap((response) => {
        this.cache.set(key, response); // 응답 캐싱
      }),
    );
  }
}
```

### 장점

✅ **횡단 관심사(Cross-cutting concerns)**: 로깅, 캐싱, 변환 등  
✅ **재사용성**: 여러 엔드포인트에서 공통 로직 재사용  
✅ **비침투적**: 비즈니스 로직 수정 없이 기능 추가

---

## 7. Guard 패턴

**난이도**: ⭐⭐ 중급  
**목적**: 요청이 컨트롤러에 도달하기 전에 인증/인가 검사  
**NestJS 구현**: CanActivate 인터페이스

### 실제 프로젝트 예제

```typescript
// 📁 src/auth/jwt-auth.guard.ts:1-6
import { Injectable } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';

@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {
  // PassportStrategy('jwt')를 사용하는 Guard
}
```

### 사용

```typescript
// 📁 src/post/post.controller.ts:31-38
@Post()
@UseGuards(JwtAuthGuard)  // 👈 인증된 사용자만 접근 가능
@ApiBearerAuth()
create(@CurrentUser() user: { id: string }, @Body() dto: CreatePostDto) {
  return this.postService.create(user.id, dto);
}
```

### Custom Guard 예제 (역할 기반 접근 제어)

```typescript
import { Injectable, CanActivate, ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    // 메타데이터에서 필요한 역할 가져오기
    const requiredRoles = this.reflector.get<string[]>(
      'roles',
      context.getHandler(),
    );

    if (!requiredRoles) {
      return true; // 역할이 지정되지 않으면 통과
    }

    const request = context.switchToHttp().getRequest();
    const user = request.user;

    // 사용자의 역할이 요구되는 역할에 포함되는지 확인
    return requiredRoles.some((role) => user.roles?.includes(role));
  }
}
```

**데코레이터와 함께 사용**:

```typescript
// roles.decorator.ts
export const Roles = (...roles: string[]) => SetMetadata('roles', roles);

// 사용
@Post('admin-only')
@UseGuards(JwtAuthGuard, RolesGuard)  // 순서대로 실행
@Roles('admin')  // 메타데이터 설정
createAdminPost() {
  return 'Admin only';
}
```

### Guard 실행 순서

```
Request
  ↓
1. Middleware (없음)
  ↓
2. Guards (순서대로 실행)
   - JwtAuthGuard (인증)
   - RolesGuard (인가)
  ↓
3. Interceptor (before)
  ↓
4. Pipe (유효성 검사)
  ↓
5. Controller Handler
  ↓
6. Interceptor (after)
  ↓
7. Exception Filter (에러 발생 시)
  ↓
Response
```

### 장점

✅ **보안**: 인증/인가를 중앙에서 관리  
✅ **재사용성**: 여러 엔드포인트에서 동일한 Guard 사용  
✅ **선언적**: `@UseGuards()` 데코레이터로 명확하게 표현

---

## 8. DTO 패턴

**난이도**: ⭐ 초급  
**목적**: 계층 간 데이터 전송 객체로 검증 및 타입 안정성 제공  
**NestJS 구현**: Class + Validation (Zod)

### 실제 프로젝트 예제

```typescript
// 📁 src/auth/dto/register.dto.ts:1-13
import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

export const RegisterSchema = z.object({
  email: z.string().email({ message: 'Invalid email format' }),
  password: z.string().min(6, 'Password must be at least 6 characters'),
  name: z.string().min(2, 'Name must be at least 2 characters'),
});

export class RegisterDto extends createZodDto(RegisterSchema) {}
// 👆 Zod 스키마를 DTO 클래스로 변환

export type RegisterType = z.infer<typeof RegisterSchema>;
```

### Controller에서 사용

```typescript
// 📁 src/auth/auth.controller.ts:33-35
@Post('register')
register(@Body() dto: RegisterDto) {  // 👈 자동 검증됨
  return this.authService.register(dto);
}
```

### 검증 실패 시

```json
// 요청
POST /auth/register
{
  "email": "invalid-email",
  "password": "123",
  "name": "A"
}

// 응답 (400 Bad Request)
{
  "statusCode": 400,
  "message": [
    "Invalid email format",
    "Password must be at least 6 characters",
    "Name must be at least 2 characters"
  ],
  "error": "Bad Request"
}
```

### DTO 종류

#### CreateDto

```typescript
// 📁 src/post/dto/create-post.dto.ts:1-10
import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

export const CreatePostSchema = z.object({
  title: z.string().min(1, 'Title is required'),
  content: z.string().min(1, 'Content is required'),
  published: z.boolean().default(false),
});

export class CreatePostDto extends createZodDto(CreatePostSchema) {}
```

#### UpdateDto

```typescript
// 📁 src/post/dto/update-post.dto.ts:1-6
import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';
import { CreatePostSchema } from './create-post.dto';

export const UpdatePostSchema = CreatePostSchema.partial(); // 👈 모든 필드 optional

export class UpdatePostDto extends createZodDto(UpdatePostSchema) {}
```

#### ResponseDto

```typescript
// 📁 src/auth/dto/auth-response.dto.ts:1-8
export class AuthResponseDto {
  accessToken: string;
  refreshToken: string;
  user: {
    id: string;
    email: string;
    name: string;
  };
}
```

### DTO vs Entity

```typescript
// DTO: 전송 계층 (클라이언트 ↔ 서버)
export class CreateUserDto {
  email: string;
  password: string; // 👈 평문 비밀번호
  name: string;
}

// Entity: 도메인 계층 (비즈니스 로직)
export class User {
  id: string;
  email: string;
  password: string; // 👈 해싱된 비밀번호
  name: string;
  createdAt: Date;
  updatedAt: Date;

  validatePassword(password: string): boolean {
    return bcrypt.compareSync(password, this.password);
  }
}
```

### 장점

✅ **타입 안정성**: 컴파일 타임에 타입 검증  
✅ **자동 검증**: ZodValidationPipe가 자동으로 검증  
✅ **문서화**: Swagger에 자동으로 스키마 생성  
✅ **재사용성**: 여러 엔드포인트에서 공통 DTO 사용

---

## 패턴 조합하기

실제 프로젝트에서는 여러 패턴을 조합하여 사용합니다.

### 예제: 게시물 생성 플로우

```typescript
// 1. DTO 패턴 (데이터 검증)
export class CreatePostDto {
  title: string;
  content: string;
}

// 2. Guard 패턴 (인증)
@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {}

// 3. Strategy 패턴 (JWT 검증)
@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  async validate(payload: any) {
    return { id: payload.sub, email: payload.email };
  }
}

// 4. Interceptor 패턴 (로깅)
@Injectable()
export class LoggingInterceptor implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler) {
    console.log('Before...');
    return next.handle().pipe(tap(() => console.log('After...')));
  }
}

// 5. Repository 패턴 (데이터 접근)
@Injectable()
export class PrismaService extends PrismaClient {}

// 6. DI 패턴 (의존성 주입)
@Injectable()
export class PostService {
  constructor(private prisma: PrismaService) {} // 👈 주입

  async create(authorId: string, dto: CreatePostDto) {
    return this.prisma.post.create({ data: { ...dto, authorId } });
  }
}

// 7. Controller (모든 패턴 조합)
@Controller('posts')
@UseInterceptors(LoggingInterceptor) // 👈 Interceptor
export class PostController {
  constructor(private postService: PostService) {} // 👈 DI

  @Post()
  @UseGuards(JwtAuthGuard) // 👈 Guard
  create(
    @Body() dto: CreatePostDto, // 👈 DTO
    @CurrentUser() user: any,
  ) {
    return this.postService.create(user.id, dto); // 👈 Service (Repository)
  }
}
```

### 실행 순서

```
1. HTTP 요청: POST /posts
   ↓
2. Interceptor (before): 로깅 "Before..."
   ↓
3. Guard: JwtAuthGuard → JwtStrategy.validate()
   ↓
4. Pipe: ZodValidationPipe → CreatePostDto 검증
   ↓
5. Controller: create() 메서드 실행
   ↓
6. Service: PostService.create()
   ↓
7. Repository: PrismaService.post.create()
   ↓
8. Database: INSERT INTO posts
   ↓
9. Interceptor (after): 로깅 "After..."
   ↓
10. HTTP 응답: 201 Created
```

---

## 💪 실습 예제

### 실습 1: 캐싱 Interceptor 구현

**목표**: GET 요청 결과를 5분간 캐싱하는 Interceptor 만들기

```typescript
// 📁 src/common/interceptors/cache.interceptor.ts
import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
} from '@nestjs/common';
import { Observable, of } from 'rxjs';
import { tap } from 'rxjs/operators';

@Injectable()
export class CacheInterceptor implements NestInterceptor {
  private cache = new Map<string, { data: any; timestamp: number }>();
  private readonly TTL = 5 * 60 * 1000; // 5분

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const request = context.switchToHttp().getRequest();
    const key = `${request.method}:${request.url}`;

    // GET 요청이 아니면 캐싱하지 않음
    if (request.method !== 'GET') {
      return next.handle();
    }

    // 캐시 확인
    const cached = this.cache.get(key);
    if (cached && Date.now() - cached.timestamp < this.TTL) {
      console.log(`[Cache] HIT: ${key}`);
      return of(cached.data);
    }

    // 캐시 미스 - 실제 요청 실행
    console.log(`[Cache] MISS: ${key}`);
    return next.handle().pipe(
      tap((data) => {
        this.cache.set(key, { data, timestamp: Date.now() });
      }),
    );
  }
}
```

**사용**:

```typescript
@Get()
@UseInterceptors(CacheInterceptor)
findAll() {
  return this.postService.findAll();
}
```

---

### 실습 2: 권한 기반 Guard 구현

**목표**: 관리자만 접근 가능한 엔드포인트 만들기

```typescript
// 📁 src/common/guards/admin.guard.ts
import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
} from '@nestjs/common';

@Injectable()
export class AdminGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest();
    const user = request.user;

    if (!user) {
      throw new ForbiddenException('No user found');
    }

    // user.role이 'admin'인지 확인
    if (user.role !== 'admin') {
      throw new ForbiddenException('Admin access required');
    }

    return true;
  }
}
```

**사용**:

```typescript
@Delete(':id')
@UseGuards(JwtAuthGuard, AdminGuard)  // 👈 순서 중요! 먼저 인증, 그 다음 권한
remove(@Param('id') id: string) {
  return this.postService.remove(id);
}
```

---

## ⚠️ 자주 하는 실수

### 1. 순환 의존성 (Circular Dependency)

```typescript
// ❌ 잘못된 코드
// user.service.ts
@Injectable()
export class UserService {
  constructor(private postService: PostService) {} // 👈 PostService 의존
}

// post.service.ts
@Injectable()
export class PostService {
  constructor(private userService: UserService) {} // 👈 UserService 의존
}
// 에러: Circular dependency between UserService and PostService
```

```typescript
// ✅ 해결 방법 1: forwardRef 사용
@Injectable()
export class UserService {
  constructor(
    @Inject(forwardRef(() => PostService)) private postService: PostService,
  ) {}
}

// ✅ 해결 방법 2: 설계 변경 (더 권장)
// 공통 로직을 별도 서비스로 분리
@Injectable()
export class CommonService {
  // 공통 로직
}

@Injectable()
export class UserService {
  constructor(private commonService: CommonService) {}
}

@Injectable()
export class PostService {
  constructor(private commonService: CommonService) {}
}
```

---

### 2. Guard 순서 무시

```typescript
// ❌ 잘못된 순서
@UseGuards(AdminGuard, JwtAuthGuard)  // 인증 전에 권한 체크!
@Get('admin')
getAdminData() {}

// ✅ 올바른 순서
@UseGuards(JwtAuthGuard, AdminGuard)  // 먼저 인증, 그 다음 권한
@Get('admin')
getAdminData() {}
```

---

### 3. Repository에서 비즈니스 로직 구현

```typescript
// ❌ 잘못된 코드 (Repository에 비즈니스 로직)
export class PrismaService {
  async createPost(dto: CreatePostDto, userId: string) {
    // 권한 검증 (비즈니스 로직)
    const user = await this.user.findUnique({ where: { id: userId } });
    if (user.role !== 'admin') {
      throw new ForbiddenException();
    }

    return this.post.create({ data: { ...dto, authorId: userId } });
  }
}

// ✅ 올바른 코드 (Service에 비즈니스 로직)
export class PostService {
  constructor(private prisma: PrismaService) {}

  async createPost(dto: CreatePostDto, userId: string) {
    // 비즈니스 로직
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (user.role !== 'admin') {
      throw new ForbiddenException();
    }

    // Repository는 데이터 접근만
    return this.prisma.post.create({ data: { ...dto, authorId: userId } });
  }
}
```

---

## ✅ 체크리스트

### Dependency Injection

- [ ] `@Injectable()` 데코레이터 사용법 이해
- [ ] 생성자 주입으로 의존성 주입 가능
- [ ] 테스트 시 Mock 객체로 교체 가능

### Repository 패턴

- [ ] PrismaService를 Repository로 사용
- [ ] Service와 Repository 계층 분리 이해

### Strategy 패턴

- [ ] PassportStrategy로 인증 전략 구현 가능
- [ ] JwtStrategy와 JwtAuthGuard 연결 이해

### Factory 패턴

- [ ] forRoot/forRootAsync 차이 이해
- [ ] Dynamic Module 개념 이해

### Filter 패턴

- [ ] Exception Filter로 에러 처리 가능
- [ ] Prisma 에러를 HTTP 에러로 변환 가능

### Interceptor 패턴

- [ ] 요청/응답을 가로채는 Interceptor 구현 가능
- [ ] 로깅, 캐싱, 변환 등 활용 가능

### Guard 패턴

- [ ] CanActivate 인터페이스로 Guard 구현
- [ ] 인증/인가 처리 가능

### DTO 패턴

- [ ] Zod를 사용한 DTO 검증 이해
- [ ] CreateDto, UpdateDto, ResponseDto 구분

---

## 📚 다음 단계

디자인 패턴을 마스터했다면:

- **[09. 고급 기능](./09-advanced-features.md)** - Filter, Interceptor, Guard, Pipe 깊이 있게
- **[10. 보안 베스트 프랙티스](./10-security-best-practices.md)** - 실전 보안 구현
- **[11. 데이터베이스 패턴](./11-database-patterns.md)** - Soft Delete, Pagination 등

---

**Happy Learning! 🎉**
