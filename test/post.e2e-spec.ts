import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import { ZodValidationPipe } from 'nestjs-zod';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';

describe('Post (e2e)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;

  // 테스트 사용자 데이터
  const testUser1 = {
    email: 'user1@example.com',
    password: 'password123',
    name: 'User One',
  };

  const testUser2 = {
    email: 'user2@example.com',
    password: 'password123',
    name: 'User Two',
  };

  let user1Token: string;
  let user2Token: string;
  let user1Id: string;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();

    // ZodValidationPipe 설정 (실제 앱과 동일하게)
    app.useGlobalPipes(new ZodValidationPipe());

    await app.init();

    prisma = moduleFixture.get<PrismaService>(PrismaService);

    // 테스트 사용자 등록 및 토큰 발급
    const user1Response = await request(app.getHttpServer())
      .post('/auth/register')
      .send(testUser1);
    user1Token = user1Response.body.accessToken;
    user1Id = user1Response.body.user.id;

    const user2Response = await request(app.getHttpServer())
      .post('/auth/register')
      .send(testUser2);
    user2Token = user2Response.body.accessToken;
  });

  afterAll(async () => {
    await prisma.post.deleteMany();
    await prisma.user.deleteMany();
    await prisma.$disconnect();
    await app.close();
  });

  beforeEach(async () => {
    // 각 테스트 전 게시물만 삭제
    await prisma.post.deleteMany();
  });

  describe('/posts (POST)', () => {
    it('인증된 사용자는 게시물을 생성할 수 있어야 함', async () => {
      const createPostDto = {
        title: 'Test Post',
        content: 'Test content',
        published: false,
      };

      const response = await request(app.getHttpServer())
        .post('/posts')
        .set('Authorization', `Bearer ${user1Token}`)
        .send(createPostDto)
        .expect(201);

      // 응답 검증
      expect(response.body).toMatchObject({
        title: createPostDto.title,
        content: createPostDto.content,
        published: createPostDto.published,
      });
      expect(response.body).toHaveProperty('id');
      expect(response.body).toHaveProperty('authorId', user1Id);
      expect(response.body).toHaveProperty('createdAt');
      expect(response.body).toHaveProperty('updatedAt');
      expect(response.body.author).toMatchObject({
        id: user1Id,
        name: testUser1.name,
      });
    });

    it('인증되지 않은 사용자는 게시물을 생성할 수 없어야 함', async () => {
      const createPostDto = {
        title: 'Test Post',
        content: 'Test content',
        published: false,
      };

      await request(app.getHttpServer())
        .post('/posts')
        .send(createPostDto)
        .expect(401);
    });

    it('필수 필드 누락 시 400 Bad Request를 반환해야 함', async () => {
      const incompleteDto = {
        title: 'Test Post',
        // content 누락
      };

      await request(app.getHttpServer())
        .post('/posts')
        .set('Authorization', `Bearer ${user1Token}`)
        .send(incompleteDto)
        .expect(400);
    });

    it('published 기본값은 false여야 함', async () => {
      const createPostDto = {
        title: 'Test Post',
        content: 'Test content',
        // published 필드 생략
      };

      const response = await request(app.getHttpServer())
        .post('/posts')
        .set('Authorization', `Bearer ${user1Token}`)
        .send(createPostDto)
        .expect(201);

      expect(response.body.published).toBe(false);
    });
  });

  describe('/posts (GET)', () => {
    beforeEach(async () => {
      // 테스트 데이터 생성
      await request(app.getHttpServer())
        .post('/posts')
        .set('Authorization', `Bearer ${user1Token}`)
        .send({
          title: 'Published Post 1',
          content: 'Content 1',
          published: true,
        });

      await request(app.getHttpServer())
        .post('/posts')
        .set('Authorization', `Bearer ${user1Token}`)
        .send({
          title: 'Draft Post 1',
          content: 'Content 2',
          published: false,
        });

      await request(app.getHttpServer())
        .post('/posts')
        .set('Authorization', `Bearer ${user2Token}`)
        .send({
          title: 'Published Post 2',
          content: 'Content 3',
          published: true,
        });
    });

    it('모든 게시물을 조회할 수 있어야 함 (인증 불필요)', async () => {
      const response = await request(app.getHttpServer())
        .get('/posts')
        .expect(200);

      expect(Array.isArray(response.body)).toBe(true);
      expect(response.body.length).toBe(3);
    });

    it('published=true 쿼리로 게시된 게시물만 조회할 수 있어야 함', async () => {
      const response = await request(app.getHttpServer())
        .get('/posts?published=true')
        .expect(200);

      expect(response.body.length).toBe(2);
      expect(response.body.every((post: any) => post.published === true)).toBe(
        true,
      );
    });

    it('published=false 쿼리로 미게시 게시물만 조회할 수 있어야 함', async () => {
      const response = await request(app.getHttpServer())
        .get('/posts?published=false')
        .expect(200);

      expect(response.body.length).toBe(1);
      expect(response.body[0].published).toBe(false);
    });

    it('최신 순으로 정렬되어야 함', async () => {
      const response = await request(app.getHttpServer())
        .get('/posts')
        .expect(200);

      // createdAt을 기준으로 내림차순 정렬 확인
      const dates = response.body.map((post: any) =>
        new Date(post.createdAt).getTime(),
      );
      const sortedDates = [...dates].sort((a, b) => b - a);
      expect(dates).toEqual(sortedDates);
    });

    it('각 게시물은 작성자 정보를 포함해야 함', async () => {
      const response = await request(app.getHttpServer())
        .get('/posts')
        .expect(200);

      expect(response.body[0]).toHaveProperty('author');
      expect(response.body[0].author).toHaveProperty('id');
      expect(response.body[0].author).toHaveProperty('name');
    });
  });

  describe('/posts/my (GET)', () => {
    beforeEach(async () => {
      // User1의 게시물 2개 생성
      await request(app.getHttpServer())
        .post('/posts')
        .set('Authorization', `Bearer ${user1Token}`)
        .send({ title: 'User1 Post 1', content: 'Content', published: true });

      await request(app.getHttpServer())
        .post('/posts')
        .set('Authorization', `Bearer ${user1Token}`)
        .send({
          title: 'User1 Post 2',
          content: 'Content',
          published: false,
        });

      // User2의 게시물 1개 생성
      await request(app.getHttpServer())
        .post('/posts')
        .set('Authorization', `Bearer ${user2Token}`)
        .send({ title: 'User2 Post 1', content: 'Content', published: true });
    });

    it('현재 사용자의 게시물만 조회해야 함', async () => {
      const response = await request(app.getHttpServer())
        .get('/posts/my')
        .set('Authorization', `Bearer ${user1Token}`)
        .expect(200);

      expect(response.body.length).toBe(2);
      expect(
        response.body.every((post: any) => post.authorId === user1Id),
      ).toBe(true);
    });

    it('인증되지 않은 사용자는 접근할 수 없어야 함', async () => {
      await request(app.getHttpServer()).get('/posts/my').expect(401);
    });

    it('다른 사용자의 게시물은 조회되지 않아야 함', async () => {
      const response = await request(app.getHttpServer())
        .get('/posts/my')
        .set('Authorization', `Bearer ${user2Token}`)
        .expect(200);

      expect(response.body.length).toBe(1);
      expect(response.body[0].title).toBe('User2 Post 1');
    });
  });

  describe('/posts/:id (GET)', () => {
    let postId: string;

    beforeEach(async () => {
      const response = await request(app.getHttpServer())
        .post('/posts')
        .set('Authorization', `Bearer ${user1Token}`)
        .send({
          title: 'Test Post',
          content: 'Test content',
          published: true,
        });
      postId = response.body.id;
    });

    it('ID로 특정 게시물을 조회할 수 있어야 함 (인증 불필요)', async () => {
      const response = await request(app.getHttpServer())
        .get(`/posts/${postId}`)
        .expect(200);

      expect(response.body).toMatchObject({
        id: postId,
        title: 'Test Post',
        content: 'Test content',
      });
      expect(response.body).toHaveProperty('author');
    });

    it('존재하지 않는 게시물 조회 시 404 Not Found를 반환해야 함', async () => {
      const nonExistentId = '00000000-0000-0000-0000-000000000000';

      await request(app.getHttpServer())
        .get(`/posts/${nonExistentId}`)
        .expect(404);
    });
  });

  describe('/posts/:id (PATCH)', () => {
    let postId: string;

    beforeEach(async () => {
      const response = await request(app.getHttpServer())
        .post('/posts')
        .set('Authorization', `Bearer ${user1Token}`)
        .send({
          title: 'Original Title',
          content: 'Original content',
          published: false,
        });
      postId = response.body.id;
    });

    it('본인의 게시물을 수정할 수 있어야 함', async () => {
      const updateDto = {
        title: 'Updated Title',
        content: 'Updated content',
      };

      const response = await request(app.getHttpServer())
        .patch(`/posts/${postId}`)
        .set('Authorization', `Bearer ${user1Token}`)
        .send(updateDto)
        .expect(200);

      expect(response.body).toMatchObject({
        id: postId,
        title: updateDto.title,
        content: updateDto.content,
      });
    });

    it('부분 수정이 가능해야 함 (title만 수정)', async () => {
      const updateDto = {
        title: 'Only Title Updated',
      };

      const response = await request(app.getHttpServer())
        .patch(`/posts/${postId}`)
        .set('Authorization', `Bearer ${user1Token}`)
        .send(updateDto)
        .expect(200);

      expect(response.body.title).toBe(updateDto.title);
      expect(response.body.content).toBe('Original content'); // 변경되지 않음
    });

    it('published 상태만 변경할 수 있어야 함', async () => {
      const updateDto = {
        published: true,
      };

      const response = await request(app.getHttpServer())
        .patch(`/posts/${postId}`)
        .set('Authorization', `Bearer ${user1Token}`)
        .send(updateDto)
        .expect(200);

      expect(response.body.published).toBe(true);
      expect(response.body.title).toBe('Original Title'); // 변경되지 않음
    });

    it('다른 사용자의 게시물은 수정할 수 없어야 함 (403 Forbidden)', async () => {
      const updateDto = {
        title: 'Hacked Title',
      };

      const response = await request(app.getHttpServer())
        .patch(`/posts/${postId}`)
        .set('Authorization', `Bearer ${user2Token}`)
        .send(updateDto)
        .expect(403);

      expect(response.body.message).toContain(
        'You can only update your own posts',
      );
    });

    it('인증되지 않은 사용자는 수정할 수 없어야 함', async () => {
      await request(app.getHttpServer())
        .patch(`/posts/${postId}`)
        .send({ title: 'Hacked' })
        .expect(401);
    });

    it('존재하지 않는 게시물 수정 시 404 Not Found를 반환해야 함', async () => {
      const nonExistentId = '00000000-0000-0000-0000-000000000000';

      await request(app.getHttpServer())
        .patch(`/posts/${nonExistentId}`)
        .set('Authorization', `Bearer ${user1Token}`)
        .send({ title: 'Updated' })
        .expect(404);
    });
  });

  describe('/posts/:id (DELETE)', () => {
    let postId: string;

    beforeEach(async () => {
      const response = await request(app.getHttpServer())
        .post('/posts')
        .set('Authorization', `Bearer ${user1Token}`)
        .send({
          title: 'Post to Delete',
          content: 'Content',
          published: false,
        });
      postId = response.body.id;
    });

    it('본인의 게시물을 삭제할 수 있어야 함', async () => {
      const response = await request(app.getHttpServer())
        .delete(`/posts/${postId}`)
        .set('Authorization', `Bearer ${user1Token}`)
        .expect(200);

      expect(response.body.message).toContain('Post deleted successfully');

      // 실제로 삭제되었는지 확인
      await request(app.getHttpServer()).get(`/posts/${postId}`).expect(404);
    });

    it('다른 사용자의 게시물은 삭제할 수 없어야 함 (403 Forbidden)', async () => {
      const response = await request(app.getHttpServer())
        .delete(`/posts/${postId}`)
        .set('Authorization', `Bearer ${user2Token}`)
        .expect(403);

      expect(response.body.message).toContain(
        'You can only delete your own posts',
      );

      // 게시물이 삭제되지 않았는지 확인
      await request(app.getHttpServer()).get(`/posts/${postId}`).expect(200);
    });

    it('인증되지 않은 사용자는 삭제할 수 없어야 함', async () => {
      await request(app.getHttpServer()).delete(`/posts/${postId}`).expect(401);
    });

    it('존재하지 않는 게시물 삭제 시 404 Not Found를 반환해야 함', async () => {
      const nonExistentId = '00000000-0000-0000-0000-000000000000';

      await request(app.getHttpServer())
        .delete(`/posts/${nonExistentId}`)
        .set('Authorization', `Bearer ${user1Token}`)
        .expect(404);
    });
  });

  describe('통합 시나리오 테스트', () => {
    it('게시물 생성 → 수정 → 게시 → 삭제 전체 플로우', async () => {
      // 1. 게시물 생성 (draft)
      const createResponse = await request(app.getHttpServer())
        .post('/posts')
        .set('Authorization', `Bearer ${user1Token}`)
        .send({
          title: 'Draft Post',
          content: 'Initial content',
          published: false,
        })
        .expect(201);

      const postId = createResponse.body.id;
      expect(createResponse.body.published).toBe(false);

      // 2. 게시물 수정
      const updateResponse = await request(app.getHttpServer())
        .patch(`/posts/${postId}`)
        .set('Authorization', `Bearer ${user1Token}`)
        .send({
          title: 'Updated Title',
          content: 'Updated content',
        })
        .expect(200);

      expect(updateResponse.body.title).toBe('Updated Title');

      // 3. 게시물 게시
      const publishResponse = await request(app.getHttpServer())
        .patch(`/posts/${postId}`)
        .set('Authorization', `Bearer ${user1Token}`)
        .send({ published: true })
        .expect(200);

      expect(publishResponse.body.published).toBe(true);

      // 4. 게시된 게시물 목록에서 확인
      const listResponse = await request(app.getHttpServer())
        .get('/posts?published=true')
        .expect(200);

      const foundPost = listResponse.body.find((p: any) => p.id === postId);
      expect(foundPost).toBeDefined();

      // 5. 게시물 삭제
      await request(app.getHttpServer())
        .delete(`/posts/${postId}`)
        .set('Authorization', `Bearer ${user1Token}`)
        .expect(200);

      // 6. 삭제 확인
      await request(app.getHttpServer()).get(`/posts/${postId}`).expect(404);
    });

    it('여러 사용자가 각자의 게시물을 관리할 수 있어야 함', async () => {
      // User1 게시물 생성
      const user1PostResponse = await request(app.getHttpServer())
        .post('/posts')
        .set('Authorization', `Bearer ${user1Token}`)
        .send({
          title: 'User1 Post',
          content: 'Content',
          published: true,
        });

      const user1PostId = user1PostResponse.body.id;

      // User2 게시물 생성
      const user2PostResponse = await request(app.getHttpServer())
        .post('/posts')
        .set('Authorization', `Bearer ${user2Token}`)
        .send({
          title: 'User2 Post',
          content: 'Content',
          published: true,
        });

      const user2PostId = user2PostResponse.body.id;

      // User1은 자신의 게시물만 수정 가능
      await request(app.getHttpServer())
        .patch(`/posts/${user1PostId}`)
        .set('Authorization', `Bearer ${user1Token}`)
        .send({ title: 'Updated by User1' })
        .expect(200);

      // User1은 User2의 게시물 수정 불가
      await request(app.getHttpServer())
        .patch(`/posts/${user2PostId}`)
        .set('Authorization', `Bearer ${user1Token}`)
        .send({ title: 'Hacked' })
        .expect(403);

      // User1은 자신의 게시물만 삭제 가능
      await request(app.getHttpServer())
        .delete(`/posts/${user1PostId}`)
        .set('Authorization', `Bearer ${user1Token}`)
        .expect(200);

      // User1은 User2의 게시물 삭제 불가
      await request(app.getHttpServer())
        .delete(`/posts/${user2PostId}`)
        .set('Authorization', `Bearer ${user1Token}`)
        .expect(403);
    });
  });
});
