# 📌 NestJS 데코레이터 완전 가이드

**난이도**: ⭐⭐ 초급-중급  
**학습 시간**: 60분  
**이 문서에서 배울 내용**: NestJS의 모든 데코레이터와 실제 사용법

---

## 📚 목차

- [개요](#개요)
- [데코레이터란?](#데코레이터란)
- [1. 클래스 데코레이터](#1-클래스-데코레이터)
  - [@Injectable()](#injectable)
  - [@Controller()](#controller)
  - [@Module()](#module)
  - [@Catch()](#catch)
- [2. 메서드 데코레이터](#2-메서드-데코레이터)
  - [HTTP 메서드 (@Get, @Post, @Patch, @Delete)](#http-메서드)
  - [@UseGuards()](#useguards)
  - [@UseInterceptors()](#useinterceptors)
  - [@HttpCode()](#httpcode)
- [3. 파라미터 데코레이터](#3-파라미터-데코레이터)
  - [@Body()](#body)
  - [@Param()](#param)
  - [@Query()](#query)
  - [@Headers()](#headers)
  - [@Req() / @Res()](#req--res)
- [4. Swagger 데코레이터](#4-swagger-데코레이터)
- [5. 커스텀 데코레이터](#5-커스텀-데코레이터)
- [실습 예제](#실습-예제)
- [자주 하는 실수](#자주-하는-실수)
- [체크리스트](#체크리스트)

---

## 개요

NestJS는 **데코레이터(Decorator)** 를 핵심 문법으로 사용합니다. 데코레이터는 TypeScript의 실험적 기능으로, 클래스, 메서드, 파라미터에 **메타데이터를 추가**하여 프레임워크가 이를 인식하고 처리할 수 있게 합니다.

이 문서는 **현재 프로젝트에서 실제로 사용하는 모든 데코레이터**를 다루며, 각 데코레이터의 역할과 사용법을 상세히 설명합니다.

---

## 데코레이터란?

데코레이터는 `@` 기호로 시작하며, 클래스나 메서드 위에 배치됩니다.

```typescript
@Controller('users') // 👈 클래스 데코레이터
export class UserController {
  @Get() // 👈 메서드 데코레이터
  findAll(@Query() query: any) {
    // 👈 파라미터 데코레이터
    return query;
  }
}
```

**데코레이터의 역할**:

- 클래스/메서드/파라미터에 **메타데이터 추가**
- NestJS 프레임워크가 **런타임에 이를 읽고 처리**
- **의존성 주입(DI)** 시스템 구현
- **라우팅, 검증, 인증** 등 자동 처리

---

## 1. 클래스 데코레이터

### @Injectable()

**역할**: 클래스를 **주입 가능한 프로바이더(Provider)** 로 표시  
**위치**: Service, Repository, Guard, Interceptor 등 모든 주입 가능한 클래스  
**난이도**: ⭐ 초급

#### 실제 프로젝트 예제

```typescript
// 📁 src/auth/auth.service.ts:16-22
import {
  Injectable,
  UnauthorizedException,
  ConflictException,
} from '@nestjs/common';

@Injectable() // 👈 이 클래스를 DI 컨테이너에 등록
export class AuthService {
  constructor(
    private prisma: PrismaService, // 👈 자동으로 주입됨
    private jwtService: JwtService, // 👈 자동으로 주입됨
    private config: ConfigService<EnvConfig>, // 👈 자동으로 주입됨
  ) {}

  async register(dto: RegisterDto) {
    // 회원가입 로직
  }
}
```

**동작 원리**:

1. `@Injectable()`이 붙은 클래스는 **NestJS DI 컨테이너**에 등록됩니다
2. 다른 클래스의 생성자에서 **타입만 명시**하면 자동으로 인스턴스가 주입됩니다
3. **싱글톤 패턴**으로 동작 (기본값, 하나의 인스턴스만 생성)

**언제 사용?**

- ✅ Service 클래스
- ✅ Repository 클래스
- ✅ Guard, Interceptor, Pipe, Filter
- ❌ Controller (대신 `@Controller()` 사용)
- ❌ DTO 클래스 (주입할 필요 없음)

---

### @Controller()

**역할**: 클래스를 **HTTP 요청을 처리하는 컨트롤러**로 표시  
**위치**: Controller 클래스  
**난이도**: ⭐ 초급

#### 실제 프로젝트 예제

```typescript
// 📁 src/auth/auth.controller.ts:26-28
import {
  Controller,
  Post,
  Body,
  Get,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';

@Controller('auth') // 👈 /auth 경로로 시작하는 모든 요청 처리
export class AuthController {
  constructor(private authService: AuthService) {}

  @Post('register') // 👈 POST /auth/register
  register(@Body() dto: RegisterDto) {
    return this.authService.register(dto);
  }

  @Post('login') // 👈 POST /auth/login
  login(@Body() dto: LoginDto) {
    return this.authService.login(dto);
  }
}
```

**경로 결합**:

- `@Controller('auth')` + `@Post('register')` = `POST /auth/register`
- `@Controller('auth')` + `@Post('login')` = `POST /auth/login`
- `@Controller('')` + `@Get('health')` = `GET /health`

**옵션**:

```typescript
@Controller('posts')        // ✅ 기본 사용
@Controller({ path: 'posts', host: 'api.example.com' })  // 호스트 제한
@Controller({ path: 'posts', version: '1' })  // API 버저닝
```

---

### @Module()

**역할**: 클래스를 **모듈**로 표시하여 관련 컴포넌트를 그룹화  
**위치**: Module 클래스  
**난이도**: ⭐⭐ 초중급

#### 실제 프로젝트 예제

```typescript
// 📁 src/auth/auth.module.ts:10-27
import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { JwtStrategy } from './jwt.strategy';
import { PrismaModule } from '../prisma/prisma.module';

@Module({
  imports: [
    PrismaModule, // 👈 다른 모듈 가져오기
    PassportModule,
    JwtModule.register({
      // 👈 동적 모듈 등록
      secret: process.env.JWT_SECRET,
      signOptions: { expiresIn: '1d' },
    }),
  ],
  controllers: [AuthController], // 👈 이 모듈의 컨트롤러
  providers: [AuthService, JwtStrategy], // 👈 이 모듈의 프로바이더
  exports: [AuthService], // 👈 다른 모듈에서 사용 가능하도록 내보내기
})
export class AuthModule {}
```

**Module 옵션**:

- **imports**: 다른 모듈을 가져옴 (해당 모듈의 exports를 사용 가능)
- **controllers**: 이 모듈에 속한 컨트롤러 목록
- **providers**: 이 모듈에 속한 프로바이더 (Service, Guard 등)
- **exports**: 다른 모듈에서 사용할 수 있도록 내보낼 프로바이더

**루트 모듈 예제**:

```typescript
// 📁 src/app.module.ts:14-47
import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_PIPE, APP_GUARD } from '@nestjs/core';

@Module({
  imports: [
    ConfigModule.forRoot({
      // 👈 전역 설정 모듈
      isGlobal: true, // 모든 모듈에서 사용 가능
      validate,
      cache: true,
    }),
    PrismaModule,
    AuthModule, // 👈 기능 모듈들
    PostModule,
    HealthModule,
  ],
  providers: [
    {
      provide: APP_PIPE, // 👈 전역 Pipe 등록
      useClass: ZodValidationPipe,
    },
    {
      provide: APP_GUARD, // 👈 전역 Guard 등록
      useClass: ThrottlerGuard,
    },
  ],
})
export class AppModule {}
```

---

### @Catch()

**역할**: 클래스를 **Exception Filter**로 표시  
**위치**: Exception Filter 클래스  
**난이도**: ⭐⭐⭐ 고급

#### 실제 프로젝트 예제

```typescript
// 📁 src/common/filters/http-exception.filter.ts:9-13
import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';

@Catch() // 👈 모든 예외를 잡음 (인자 없으면 전체 캐치)
export class HttpExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(HttpExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    let status = HttpStatus.INTERNAL_SERVER_ERROR;
    let message: string | string[] = 'Internal server error';

    // HTTP Exception 처리
    if (exception instanceof HttpException) {
      status = exception.getStatus();
      // ...
    }
    // Prisma 에러 처리
    else if (exception instanceof Prisma.PrismaClientKnownRequestError) {
      status = HttpStatus.BAD_REQUEST;
      // ...
    }

    response.status(status).json({
      statusCode: status,
      timestamp: new Date().toISOString(),
      path: request.url,
      message,
    });
  }
}
```

**특정 예외만 캐치**:

```typescript
@Catch(HttpException) // 👈 HttpException만 캐치
export class HttpExceptionFilter implements ExceptionFilter {
  // ...
}

@Catch(NotFoundException, BadRequestException) // 👈 여러 예외 캐치
export class NotFoundFilter implements ExceptionFilter {
  // ...
}
```

---

## 2. 메서드 데코레이터

### HTTP 메서드

**역할**: 메서드를 **HTTP 요청 핸들러**로 표시  
**난이도**: ⭐ 초급

#### @Get()

```typescript
// 📁 src/auth/auth.controller.ts:66-74
@Get('me')  // 👈 GET /auth/me
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
@ApiOperation({ summary: 'Get current user profile' })
@ApiResponse({ status: 200, description: 'Returns current user' })
@ApiResponse({ status: 401, description: 'Unauthorized' })
getMe(@CurrentUser() user: { id: string; email: string; name: string }) {
  return user;
}
```

#### @Post()

```typescript
// 📁 src/auth/auth.controller.ts:29-35
@Post('register')  // 👈 POST /auth/register
@Throttle(3, 900000)  // 15분에 3회 제한
@ApiOperation({ summary: 'Register a new user' })
@ApiResponse({ status: 201, type: AuthResponseDto })
register(@Body() dto: RegisterDto) {
  return this.authService.register(dto);
}
```

#### @Patch()

```typescript
// 📁 src/post/post.controller.ts:67-80
@Patch(':id')  // 👈 PATCH /posts/:id
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
@ApiOperation({ summary: 'Update a post' })
@ApiResponse({ status: 200, type: PostResponseDto })
update(
  @Param('id') id: string,
  @CurrentUser() user: { id: string },
  @Body() dto: UpdatePostDto,
) {
  return this.postService.update(id, user.id, dto);
}
```

#### @Delete()

```typescript
// 📁 src/post/post.controller.ts:82-92
@Delete(':id')  // 👈 DELETE /posts/:id
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
@ApiOperation({ summary: 'Delete a post' })
@ApiResponse({ status: 200, description: 'Post deleted successfully' })
remove(@Param('id') id: string, @CurrentUser() user: { id: string }) {
  return this.postService.remove(id, user.id);
}
```

**경로 파라미터 사용**:

```typescript
@Get(':id')           // /posts/123
@Get(':id/comments')  // /posts/123/comments
@Get('user/:userId/posts/:postId')  // /user/1/posts/456
```

---

### @UseGuards()

**역할**: 메서드나 컨트롤러에 **Guard 적용** (인증/인가 처리)  
**난이도**: ⭐⭐ 중급

#### 실제 프로젝트 예제

```typescript
// 📁 src/post/post.controller.ts:31-38
@Post()
@UseGuards(JwtAuthGuard)  // 👈 JWT 인증이 필요한 엔드포인트
@ApiBearerAuth()
@ApiOperation({ summary: 'Create a new post' })
@ApiResponse({ status: 201, type: PostResponseDto })
create(@CurrentUser() user: { id: string }, @Body() dto: CreatePostDto) {
  return this.postService.create(user.id, dto);
}
```

**여러 Guard 적용**:

```typescript
@UseGuards(JwtAuthGuard, RolesGuard, PermissionsGuard)  // 👈 순서대로 실행
@Post()
create() {
  // ...
}
```

**컨트롤러 전체에 적용**:

```typescript
@Controller('admin')
@UseGuards(JwtAuthGuard, AdminGuard) // 👈 모든 메서드에 적용
export class AdminController {
  @Get() // 자동으로 Guard 적용됨
  findAll() {}
}
```

---

### @UseInterceptors()

**역할**: 메서드나 컨트롤러에 **Interceptor 적용** (요청/응답 가로채기)  
**난이도**: ⭐⭐ 중급

#### 예제

```typescript
import { UseInterceptors } from '@nestjs/common';
import { LoggingInterceptor } from '../common/interceptors/logging.interceptor';

@Controller('posts')
@UseInterceptors(LoggingInterceptor) // 👈 모든 요청/응답 로깅
export class PostController {
  @Get()
  findAll() {
    return [];
  }
}
```

**현재 프로젝트에서는 main.ts에서 전역 적용**:

```typescript
// 📁 src/main.ts:27
app.useGlobalInterceptors(new LoggingInterceptor());
```

---

### @HttpCode()

**역할**: 응답의 **HTTP 상태 코드 지정**  
**난이도**: ⭐ 초급

#### 실제 프로젝트 예제

```typescript
// 📁 src/auth/auth.controller.ts:37-44
@Post('login')
@HttpCode(HttpStatus.OK)  // 👈 200 OK 반환 (기본은 201 Created)
@Throttle(5, 900000)
@ApiOperation({ summary: 'Login with email and password' })
login(@Body() dto: LoginDto) {
  return this.authService.login(dto);
}
```

**왜 필요한가?**

- `@Post()`는 기본적으로 **201 Created** 반환
- 로그인은 생성이 아니므로 **200 OK**가 더 적합
- `@HttpCode(200)` 또는 `@HttpCode(HttpStatus.OK)` 사용

**다른 상태 코드 예제**:

```typescript
@Delete(':id')
@HttpCode(HttpStatus.NO_CONTENT)  // 204 No Content
remove(@Param('id') id: string) {
  // ...
}

@Post('logout')
@HttpCode(HttpStatus.ACCEPTED)  // 202 Accepted
logout() {
  // ...
}
```

---

## 3. 파라미터 데코레이터

### @Body()

**역할**: HTTP 요청의 **body 추출**  
**난이도**: ⭐ 초급

#### 실제 프로젝트 예제

```typescript
// 📁 src/auth/auth.controller.ts:33-35
@Post('register')
register(@Body() dto: RegisterDto) {  // 👈 전체 body를 dto로 받음
  return this.authService.register(dto);
}
```

**부분 추출**:

```typescript
@Post('login')
login(
  @Body('email') email: string,     // 👈 body.email만 추출
  @Body('password') password: string  // 👈 body.password만 추출
) {
  return { email, password };
}
```

**유효성 검사와 함께**:

```typescript
// 📁 src/auth/dto/register.dto.ts:4-12
import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

export const RegisterSchema = z.object({
  email: z.string().email({ message: 'Invalid email format' }),
  password: z.string().min(6, 'Password must be at least 6 characters'),
  name: z.string().min(2, 'Name must be at least 2 characters'),
});

export class RegisterDto extends createZodDto(RegisterSchema) {}
```

---

### @Param()

**역할**: URL 경로 파라미터 추출  
**난이도**: ⭐ 초급

#### 실제 프로젝트 예제

```typescript
// 📁 src/post/post.controller.ts:59-65
@Get(':id')  // 👈 /posts/123
@ApiOperation({ summary: 'Get a post by ID' })
findOne(@Param('id') id: string) {  // 👈 URL에서 :id 추출
  return this.postService.findOne(id);
}
```

**여러 파라미터**:

```typescript
@Get('user/:userId/posts/:postId')
findPost(
  @Param('userId') userId: string,
  @Param('postId') postId: string
) {
  return { userId, postId };
}

// 또는 전체 객체로 받기
@Get('user/:userId/posts/:postId')
findPost(@Param() params: { userId: string; postId: string }) {
  return params;
}
```

---

### @Query()

**역할**: URL 쿼리 파라미터 추출  
**난이도**: ⭐ 초급

#### 실제 프로젝트 예제

```typescript
// 📁 src/post/post.controller.ts:40-53
@Get()
@ApiOperation({ summary: 'Get all posts with pagination' })
@ApiQuery({ name: 'page', required: false, type: Number })
@ApiQuery({ name: 'limit', required: false, type: Number })
@ApiQuery({ name: 'published', required: false, type: Boolean })
findAll(
  @Query() pagination: PaginationDto,      // 👈 전체 쿼리를 DTO로
  @Query('published') published?: string   // 👈 특정 쿼리만 추출
) {
  const publishedFilter =
    published === 'true' ? true : published === 'false' ? false : undefined;
  return this.postService.findAll(pagination, publishedFilter);
}
```

**요청 예시**:

- `GET /posts?page=1&limit=20&published=true`
- `pagination` = `{ page: 1, limit: 20, sortOrder: 'desc' }`
- `published` = `'true'`

---

### @Headers()

**역할**: HTTP 요청 헤더 추출  
**난이도**: ⭐ 초급

```typescript
@Get()
findAll(
  @Headers('authorization') auth: string,  // 👈 특정 헤더만
  @Headers() headers: Record<string, string>  // 👈 모든 헤더
) {
  return { auth, headers };
}
```

---

### @Req() / @Res()

**역할**: Express의 Request/Response 객체 직접 접근  
**난이도**: ⭐⭐ 중급

```typescript
import { Req, Res } from '@nestjs/common';
import { Request, Response } from 'express';

@Get()
findAll(@Req() req: Request, @Res() res: Response) {
  console.log(req.headers);
  res.status(200).json({ message: 'OK' });
}
```

**⚠️ 주의**: `@Res()`를 사용하면 직접 응답을 보내야 하며, NestJS의 자동 응답 처리가 비활성화됩니다.

**권장하지 않음**:

- 대부분의 경우 `@Body()`, `@Param()`, `@Query()` 등으로 충분
- Express에 종속되어 Fastify 등으로 전환 시 문제
- 꼭 필요한 경우에만 사용

---

## 4. Swagger 데코레이터

**역할**: API 문서 자동 생성  
**난이도**: ⭐ 초급

### 현재 프로젝트에서 사용 중인 Swagger 데코레이터

#### @ApiTags()

```typescript
// 📁 src/auth/auth.controller.ts:24
@ApiTags('Auth') // 👈 Swagger에서 'Auth' 그룹으로 분류
@Controller('auth')
export class AuthController {}
```

#### @ApiOperation()

```typescript
// 📁 src/auth/auth.controller.ts:30
@ApiOperation({ summary: 'Register a new user' })  // 👈 엔드포인트 설명
@Post('register')
register() {}
```

#### @ApiResponse()

```typescript
// 📁 src/auth/auth.controller.ts:31-32
@ApiResponse({ status: 201, type: AuthResponseDto })  // 👈 성공 응답
@ApiResponse({ status: 409, description: 'Email already exists' })  // 👈 에러 응답
@Post('register')
register() {}
```

#### @ApiBearerAuth()

```typescript
// 📁 src/post/post.controller.ts:33
@ApiBearerAuth()  // 👈 JWT 토큰 필요함을 Swagger에 표시
@UseGuards(JwtAuthGuard)
@Post()
create() {}
```

#### @ApiQuery()

```typescript
// 📁 src/post/post.controller.ts:42-45
@ApiQuery({ name: 'page', required: false, type: Number })
@ApiQuery({ name: 'limit', required: false, type: Number })
@ApiQuery({ name: 'published', required: false, type: Boolean })
@Get()
findAll() {}
```

**Swagger 문서 확인**:

- 개발 서버 실행 후 `http://localhost:3000/api` 접속
- 모든 API 엔드포인트가 자동으로 문서화됨

---

## 5. 커스텀 데코레이터

프로젝트에서 직접 만든 데코레이터들입니다.

### @CurrentUser()

**역할**: JWT에서 현재 사용자 정보 추출  
**난이도**: ⭐⭐ 중급

#### 구현

```typescript
// 📁 src/auth/current-user.decorator.ts:1-7
import { createParamDecorator, ExecutionContext } from '@nestjs/common';

export const CurrentUser = createParamDecorator(
  (data: unknown, ctx: ExecutionContext) => {
    const request = ctx.switchToHttp().getRequest();
    return request.user; // 👈 JwtStrategy에서 설정한 user 객체
  },
);
```

#### 사용

```typescript
// 📁 src/auth/auth.controller.ts:72
@Get('me')
@UseGuards(JwtAuthGuard)  // 👈 먼저 인증 필요
getMe(@CurrentUser() user: { id: string; email: string; name: string }) {
  return user;  // 👈 자동으로 JWT payload에서 추출된 사용자 정보
}
```

**동작 원리**:

1. `JwtAuthGuard`가 JWT 토큰 검증
2. `JwtStrategy.validate()`가 사용자 정보를 `request.user`에 저장
3. `@CurrentUser()`가 `request.user` 추출하여 반환

---

### @Throttle()

**역할**: Rate Limiting (요청 횟수 제한)  
**난이도**: ⭐⭐ 중급

#### 구현

```typescript
// 📁 src/common/decorators/throttle.decorator.ts:1-17
import { SetMetadata } from '@nestjs/common';

export const THROTTLE_KEY = 'throttle';

export interface ThrottleOptions {
  limit: number; // 최대 요청 횟수
  ttl: number; // 시간 윈도우 (밀리초)
}

/**
 * Rate limiting decorator
 * @param limit - Maximum number of requests
 * @param ttl - Time window in milliseconds
 */
export const Throttle = (limit: number, ttl: number) =>
  SetMetadata(THROTTLE_KEY, { limit, ttl });
```

#### 사용

```typescript
// 📁 src/auth/auth.controller.ts:29-30
@Post('register')
@Throttle(3, 900000)  // 👈 15분(900000ms)에 3회만 허용
register(@Body() dto: RegisterDto) {
  return this.authService.register(dto);
}

// 📁 src/auth/auth.controller.ts:38
@Post('login')
@Throttle(5, 900000)  // 👈 15분에 5회 허용
login(@Body() dto: LoginDto) {
  return this.authService.login(dto);
}
```

**엔드포인트별 차등 제한**:

- 회원가입: 15분에 3회 (악용 방지)
- 로그인: 15분에 5회 (브루트포스 방지)
- Refresh: 1분에 10회 (정상적인 사용 허용)

---

## 💪 실습 예제

### 실습 1: 간단한 CRUD API 만들기

**목표**: 데코레이터를 사용하여 완전한 RESTful API 구현

```typescript
// 📁 src/tasks/tasks.controller.ts
import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';

@ApiTags('Tasks')
@Controller('tasks')
@UseGuards(JwtAuthGuard) // 모든 엔드포인트에 인증 필요
export class TasksController {
  constructor(private tasksService: TasksService) {}

  // 1. 모든 태스크 조회
  @Get()
  @ApiOperation({ summary: 'Get all tasks' })
  @ApiResponse({ status: 200, description: 'Returns all tasks' })
  findAll(@Query('status') status?: string) {
    return this.tasksService.findAll(status);
  }

  // 2. 특정 태스크 조회
  @Get(':id')
  @ApiOperation({ summary: 'Get task by ID' })
  @ApiResponse({ status: 200, description: 'Returns a task' })
  @ApiResponse({ status: 404, description: 'Task not found' })
  findOne(@Param('id') id: string) {
    return this.tasksService.findOne(id);
  }

  // 3. 태스크 생성
  @Post()
  @ApiOperation({ summary: 'Create a new task' })
  @ApiResponse({ status: 201, description: 'Task created' })
  create(@Body() createTaskDto: CreateTaskDto, @CurrentUser() user: any) {
    return this.tasksService.create(createTaskDto, user.id);
  }

  // 4. 태스크 수정
  @Patch(':id')
  @ApiOperation({ summary: 'Update a task' })
  @ApiResponse({ status: 200, description: 'Task updated' })
  update(
    @Param('id') id: string,
    @Body() updateTaskDto: UpdateTaskDto,
    @CurrentUser() user: any,
  ) {
    return this.tasksService.update(id, updateTaskDto, user.id);
  }

  // 5. 태스크 삭제
  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete a task' })
  remove(@Param('id') id: string, @CurrentUser() user: any) {
    return this.tasksService.remove(id, user.id);
  }
}
```

**실습 과제**:

1. 위 코드를 프로젝트에 추가
2. `TasksService`, `CreateTaskDto`, `UpdateTaskDto` 생성
3. Swagger 문서에서 확인
4. Postman으로 테스트

---

### 실습 2: 커스텀 데코레이터 만들기

**목표**: `@User('email')` 형태로 사용자 정보 일부만 추출하는 데코레이터

```typescript
// 📁 src/common/decorators/user.decorator.ts
import { createParamDecorator, ExecutionContext } from '@nestjs/common';

export const User = createParamDecorator(
  (data: string, ctx: ExecutionContext) => {
    const request = ctx.switchToHttp().getRequest();
    const user = request.user;

    // data가 있으면 특정 필드만 반환
    return data ? user?.[data] : user;
  },
);
```

**사용**:

```typescript
@Get('profile')
@UseGuards(JwtAuthGuard)
getProfile(
  @User() user: any,          // 전체 user 객체
  @User('email') email: string,  // user.email만
  @User('id') userId: string     // user.id만
) {
  return { user, email, userId };
}
```

---

## ⚠️ 자주 하는 실수

### 1. @Injectable() 빠뜨리기

```typescript
// ❌ 잘못된 코드
export class UserService {
  // @Injectable() 없음!
  constructor(private prisma: PrismaService) {} // 에러 발생!
}

// ✅ 올바른 코드
@Injectable()
export class UserService {
  constructor(private prisma: PrismaService) {}
}
```

**에러 메시지**:

```
Error: Nest can't resolve dependencies of the UserService (?).
Please make sure that the argument PrismaService at index [0] is available in the UserModule context.
```

---

### 2. 잘못된 HTTP 메서드 데코레이터

```typescript
// ❌ 잘못된 코드
@Get()  // GET 메서드인데
createUser(@Body() dto: CreateUserDto) {  // 생성 로직?
  return this.userService.create(dto);
}

// ✅ 올바른 코드
@Post()  // POST 메서드 사용
createUser(@Body() dto: CreateUserDto) {
  return this.userService.create(dto);
}
```

**REST 규칙**:

- `@Get()`: 조회 (Read)
- `@Post()`: 생성 (Create)
- `@Patch()` / `@Put()`: 수정 (Update)
- `@Delete()`: 삭제 (Delete)

---

### 3. @Res() 사용 시 직접 응답 안 보내기

```typescript
// ❌ 잘못된 코드
@Get()
findAll(@Res() res: Response) {
  return { data: [] };  // 응답이 안 감!
}

// ✅ 올바른 코드 (방법 1: @Res() 사용 시 직접 응답)
@Get()
findAll(@Res() res: Response) {
  res.status(200).json({ data: [] });
}

// ✅ 올바른 코드 (방법 2: @Res() 없이 return)
@Get()
findAll() {
  return { data: [] };  // NestJS가 자동으로 JSON 응답
}
```

---

### 4. 파라미터 데코레이터 순서 무시

```typescript
// ⚠️ 작동하지만 가독성 낮음
@Patch(':id')
update(
  @CurrentUser() user: any,
  @Body() dto: UpdateDto,
  @Param('id') id: string,  // 순서가 뒤죽박죽
) {}

// ✅ 권장: 논리적 순서로 배치
@Patch(':id')
update(
  @Param('id') id: string,      // 1. URL 파라미터
  @Body() dto: UpdateDto,        // 2. Body
  @CurrentUser() user: any,      // 3. 인증 정보
) {}
```

---

### 5. Guard 없이 @CurrentUser() 사용

```typescript
// ❌ 잘못된 코드
@Get('profile')
// @UseGuards(JwtAuthGuard) 없음!
getProfile(@CurrentUser() user: any) {  // user는 undefined!
  return user;
}

// ✅ 올바른 코드
@Get('profile')
@UseGuards(JwtAuthGuard)  // 먼저 인증 필요!
getProfile(@CurrentUser() user: any) {
  return user;
}
```

---

## ✅ 체크리스트

학습 완료 후 다음 항목을 체크하세요:

### 클래스 데코레이터

- [ ] `@Injectable()`의 역할과 사용법 이해
- [ ] `@Controller()`로 라우팅 경로 설정 가능
- [ ] `@Module()`의 imports, providers, exports 이해
- [ ] `@Catch()`로 Exception Filter 만들 수 있음

### 메서드 데코레이터

- [ ] `@Get()`, `@Post()`, `@Patch()`, `@Delete()` 사용 가능
- [ ] `@UseGuards()`로 인증/인가 처리 이해
- [ ] `@HttpCode()`로 상태 코드 변경 가능

### 파라미터 데코레이터

- [ ] `@Body()`로 요청 body 추출 가능
- [ ] `@Param()`으로 URL 파라미터 추출 가능
- [ ] `@Query()`로 쿼리 파라미터 추출 가능
- [ ] `@CurrentUser()` 같은 커스텀 데코레이터 만들 수 있음

### Swagger 데코레이터

- [ ] `@ApiTags()`, `@ApiOperation()` 사용 가능
- [ ] `@ApiResponse()`로 응답 스키마 정의 가능
- [ ] `@ApiBearerAuth()`로 인증 표시 가능

### 실습

- [ ] CRUD API를 데코레이터로 구현 가능
- [ ] 커스텀 데코레이터 만들 수 있음
- [ ] Swagger 문서 자동 생성 확인

---

## 📚 다음 단계

데코레이터를 마스터했다면, 다음 문서로 진행하세요:

- **[08. 디자인 패턴](./08-design-patterns.md)** - NestJS의 핵심 디자인 패턴 학습
- **[09. 고급 기능](./09-advanced-features.md)** - Filter, Interceptor, Guard, Pipe 깊이 있게
- **[10. 보안 베스트 프랙티스](./10-security-best-practices.md)** - 실전 보안 구현

---

## 🔗 참고 자료

- [NestJS 공식 문서 - Custom Decorators](https://docs.nestjs.com/custom-decorators)
- [NestJS 공식 문서 - OpenAPI (Swagger)](https://docs.nestjs.com/openapi/introduction)
- [TypeScript Decorators](https://www.typescriptlang.org/docs/handbook/decorators.html)

---

**Happy Learning! 🎉**
