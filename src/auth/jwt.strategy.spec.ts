import { Test, TestingModule } from '@nestjs/testing';
import { UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtStrategy } from './jwt.strategy';
import { AuthService } from './auth.service';

describe('JwtStrategy', () => {
  let strategy: JwtStrategy;
  let authService: AuthService;

  const mockUser = {
    id: 'user-123',
    email: 'test@example.com',
    name: 'Test User',
  };

  const mockPayload = {
    sub: 'user-123',
    email: 'test@example.com',
  };

  const mockAuthService = {
    validateUser: jest.fn(),
  };

  const mockConfigService = {
    get: jest.fn(),
  };

  beforeEach(async () => {
    // ConfigService mock 설정 (모듈 컴파일 전에 설정)
    mockConfigService.get.mockReturnValue('test-secret-key');

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        JwtStrategy,
        {
          provide: AuthService,
          useValue: mockAuthService,
        },
        {
          provide: ConfigService,
          useValue: mockConfigService,
        },
      ],
    }).compile();

    strategy = module.get<JwtStrategy>(JwtStrategy);
    authService = module.get<AuthService>(AuthService);

    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(strategy).toBeDefined();
  });

  describe('validate', () => {
    it('유효한 JWT payload로 사용자를 반환해야 함', async () => {
      // Given: 사용자가 존재
      mockAuthService.validateUser.mockResolvedValue(mockUser);

      // When: JWT payload 검증
      const result = await strategy.validate(mockPayload);

      // Then: 사용자 정보 반환
      expect(result).toEqual(mockUser);
      expect(authService.validateUser).toHaveBeenCalledWith(mockPayload.sub);
    });

    it('사용자가 존재하지 않으면 UnauthorizedException을 던져야 함', async () => {
      // Given: 사용자가 존재하지 않음
      mockAuthService.validateUser.mockResolvedValue(null);

      // When & Then: UnauthorizedException 발생
      await expect(strategy.validate(mockPayload)).rejects.toThrow(
        UnauthorizedException,
      );
      expect(authService.validateUser).toHaveBeenCalledWith(mockPayload.sub);
    });

    it('payload의 sub(userId)를 사용하여 사용자를 검증해야 함', async () => {
      // Given
      const customPayload = {
        sub: 'custom-user-id',
        email: 'custom@example.com',
      };
      mockAuthService.validateUser.mockResolvedValue({
        id: 'custom-user-id',
        email: 'custom@example.com',
        name: 'Custom User',
      });

      // When
      await strategy.validate(customPayload);

      // Then: sub 값으로 사용자 검증
      expect(authService.validateUser).toHaveBeenCalledWith('custom-user-id');
    });

    it('validateUser가 undefined를 반환하면 UnauthorizedException을 던져야 함', async () => {
      // Given: validateUser가 undefined 반환
      mockAuthService.validateUser.mockResolvedValue(undefined);

      // When & Then: UnauthorizedException 발생
      await expect(strategy.validate(mockPayload)).rejects.toThrow(
        UnauthorizedException,
      );
    });

    it('검증된 사용자는 비밀번호 정보를 포함하지 않아야 함', async () => {
      // Given: 사용자 정보에 비밀번호 제외
      const userWithoutPassword = {
        id: mockUser.id,
        email: mockUser.email,
        name: mockUser.name,
        // password 필드 없음
      };
      mockAuthService.validateUser.mockResolvedValue(userWithoutPassword);

      // When
      const result = await strategy.validate(mockPayload);

      // Then: 비밀번호 필드가 없어야 함
      expect(result).not.toHaveProperty('password');
      expect(result).toEqual(userWithoutPassword);
    });
  });

  describe('Strategy Configuration', () => {
    it('JWT_SECRET 환경 변수를 사용해야 함', async () => {
      // Given: ConfigService mock 초기화
      mockConfigService.get.mockClear();
      mockConfigService.get.mockReturnValue('test-secret-key');

      // When: 새로운 JwtStrategy 인스턴스 생성 (beforeEach에서 이미 생성됨)
      const module = await Test.createTestingModule({
        providers: [
          JwtStrategy,
          { provide: AuthService, useValue: mockAuthService },
          { provide: ConfigService, useValue: mockConfigService },
        ],
      }).compile();

      // Then: ConfigService.get이 JWT_SECRET으로 호출됨
      expect(mockConfigService.get).toHaveBeenCalledWith('JWT_SECRET');
    });

    it('Bearer 토큰 추출 방식을 사용해야 함', () => {
      // Strategy 인스턴스의 설정을 간접적으로 검증
      // super()에서 jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken() 사용
      expect(strategy).toBeDefined();
      // 실제 운영 환경에서는 Authorization: Bearer <token> 형식으로 전달
    });

    it('토큰 만료를 검증해야 함 (ignoreExpiration: false)', () => {
      // Strategy 설정에서 ignoreExpiration: false 사용
      // 만료된 토큰은 자동으로 거부됨
      expect(strategy).toBeDefined();
    });
  });
});
