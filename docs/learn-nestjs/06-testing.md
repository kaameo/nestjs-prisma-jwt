# 🧪 NestJS Testing Guide

## 📚 작성된 테스트 목록

### Unit Tests (단위 테스트)

1. **AuthService** (`src/auth/auth.service.spec.ts`)
   - ✅ 회원가입 (이메일 중복 검증, 비밀번호 해싱)
   - ✅ 로그인 (자격증명 검증, JWT 토큰 발급)
   - ✅ 사용자 검증 (validateUser)
   - ✅ JWT 토큰 생성 (payload 검증)

2. **JwtStrategy** (`src/auth/jwt.strategy.spec.ts`)
   - ✅ JWT 페이로드 검증
   - ✅ 사용자 존재 여부 확인
   - ✅ UnauthorizedException 처리
   - ✅ JWT_SECRET 환경 변수 사용 확인

3. **PostService** (`src/post/post.service.spec.ts`)
   - ✅ 게시물 생성 (작성자 ID 자동 할당)
   - ✅ 게시물 조회 (전체, 필터링, 작성자별)
   - ✅ 게시물 수정 (권한 검증, 부분 수정)
   - ✅ 게시물 삭제 (권한 검증)
   - ✅ NotFoundException 처리
   - ✅ ForbiddenException 처리

4. **PostController** (`src/post/post.controller.spec.ts`)
   - ✅ HTTP 요청 처리 (POST, GET, PATCH, DELETE)
   - ✅ DTO 검증
   - ✅ Guard 적용 확인 (@UseGuards(JwtAuthGuard))
   - ✅ CurrentUser 데코레이터 동작

### E2E Tests (통합 테스트)

1. **Auth E2E** (`test/auth.e2e-spec.ts`)
   - ✅ 회원가입 플로우
   - ✅ 로그인 플로우
   - ✅ JWT 인증 플로우 (회원가입 → 로그인 → 보호된 라우트 접근)
   - ✅ 보안 테스트 (비밀번호 응답 제외, SQL Injection 방어)
   - ✅ 동시성 테스트 (중복 가입 방지)

2. **Post E2E** (`test/post.e2e-spec.ts`)
   - ✅ CRUD 전체 플로우
   - ✅ 인증 필요/불필요 엔드포인트 구분
   - ✅ 권한 검증 (본인 게시물만 수정/삭제)
   - ✅ 쿼리 파라미터 처리 (published 필터)
   - ✅ 통합 시나리오 (생성 → 수정 → 게시 → 삭제)

---

## 🚀 테스트 실행 방법

### 전체 Unit Tests 실행
```bash
pnpm test
```

### 특정 파일만 테스트
```bash
pnpm test auth.service.spec.ts
pnpm test post.service.spec.ts
```

### Watch 모드 (파일 변경 시 자동 재실행)
```bash
pnpm test:watch
```

### Coverage 확인 (코드 커버리지)
```bash
pnpm test:cov
```

### E2E Tests 실행
```bash
# 먼저 개발 서버가 실행 중이지 않은지 확인 (포트 충돌 방지)
pnpm test:e2e
```

### 디버그 모드
```bash
pnpm test:debug
```

---

## 🧩 테스트 구조 설명

### Unit Test 패턴

```typescript
describe('ServiceName', () => {
  let service: ServiceName;
  let dependency: DependencyName;

  // Mock 객체 생성
  const mockDependency = {
    method: jest.fn(),
  };

  beforeEach(async () => {
    // 테스트 모듈 설정
    const module = await Test.createTestingModule({
      providers: [
        ServiceName,
        { provide: DependencyName, useValue: mockDependency },
      ],
    }).compile();

    service = module.get<ServiceName>(ServiceName);
    jest.clearAllMocks();
  });

  describe('methodName', () => {
    it('성공 케이스: 설명', async () => {
      // Given: 테스트 데이터 준비
      mockDependency.method.mockResolvedValue(mockData);

      // When: 테스트 실행
      const result = await service.methodName(input);

      // Then: 결과 검증
      expect(result).toEqual(expectedOutput);
      expect(mockDependency.method).toHaveBeenCalledWith(expectedParams);
    });

    it('실패 케이스: Exception 발생', async () => {
      // Given
      mockDependency.method.mockResolvedValue(null);

      // When & Then
      await expect(service.methodName(input)).rejects.toThrow(ExceptionType);
    });
  });
});
```

### E2E Test 패턴

```typescript
describe('FeatureName (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;

  beforeAll(async () => {
    const module = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = module.createNestApplication();
    app.useGlobalPipes(new ValidationPipe({ /* ... */ }));
    await app.init();

    prisma = module.get<PrismaService>(PrismaService);
  });

  afterAll(async () => {
    // 데이터 정리
    await prisma.post.deleteMany();
    await prisma.user.deleteMany();
    await app.close();
  });

  beforeEach(async () => {
    // 각 테스트 전 데이터 초기화
    await prisma.post.deleteMany();
  });

  it('/endpoint (METHOD)', async () => {
    const response = await request(app.getHttpServer())
      .post('/endpoint')
      .set('Authorization', \`Bearer \${token}\`)
      .send(dto)
      .expect(201);

    expect(response.body).toMatchObject({ /* ... */ });
  });
});
```

---

## 📊 테스트 커버리지 목표

현업에서 권장하는 커버리지:
- **Unit Tests**: ≥80% (비즈니스 로직 중심)
- **Integration/E2E Tests**: ≥70% (주요 사용자 플로우)

**현재 프로젝트 커버리지**:
```bash
pnpm test:cov
```

---

## 🔍 주요 학습 포인트

### 1. Mock과 Spy
- **Mock**: 의존성을 가짜 객체로 대체 (jest.fn(), mockResolvedValue)
- **Spy**: 실제 객체의 동작을 감시 (jest.spyOn)

### 2. Given-When-Then 패턴
- **Given**: 테스트 사전 조건 설정
- **When**: 테스트 대상 실행
- **Then**: 결과 검증

### 3. NestJS Testing Utilities
- **Test.createTestingModule()**: 테스트용 모듈 생성
- **useValue**: Mock 객체 주입
- **INestApplication**: E2E 테스트용 앱 인스턴스

### 4. Jest Matchers
- \`expect().toBe()\`: 원시 타입 비교
- \`expect().toEqual()\`: 객체/배열 깊은 비교
- \`expect().toHaveBeenCalled()\`: 함수 호출 여부
- \`expect().toHaveBeenCalledWith()\`: 함수 호출 파라미터 검증
- \`expect().rejects.toThrow()\`: 비동기 예외 검증

### 5. 보안 테스트
- 비밀번호 응답 제외 검증
- SQL Injection 방어 확인
- XSS 공격 방어 확인
- 동시성 처리 검증

---

## ⚠️ 주의사항

### E2E 테스트 실행 전
1. **개발 서버 종료**: E2E 테스트는 자체 서버를 실행하므로 포트 충돌 방지
2. **테스트 DB 분리**: 실제 DB와 테스트 DB를 분리하여 데이터 손실 방지
3. **환경 변수**: `.env.test` 파일로 테스트 환경 설정

### Mock 사용 시
- \`jest.clearAllMocks()\`: 각 테스트마다 호출 기록 초기화
- \`jest.restoreAllMocks()\`: Spy 복원 (bcrypt 등 외부 라이브러리)

### 비동기 테스트
- \`async/await\` 필수 사용
- \`rejects.toThrow()\`로 비동기 예외 검증

---

## 📖 추가 학습 자료

- [NestJS Testing 공식 문서](https://docs.nestjs.com/fundamentals/testing)
- [Jest 공식 문서](https://jestjs.io/docs/getting-started)
- [Supertest 문서](https://github.com/visionmedia/supertest)
- [Testing Best Practices](https://testingjavascript.com/)

---

## 🎯 다음 단계

1. **통합 테스트 추가**: 여러 모듈 간 상호작용 테스트
2. **성능 테스트**: 부하 테스트 및 병목 지점 파악
3. **Mocking Library 학습**: jest-mock-extended 등
4. **CI/CD 통합**: GitHub Actions에서 자동 테스트 실행

---

**작성 완료!** 🎉 모든 테스트가 통과했습니다.

```bash
Test Suites: 4 passed, 4 total
Tests:       68 passed, 68 total
```
