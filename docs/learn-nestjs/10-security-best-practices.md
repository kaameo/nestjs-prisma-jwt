# 10. Security Best Practices ⭐⭐⭐

JWT 인증, Refresh Token Rotation, bcrypt 암호화, Rate Limiting 등 프로덕션 환경에서 필수적인 보안 패턴을 실제 프로젝트 코드로 학습합니다.

## 📚 목차

1. [보안의 중요성](#보안의-중요성)
2. [Refresh Token Rotation](#refresh-token-rotation)
3. [bcrypt 비밀번호 해싱](#bcrypt-비밀번호-해싱)
4. [JWT 토큰 관리](#jwt-토큰-관리)
5. [Rate Limiting](#rate-limiting)
6. [CORS 설정](#cors-설정)
7. [환경 변수 관리](#환경-변수-관리)
8. [입력 검증 (Validation)](#입력-검증-validation)
9. [💪 실습 과제](#-실습-과제)
10. [⚠️ 보안 체크리스트](#️-보안-체크리스트)

---

## 보안의 중요성

웹 애플리케이션에서 보안은 선택이 아닌 **필수**입니다.

**일반적인 보안 위협:**

- 🔓 **인증 우회**: 로그인 없이 보호된 리소스 접근
- 🔑 **토큰 탈취**: XSS/MITM 공격으로 JWT 토큰 도용
- 💣 **Brute Force**: 무차별 대입 공격으로 비밀번호 추측
- 💉 **SQL Injection**: 악의적인 SQL 쿼리 삽입 (Prisma는 자동으로 방어)
- 🌐 **CSRF**: Cross-Site Request Forgery
- 📊 **민감한 정보 노출**: 스택 트레이스, DB 정보 노출

이 문서에서는 프로젝트에 구현된 **실전 보안 패턴**을 다룹니다.

---

## Refresh Token Rotation

### 개념

**Refresh Token Rotation**은 토큰 탈취 시 피해를 최소화하는 보안 패턴입니다.

**핵심 원칙:**

1. Refresh Token은 **한 번만 사용** 가능 (사용 후 무효화)
2. 새로운 Access Token을 발급할 때마다 **새로운 Refresh Token**도 함께 발급
3. **재사용 감지**: 이미 사용된 Refresh Token이 다시 사용되면 **모든 세션 무효화** (보안 위협으로 간주)

**왜 필요한가요?**

```
❌ Rotation 없는 경우:
- 공격자가 Refresh Token을 탈취
- 피해자는 계속 사용 중 (아무도 모름)
- 공격자도 계속 사용 가능 (영구적 접근!)

✅ Rotation 적용:
- 공격자가 Refresh Token을 탈취
- 공격자가 먼저 사용 → 새 토큰 발급
- 피해자가 원래 토큰 사용 시도 → 재사용 감지!
- 시스템이 모든 세션 무효화 → 공격자도 로그아웃됨
```

### 데이터베이스 스키마

프로젝트는 **별도의 RefreshToken 모델**을 사용하여 다중 디바이스 지원 및 향상된 보안을 제공합니다.

📁 **prisma/schema.prisma**

```prisma
model User {
  id            String         @id @default(uuid())
  email         String         @unique
  password      String
  name          String
  refreshTokens RefreshToken[] // 일대다 관계 (여러 디바이스 지원)
}

model RefreshToken {
  id        String   @id @default(uuid())
  token     String   @unique            // bcrypt 해시된 토큰
  userId    String   @map("user_id")
  expiresAt DateTime @map("expires_at") // 만료 시간
  createdAt DateTime @default(now()) @map("created_at")
  user      User     @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@index([userId])
  @@index([token])
  @@map("refresh_tokens")
}
```

**아키텍처 장점:**

- ✅ **다중 디바이스 지원**: 사용자가 여러 기기에서 동시 로그인 가능
- ✅ **세밀한 세션 관리**: 개별 토큰 무효화 또는 전체 세션 무효화 선택 가능
- ✅ **감사 추적**: 각 토큰의 생성 시간 및 만료 시간 추적
- ✅ **보안 강화**: 토큰 재사용 감지 시 모든 디바이스에서 로그아웃

---

### 프로젝트 구현 분석

📁 **src/auth/auth.service.ts:73-128** (토큰 생성)

```typescript
private async generateTokens(user: { id: string; email: string; name: string }) {
  const payload = { sub: user.id, email: user.email };

  // 1. Access Token 생성 (15분, 짧은 수명)
  const accessToken = this.jwtService.sign(payload, {
    secret: this.config.get('JWT_SECRET'),
    expiresIn: this.config.get('JWT_EXPIRES_IN') ?? '15m',
  });

  // 2. Refresh Token을 JWT로 생성 (7일, 긴 수명)
  const refreshToken = this.jwtService.sign(
    {
      sub: user.id,
      type: 'refresh',           // 토큰 타입 구분
      tokenVersion: Date.now(),  // 고유 식별자 (재사용 감지용)
    },
    {
      secret: this.config.get('JWT_REFRESH_SECRET'),
      expiresIn: this.config.get('JWT_REFRESH_EXPIRES_IN') ?? '7d',
    },
  );

  // 3. 만료 시간 계산
  const refreshExpiresIn = this.config.get('JWT_REFRESH_EXPIRES_IN') ?? '7d';
  const expiresAt = new Date();
  const days = parseInt(refreshExpiresIn.replace('d', ''));
  expiresAt.setDate(expiresAt.getDate() + days);

  // 4. Refresh Token을 bcrypt로 해싱
  const hashedToken = await bcrypt.hash(refreshToken, 10);

  // 5. 별도의 RefreshToken 테이블에 저장 (User 모델이 아님!)
  await this.prisma.refreshToken.create({
    data: {
      token: hashedToken,
      userId: user.id,
      expiresAt,
    },
  });

  // 6. 평문 토큰을 클라이언트에 반환
  return {
    accessToken,
    refreshToken,
    user: {
      id: user.id,
      email: user.email,
      name: user.name,
    },
  };
}
```

**보안 포인트:**

- ✅ Refresh Token도 **JWT 형식** (검증 가능, 만료 시간 포함)
- ✅ **bcrypt 해싱** 후 DB 저장 (탈취 시에도 원본 복구 불가)
- ✅ 별도의 **JWT_REFRESH_SECRET** 사용 (Access Token과 분리)
- ✅ **tokenVersion** 필드로 각 토큰을 고유하게 식별
- ✅ **별도 테이블**로 여러 디바이스의 토큰을 독립적으로 관리

---

📁 **src/auth/auth.service.ts:130-187** (토큰 갱신 + Rotation)

```typescript
async refresh(dto: RefreshTokenDto) {
  // 1. JWT 서명 및 만료 시간 검증
  let payload: any;
  try {
    payload = this.jwtService.verify(dto.refreshToken, {
      secret: this.config.get('JWT_REFRESH_SECRET'),
    });
  } catch (error) {
    throw new UnauthorizedException('Invalid refresh token');
  }

  // 2. 토큰 타입 검증 (refresh 토큰인지 확인)
  if (payload.type !== 'refresh') {
    throw new UnauthorizedException('Invalid token type');
  }

  const userId = payload.sub;

  // 3. DB에서 사용자의 모든 유효한 Refresh Token 조회
  const storedTokens = await this.prisma.refreshToken.findMany({
    where: {
      userId,
      expiresAt: { gte: new Date() }, // 만료되지 않은 것만
    },
    include: { user: true },
  });

  if (storedTokens.length === 0) {
    throw new UnauthorizedException('No valid refresh token found');
  }

  // 4. 제공된 토큰이 저장된 토큰 중 하나와 일치하는지 확인
  let matchedToken: (typeof storedTokens)[0] | null = null;
  for (const stored of storedTokens) {
    const isMatch = await bcrypt.compare(dto.refreshToken, stored.token);
    if (isMatch) {
      matchedToken = stored;
      break;
    }
  }

  if (!matchedToken) {
    // 🚨 토큰 재사용 감지!
    // JWT는 유효하지만 DB에 없음 = 이미 사용된 토큰 = 탈취 가능성

    // 모든 디바이스에서 로그아웃 (보안 조치)
    await this.prisma.refreshToken.deleteMany({ where: { userId } });

    throw new UnauthorizedException(
      'Token reuse detected - all sessions revoked for security',
    );
  }

  // 5. Rotation: 사용된 Refresh Token 삭제
  await this.prisma.refreshToken.delete({
    where: { id: matchedToken.id },
  });

  // 6. 새로운 토큰 쌍 생성 (새로운 Refresh Token이 DB에 저장됨)
  return this.generateTokens(matchedToken.user);
}
```

**Rotation 메커니즘:**

1. 클라이언트가 Refresh Token 제출
2. JWT 검증 + DB 해시 비교 (이중 검증)
3. 일치하면 → 기존 토큰 삭제 + 새 토큰 생성
4. 불일치하면 → 재사용 감지 → **모든 세션 무효화**
5. 이전 토큰은 DB에서 삭제되어 재사용 불가능

### 동작 시나리오

**시나리오 1: 정상적인 토큰 갱신**

```
1. 클라이언트 (스마트폰): POST /auth/refresh
   Body: { refreshToken: "eyJhbGc...v1" }

2. 서버:
   - JWT 검증 ✓ (서명, 만료 시간, type: 'refresh')
   - DB에서 userId의 모든 유효한 토큰 조회
   - bcrypt.compare()로 일치하는 토큰 찾기 ✓
   - 일치하는 토큰 삭제: DELETE FROM refresh_tokens WHERE id = 'xxx'
   - 새 토큰 생성 및 저장: INSERT INTO refresh_tokens ...

3. 응답:
   {
     "accessToken": "new-access-token",
     "refreshToken": "eyJhbGc...v2",  // 새 토큰
     "user": { "id": "...", "email": "...", "name": "..." }
   }

4. 클라이언트: 새 토큰 저장

5. DB 상태:
   refresh_tokens 테이블:
   - v1 토큰 삭제됨 (사용됨)
   - v2 토큰 저장됨 (새로 발급)
   - 다른 디바이스의 토큰은 그대로 유지
```

**시나리오 2: 다중 디바이스 지원**

```
사용자가 스마트폰, 태블릿, PC에서 로그인한 상황:

DB 상태:
refresh_tokens 테이블:
- id: 'token-1', userId: 'user-123', device: 스마트폰
- id: 'token-2', userId: 'user-123', device: 태블릿
- id: 'token-3', userId: 'user-123', device: PC

스마트폰에서 토큰 갱신:
→ token-1 삭제, token-4 생성
→ token-2, token-3은 영향 없음 (다른 디바이스는 계속 사용 가능)
```

**시나리오 3: 토큰 재사용 감지 (공격 시도)**

```
공격자가 Refresh Token을 탈취한 상황:

초기 DB 상태:
refresh_tokens:
- id: 'token-1', token: hash('eyJhbGc...stolen'), userId: 'user-123'

1. 공격자가 먼저 사용:
   POST /auth/refresh { refreshToken: "eyJhbGc...stolen" }
   → JWT 검증 ✓
   → bcrypt.compare() 성공 (token-1과 일치)
   → token-1 삭제
   → 새 token-2 생성 및 저장
   → 공격자에게 새 토큰 발급

   DB 상태:
   - token-1 삭제됨
   - token-2 생성됨 (공격자가 받음)

2. 피해자가 원래 토큰 사용 시도:
   POST /auth/refresh { refreshToken: "eyJhbGc...stolen" }
   → JWT 검증 ✓ (아직 만료되지 않음)
   → DB에서 유효한 토큰 조회: [token-2]
   → bcrypt.compare(stolen, token-2) 실패! (해시가 다름)
   → 🚨 재사용 감지! (유효한 JWT인데 DB에 없음 = 이미 사용됨)

   보안 조치:
   → DELETE FROM refresh_tokens WHERE userId = 'user-123'
   → 모든 디바이스의 토큰 삭제 (token-2 포함)
   → 공격자도 로그아웃됨!

3. 응답:
   {
     "statusCode": 401,
     "message": "Token reuse detected - all sessions revoked for security"
   }

4. 결과:
   - 피해자: 모든 디바이스에서 로그아웃 (재로그인 필요)
   - 공격자: 새로 받은 토큰(token-2)도 무효화되어 접근 불가
   - 시스템: 보안 이벤트 로깅 (감사 추적)
```

### Refresh Token Rotation 흐름도

```
┌──────────────────────────────────────────────────────────────────┐
│                      Token Lifecycle                              │
└──────────────────────────────────────────────────────────────────┘

Login
  │
  ├─→ Access Token (15분) + Refresh Token v1 (7일) 발급
  │
  └─→ DB: INSERT INTO refresh_tokens (token: hash(v1), userId, expiresAt)

refresh_tokens 테이블:
┌────────┬──────────┬─────────┬───────────┐
│ id     │ token    │ userId  │ expiresAt │
├────────┼──────────┼─────────┼───────────┤
│ uuid-1 │ hash(v1) │ user-1  │ +7일      │
└────────┴──────────┴─────────┴───────────┘

After 15분 (Access Token 만료)
  │
  ├─→ POST /auth/refresh { refreshToken: v1 }
  │
  ├─→ JWT 검증 ✓
  │
  ├─→ DB 조회: SELECT * FROM refresh_tokens WHERE userId = 'user-1'
  │
  ├─→ bcrypt.compare(v1, hash(v1)) ✓ 일치!
  │
  ├─→ DELETE FROM refresh_tokens WHERE id = 'uuid-1'  ← v1 삭제
  │
  ├─→ New Access Token + Refresh Token v2 발급
  │
  └─→ INSERT INTO refresh_tokens (token: hash(v2), userId, expiresAt)

refresh_tokens 테이블:
┌────────┬──────────┬─────────┬───────────┐
│ id     │ token    │ userId  │ expiresAt │
├────────┼──────────┼─────────┼───────────┤
│ uuid-2 │ hash(v2) │ user-1  │ +7일      │  ← v1 무효화, v2 생성
└────────┴──────────┴─────────┴───────────┘

공격 시나리오 (v1 재사용 시도)
  │
  ├─→ POST /auth/refresh { refreshToken: v1 }
  │
  ├─→ JWT 검증 ✓ (아직 만료되지 않음)
  │
  ├─→ DB 조회: SELECT * FROM refresh_tokens WHERE userId = 'user-1'
  │   결과: [{ id: 'uuid-2', token: hash(v2) }]
  │
  ├─→ bcrypt.compare(v1, hash(v2)) ✗ 불일치!
  │
  ├─→ 🚨 재사용 감지! (유효한 JWT인데 DB에 매칭 없음)
  │
  └─→ DELETE FROM refresh_tokens WHERE userId = 'user-1'  ← 모든 세션 무효화

refresh_tokens 테이블:
┌────────┬──────────┬─────────┬───────────┐
│ id     │ token    │ userId  │ expiresAt │
├────────┼──────────┼─────────┼───────────┤
│ (empty - 모든 토큰 삭제됨)             │
└────────┴──────────┴─────────┴───────────┘
```

---

## bcrypt 비밀번호 해싱

### 개념

**bcrypt**는 비밀번호를 안전하게 저장하기 위한 해싱 알고리즘입니다.

**왜 평문 저장은 안 되나요?**

```
❌ 평문 저장:
DB: { email: "user@example.com", password: "mypassword123" }
→ DB 탈취 시 모든 비밀번호 노출!

❌ 단순 해시 (MD5, SHA-256):
DB: { password: "5f4dcc3b5aa765d61d8327deb882cf99" }
→ Rainbow Table 공격으로 복구 가능

✅ bcrypt (Salt + Adaptive Hashing):
DB: { password: "$2b$10$N9qo8uLOickgx2ZMRZoMyeIjZAgcfl7p92ldGxad68LJZdL17lhWy" }
→ Salt가 포함되어 Rainbow Table 무용지물
→ 연산 비용이 높아 Brute Force 방어
```

### 프로젝트 구현

📁 **src/auth/auth.service.ts:34-42** (회원가입)

```typescript
async register(registerDto: RegisterDto) {
  // 1. 비밀번호를 bcrypt로 해싱 (10 rounds)
  const hashedPassword = await bcrypt.hash(registerDto.password, 10);

  // 2. 해시된 비밀번호로 사용자 생성
  const user = await this.prisma.user.create({
    data: {
      email: registerDto.email,
      password: hashedPassword, // 평문 저장 X
      name: registerDto.name,
    },
  });

  // 3. 토큰 발급
  return this.generateTokens(user.id);
}
```

📁 **src/auth/auth.service.ts:44-69** (로그인)

```typescript
async login(loginDto: LoginDto) {
  // 1. 이메일으로 사용자 조회
  const user = await this.prisma.user.findUnique({
    where: { email: loginDto.email },
  });

  if (!user) {
    throw new UnauthorizedException('Invalid credentials');
  }

  // 2. bcrypt로 비밀번호 비교
  const isPasswordValid = await bcrypt.compare(
    loginDto.password,        // 평문 비밀번호
    user.password,            // DB의 해시
  );

  if (!isPasswordValid) {
    throw new UnauthorizedException('Invalid credentials');
  }

  // 3. 토큰 발급
  return this.generateTokens(user.id);
}
```

### bcrypt 파라미터 이해하기

```typescript
await bcrypt.hash(password, saltRounds);
```

**saltRounds (10)의 의미:**

- Salt 생성 시 반복 횟수: `2^10 = 1024번`
- 값이 클수록 보안 ↑, 연산 시간 ↑
- 권장값: **10~12**

**해시 결과 예시:**

```
$2b$10$N9qo8uLOickgx2ZMRZoMyeIjZAgcfl7p92ldGxad68LJZdL17lhWy
│  │  │                    │
│  │  │                    └─ 해시 (31자)
│  │  └─ Salt (22자)
│  └─ Cost Factor (10)
└─ 알고리즘 버전 (2b)
```

**비교 연산:**

```typescript
await bcrypt.compare('mypassword', hash);
// 내부 동작:
// 1. hash에서 Salt 추출
// 2. 'mypassword' + Salt로 해시 생성
// 3. 생성된 해시와 기존 해시 비교
```

---

## JWT 토큰 관리

### JWT 구조

```
eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOjEsImlhdCI6MTY0MTAyNDAwMH0.abcdef123456
│                                    │                                │
│                                    │                                └─ Signature (서명)
│                                    └─ Payload (데이터)
└─ Header (알고리즘)
```

**Payload 예시:**

```json
{
  "sub": 1, // Subject (사용자 ID)
  "iat": 1641024000, // Issued At (발급 시간)
  "exp": 1641024900 // Expiration (만료 시간)
}
```

### 프로젝트 설정

📁 **src/auth/jwt.strategy.ts:16-21**

```typescript
super({
  jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
  // Authorization: Bearer <token> 헤더에서 추출

  ignoreExpiration: false,
  // 만료된 토큰은 자동으로 거부

  secretOrKey: configService.get<string>('JWT_SECRET'),
  // 서명 검증에 사용할 비밀키
});
```

📁 **.env.example**

```bash
# Access Token (15분)
JWT_SECRET=your-super-secret-jwt-key-change-this-in-production

# Refresh Token (7일)
JWT_REFRESH_SECRET=your-super-secret-refresh-jwt-key-change-this-in-production
```

### 보안 Best Practices

**1. Secret 관리**

```bash
# ❌ 위험한 Secret
JWT_SECRET=secret
JWT_SECRET=12345

# ✅ 안전한 Secret (최소 32자, 랜덤)
JWT_SECRET=f8d6a9b2c3e1f4g7h8i9j0k1l2m3n4o5p6q7r8s9t0u1v2w3x4y5z6
```

**생성 방법:**

```bash
# Node.js
node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"

# OpenSSL
openssl rand -hex 64
```

**2. 만료 시간 설정**

```typescript
// ✅ 권장 설정
Access Token: 15m ~ 1h    // 짧게 (보안 ↑)
Refresh Token: 7d ~ 30d   // 길게 (편의성 ↑)

// ❌ 위험한 설정
Access Token: 1d          // 너무 길면 탈취 시 위험
Refresh Token: 365d       // 너무 길면 재로그인 기회 없음
```

**3. 민감한 정보 저장 금지**

```typescript
// ❌ Payload에 민감한 정보 포함
const payload = {
  sub: userId,
  email: user.email,
  password: user.password, // 절대 안 됨!
  creditCard: '1234-5678', // 절대 안 됨!
};

// ✅ 최소한의 정보만
const payload = {
  sub: userId, // 사용자 ID만으로 충분
};
```

---

## Rate Limiting

### 개념

**Rate Limiting**은 특정 시간 내 요청 횟수를 제한하여 Brute Force 공격을 방어합니다.

**공격 시나리오:**

```
공격자: 1초에 1000번 로그인 시도
→ 1,000,000개의 비밀번호 조합을 1000초(16분)만에 시도 가능!

Rate Limiting 적용:
→ 15분에 5번만 허용
→ 1,000,000개 시도에 50,000시간(5.7년) 필요
→ 사실상 불가능
```

### 프로젝트 구현

📁 **src/common/decorators/throttle.decorator.ts**

```typescript
import { SetMetadata } from '@nestjs/common';

export const THROTTLE_KEY = 'throttle';

export interface ThrottleOptions {
  limit: number; // 최대 요청 횟수
  ttl: number; // 시간 윈도우 (초)
}

export const Throttle = (limit: number, ttl: number) =>
  SetMetadata(THROTTLE_KEY, { limit, ttl });
```

📁 **src/auth/auth.controller.ts**

```typescript
import { Throttle } from '../common/decorators/throttle.decorator';

@Controller('auth')
export class AuthController {
  // 회원가입: 15분에 3번
  @Post('register')
  @Throttle(3, 900) // 900초 = 15분
  async register(@Body() registerDto: RegisterDto) {
    return this.authService.register(registerDto);
  }

  // 로그인: 15분에 5번
  @Post('login')
  @Throttle(5, 900)
  async login(@Body() loginDto: LoginDto) {
    return this.authService.login(loginDto);
  }

  // 토큰 갱신: 1분에 10번
  @Post('refresh')
  @Throttle(10, 60)
  async refresh(@Body() refreshTokenDto: RefreshTokenDto) {
    return this.authService.refresh(refreshTokenDto);
  }
}
```

### Rate Limiting 전략

| 엔드포인트       | Limit | TTL  | 이유                       |
| ---------------- | ----- | ---- | -------------------------- |
| `/auth/register` | 3     | 15분 | 스팸 계정 생성 방지        |
| `/auth/login`    | 5     | 15분 | Brute Force 방어           |
| `/auth/refresh`  | 10    | 1분  | 토큰 갱신은 자주 발생 가능 |
| `/posts`         | 100   | 1분  | 일반 API는 느슨하게        |

### 동작 예시

```
1번째 로그인: ✓ 성공
2번째 로그인: ✓ 성공
3번째 로그인: ✓ 성공
4번째 로그인: ✓ 성공
5번째 로그인: ✓ 성공
6번째 로그인: ✗ 429 Too Many Requests

{
  "statusCode": 429,
  "message": "Too many requests. Please try again later."
}

15분 후: 카운터 리셋 → 다시 5번 시도 가능
```

---

## CORS 설정

### 개념

**CORS (Cross-Origin Resource Sharing)**는 다른 도메인에서의 요청을 허용/차단합니다.

**시나리오:**

```
프론트엔드: http://localhost:3000
백엔드: http://localhost:3001

CORS 없이:
→ 브라우저가 요청 차단 (보안 정책)

CORS 설정:
→ 백엔드가 "localhost:3000은 허용" 선언
→ 브라우저가 요청 허용
```

### 프로젝트 구현

📁 **src/main.ts:12-15**

```typescript
async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // CORS 활성화
  app.enableCors({
    origin: process.env.CORS_ORIGIN || 'http://localhost:3000',
    credentials: true, // 쿠키 포함 요청 허용
  });

  await app.listen(3000);
}
```

📁 **.env.example**

```bash
# 개발 환경
CORS_ORIGIN=http://localhost:3000

# 프로덕션 환경
CORS_ORIGIN=https://myapp.com
```

### 고급 설정

```typescript
// 여러 도메인 허용
app.enableCors({
  origin: [
    'http://localhost:3000',
    'https://myapp.com',
    'https://admin.myapp.com',
  ],
  methods: 'GET,HEAD,PUT,PATCH,POST,DELETE',
  allowedHeaders: 'Content-Type,Authorization',
  credentials: true,
});
```

---

## 환경 변수 관리

### 개념

민감한 정보(Secret, DB 접속 정보)는 코드에 하드코딩하지 않고 환경 변수로 관리합니다.

### 프로젝트 구현

📁 **src/config/env.validation.ts**

```typescript
import { z } from 'zod';

export const envSchema = z.object({
  NODE_ENV: z
    .enum(['development', 'production', 'test'])
    .default('development'),
  PORT: z.string().default('3000'),
  DATABASE_URL: z.string().min(1, 'DATABASE_URL is required'),
  JWT_SECRET: z.string().min(32, 'JWT_SECRET must be at least 32 characters'),
  JWT_REFRESH_SECRET: z
    .string()
    .min(32, 'JWT_REFRESH_SECRET must be at least 32 characters'),
  CORS_ORIGIN: z.string().optional(),
});

export type Env = z.infer<typeof envSchema>;

export function validateEnv(config: Record<string, unknown>): Env {
  const parsed = envSchema.safeParse(config);

  if (!parsed.success) {
    console.error(
      '❌ Invalid environment variables:',
      parsed.error.flatten().fieldErrors,
    );
    throw new Error('Invalid environment variables');
  }

  return parsed.data;
}
```

📁 **src/app.module.ts**

```typescript
import { ConfigModule } from '@nestjs/config';
import { validateEnv } from './config/env.validation';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      validate: validateEnv, // 앱 시작 시 검증
    }),
  ],
})
export class AppModule {}
```

### 환경 변수 파일 예시

📁 **.env** (gitignore에 포함)

```bash
NODE_ENV=development
DATABASE_URL=postgresql://postgres:postgres123@localhost:5432/postgres
JWT_SECRET=f8d6a9b2c3e1f4g7h8i9j0k1l2m3n4o5p6q7r8s9t0u1v2w3x4y5z6
JWT_REFRESH_SECRET=a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6q7r8s9t0u1v2w3x4y5z6
CORS_ORIGIN=http://localhost:3000
```

📁 **.env.example** (Git에 포함, 템플릿용)

```bash
NODE_ENV=development
DATABASE_URL=postgresql://user:password@localhost:5432/dbname
JWT_SECRET=your-super-secret-jwt-key-change-this-in-production
JWT_REFRESH_SECRET=your-super-secret-refresh-jwt-key-change-this-in-production
CORS_ORIGIN=http://localhost:3000
```

---

## 입력 검증 (Validation)

### 개념

사용자 입력을 신뢰하지 말고 항상 검증해야 합니다.

**검증하지 않으면:**

```typescript
// ❌ 검증 없음
@Post('register')
async register(@Body() body: any) {
  // body.email이 실제로 이메일인지?
  // body.password가 충분히 긴지?
  // body에 악의적인 필드는 없는지?
}
```

### 프로젝트 구현 (Zod)

📁 **src/auth/dto/register.dto.ts**

```typescript
import { z } from 'zod';

export const registerSchema = z.object({
  email: z.string().email('Invalid email format').min(1, 'Email is required'),

  password: z
    .string()
    .min(6, 'Password must be at least 6 characters')
    .max(100, 'Password is too long'),

  name: z.string().min(1, 'Name is required').max(100, 'Name is too long'),
});

export type RegisterDto = z.infer<typeof registerSchema>;
```

📁 **src/auth/auth.controller.ts:17-23**

```typescript
import { ZodValidationPipe } from '@anatine/zod-nestjs';

@Post('register')
@UsePipes(new ZodValidationPipe(registerSchema))
async register(@Body() registerDto: RegisterDto) {
  return this.authService.register(registerDto);
}
```

### 검증 예시

**잘못된 요청:**

```json
POST /auth/register
{
  "email": "not-an-email",
  "password": "123",
  "name": ""
}
```

**응답:**

```json
{
  "statusCode": 400,
  "message": [
    "Invalid email format",
    "Password must be at least 6 characters",
    "Name is required"
  ],
  "error": "Bad Request"
}
```

---

## 💪 실습 과제

### 과제 1: 비밀번호 강도 검증

Zod 스키마에 비밀번호 강도 검증을 추가하세요.

```typescript
// src/auth/dto/register.dto.ts
export const registerSchema = z.object({
  password: z
    .string()
    .min(8, 'Password must be at least 8 characters')
    .regex(/[A-Z]/, 'Password must contain at least one uppercase letter')
    .regex(/[a-z]/, 'Password must contain at least one lowercase letter')
    .regex(/[0-9]/, 'Password must contain at least one number')
    .regex(
      /[@$!%*?&#]/,
      'Password must contain at least one special character',
    ),
});
```

### 과제 2: Logout 기능 구현

Refresh Token을 무효화하는 로그아웃 기능을 추가하세요.

```typescript
// src/auth/auth.service.ts
async logout(userId: number) {
  // TODO: DB의 refreshToken을 null로 설정
  // 힌트: this.prisma.user.update()
}

// src/auth/auth.controller.ts
@Post('logout')
@UseGuards(JwtAuthGuard)
async logout(@CurrentUser() user: { userId: number }) {
  // TODO: authService.logout() 호출
}
```

### 과제 3: IP 기반 Rate Limiting

동일 IP에서의 요청만 제한하도록 개선하세요.

```typescript
// src/common/guards/throttle.guard.ts
import { Injectable, CanActivate, ExecutionContext } from '@nestjs/common';

@Injectable()
export class ThrottleGuard implements CanActivate {
  private requests = new Map<string, number[]>();

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest();
    const ip = request.ip;

    // TODO: IP별로 요청 횟수 추적
    // 힌트: Map<ip, timestamps[]> 사용
  }
}
```

---

## ⚠️ 보안 체크리스트

### 인증/인가

- [ ] 비밀번호를 bcrypt로 해싱하는가? (Salt rounds >= 10)
- [ ] Refresh Token Rotation이 구현되어 있는가?
- [ ] 토큰 재사용 감지 시 모든 세션을 무효화하는가?
- [ ] JWT Secret이 충분히 길고 랜덤한가? (>= 32자)
- [ ] Access Token과 Refresh Token에 다른 Secret을 사용하는가?
- [ ] 토큰 만료 시간이 적절한가? (Access: 15m~1h, Refresh: 7d~30d)

### Rate Limiting

- [ ] 로그인/회원가입에 Rate Limiting이 적용되어 있는가?
- [ ] Limit 값이 적절한가? (로그인: 5회/15분)
- [ ] 429 에러 시 명확한 메시지를 반환하는가?

### 입력 검증

- [ ] 모든 DTO에 Zod 검증이 적용되어 있는가?
- [ ] 이메일 형식을 검증하는가?
- [ ] 비밀번호 최소 길이를 검증하는가? (>= 6자, 권장 8자)
- [ ] 문자열 최대 길이를 검증하는가? (DoS 방지)

### 환경 변수

- [ ] `.env` 파일이 `.gitignore`에 포함되어 있는가?
- [ ] `.env.example`이 제공되는가?
- [ ] 환경 변수를 앱 시작 시 검증하는가? (validateEnv)
- [ ] 프로덕션 환경에서 민감한 정보를 로그에 출력하지 않는가?

### CORS

- [ ] CORS가 적절히 설정되어 있는가?
- [ ] 프로덕션에서 `origin: '*'`를 사용하지 않는가?
- [ ] `credentials: true` 설정이 필요한 경우에만 활성화되어 있는가?

### 에러 처리

- [ ] 프로덕션에서 스택 트레이스를 노출하지 않는가?
- [ ] Prisma 에러를 적절히 변환하는가? (P2002 → 409 Conflict)
- [ ] 민감한 DB 정보가 에러 메시지에 포함되지 않는가?

### 일반

- [ ] HTTPS를 사용하는가? (프로덕션)
- [ ] 민감한 정보를 JWT Payload에 포함하지 않는가?
- [ ] 로그아웃 기능이 구현되어 있는가?
- [ ] 정기적으로 의존성을 업데이트하는가? (`npm audit`)

---

## 다음 단계

- **[11. Database Patterns](./11-database-patterns.md)** ⭐⭐⭐  
  Soft Delete, Pagination, Transactions, Relations 등 데이터베이스 패턴 학습

- **[이전: 09. Advanced Features](./09-advanced-features.md)** ⭐⭐⭐  
  Exception Filters, Interceptors, Guards, Pipes, Middleware 복습
