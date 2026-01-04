# JWT 인증 구현 이해하기

## 인증 흐름

```
1. 회원가입/로그인 → JWT 토큰 발급
2. 클라이언트가 토큰 저장 (localStorage, cookie 등)
3. API 요청 시 Header에 토큰 포함: Authorization: Bearer {token}
4. Guard가 토큰 검증 → Strategy가 사용자 정보 추출
5. 컨트롤러에서 사용자 정보 사용
```

---

## 1. Guard (가드)

**역할**: 요청이 컨트롤러에 도달하기 전에 인증/인가 확인

```typescript
// jwt-auth.guard.ts
import { Injectable } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';

@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {}
// 'jwt'는 JwtStrategy에서 정의한 이름과 매칭
```

### 사용법
```typescript
// 특정 엔드포인트에 적용
@UseGuards(JwtAuthGuard)
@Get('profile')
getProfile() { ... }

// 컨트롤러 전체에 적용
@UseGuards(JwtAuthGuard)
@Controller('posts')
export class PostController { ... }
```

---

## 2. Strategy (전략)

**역할**: 토큰 검증 및 사용자 정보 추출

```typescript
// jwt.strategy.ts
import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { ConfigService } from '@nestjs/config';
import { AuthService } from './auth.service';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(
    configService: ConfigService,
    private authService: AuthService,
  ) {
    super({
      // 토큰 추출 위치: Authorization: Bearer {token}
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),

      // 만료된 토큰 거부
      ignoreExpiration: false,

      // 서명 검증용 비밀키
      secretOrKey: configService.get<string>('JWT_SECRET')!,
    });
  }

  // 토큰이 유효하면 이 메서드 실행
  // 반환값이 request.user에 저장됨
  async validate(payload: { sub: string; email: string }) {
    const user = await this.authService.validateUser(payload.sub);

    if (!user) {
      throw new UnauthorizedException();
    }

    return user;  // → request.user = { id, email, name }
  }
}
```

---

## 3. Custom Decorator (커스텀 데코레이터)

**역할**: request.user를 쉽게 가져오기

```typescript
// current-user.decorator.ts
import { createParamDecorator, ExecutionContext } from '@nestjs/common';

export const CurrentUser = createParamDecorator(
  (data: unknown, ctx: ExecutionContext) => {
    const request = ctx.switchToHttp().getRequest();
    return request.user;  // Strategy의 validate()가 반환한 값
  },
);
```

### 사용법
```typescript
@Get('me')
@UseGuards(JwtAuthGuard)
getMe(@CurrentUser() user: { id: string; email: string; name: string }) {
  return user;
}

// CurrentUser 없이 하려면:
@Get('me')
@UseGuards(JwtAuthGuard)
getMe(@Request() req) {
  return req.user;  // 덜 깔끔함
}
```

---

## 4. Auth Service

**역할**: 회원가입, 로그인, 토큰 발급

```typescript
// auth.service.ts
@Injectable()
export class AuthService {
  constructor(
    private prisma: PrismaService,
    private jwtService: JwtService,
  ) {}

  async register(dto: RegisterDto) {
    // 1. 이메일 중복 체크
    const existingUser = await this.prisma.user.findUnique({
      where: { email: dto.email },
    });
    if (existingUser) {
      throw new ConflictException('Email already exists');
    }

    // 2. 비밀번호 해싱 (bcrypt)
    const hashedPassword = await bcrypt.hash(dto.password, 10);

    // 3. 사용자 생성
    const user = await this.prisma.user.create({
      data: { ...dto, password: hashedPassword },
    });

    // 4. 토큰 발급
    return this.generateToken(user);
  }

  async login(dto: LoginDto) {
    // 1. 사용자 조회
    const user = await this.prisma.user.findUnique({
      where: { email: dto.email },
    });
    if (!user) {
      throw new UnauthorizedException('Invalid credentials');
    }

    // 2. 비밀번호 검증
    const isPasswordValid = await bcrypt.compare(dto.password, user.password);
    if (!isPasswordValid) {
      throw new UnauthorizedException('Invalid credentials');
    }

    // 3. 토큰 발급
    return this.generateToken(user);
  }

  private generateToken(user: { id: string; email: string; name: string }) {
    // JWT Payload (토큰에 담길 정보)
    const payload = { sub: user.id, email: user.email };

    return {
      accessToken: this.jwtService.sign(payload),
      user: { id: user.id, email: user.email, name: user.name },
    };
  }
}
```

---

## JWT 토큰 구조

```
eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.  ← Header (알고리즘, 타입)
eyJzdWIiOiIxMjM0IiwiZW1haWwiOiJ0ZXN0QHRlc3QuY29tIiwiaWF0IjoxNzE2MjM5MDIyfQ.  ← Payload (데이터)
SflKxwRJSMeKKF2QT4fwpMeJf36POk6yJV_adQssw5c  ← Signature (서명)
```

### Payload 예시
```json
{
  "sub": "user-uuid-1234",      // subject (사용자 ID)
  "email": "test@test.com",
  "iat": 1716239022,            // issued at (발급 시간)
  "exp": 1716843822             // expiration (만료 시간)
}
```

jwt.io에서 토큰 내용 확인 가능!
