# 12. Project Structure & Best Practices ⭐⭐

NestJS 프로젝트의 구조, 3-Layer Architecture, 모듈 조직화, 파일 명명 규칙 등을 실제 프로젝트를 통해 학습합니다.

## 📚 목차

1. [프로젝트 전체 구조](#프로젝트-전체-구조)
2. [3-Layer Architecture](#3-layer-architecture)
3. [모듈 조직화](#모듈-조직화)
4. [파일 명명 규칙](#파일-명명-규칙)
5. [Common Module Pattern](#common-module-pattern)
6. [확장 가능한 구조](#확장-가능한-구조)
7. [💪 실습 과제](#-실습-과제)
8. [⚠️ 자주 하는 실수](#️-자주-하는-실수)
9. [✅ 체크리스트](#-체크리스트)

---

## 프로젝트 전체 구조

### 디렉토리 트리

```
nestjs-prisma-jwt/
│
├── prisma/                      # Prisma ORM 설정
│   ├── migrations/              # DB 마이그레이션 히스토리
│   │   ├── 20260103024717_init/
│   │   ├── 20260104105447_add_refresh_token/
│   │   └── 20260104112203_add_soft_delete_to_posts/
│   └── schema.prisma            # DB 스키마 정의
│
├── src/                         # 소스 코드
│   ├── auth/                    # 인증 모듈
│   │   ├── dto/                 # Data Transfer Objects
│   │   │   ├── auth-response.dto.ts
│   │   │   ├── login.dto.ts
│   │   │   ├── refresh-token.dto.ts
│   │   │   └── register.dto.ts
│   │   ├── auth.controller.ts   # 라우트 핸들러
│   │   ├── auth.module.ts       # 모듈 정의
│   │   ├── auth.service.ts      # 비즈니스 로직
│   │   ├── auth.service.spec.ts # 테스트
│   │   ├── current-user.decorator.ts
│   │   ├── jwt-auth.guard.ts
│   │   ├── jwt.strategy.ts
│   │   └── jwt.strategy.spec.ts
│   │
│   ├── post/                    # 게시글 모듈
│   │   ├── dto/
│   │   │   ├── create-post.dto.ts
│   │   │   ├── post-response.dto.ts
│   │   │   └── update-post.dto.ts
│   │   ├── post.controller.ts
│   │   ├── post.controller.spec.ts
│   │   ├── post.module.ts
│   │   ├── post.service.ts
│   │   └── post.service.spec.ts
│   │
│   ├── common/                  # 공통 기능
│   │   ├── decorators/
│   │   │   └── throttle.decorator.ts
│   │   ├── dto/
│   │   │   └── pagination.dto.ts
│   │   ├── filters/
│   │   │   └── http-exception.filter.ts
│   │   └── interceptors/
│   │       └── logging.interceptor.ts
│   │
│   ├── config/                  # 설정
│   │   ├── env.validation.ts
│   │   └── winston.config.ts
│   │
│   ├── health/                  # 헬스 체크 모듈
│   │   ├── health.controller.ts
│   │   └── health.module.ts
│   │
│   ├── prisma/                  # Prisma 서비스
│   │   ├── prisma.module.ts
│   │   └── prisma.service.ts
│   │
│   ├── app.module.ts            # 루트 모듈
│   └── main.ts                  # 진입점
│
├── test/                        # E2E 테스트
│   ├── auth.e2e-spec.ts
│   ├── post.e2e-spec.ts
│   ├── global-setup.ts
│   └── jest-e2e.json
│
├── docs/                        # 문서
│   └── learn-nestjs/
│       ├── 01-architecture.md
│       ├── 02-core-concepts.md
│       └── ...
│
├── .env                         # 환경 변수 (gitignore)
├── .env.example                 # 환경 변수 템플릿
├── .gitignore
├── .prettierrc                  # 코드 포맷팅 규칙
├── docker-compose.yml           # Docker 설정
├── Dockerfile
├── eslint.config.mjs            # Linting 규칙
├── nest-cli.json                # NestJS CLI 설정
├── package.json                 # 의존성 관리
├── pnpm-lock.yaml
├── tsconfig.json                # TypeScript 설정
├── tsconfig.build.json
└── README.md
```

---

## 3-Layer Architecture

NestJS는 **3-Layer Architecture**를 권장합니다.

### 계층 구조

```
┌────────────────────────────────────────────────────────────┐
│                   Presentation Layer                        │
│                     (Controller)                            │
│  - HTTP 요청/응답 처리                                        │
│  - 라우팅, DTO 검증                                           │
│  - Guard, Interceptor 적용                                  │
└────────────────────┬───────────────────────────────────────┘
                     │
                     ▼
┌────────────────────────────────────────────────────────────┐
│                  Application Layer                          │
│                      (Service)                              │
│  - 비즈니스 로직                                              │
│  - 데이터 변환, 검증                                          │
│  - 트랜잭션 관리                                              │
└────────────────────┬───────────────────────────────────────┘
                     │
                     ▼
┌────────────────────────────────────────────────────────────┐
│                   Data Access Layer                         │
│                  (Repository/Prisma)                        │
│  - 데이터베이스 접근                                          │
│  - 쿼리 실행                                                 │
│  - 영속성 관리                                               │
└────────────────────────────────────────────────────────────┘
```

### 실제 예시: 게시글 조회

📁 **src/post/post.controller.ts** (Presentation Layer)

```typescript
@Controller('posts')
export class PostController {
  constructor(private readonly postService: PostService) {}

  @Get(':id')
  @ApiOperation({ summary: 'Get a post by ID' })
  async findOne(@Param('id', ParseIntPipe) id: number): Promise<Post> {
    // 역할: HTTP 요청 받기, 파라미터 변환, 응답 반환
    return this.postService.findOne(id);
  }
}
```

📁 **src/post/post.service.ts** (Application Layer)

```typescript
@Injectable()
export class PostService {
  constructor(private prisma: PrismaService) {}

  async findOne(id: number): Promise<Post> {
    // 역할: 비즈니스 로직 (Soft Delete 필터링)
    const post = await this.prisma.post.findFirst({
      where: {
        id,
        deletedAt: null, // 비즈니스 규칙
      },
      include: { author: true },
    });

    if (!post) {
      throw new NotFoundException(`Post with ID ${id} not found`);
    }

    return post;
  }
}
```

📁 **src/prisma/prisma.service.ts** (Data Access Layer)

```typescript
@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit {
  async onModuleInit() {
    await this.$connect();
  }

  async onModuleDestroy() {
    await this.$disconnect();
  }
}
```

### 책임 분리 원칙

| 계층           | 책임                                 | 금지 사항                                                   |
| -------------- | ------------------------------------ | ----------------------------------------------------------- |
| **Controller** | HTTP 처리, DTO 검증, 응답 반환       | ❌ DB 직접 접근<br>❌ 복잡한 비즈니스 로직                  |
| **Service**    | 비즈니스 로직, 데이터 변환, 트랜잭션 | ❌ HTTP 관련 처리 (req, res)<br>❌ 직접 쿼리 작성 (Raw SQL) |
| **Repository** | DB 접근, 쿼리 실행                   | ❌ 비즈니스 로직<br>❌ HTTP 응답 생성                       |

---

## 모듈 조직화

### Feature Module Pattern

각 기능을 독립적인 모듈로 분리합니다.

📁 **src/auth/auth.module.ts**

```typescript
import { Module } from '@nestjs/common';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { JwtModule } from '@nestjs/jwt';
import { JwtStrategy } from './jwt.strategy';
import { PrismaModule } from '../prisma/prisma.module';

@Module({
  imports: [
    PrismaModule, // 의존성 모듈
    JwtModule.register({}), // JWT 기능
  ],
  controllers: [AuthController], // HTTP 라우트
  providers: [AuthService, JwtStrategy], // 서비스, 전략
  exports: [AuthService], // 다른 모듈에서 사용 가능
})
export class AuthModule {}
```

📁 **src/post/post.module.ts**

```typescript
import { Module } from '@nestjs/common';
import { PostController } from './post.controller';
import { PostService } from './post.service';
import { PrismaModule } from '../prisma/prisma.module';

@Module({
  imports: [PrismaModule],
  controllers: [PostController],
  providers: [PostService],
  exports: [PostService],
})
export class PostModule {}
```

### Global Module Pattern

📁 **src/prisma/prisma.module.ts**

```typescript
import { Global, Module } from '@nestjs/common';
import { PrismaService } from './prisma.service';

@Global() // 전역 모듈 선언 (어디서든 import 없이 사용 가능)
@Module({
  providers: [PrismaService],
  exports: [PrismaService],
})
export class PrismaModule {}
```

**장점:**

- `PrismaService`를 모든 모듈에서 `imports` 없이 사용 가능
- DB 연결을 하나의 인스턴스로 공유

### Root Module

📁 **src/app.module.ts**

```typescript
import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AuthModule } from './auth/auth.module';
import { PostModule } from './post/post.module';
import { PrismaModule } from './prisma/prisma.module';
import { HealthModule } from './health/health.module';
import { validateEnv } from './config/env.validation';

@Module({
  imports: [
    // 설정 모듈 (Global)
    ConfigModule.forRoot({
      isGlobal: true,
      validate: validateEnv,
    }),

    // 전역 모듈
    PrismaModule,

    // 기능 모듈
    AuthModule,
    PostModule,
    HealthModule,
  ],
})
export class AppModule {}
```

**모듈 구조 다이어그램:**

```
AppModule (Root)
│
├── ConfigModule (Global)
├── PrismaModule (Global)
│
├── AuthModule
│   ├── AuthController
│   ├── AuthService
│   └── JwtStrategy
│
├── PostModule
│   ├── PostController
│   └── PostService
│
└── HealthModule
    └── HealthController
```

---

## 파일 명명 규칙

### NestJS 표준 네이밍

| 파일 유형       | 패턴               | 예시                        |
| --------------- | ------------------ | --------------------------- |
| **Module**      | `*.module.ts`      | `auth.module.ts`            |
| **Controller**  | `*.controller.ts`  | `auth.controller.ts`        |
| **Service**     | `*.service.ts`     | `auth.service.ts`           |
| **Guard**       | `*.guard.ts`       | `jwt-auth.guard.ts`         |
| **Interceptor** | `*.interceptor.ts` | `logging.interceptor.ts`    |
| **Filter**      | `*.filter.ts`      | `http-exception.filter.ts`  |
| **Pipe**        | `*.pipe.ts`        | `validation.pipe.ts`        |
| **Decorator**   | `*.decorator.ts`   | `current-user.decorator.ts` |
| **DTO**         | `*.dto.ts`         | `create-post.dto.ts`        |
| **Strategy**    | `*.strategy.ts`    | `jwt.strategy.ts`           |
| **Unit Test**   | `*.spec.ts`        | `auth.service.spec.ts`      |
| **E2E Test**    | `*.e2e-spec.ts`    | `auth.e2e-spec.ts`          |

### Class 네이밍

```typescript
// ✅ 올바른 네이밍
AuthController;
AuthService;
JwtAuthGuard;
LoggingInterceptor;
HttpExceptionFilter;
CreatePostDto;
CurrentUserDecorator;

// ❌ 잘못된 네이밍
Auth; // 너무 모호함
AuthCtrl; // 축약 사용 금지
auth_controller; // snake_case 사용 금지
```

### 폴더 구조 규칙

```
src/
├── auth/                        # 모듈 이름 (소문자, 하이픈)
│   ├── dto/                     # 하위 폴더
│   │   ├── login.dto.ts
│   │   └── register.dto.ts
│   ├── auth.controller.ts       # 모듈명.타입.ts
│   ├── auth.service.ts
│   └── auth.module.ts
│
├── post/
│   ├── dto/
│   ├── post.controller.ts
│   └── ...
│
└── common/                      # 공통 기능은 common 폴더에
    ├── decorators/
    ├── filters/
    └── interceptors/
```

---

## Common Module Pattern

### 개념

여러 모듈에서 공통으로 사용하는 기능은 `common` 폴더에 모읍니다.

### 프로젝트 구현

```
src/common/
├── decorators/
│   └── throttle.decorator.ts     # Rate Limiting 데코레이터
├── dto/
│   └── pagination.dto.ts         # 페이지네이션 DTO
├── filters/
│   └── http-exception.filter.ts  # 전역 에러 핸들러
└── interceptors/
    └── logging.interceptor.ts    # 로깅 인터셉터
```

### 사용 예시

📁 **src/common/decorators/throttle.decorator.ts**

```typescript
import { SetMetadata } from '@nestjs/common';

export const THROTTLE_KEY = 'throttle';

export interface ThrottleOptions {
  limit: number;
  ttl: number;
}

export const Throttle = (limit: number, ttl: number) =>
  SetMetadata(THROTTLE_KEY, { limit, ttl });
```

**여러 컨트롤러에서 재사용:**

```typescript
// auth.controller.ts
@Post('login')
@Throttle(5, 900)
async login() { ... }

// post.controller.ts
@Post()
@Throttle(10, 60)
async create() { ... }
```

### Common Module 생성 (옵션)

```typescript
// src/common/common.module.ts
import { Module, Global } from '@nestjs/common';

@Global()
@Module({
  providers: [
    // 공통 서비스 등록
  ],
  exports: [
    // 다른 모듈에서 사용 가능하도록 export
  ],
})
export class CommonModule {}
```

---

## 확장 가능한 구조

### 프로젝트 성장에 따른 구조 변화

**초기 (< 5 모듈):**

```
src/
├── auth/
├── post/
├── user/
├── common/
└── prisma/
```

**중기 (5-20 모듈):**

```
src/
├── modules/                     # 기능 모듈
│   ├── auth/
│   ├── post/
│   ├── user/
│   ├── comment/
│   ├── notification/
│   └── ...
├── common/                      # 공통 기능
│   ├── decorators/
│   ├── filters/
│   ├── guards/
│   ├── interceptors/
│   └── pipes/
├── config/                      # 설정
├── database/                    # DB 관련
│   └── prisma/
└── main.ts
```

**대규모 (20+ 모듈, 마이크로서비스):**

```
src/
├── api/                         # API Gateway
│   ├── auth/
│   ├── post/
│   └── ...
├── core/                        # 핵심 비즈니스 로직
│   ├── domain/
│   ├── application/
│   └── infrastructure/
├── shared/                      # 공유 라이브러리
│   ├── common/
│   ├── config/
│   └── utils/
└── microservices/               # 마이크로서비스
    ├── notification/
    └── analytics/
```

### Barrel Export Pattern

`index.ts`를 사용하여 import를 간소화합니다.

📁 **src/common/index.ts**

```typescript
export * from './decorators/throttle.decorator';
export * from './dto/pagination.dto';
export * from './filters/http-exception.filter';
export * from './interceptors/logging.interceptor';
```

**사용:**

```typescript
// ❌ 여러 줄 import
import { Throttle } from '../common/decorators/throttle.decorator';
import { PaginationDto } from '../common/dto/pagination.dto';

// ✅ 한 줄 import
import { Throttle, PaginationDto } from '../common';
```

### Environment-based Configuration

환경별로 다른 설정을 사용합니다.

```
config/
├── env.validation.ts            # 환경 변수 검증
├── database.config.ts           # DB 설정
├── jwt.config.ts                # JWT 설정
└── swagger.config.ts            # Swagger 설정
```

📁 **src/config/database.config.ts**

```typescript
import { registerAs } from '@nestjs/config';

export default registerAs('database', () => ({
  url: process.env.DATABASE_URL,
  logging: process.env.NODE_ENV === 'development',
  maxConnections: parseInt(process.env.DB_MAX_CONNECTIONS || '10', 10),
}));
```

**사용:**

```typescript
// app.module.ts
import databaseConfig from './config/database.config';

@Module({
  imports: [
    ConfigModule.forRoot({
      load: [databaseConfig],
    }),
  ],
})
export class AppModule {}
```

---

## 💪 실습 과제

### 과제 1: Comment 모듈 추가

게시글에 댓글 기능을 추가하세요.

```typescript
// 1. Prisma Schema 업데이트
model Comment {
  id        String   @id @default(uuid())
  content   String
  postId    String   @map("post_id")
  post      Post     @relation(fields: [postId], references: [id], onDelete: Cascade)
  authorId  String   @map("author_id")
  author    User     @relation(fields: [authorId], references: [id], onDelete: Cascade)
  createdAt DateTime @default(now()) @map("created_at")
  updatedAt DateTime @updatedAt @map("updated_at")

  @@index([postId])
  @@index([authorId])
  @@map("comments")
}

// 2. 모듈 생성
nest g module comment
nest g controller comment
nest g service comment

// 3. DTO 생성
// src/comment/dto/create-comment.dto.ts
import { z } from 'zod';

export const createCommentSchema = z.object({
  content: z.string().min(1).max(1000),
  postId: z.string().uuid(),
});

export type CreateCommentDto = z.infer<typeof createCommentSchema>;

// 4. CRUD 구현
// TODO: CommentService에 create, findAll, remove 구현
```

### 과제 2: Barrel Export 적용

`common` 폴더에 `index.ts`를 생성하고 모든 공통 기능을 export하세요.

```typescript
// src/common/index.ts
export * from './decorators/throttle.decorator';
export * from './dto/pagination.dto';
// TODO: 나머지 export 추가
```

### 과제 3: Config Module 리팩토링

JWT 설정을 별도 파일로 분리하세요.

```typescript
// src/config/jwt.config.ts
import { registerAs } from '@nestjs/config';

export default registerAs('jwt', () => ({
  secret: process.env.JWT_SECRET,
  refreshSecret: process.env.JWT_REFRESH_SECRET,
  expiresIn: process.env.JWT_EXPIRES_IN || '15m',
  refreshExpiresIn: process.env.JWT_REFRESH_EXPIRES_IN || '7d',
}));

// auth.service.ts에서 사용
constructor(
  @Inject('jwt') private jwtConfig: any,
) {}
```

---

## ⚠️ 자주 하는 실수

### 1. Controller에 비즈니스 로직 작성

```typescript
// ❌ Controller에 비즈니스 로직
@Post()
async create(@Body() dto: CreatePostDto, @CurrentUser() user: any) {
  const hashedPassword = await bcrypt.hash(dto.password, 10); // 잘못됨!
  return this.postService.create({ ...dto, password: hashedPassword });
}

// ✅ Service에 비즈니스 로직
@Post()
async create(@Body() dto: CreatePostDto, @CurrentUser() user: any) {
  return this.postService.create(dto, user.userId);
}
```

### 2. 순환 의존성 (Circular Dependency)

```typescript
// ❌ 순환 의존성 발생
// auth.service.ts
@Injectable()
export class AuthService {
  constructor(private userService: UserService) {}
}

// user.service.ts
@Injectable()
export class UserService {
  constructor(private authService: AuthService) {} // 순환 참조!
}

// ✅ forwardRef 사용 또는 구조 개선
constructor(
  @Inject(forwardRef(() => UserService))
  private userService: UserService,
) {}
```

### 3. 모듈을 import하지 않음

```typescript
// ❌ PrismaService를 사용하지만 PrismaModule을 import하지 않음
@Module({
  controllers: [PostController],
  providers: [PostService], // PrismaService 사용 불가!
})
export class PostModule {}

// ✅ 의존성 모듈 import
@Module({
  imports: [PrismaModule], // 추가!
  controllers: [PostController],
  providers: [PostService],
})
export class PostModule {}
```

### 4. 잘못된 파일 명명

```typescript
// ❌ 잘못된 네이밍
AuthCtrl.ts;
auth_service.ts;
Auth.ts;

// ✅ 올바른 네이밍
auth.controller.ts;
auth.service.ts;
auth.module.ts;
```

---

## ✅ 체크리스트

### 구조

- [ ] 각 기능이 독립적인 모듈로 분리되어 있는가?
- [ ] Controller, Service, Module 파일이 각각 존재하는가?
- [ ] DTO가 `dto/` 폴더에 정리되어 있는가?
- [ ] 공통 기능이 `common/` 폴더에 있는가?

### 명명 규칙

- [ ] 파일명이 `*.controller.ts`, `*.service.ts`, `*.module.ts` 형식인가?
- [ ] Class명이 PascalCase인가? (예: `AuthService`)
- [ ] 폴더명이 kebab-case인가? (예: `auth-module/`)

### 책임 분리

- [ ] Controller가 HTTP 처리만 담당하는가?
- [ ] Service가 비즈니스 로직을 담당하는가?
- [ ] DB 접근이 Prisma/Repository를 통해서만 이루어지는가?
- [ ] Controller에 복잡한 로직이 없는가?

### 모듈 관리

- [ ] 필요한 모듈이 `imports`에 선언되어 있는가?
- [ ] 다른 모듈에서 사용할 Service가 `exports`에 포함되어 있는가?
- [ ] 전역 모듈 (`@Global()`)이 적절히 사용되는가?
- [ ] 순환 의존성이 없는가?

### 확장성

- [ ] 새 기능 추가 시 기존 코드 수정이 최소화되는가?
- [ ] 환경별 설정이 분리되어 있는가? (.env, config/)
- [ ] Barrel Export를 사용하여 import를 간소화했는가?

---

## 다음 단계

축하합니다! NestJS 학습 문서를 모두 완료했습니다. 🎉

### 추가 학습 자료

1. **공식 문서**
   - [NestJS Docs](https://docs.nestjs.com)
   - [Prisma Docs](https://www.prisma.io/docs)

2. **고급 주제**
   - Microservices with NestJS
   - GraphQL with NestJS
   - WebSockets & Real-time Communication
   - CQRS Pattern
   - Event Sourcing

3. **실전 프로젝트**
   - E-commerce API
   - Social Media Platform
   - Task Management System
   - Real-time Chat Application

### 프로젝트 개선 아이디어

- [ ] **Role-based Authorization**: Admin/User 권한 구분
- [ ] **File Upload**: 이미지 업로드 기능 (S3, Cloudinary)
- [ ] **Email Notification**: 회원가입/비밀번호 재설정 이메일
- [ ] **Full-text Search**: 게시글 검색 기능 (Elasticsearch)
- [ ] **Caching**: Redis를 사용한 캐싱
- [ ] **GraphQL**: REST 대신 GraphQL API 구현
- [ ] **WebSocket**: 실시간 채팅 기능
- [ ] **Monitoring**: Prometheus + Grafana 모니터링

---

**[← 이전: 11. Database Patterns](./11-database-patterns.md)** ⭐⭐⭐
