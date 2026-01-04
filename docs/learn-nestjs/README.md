# 📚 NestJS + Prisma + JWT 학습 문서

NestJS 프레임워크를 학습하기 위한 종합 가이드입니다.

## 📖 문서 목록

### 기초 개념
- [01. 아키텍처 (Architecture)](./01-architecture.md) - NestJS 프로젝트 구조와 설계 원칙
- [02. 핵심 개념 (Core Concepts)](./02-core-concepts.md) - Module, Controller, Provider, Dependency Injection

### 인증 및 데이터베이스
- [03. 인증과 JWT (Authentication & JWT)](./03-auth-jwt.md) - JWT 기반 인증 시스템 구현
- [05. Prisma ORM](./05-prisma.md) - Prisma를 사용한 데이터베이스 관리

### 개발 도구
- [04. NestJS CLI](./04-nestjs-cli.md) - NestJS CLI 명령어와 사용법

### 테스팅
- [06. 테스팅 가이드 (Testing Guide)](./06-testing.md) - Unit Test와 E2E Test 작성법

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

### 1단계: 기초 이해
1. [아키텍처](./01-architecture.md)를 읽고 NestJS 구조 파악
2. [핵심 개념](./02-core-concepts.md)으로 Module, Controller, Provider 학습

### 2단계: 인증 구현
3. [인증과 JWT](./03-auth-jwt.md)로 JWT 인증 시스템 이해
4. src/auth/ 폴더의 코드를 직접 분석

### 3단계: 데이터베이스
5. [Prisma ORM](./05-prisma.md)으로 데이터베이스 관리 학습
6. prisma/schema.prisma 파일 수정 및 마이그레이션 실습

### 4단계: 개발 도구
7. [NestJS CLI](./04-nestjs-cli.md)로 효율적인 개발 방법 익히기

### 5단계: 테스팅
8. [테스팅 가이드](./06-testing.md)로 Unit/E2E 테스트 작성법 마스터
9. 직접 테스트 코드 작성하고 실행해보기

---

## 💡 주요 개념

### NestJS 핵심 원칙
- **모듈화**: 기능별로 모듈을 분리하여 관리
- **의존성 주입**: 코드의 재사용성과 테스트 용이성 향상
- **데코레이터 패턴**: `@Controller`, `@Injectable` 등으로 명확한 구조

### 보안 Best Practices
- ✅ 비밀번호는 bcrypt로 해싱
- ✅ JWT Secret은 환경 변수로 관리
- ✅ 비밀번호는 절대 응답에 포함하지 않음
- ✅ ValidationPipe로 입력 데이터 검증
- ✅ Guards로 인증/인가 처리

### 테스트 전략
- **Unit Test**: 개별 기능(Service, Controller)의 로직 검증
- **E2E Test**: 전체 플로우(회원가입 → 로그인 → API 호출) 검증
- **Coverage 목표**: Unit ≥80%, E2E ≥70%

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

---

## 🤝 기여하기

이 프로젝트는 NestJS 학습을 위한 예제 프로젝트입니다.
- 버그 발견 시 이슈를 등록해주세요
- 개선 사항이 있으면 PR을 보내주세요
- 질문은 Discussions에 올려주세요

---

**Happy Learning! 🎉**
