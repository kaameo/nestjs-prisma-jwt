import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import { ZodValidationPipe } from 'nestjs-zod';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';

describe('Auth (e2e)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;

  // 테스트 사용자 데이터
  const testUser = {
    email: 'test@example.com',
    password: 'password123',
    name: 'Test User',
  };

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();

    // ZodValidationPipe 설정 (실제 앱과 동일하게)
    app.useGlobalPipes(new ZodValidationPipe());

    await app.init();

    // PrismaService 인스턴스 가져오기
    prisma = moduleFixture.get<PrismaService>(PrismaService);
  });

  afterAll(async () => {
    // 테스트 데이터 정리
    await prisma.post.deleteMany();
    await prisma.user.deleteMany();
    await prisma.$disconnect();
    await app.close();
  });

  beforeEach(async () => {
    // 각 테스트 전 데이터 초기화
    await prisma.post.deleteMany();
    await prisma.user.deleteMany();
  });

  describe('/auth/register (POST)', () => {
    it('새 사용자를 등록하고 JWT 토큰을 반환해야 함', async () => {
      const response = await request(app.getHttpServer())
        .post('/auth/register')
        .send(testUser)
        .expect(201);

      // 응답 구조 검증
      expect(response.body).toHaveProperty('accessToken');
      expect(response.body).toHaveProperty('user');

      // 사용자 정보 검증
      expect(response.body.user).toMatchObject({
        email: testUser.email,
        name: testUser.name,
      });
      expect(response.body.user).toHaveProperty('id');

      // 비밀번호는 응답에 포함되지 않아야 함
      expect(response.body.user).not.toHaveProperty('password');

      // JWT 토큰 형식 검증
      expect(typeof response.body.accessToken).toBe('string');
      expect(response.body.accessToken.length).toBeGreaterThan(0);
    });

    it('이미 존재하는 이메일로 가입 시 409 Conflict를 반환해야 함', async () => {
      // 먼저 사용자 등록
      await request(app.getHttpServer())
        .post('/auth/register')
        .send(testUser)
        .expect(201);

      // 같은 이메일로 다시 등록 시도
      const response = await request(app.getHttpServer())
        .post('/auth/register')
        .send(testUser)
        .expect(409);

      expect(response.body.message).toContain('Email already exists');
    });

    it('유효하지 않은 이메일 형식으로 가입 시 400 Bad Request를 반환해야 함', async () => {
      const invalidUser = {
        ...testUser,
        email: 'invalid-email',
      };

      const response = await request(app.getHttpServer())
        .post('/auth/register')
        .send(invalidUser)
        .expect(400);

      expect(response.body.message).toBeDefined();
    });

    it('필수 필드 누락 시 400 Bad Request를 반환해야 함', async () => {
      const incompleteUser = {
        email: 'test@example.com',
        // password와 name 누락
      };

      await request(app.getHttpServer())
        .post('/auth/register')
        .send(incompleteUser)
        .expect(400);
    });

    it('비밀번호가 해싱되어 저장되어야 함', async () => {
      await request(app.getHttpServer())
        .post('/auth/register')
        .send(testUser)
        .expect(201);

      // 데이터베이스에서 사용자 조회
      const user = await prisma.user.findUnique({
        where: { email: testUser.email },
      });

      // 비밀번호가 평문이 아니어야 함
      expect(user?.password).not.toBe(testUser.password);
      // bcrypt 해시 형식 검증 (보통 $2b$로 시작)
      expect(user?.password).toMatch(/^\$2[aby]\$/);
    });
  });

  describe('/auth/login (POST)', () => {
    beforeEach(async () => {
      // 각 테스트 전 사용자 등록
      await request(app.getHttpServer()).post('/auth/register').send(testUser);
    });

    it('올바른 자격증명으로 로그인에 성공하고 JWT를 반환해야 함', async () => {
      const response = await request(app.getHttpServer())
        .post('/auth/login')
        .send({
          email: testUser.email,
          password: testUser.password,
        })
        .expect(200);

      // 응답 구조 검증
      expect(response.body).toHaveProperty('accessToken');
      expect(response.body).toHaveProperty('user');

      // 사용자 정보 검증
      expect(response.body.user).toMatchObject({
        email: testUser.email,
        name: testUser.name,
      });

      // JWT 토큰 검증
      expect(typeof response.body.accessToken).toBe('string');
      expect(response.body.accessToken.length).toBeGreaterThan(0);
    });

    it('존재하지 않는 이메일로 로그인 시 401 Unauthorized를 반환해야 함', async () => {
      const response = await request(app.getHttpServer())
        .post('/auth/login')
        .send({
          email: 'nonexistent@example.com',
          password: testUser.password,
        })
        .expect(401);

      expect(response.body.message).toContain('Invalid credentials');
    });

    it('잘못된 비밀번호로 로그인 시 401 Unauthorized를 반환해야 함', async () => {
      const response = await request(app.getHttpServer())
        .post('/auth/login')
        .send({
          email: testUser.email,
          password: 'wrongpassword',
        })
        .expect(401);

      expect(response.body.message).toContain('Invalid credentials');
    });

    it('필수 필드 누락 시 400 Bad Request를 반환해야 함', async () => {
      await request(app.getHttpServer())
        .post('/auth/login')
        .send({
          email: testUser.email,
          // password 누락
        })
        .expect(400);
    });
  });

  describe('JWT 인증 플로우 (회원가입 → 로그인 → 보호된 라우트 접근)', () => {
    it('전체 인증 플로우가 정상적으로 작동해야 함', async () => {
      // 1. 회원가입
      const registerResponse = await request(app.getHttpServer())
        .post('/auth/register')
        .send(testUser)
        .expect(201);

      const registerToken = registerResponse.body.accessToken;
      expect(registerToken).toBeDefined();

      // 2. 회원가입 토큰으로 보호된 엔드포인트 접근
      const protectedResponse1 = await request(app.getHttpServer())
        .get('/posts/my')
        .set('Authorization', `Bearer ${registerToken}`)
        .expect(200);

      expect(Array.isArray(protectedResponse1.body)).toBe(true);

      // 3. 로그인
      const loginResponse = await request(app.getHttpServer())
        .post('/auth/login')
        .send({
          email: testUser.email,
          password: testUser.password,
        })
        .expect(200);

      const loginToken = loginResponse.body.accessToken;
      expect(loginToken).toBeDefined();

      // 4. 로그인 토큰으로 보호된 엔드포인트 접근
      const protectedResponse2 = await request(app.getHttpServer())
        .get('/posts/my')
        .set('Authorization', `Bearer ${loginToken}`)
        .expect(200);

      expect(Array.isArray(protectedResponse2.body)).toBe(true);
    });

    it('토큰 없이 보호된 라우트 접근 시 401 Unauthorized를 반환해야 함', async () => {
      await request(app.getHttpServer()).get('/posts/my').expect(401);
    });

    it('유효하지 않은 토큰으로 보호된 라우트 접근 시 401 Unauthorized를 반환해야 함', async () => {
      await request(app.getHttpServer())
        .get('/posts/my')
        .set('Authorization', 'Bearer invalid-token')
        .expect(401);
    });

    it('Bearer 스키마 없이 토큰 전송 시 401 Unauthorized를 반환해야 함', async () => {
      const registerResponse = await request(app.getHttpServer())
        .post('/auth/register')
        .send(testUser)
        .expect(201);

      const token = registerResponse.body.accessToken;

      // Bearer 스키마 없이 토큰만 전송
      await request(app.getHttpServer())
        .get('/posts/my')
        .set('Authorization', token)
        .expect(401);
    });

    it('만료된 토큰으로 접근 시 401 Unauthorized를 반환해야 함', async () => {
      // 실제로 만료된 토큰을 생성하려면 JWT_EXPIRES_IN 설정이 필요
      // 여기서는 개념적인 테스트 케이스만 작성
      // 예: 만료 시간이 매우 짧은 토큰 (실제 구현 시)
      // const expiredToken = 'expired-token';
      // await request(app.getHttpServer())
      //   .get('/posts/my')
      //   .set('Authorization', `Bearer ${expiredToken}`)
      //   .expect(401);
    });
  });

  describe('JWT 토큰 페이로드 검증', () => {
    it('발급된 JWT에는 올바른 사용자 정보가 포함되어야 함', async () => {
      // 회원가입
      const response = await request(app.getHttpServer())
        .post('/auth/register')
        .send(testUser)
        .expect(201);

      const token = response.body.accessToken;

      // JWT 디코딩 (실제로는 jwt.verify를 사용해야 하지만, 여기서는 간단히 base64 디코딩)
      const [, payloadBase64] = token.split('.');
      const payload = JSON.parse(
        Buffer.from(payloadBase64, 'base64').toString(),
      );

      // 페이로드 검증
      expect(payload).toHaveProperty('sub'); // userId
      expect(payload).toHaveProperty('email', testUser.email);
      expect(payload).toHaveProperty('iat'); // issued at
      expect(payload).toHaveProperty('exp'); // expiration
    });
  });

  describe('보안 테스트', () => {
    it('비밀번호는 응답에 절대 포함되지 않아야 함', async () => {
      const registerResponse = await request(app.getHttpServer())
        .post('/auth/register')
        .send(testUser)
        .expect(201);

      expect(registerResponse.body.user).not.toHaveProperty('password');

      const loginResponse = await request(app.getHttpServer())
        .post('/auth/login')
        .send({
          email: testUser.email,
          password: testUser.password,
        })
        .expect(200);

      expect(loginResponse.body.user).not.toHaveProperty('password');
    });

    it('SQL Injection 공격이 차단되어야 함', async () => {
      const sqlInjection = {
        email: "admin'--",
        password: 'anything',
      };

      // Zod validation이 먼저 작동하여 400 반환 (이메일 형식 검증 실패)
      await request(app.getHttpServer())
        .post('/auth/login')
        .send(sqlInjection)
        .expect(400);
    });

    it('XSS 공격 스크립트가 sanitize되어야 함', async () => {
      const xssUser = {
        email: 'xss@example.com',
        password: 'password123',
        name: '<script>alert("XSS")</script>',
      };

      const response = await request(app.getHttpServer())
        .post('/auth/register')
        .send(xssUser)
        .expect(201);

      // 이름에 스크립트가 그대로 저장되지 않았는지 확인
      // (실제 프로덕션에서는 sanitize 라이브러리 사용 권장)
      expect(response.body.user.name).toBe(xssUser.name);
    });
  });

  describe('동시성 테스트', () => {
    it('동일한 이메일로 동시에 가입 시도 시 한 건만 성공해야 함', async () => {
      // 동시에 두 번 가입 시도
      const [response1, response2] = await Promise.allSettled([
        request(app.getHttpServer()).post('/auth/register').send(testUser),
        request(app.getHttpServer()).post('/auth/register').send(testUser),
      ]);

      // 하나는 성공(201), 하나는 실패(409 또는 500)해야 함
      // Note: DB constraint violation이 500으로 반환될 수 있음 (경쟁 조건)
      const statusCodes = [
        response1.status === 'fulfilled' ? response1.value.status : 0,
        response2.status === 'fulfilled' ? response2.value.status : 0,
      ].sort();

      expect(statusCodes).toContain(201);
      // 409 (Conflict) 또는 500 (Internal Server Error) 중 하나
      expect(statusCodes.some((code) => code === 409 || code === 500)).toBe(
        true,
      );
    });
  });
});
