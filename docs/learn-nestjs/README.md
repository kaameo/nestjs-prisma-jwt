# 📚 NestJS + Prisma + JWT 학습 문서

NestJS 프레임워크를 학습하기 위한 종합 가이드입니다.

## 📖 문서 목록

### 기초 개념 ⭐

- [01. 아키텍처 (Architecture)](./01-architecture.md) - NestJS 프로젝트 구조와 설계 원칙
- [02. 핵심 개념 (Core Concepts)](./02-core-concepts.md) - Module, Controller, Provider, Dependency Injection

### 인증 및 데이터베이스 ⭐⭐

- [03. 인증과 JWT (Authentication & JWT)](./03-auth-jwt.md) - JWT 기반 인증 시스템 구현
- [05. Prisma ORM](./05-prisma.md) - Prisma를 사용한 데이터베이스 관리

### 개발 도구 ⭐

- [04. NestJS CLI](./04-nestjs-cli.md) - NestJS CLI 명령어와 사용법

### 테스팅 ⭐⭐

- [06. 테스팅 가이드 (Testing Guide)](./06-testing.md) - Unit Test와 E2E Test 작성법

### 고급 패턴 ⭐⭐⭐

- [07. Decorators Guide](./07-decorators-guide.md) - NestJS 데코레이터 완벽 가이드 (Class, Method, Parameter 데코레이터)
- [08. Design Patterns](./08-design-patterns.md) - DI, Repository, Strategy, Factory 등 핵심 디자인 패턴
- [09. Advanced Features](./09-advanced-features.md) - Exception Filters, Interceptors, Guards, Pipes, Middleware
- [10. Security Best Practices](./10-security-best-practices.md) - Refresh Token Rotation, bcrypt, JWT 관리, Rate Limiting
- [11. Database Patterns](./11-database-patterns.md) - Soft Delete, Pagination, Transactions, Relations
- [12. Project Structure](./12-project-structure.md) - 3-Layer Architecture, 모듈 조직화, 확장 가능한 구조

---

## 🚀 빠른 시작

### 1. 프로젝트 설정

```bash
# 의존성 설치
pnpm install

# 데이터베이스 마이그레이션
pnpm prisma migrate dev

# 개발 서버 실행
pnpm start:dev
```

### 2. 환경 변수 설정

`.env` 파일 생성:

```env
DATABASE_URL="postgresql://user:password@localhost:5432/mydb"
JWT_SECRET="your-super-secret-key-here"
JWT_EXPIRES_IN="1d"
```

### 3. 테스트 실행

```bash
# Unit 테스트
pnpm test

# E2E 테스트
pnpm test:e2e

# 테스트 커버리지
pnpm test:cov
```

---

## 📂 프로젝트 구조

```
src/
├── auth/              # 인증 모듈
│   ├── dto/          # Data Transfer Objects
│   ├── guards/       # JWT Guard
│   ├── strategies/   # Passport Strategies
│   └── auth.service.ts
├── post/              # 게시물 모듈
│   ├── dto/
│   └── post.service.ts
├── prisma/            # Prisma 설정
│   └── prisma.service.ts
└── main.ts            # 애플리케이션 진입점

prisma/
└── schema.prisma      # 데이터베이스 스키마

test/
├── auth.e2e-spec.ts   # 인증 E2E 테스트
└── post.e2e-spec.ts   # 게시물 E2E 테스트
```

---

## 🎯 학습 로드맵

### 1단계: 기초 이해 ⭐ (1-2일)

1. [아키텍처](./01-architecture.md)를 읽고 NestJS 구조 파악
2. [핵심 개념](./02-core-concepts.md)으로 Module, Controller, Provider 학습
3. [NestJS CLI](./04-nestjs-cli.md)로 효율적인 개발 방법 익히기

### 2단계: 인증 구현 ⭐⭐ (2-3일)

4. [인증과 JWT](./03-auth-jwt.md)로 JWT 인증 시스템 이해
5. src/auth/ 폴더의 코드를 직접 분석
6. [Decorators Guide](./07-decorators-guide.md)로 데코레이터 패턴 마스터

### 3단계: 데이터베이스 ⭐⭐ (2-3일)

7. [Prisma ORM](./05-prisma.md)으로 데이터베이스 관리 학습
8. [Database Patterns](./11-database-patterns.md)로 Soft Delete, Pagination, Transactions 실습
9. prisma/schema.prisma 파일 수정 및 마이그레이션 실습

### 4단계: 테스팅 ⭐⭐ (2일)

10. [테스팅 가이드](./06-testing.md)로 Unit/E2E 테스트 작성법 마스터
11. 직접 테스트 코드 작성하고 실행해보기

### 5단계: 고급 패턴 ⭐⭐⭐ (3-5일)

12. [Design Patterns](./08-design-patterns.md)로 DI, Repository, Factory 패턴 이해
13. [Advanced Features](./09-advanced-features.md)로 Filters, Interceptors, Guards, Pipes 학습
14. [Security Best Practices](./10-security-best-practices.md)로 보안 강화 (Refresh Token Rotation, Rate Limiting)
15. [Project Structure](./12-project-structure.md)로 확장 가능한 구조 설계

### 6단계: 실전 프로젝트 (2주+)

16. 학습한 내용을 바탕으로 실제 프로젝트 구현
17. 코드 리뷰 및 리팩토링
18. 배포 및 모니터링

**총 학습 시간: 약 2-3주** (하루 2-3시간 기준)

---

## 💡 주요 개념

### NestJS 핵심 원칙

- **모듈화**: 기능별로 모듈을 분리하여 관리
- **의존성 주입**: 코드의 재사용성과 테스트 용이성 향상
- **데코레이터 패턴**: `@Controller`, `@Injectable` 등으로 명확한 구조
- **3-Layer Architecture**: Controller → Service → Repository 계층 분리

### 보안 Best Practices

- ✅ 비밀번호는 bcrypt로 해싱 (Salt rounds: 10)
- ✅ JWT Secret은 환경 변수로 관리 (최소 32자)
- ✅ Refresh Token Rotation으로 토큰 재사용 감지
- ✅ Rate Limiting으로 Brute Force 공격 방어
- ✅ 비밀번호는 절대 응답에 포함하지 않음
- ✅ Zod/ValidationPipe로 입력 데이터 검증
- ✅ Guards로 인증/인가 처리
- ✅ CORS 설정으로 출처 제한

### 데이터베이스 패턴

- **Soft Delete**: `deletedAt` 필드로 논리적 삭제 (복구 가능)
- **Pagination**: Offset-based 페이징 (skip/take)
- **Transactions**: 원자적 작업 보장 (모두 성공 or 모두 실패)
- **Relations**: Include로 N+1 Problem 방지

### 테스트 전략

- **Unit Test**: 개별 기능(Service, Controller)의 로직 검증
- **E2E Test**: 전체 플로우(회원가입 → 로그인 → API 호출) 검증
- **Coverage 목표**: Unit ≥80%, E2E ≥70%

### 최근 프로젝트 개선 사항 🆕

- ✅ **Refresh Token Rotation**:
  - 별도의 `RefreshToken` 테이블로 다중 디바이스 지원
  - 토큰 재사용 감지 시 모든 세션 무효화 (보안 강화)
  - bcrypt 해싱 + JWT 이중 검증
- ✅ **Soft Delete**: 게시글 논리적 삭제 기능 (`deletedAt` 필드, 복구 가능)
- ✅ **Pagination**: 페이지네이션 + 메타데이터 (total, hasNextPage 등)
- ✅ **Global Exception Filter**: Prisma 에러를 HTTP 에러로 변환, 프로덕션 환경 보안 강화
- ✅ **Rate Limiting**: 로그인(5회/15분), 회원가입(3회/15분) 제한
- ✅ **Logging Interceptor**: 모든 HTTP 요청/응답 자동 로깅
- ✅ **Docker Support**: Multi-stage build, 비루트 사용자, 헬스 체크
- ✅ **Environment Validation**: Zod로 환경 변수 검증 (앱 시작 시)
- ✅ **UUID 기본키**: 모든 모델에 UUID 사용 (autoincrement 대신 보안 강화)

---

## 🔗 유용한 링크

### 공식 문서

- [NestJS 공식 문서](https://docs.nestjs.com/)
- [Prisma 공식 문서](https://www.prisma.io/docs)
- [Jest 공식 문서](https://jestjs.io/docs/getting-started)

### GitHub

- [NestJS GitHub](https://github.com/nestjs/nest)
- [Prisma GitHub](https://github.com/prisma/prisma)

### 학습 자료

- [NestJS 한국어 튜토리얼](https://github.com/nestjs/docs.nestjs.kr)
- [TypeScript 핸드북](https://www.typescriptlang.org/docs/)

---

## ❓ FAQ

### Q1: 왜 NestJS를 사용하나요?

A: Express보다 구조화되고 확장 가능한 애플리케이션을 만들 수 있으며, TypeScript 네이티브 지원과 강력한 DI 시스템을 제공합니다.

### Q2: Prisma와 TypeORM 중 어떤 것을 선택해야 하나요?

A: Prisma는 타입 안정성이 뛰어나고 학습 곡선이 낮으며, 마이그레이션 자동 생성 기능이 강력합니다. TypeORM은 더 많은 기능을 제공하지만 복잡합니다.

### Q3: JWT 토큰을 어디에 저장해야 하나요?

A: 프로덕션에서는 HttpOnly Cookie에 저장하는 것이 가장 안전합니다. 개발/학습 시에는 LocalStorage를 사용할 수 있습니다.

### Q4: 테스트는 어떻게 작성하나요?

A: [테스팅 가이드](./06-testing.md)를 참고하세요. Given-When-Then 패턴을 사용하며, Mock 객체로 의존성을 대체합니다.

### Q5: Refresh Token Rotation이란 무엇인가요?

A: 토큰 탈취 시 피해를 최소화하는 보안 패턴입니다. 이 프로젝트는 별도의 `RefreshToken` 테이블을 사용하여 다중 디바이스 지원과 함께 구현되어 있습니다. Refresh Token을 한 번만 사용 가능하게 하고, 재사용 감지 시 모든 세션을 무효화합니다. 자세한 내용은 [Security Best Practices](./10-security-best-practices.md)를 참고하세요.

### Q6: Soft Delete와 Hard Delete의 차이는?

A: Hard Delete는 데이터를 영구적으로 삭제하지만, Soft Delete는 `deletedAt` 필드를 설정하여 논리적으로만 삭제합니다. 복구가 가능하고 감사 추적이 필요한 경우 Soft Delete를 사용합니다. [Database Patterns](./11-database-patterns.md)를 참고하세요.

### Q7: 프로젝트 구조를 어떻게 확장해야 하나요?

A: 기능별로 모듈을 분리하고, 공통 기능은 `common/` 폴더에 모읍니다. 3-Layer Architecture (Controller → Service → Repository)를 유지하세요. [Project Structure](./12-project-structure.md)를 참고하세요.

---

## 🤝 기여하기

이 프로젝트는 NestJS 학습을 위한 예제 프로젝트입니다.

- 버그 발견 시 이슈를 등록해주세요
- 개선 사항이 있으면 PR을 보내주세요
- 질문은 Discussions에 올려주세요

---

**Happy Learning! 🎉**
