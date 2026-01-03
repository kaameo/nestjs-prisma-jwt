# NestJS 아키텍처 이해하기

## Spring vs NestJS 비교

| Spring | NestJS | 역할 |
|--------|--------|------|
| `@Configuration` | `@Module` | 의존성 설정 및 모듈 정의 |
| `@Service` | `@Injectable` | 비즈니스 로직 담당 |
| `@RestController` | `@Controller` | HTTP 요청 처리 |
| `@RequestBody` | `@Body()` | 요청 바디 파싱 |
| `@PathVariable` | `@Param()` | URL 파라미터 |
| `@RequestParam` | `@Query()` | 쿼리 파라미터 |
| `@Valid` | `ValidationPipe` | DTO 검증 |
| `@PreAuthorize` | `@UseGuards()` | 인증/인가 |
| JPA Entity | Prisma Model | DB 스키마 정의 |

---

## 핵심 파일 구조

```
src/
├── main.ts              # 앱 진입점 (Spring의 Application.java)
├── app.module.ts        # 루트 모듈 (모든 모듈 import)
│
├── auth/                # 인증 모듈
│   ├── auth.module.ts       # 모듈 정의
│   ├── auth.controller.ts   # API 엔드포인트
│   ├── auth.service.ts      # 비즈니스 로직
│   ├── jwt.strategy.ts      # JWT 검증 전략
│   ├── jwt-auth.guard.ts    # 인증 가드
│   ├── current-user.decorator.ts  # 커스텀 데코레이터
│   └── dto/                 # 요청/응답 타입
│       ├── login.dto.ts
│       ├── register.dto.ts
│       └── auth-response.dto.ts
│
├── post/                # 게시글 모듈 (같은 패턴)
│   ├── post.module.ts
│   ├── post.controller.ts
│   ├── post.service.ts
│   └── dto/
│
└── prisma/              # DB 연결 모듈
    ├── prisma.module.ts
    └── prisma.service.ts
```

---

## 요청 흐름

```
HTTP Request
    ↓
[Guard] - 인증 확인 (JwtAuthGuard)
    ↓
[Controller] - 라우팅 및 요청 파싱
    ↓
[Service] - 비즈니스 로직 실행
    ↓
[Prisma] - DB 쿼리
    ↓
HTTP Response
```
