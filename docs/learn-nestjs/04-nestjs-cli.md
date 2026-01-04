# NestJS CLI 사용법

## 설치
```bash
npm install -g @nestjs/cli
```

---

## 새 프로젝트 생성
```bash
nest new project-name

# 패키지 매니저 선택
? Which package manager would you ❤️ to use?
  npm
  yarn
❯ pnpm
```

---

## Resource 생성 (가장 많이 사용)

### 기본 CRUD 리소스 생성
```bash
nest g resource users

# 질문에 답변:
? What transport layer do you use? REST API
? Would you like to generate CRUD entry points? Yes
```

### 생성되는 파일들
```
src/users/
├── dto/
│   ├── create-user.dto.ts
│   └── update-user.dto.ts
├── entities/
│   └── user.entity.ts
├── users.controller.ts
├── users.controller.spec.ts  (테스트 파일)
├── users.module.ts
└── users.service.ts
```

### 테스트 파일 없이 생성
```bash
nest g resource users --no-spec
```

---

## 개별 생성 명령어

### 모듈 생성
```bash
nest g module users
# 또는
nest g mo users
```

### 컨트롤러 생성
```bash
nest g controller users
# 또는
nest g co users

# 테스트 파일 없이
nest g co users --no-spec
```

### 서비스 생성
```bash
nest g service users
# 또는
nest g s users --no-spec
```

### 가드 생성
```bash
nest g guard auth/jwt-auth
nest g gu auth/jwt-auth --no-spec
```

### 데코레이터 생성
```bash
nest g decorator auth/current-user
nest g d auth/current-user
```

### 파이프 생성 (유효성 검증)
```bash
nest g pipe common/parse-int
nest g pi common/parse-int --no-spec
```

### 인터셉터 생성 (요청/응답 변환)
```bash
nest g interceptor common/transform
nest g itc common/transform --no-spec
```

### 필터 생성 (예외 처리)
```bash
nest g filter common/http-exception
nest g f common/http-exception --no-spec
```

---

## 명령어 축약어 정리

| 전체 명령어 | 축약어 | 설명 |
|------------|--------|------|
| `module` | `mo` | 모듈 |
| `controller` | `co` | 컨트롤러 |
| `service` | `s` | 서비스 |
| `resource` | `res` | CRUD 리소스 |
| `guard` | `gu` | 가드 |
| `decorator` | `d` | 데코레이터 |
| `pipe` | `pi` | 파이프 |
| `interceptor` | `itc` | 인터셉터 |
| `filter` | `f` | 필터 |
| `middleware` | `mi` | 미들웨어 |
| `class` | `cl` | 클래스 |
| `interface` | `itf` | 인터페이스 |

---

## 유용한 옵션들

```bash
# --no-spec: 테스트 파일 생성 안 함
nest g s users --no-spec

# --flat: 폴더 생성 안 함 (현재 위치에 생성)
nest g s users --flat

# --dry-run: 실제 생성 없이 미리보기
nest g resource products --dry-run

# 특정 경로에 생성
nest g co admin/users --no-spec
# → src/admin/users/users.controller.ts
```

---

## 빌드 및 실행

```bash
# 개발 모드 (파일 변경 감지)
pnpm start:dev

# 프로덕션 빌드
pnpm build

# 프로덕션 실행
pnpm start:prod

# 디버그 모드
pnpm start:debug
```

---

## 예시: Comment 기능 추가하기

```bash
# 1. Comment 리소스 생성
nest g resource comment --no-spec

# 2. Prisma 스키마에 Comment 모델 추가
# prisma/schema.prisma 편집

# 3. 마이그레이션
npx prisma migrate dev --name add-comment

# 4. 생성된 파일 수정
# - dto 수정
# - service 로직 구현
# - controller 엔드포인트 확인
```
