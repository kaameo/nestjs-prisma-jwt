import { Test, TestingModule } from '@nestjs/testing';
import { ConflictException, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { AuthService } from './auth.service';
import { PrismaService } from '../prisma/prisma.service';

// bcrypt 모킹
jest.mock('bcrypt', () => ({
  hash: jest.fn(),
  compare: jest.fn(),
}));

import * as bcrypt from 'bcrypt';

describe('AuthService', () => {
  let service: AuthService;
  let prismaService: PrismaService;
  let jwtService: JwtService;

  // Mock 데이터
  const mockUser = {
    id: 'user-123',
    email: 'test@example.com',
    name: 'Test User',
    password: 'hashedPassword123',
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const mockRegisterDto = {
    email: 'newuser@example.com',
    password: 'password123',
    name: 'New User',
  };

  const mockLoginDto = {
    email: 'test@example.com',
    password: 'password123',
  };

  // Mock PrismaService
  const mockPrismaService = {
    user: {
      findUnique: jest.fn(),
      create: jest.fn(),
    },
  };

  // Mock JwtService
  const mockJwtService = {
    sign: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        {
          provide: PrismaService,
          useValue: mockPrismaService,
        },
        {
          provide: JwtService,
          useValue: mockJwtService,
        },
      ],
    }).compile();

    service = module.get<AuthService>(AuthService);
    prismaService = module.get<PrismaService>(PrismaService);
    jwtService = module.get<JwtService>(JwtService);

    // 모든 mock 초기화
    jest.clearAllMocks();
    jest.restoreAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('register', () => {
    it('새로운 사용자를 성공적으로 등록해야 함', async () => {
      // Given: 이메일이 존재하지 않음
      mockPrismaService.user.findUnique.mockResolvedValue(null);
      mockPrismaService.user.create.mockResolvedValue({
        ...mockUser,
        email: mockRegisterDto.email,
        name: mockRegisterDto.name,
      });
      mockJwtService.sign.mockReturnValue('mock-jwt-token');
      (bcrypt.hash as jest.Mock).mockResolvedValue('hashedPassword');

      // When: 회원가입 시도
      const result = await service.register(mockRegisterDto);

      // Then: 올바른 결과 반환
      expect(result).toEqual({
        accessToken: 'mock-jwt-token',
        user: {
          id: mockUser.id,
          email: mockRegisterDto.email,
          name: mockRegisterDto.name,
        },
      });

      // Prisma 호출 검증
      expect(mockPrismaService.user.findUnique).toHaveBeenCalledWith({
        where: { email: mockRegisterDto.email },
      });

      // 비밀번호 해싱 검증
      expect(bcrypt.hash).toHaveBeenCalledWith(mockRegisterDto.password, 10);

      // 사용자 생성 검증
      expect(mockPrismaService.user.create).toHaveBeenCalledWith({
        data: {
          email: mockRegisterDto.email,
          password: 'hashedPassword',
          name: mockRegisterDto.name,
        },
      });

      // JWT 토큰 생성 검증
      expect(mockJwtService.sign).toHaveBeenCalledWith({
        sub: mockUser.id,
        email: mockRegisterDto.email,
      });
    });

    it('이미 존재하는 이메일로 가입 시 ConflictException을 던져야 함', async () => {
      // Given: 이메일이 이미 존재
      mockPrismaService.user.findUnique.mockResolvedValue(mockUser);

      // When & Then: ConflictException 발생
      await expect(service.register(mockRegisterDto)).rejects.toThrow(
        ConflictException,
      );
      await expect(service.register(mockRegisterDto)).rejects.toThrow(
        'Email already exists',
      );

      // 사용자 생성이 호출되지 않아야 함
      expect(mockPrismaService.user.create).not.toHaveBeenCalled();
    });

    it('비밀번호가 bcrypt로 해싱되어야 함', async () => {
      // Given
      mockPrismaService.user.findUnique.mockResolvedValue(null);
      mockPrismaService.user.create.mockResolvedValue(mockUser);
      mockJwtService.sign.mockReturnValue('mock-jwt-token');
      (bcrypt.hash as jest.Mock).mockResolvedValue('hashedPassword');

      // When
      await service.register(mockRegisterDto);

      // Then: bcrypt.hash가 올바른 인자로 호출됨
      expect(bcrypt.hash).toHaveBeenCalledWith(mockRegisterDto.password, 10);
    });
  });

  describe('login', () => {
    it('올바른 자격증명으로 로그인에 성공해야 함', async () => {
      // Given: 사용자가 존재하고 비밀번호가 일치
      mockPrismaService.user.findUnique.mockResolvedValue(mockUser);
      mockJwtService.sign.mockReturnValue('mock-jwt-token');
      (bcrypt.compare as jest.Mock).mockResolvedValue(true);

      // When: 로그인 시도
      const result = await service.login(mockLoginDto);

      // Then: 올바른 토큰과 사용자 정보 반환
      expect(result).toEqual({
        accessToken: 'mock-jwt-token',
        user: {
          id: mockUser.id,
          email: mockUser.email,
          name: mockUser.name,
        },
      });

      // 사용자 조회 검증
      expect(mockPrismaService.user.findUnique).toHaveBeenCalledWith({
        where: { email: mockLoginDto.email },
      });

      // 비밀번호 비교 검증
      expect(bcrypt.compare).toHaveBeenCalledWith(
        mockLoginDto.password,
        mockUser.password,
      );
    });

    it('존재하지 않는 이메일로 로그인 시 UnauthorizedException을 던져야 함', async () => {
      // Given: 사용자가 존재하지 않음
      mockPrismaService.user.findUnique.mockResolvedValue(null);

      // When & Then: UnauthorizedException 발생
      await expect(service.login(mockLoginDto)).rejects.toThrow(
        UnauthorizedException,
      );
      await expect(service.login(mockLoginDto)).rejects.toThrow(
        'Invalid credentials',
      );

      // 비밀번호 비교가 호출되지 않아야 함
      expect(bcrypt.compare).not.toHaveBeenCalled();
    });

    it('잘못된 비밀번호로 로그인 시 UnauthorizedException을 던져야 함', async () => {
      // Given: 사용자는 존재하지만 비밀번호가 틀림
      mockPrismaService.user.findUnique.mockResolvedValue(mockUser);
      (bcrypt.compare as jest.Mock).mockResolvedValue(false);

      // When & Then: UnauthorizedException 발생
      await expect(service.login(mockLoginDto)).rejects.toThrow(
        UnauthorizedException,
      );
      await expect(service.login(mockLoginDto)).rejects.toThrow(
        'Invalid credentials',
      );

      // JWT 토큰이 생성되지 않아야 함
      expect(mockJwtService.sign).not.toHaveBeenCalled();
    });
  });

  describe('validateUser', () => {
    it('유효한 userId로 사용자 정보를 반환해야 함', async () => {
      // Given: 사용자가 존재
      const expectedUser = {
        id: mockUser.id,
        email: mockUser.email,
        name: mockUser.name,
      };
      mockPrismaService.user.findUnique.mockResolvedValue(expectedUser);

      // When: 사용자 검증
      const result = await service.validateUser(mockUser.id);

      // Then: 올바른 사용자 정보 반환 (비밀번호 제외)
      expect(result).toEqual(expectedUser);
      expect(mockPrismaService.user.findUnique).toHaveBeenCalledWith({
        where: { id: mockUser.id },
        select: { id: true, email: true, name: true },
      });
    });

    it('존재하지 않는 userId에 대해 null을 반환해야 함', async () => {
      // Given: 사용자가 존재하지 않음
      mockPrismaService.user.findUnique.mockResolvedValue(null);

      // When: 사용자 검증
      const result = await service.validateUser('invalid-user-id');

      // Then: null 반환
      expect(result).toBeNull();
    });
  });

  describe('generateToken (private method testing via public methods)', () => {
    it('register 시 올바른 payload로 JWT를 생성해야 함', async () => {
      // Given
      mockPrismaService.user.findUnique.mockResolvedValue(null);
      mockPrismaService.user.create.mockResolvedValue(mockUser);
      mockJwtService.sign.mockReturnValue('mock-jwt-token');
      (bcrypt.hash as jest.Mock).mockResolvedValue('hashedPassword');

      // When
      await service.register(mockRegisterDto);

      // Then: JWT payload에 sub(userId)와 email이 포함되어야 함
      expect(mockJwtService.sign).toHaveBeenCalledWith({
        sub: mockUser.id,
        email: mockUser.email,
      });
    });

    it('login 시 올바른 payload로 JWT를 생성해야 함', async () => {
      // Given
      mockPrismaService.user.findUnique.mockResolvedValue(mockUser);
      mockJwtService.sign.mockReturnValue('mock-jwt-token');
      (bcrypt.compare as jest.Mock).mockResolvedValue(true);

      // When
      await service.login(mockLoginDto);

      // Then: JWT payload에 sub(userId)와 email이 포함되어야 함
      expect(mockJwtService.sign).toHaveBeenCalledWith({
        sub: mockUser.id,
        email: mockUser.email,
      });
    });
  });
});
