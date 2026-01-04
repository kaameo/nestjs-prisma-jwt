# 11. Database Patterns with Prisma ⭐⭐⭐

Prisma ORM을 사용한 고급 데이터베이스 패턴 (Soft Delete, Pagination, Transactions, Relations)을 실제 프로젝트 코드로 학습합니다.

## 📚 목차

1. [Prisma 소개](#prisma-소개)
2. [Soft Delete Pattern](#soft-delete-pattern)
3. [Pagination Pattern](#pagination-pattern)
4. [Transactions](#transactions)
5. [Relations](#relations)
6. [Indexing & Performance](#indexing--performance)
7. [N+1 Query Problem](#n1-query-problem)
8. [💪 실습 과제](#-실습-과제)
9. [⚠️ 자주 하는 실수](#️-자주-하는-실수)
10. [✅ 체크리스트](#-체크리스트)

---

## Prisma 소개

### 개념

**Prisma**는 TypeScript/JavaScript를 위한 차세대 ORM(Object-Relational Mapping)입니다.

**전통적인 SQL vs. Prisma:**

```sql
-- Raw SQL
SELECT * FROM users WHERE email = 'user@example.com';
INSERT INTO posts (title, content, authorId) VALUES ('Hello', 'World', 1);
```

```typescript
// Prisma
const user = await prisma.user.findUnique({
  where: { email: 'user@example.com' },
});

const post = await prisma.post.create({
  data: { title: 'Hello', content: 'World', authorId: 1 },
});
```

**Prisma의 장점:**

- ✅ **Type Safety**: 컴파일 타임에 타입 검증
- ✅ **Auto-completion**: IDE에서 자동 완성
- ✅ **Migration**: 스키마 변경을 자동으로 마이그레이션
- ✅ **SQL Injection 방지**: 파라미터 바인딩 자동 처리
- ✅ **성능**: 효율적인 쿼리 생성

---

## Soft Delete Pattern

### 개념

**Soft Delete**는 데이터를 물리적으로 삭제하지 않고 `deletedAt` 필드를 설정하여 논리적으로 삭제합니다.

**Hard Delete vs. Soft Delete:**

```
Hard Delete (일반 삭제):
DELETE FROM posts WHERE id = 1;
→ 데이터가 영구적으로 사라짐 (복구 불가능)

Soft Delete (논리적 삭제):
UPDATE posts SET deletedAt = NOW() WHERE id = 1;
→ 데이터는 남아있지만 조회되지 않음 (복구 가능)
```

**왜 필요한가요?**

- 🗂️ **감사 추적(Audit Trail)**: 누가 언제 삭제했는지 기록
- ♻️ **복구 가능**: 실수로 삭제한 데이터 복구
- 📊 **데이터 분석**: 삭제된 데이터도 통계에 활용
- 🔗 **외래 키 무결성**: 관계된 데이터가 있어도 안전하게 "삭제"

### 프로젝트 구현

📁 **prisma/schema.prisma:36-49**

```prisma
model Post {
  id        String    @id @default(uuid())
  title     String
  content   String
  published Boolean   @default(false)
  deletedAt DateTime? @map("deleted_at") // Soft Delete 필드
  createdAt DateTime  @default(now()) @map("created_at")
  updatedAt DateTime  @updatedAt @map("updated_at")
  authorId  String    @map("author_id")
  author    User      @relation(fields: [authorId], references: [id], onDelete: Cascade)

  @@index([deletedAt]) // 성능 최적화
  @@map("posts")
}
```

**Migration 생성:**

```bash
pnpm prisma migrate dev --name add_soft_delete_to_posts
```

📁 **prisma/migrations/20260104112203_add_soft_delete_to_posts/migration.sql**

```sql
-- AlterTable
ALTER TABLE "Post" ADD COLUMN "deletedAt" TIMESTAMP(3);

-- CreateIndex
CREATE INDEX "Post_deletedAt_idx" ON "Post"("deletedAt");
```

### Service 구현

📁 **src/post/post.service.ts:61-90**

```typescript
async findAll(paginationDto: PaginationDto): Promise<PaginatedResponse<Post>> {
  const { page, limit, sortBy, sortOrder } = paginationDto;
  const skip = (page - 1) * limit;

  // 1. 삭제되지 않은 게시글만 조회
  const [posts, total] = await Promise.all([
    this.prisma.post.findMany({
      where: { deletedAt: null }, // 핵심!
      skip,
      take: limit,
      orderBy: { [sortBy]: sortOrder },
      include: { author: true },
    }),
    this.prisma.post.count({
      where: { deletedAt: null }, // 총 개수도 필터링
    }),
  ]);

  // 2. 메타데이터 계산
  const totalPages = Math.ceil(total / limit);

  return {
    data: posts,
    meta: {
      total,
      page,
      limit,
      totalPages,
      hasNextPage: page < totalPages,
      hasPreviousPage: page > 1,
    },
  };
}
```

📁 **src/post/post.service.ts:92-99**

```typescript
async findOne(id: number): Promise<Post> {
  const post = await this.prisma.post.findFirst({
    where: {
      id,
      deletedAt: null, // 삭제된 게시글은 조회 불가
    },
    include: { author: true },
  });

  if (!post) {
    throw new NotFoundException(`Post with ID ${id} not found`);
  }

  return post;
}
```

📁 **src/post/post.service.ts:108-120**

```typescript
async remove(id: number, userId: number): Promise<Post> {
  // 1. 게시글 존재 확인 (삭제되지 않은 것만)
  const post = await this.findOne(id);

  // 2. 권한 확인
  if (post.authorId !== userId) {
    throw new ForbiddenException('You can only delete your own posts');
  }

  // 3. Soft Delete 실행 (Hard Delete 아님!)
  return this.prisma.post.update({
    where: { id },
    data: { deletedAt: new Date() }, // 현재 시간 설정
  });
}
```

### 동작 예시

**데이터베이스 상태:**

```sql
-- 게시글 3개 생성
id | title       | deletedAt
---|-------------|----------
1  | Post 1      | NULL
2  | Post 2      | NULL
3  | Post 3      | NULL

-- ID 2 삭제 (Soft Delete)
UPDATE posts SET deletedAt = '2026-01-04 10:30:00' WHERE id = 2;

id | title       | deletedAt
---|-------------|-------------------
1  | Post 1      | NULL
2  | Post 2      | 2026-01-04 10:30:00  ← 삭제됨
3  | Post 3      | NULL
```

**API 요청:**

```bash
# 전체 조회 (삭제된 것은 제외)
GET /posts
→ [Post 1, Post 3]  # Post 2는 안 보임

# 삭제된 게시글 조회 시도
GET /posts/2
→ 404 Not Found

# 삭제
DELETE /posts/3
→ deletedAt이 설정됨 (DB에는 남아있음)
```

### 복구 기능 구현 (옵션)

```typescript
// src/post/post.service.ts
async restore(id: number): Promise<Post> {
  const post = await this.prisma.post.findUnique({
    where: { id },
  });

  if (!post) {
    throw new NotFoundException(`Post with ID ${id} not found`);
  }

  if (!post.deletedAt) {
    throw new BadRequestException('Post is not deleted');
  }

  // deletedAt을 null로 설정하여 복구
  return this.prisma.post.update({
    where: { id },
    data: { deletedAt: null },
  });
}
```

---

## Pagination Pattern

### 개념

**Pagination**은 대량의 데이터를 여러 페이지로 나누어 조회합니다.

**Pagination 없이:**

```typescript
// ❌ 위험: 1,000,000개 게시글을 한 번에 조회
const posts = await prisma.post.findMany();
→ 메모리 초과, 응답 시간 초과
```

**Pagination 적용:**

```typescript
// ✅ 안전: 10개씩 조회
const posts = await prisma.post.findMany({
  skip: 0, // 건너뛸 개수
  take: 10, // 가져올 개수
});
```

### Offset-based Pagination

프로젝트에서 사용하는 방식입니다.

**공식:**

```
skip = (page - 1) * limit
take = limit

예: 2페이지, 10개씩
skip = (2 - 1) * 10 = 10
take = 10
→ 11번째 ~ 20번째 레코드 조회
```

### 프로젝트 구현

📁 **src/common/dto/pagination.dto.ts**

```typescript
import { z } from 'zod';

export const paginationSchema = z.object({
  page: z.number().int().positive().default(1),
  limit: z.number().int().positive().max(100).default(10),
  sortBy: z.string().default('createdAt'),
  sortOrder: z.enum(['asc', 'desc']).default('desc'),
});

export type PaginationDto = z.infer<typeof paginationSchema>;

export interface PaginatedResponse<T> {
  data: T[];
  meta: {
    total: number; // 전체 레코드 수
    page: number; // 현재 페이지
    limit: number; // 페이지당 개수
    totalPages: number; // 전체 페이지 수
    hasNextPage: boolean; // 다음 페이지 존재 여부
    hasPreviousPage: boolean; // 이전 페이지 존재 여부
  };
}
```

📁 **src/post/post.service.ts:61-90**

```typescript
async findAll(paginationDto: PaginationDto): Promise<PaginatedResponse<Post>> {
  const { page, limit, sortBy, sortOrder } = paginationDto;

  // 1. skip 계산
  const skip = (page - 1) * limit;

  // 2. 데이터와 총 개수를 병렬로 조회 (성능 최적화)
  const [posts, total] = await Promise.all([
    this.prisma.post.findMany({
      where: { deletedAt: null },
      skip,
      take: limit,
      orderBy: { [sortBy]: sortOrder },
      include: { author: true },
    }),
    this.prisma.post.count({
      where: { deletedAt: null },
    }),
  ]);

  // 3. 메타데이터 계산
  const totalPages = Math.ceil(total / limit);

  return {
    data: posts,
    meta: {
      total,
      page,
      limit,
      totalPages,
      hasNextPage: page < totalPages,
      hasPreviousPage: page > 1,
    },
  };
}
```

📁 **src/post/post.controller.ts:18-37**

```typescript
@Get()
@ApiOperation({ summary: 'Get all posts with pagination' })
@ApiQuery({ name: 'page', required: false, example: 1 })
@ApiQuery({ name: 'limit', required: false, example: 10 })
@ApiQuery({ name: 'sortBy', required: false, example: 'createdAt' })
@ApiQuery({ name: 'sortOrder', required: false, example: 'desc' })
async findAll(
  @Query('page') page?: number,
  @Query('limit') limit?: number,
  @Query('sortBy') sortBy?: string,
  @Query('sortOrder') sortOrder?: 'asc' | 'desc',
): Promise<PaginatedResponse<Post>> {
  const paginationDto: PaginationDto = {
    page: page || 1,
    limit: limit || 10,
    sortBy: sortBy || 'createdAt',
    sortOrder: sortOrder || 'desc',
  };
  return this.postService.findAll(paginationDto);
}
```

### API 응답 예시

**요청:**

```bash
GET /posts?page=2&limit=5&sortBy=title&sortOrder=asc
```

**응답:**

```json
{
  "data": [
    {
      "id": 6,
      "title": "Post 6",
      "content": "Content 6",
      "authorId": 1,
      "createdAt": "2026-01-04T10:00:00.000Z"
    },
    {
      "id": 7,
      "title": "Post 7",
      "content": "Content 7",
      "authorId": 2,
      "createdAt": "2026-01-04T11:00:00.000Z"
    }
  ],
  "meta": {
    "total": 23,
    "page": 2,
    "limit": 5,
    "totalPages": 5,
    "hasNextPage": true,
    "hasPreviousPage": true
  }
}
```

### Cursor-based Pagination (고급)

대규모 데이터에서는 Cursor 방식이 더 효율적입니다.

```typescript
// Offset 방식의 문제: 페이지가 뒤로 갈수록 느려짐
// skip: 10000, take: 10 → DB가 10010개를 읽고 10개만 반환

// Cursor 방식: 마지막 레코드의 ID를 기준으로 조회
async findAllCursor(cursor?: number, limit: number = 10) {
  return this.prisma.post.findMany({
    take: limit,
    skip: cursor ? 1 : 0, // cursor가 있으면 해당 레코드는 제외
    cursor: cursor ? { id: cursor } : undefined,
    where: { deletedAt: null },
    orderBy: { id: 'asc' },
  });
}

// 사용 예:
// 1페이지: GET /posts?limit=10
// → [id: 1~10], nextCursor: 10

// 2페이지: GET /posts?cursor=10&limit=10
// → [id: 11~20], nextCursor: 20
```

---

## Transactions

### 개념

**Transaction**은 여러 DB 작업을 하나의 단위로 묶어서 **모두 성공하거나 모두 실패**하도록 보장합니다.

**ACID 원칙:**

- **Atomicity (원자성)**: 모두 성공 또는 모두 실패
- **Consistency (일관성)**: 데이터 무결성 유지
- **Isolation (격리성)**: 동시 실행되는 트랜잭션 간 간섭 없음
- **Durability (지속성)**: 커밋된 데이터는 영구 저장

### 시나리오: 게시글 생성 + 통계 업데이트

```typescript
// ❌ Transaction 없이 (위험!)
async createPost(data: CreatePostDto) {
  // 1. 게시글 생성
  const post = await this.prisma.post.create({ data });

  // 2. 사용자 통계 업데이트
  await this.prisma.user.update({
    where: { id: data.authorId },
    data: { postCount: { increment: 1 } },
  });

  // 문제: 2번에서 에러 발생 시 1번은 롤백되지 않음!
  // → 게시글은 생성되었지만 통계는 업데이트되지 않음 (데이터 불일치)
}
```

```typescript
// ✅ Transaction 적용
async createPost(data: CreatePostDto) {
  return this.prisma.$transaction(async (tx) => {
    // 1. 게시글 생성
    const post = await tx.post.create({ data });

    // 2. 사용자 통계 업데이트
    await tx.user.update({
      where: { id: data.authorId },
      data: { postCount: { increment: 1 } },
    });

    // 모두 성공하면 커밋, 하나라도 실패하면 롤백!
    return post;
  });
}
```

### Interactive Transaction (고급)

```typescript
// 예: 포인트 이동 (A → B)
async transferPoints(fromUserId: number, toUserId: number, amount: number) {
  return this.prisma.$transaction(async (tx) => {
    // 1. A의 포인트 차감
    const fromUser = await tx.user.update({
      where: { id: fromUserId },
      data: { points: { decrement: amount } },
    });

    // 2. 잔액 부족 확인
    if (fromUser.points < 0) {
      throw new BadRequestException('Insufficient points');
    }

    // 3. B의 포인트 증가
    await tx.user.update({
      where: { id: toUserId },
      data: { points: { increment: amount } },
    });

    // 4. 트랜잭션 로그 생성
    await tx.pointLog.create({
      data: {
        fromUserId,
        toUserId,
        amount,
        timestamp: new Date(),
      },
    });
  });
}
```

### Batch Transaction

```typescript
// 여러 작업을 한 번에 실행
const result = await this.prisma.$transaction([
  this.prisma.post.create({ data: { title: 'Post 1' } }),
  this.prisma.post.create({ data: { title: 'Post 2' } }),
  this.prisma.post.create({ data: { title: 'Post 3' } }),
]);

// result: [Post, Post, Post]
// 하나라도 실패하면 모두 롤백
```

---

## Relations

### 개념

**Relations**은 테이블 간의 관계를 정의합니다.

**관계 유형:**

- **1:N (One-to-Many)**: 한 사용자가 여러 게시글 작성
- **N:1 (Many-to-One)**: 여러 게시글이 한 사용자에 속함
- **M:N (Many-to-Many)**: 게시글 ↔ 태그 (중간 테이블 필요)

### 프로젝트 Schema

📁 **prisma/schema.prisma**

```prisma
model User {
  id            String         @id @default(uuid())
  email         String         @unique
  password      String
  name          String
  createdAt     DateTime       @default(now()) @map("created_at")
  updatedAt     DateTime       @updatedAt @map("updated_at")

  posts         Post[]         // 1:N 관계 (User → Posts)
  refreshTokens RefreshToken[] // 1:N 관계 (User → RefreshTokens)

  @@map("users")
}

model Post {
  id        String    @id @default(uuid())
  title     String
  content   String
  published Boolean   @default(false)
  deletedAt DateTime? @map("deleted_at")
  createdAt DateTime  @default(now()) @map("created_at")
  updatedAt DateTime  @updatedAt @map("updated_at")
  authorId  String    @map("author_id")

  author    User      @relation(fields: [authorId], references: [id], onDelete: Cascade)
  // N:1 관계 (Post → User)
  // fields: 현재 모델의 필드
  // references: 참조하는 모델의 필드
  // onDelete: Cascade - 사용자 삭제 시 게시글도 삭제

  @@index([deletedAt])
  @@map("posts")
}

model RefreshToken {
  id        String   @id @default(uuid())
  token     String   @unique
  userId    String   @map("user_id")
  expiresAt DateTime @map("expires_at")
  createdAt DateTime @default(now()) @map("created_at")
  user      User     @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@index([userId])
  @@index([token])
  @@map("refresh_tokens")
}
```

### Include (Eager Loading)

관계된 데이터를 함께 조회합니다.

```typescript
// ❌ N+1 Problem (나쁜 예)
const posts = await this.prisma.post.findMany();
for (const post of posts) {
  const author = await this.prisma.user.findUnique({
    where: { id: post.authorId },
  });
  // 100개 게시글 → 1(posts) + 100(authors) = 101번 쿼리!
}

// ✅ Include 사용 (좋은 예)
const posts = await this.prisma.post.findMany({
  include: { author: true },
});
// 1번 쿼리로 게시글 + 작성자 정보를 모두 가져옴 (JOIN 사용)
```

📁 **src/post/post.service.ts:92-99**

```typescript
async findOne(id: number): Promise<Post> {
  const post = await this.prisma.post.findFirst({
    where: { id, deletedAt: null },
    include: { author: true }, // User 정보도 포함
  });

  if (!post) {
    throw new NotFoundException(`Post with ID ${id} not found`);
  }

  return post;
}
```

**응답:**

```json
{
  "id": 1,
  "title": "Hello World",
  "content": "My first post",
  "authorId": 1,
  "author": {
    "id": 1,
    "email": "user@example.com",
    "name": "John Doe"
  }
}
```

### Select (특정 필드만 조회)

```typescript
// 비밀번호는 제외하고 조회
const user = await this.prisma.user.findUnique({
  where: { id: 1 },
  select: {
    id: true,
    email: true,
    name: true,
    posts: {
      select: {
        id: true,
        title: true,
      },
    },
  },
});

// 결과:
// {
//   id: 1,
//   email: "user@example.com",
//   name: "John Doe",
//   posts: [
//     { id: 1, title: "Post 1" },
//     { id: 2, title: "Post 2" }
//   ]
// }
```

---

## Indexing & Performance

### 개념

**Index**는 데이터베이스에서 빠른 검색을 위한 자료구조입니다.

**Index 없이:**

```sql
-- Full Table Scan (모든 행을 순회)
SELECT * FROM posts WHERE deletedAt IS NULL;
→ 1,000,000개 행을 모두 확인 (느림!)
```

**Index 적용:**

```sql
-- Index Scan (인덱스를 통해 빠르게 찾기)
CREATE INDEX idx_posts_deleted_at ON posts(deletedAt);
→ deletedAt이 NULL인 행만 빠르게 조회
```

### 프로젝트 구현

📁 **prisma/schema.prisma:36-49**

```prisma
model Post {
  id        String    @id @default(uuid())
  title     String
  content   String
  published Boolean   @default(false)
  deletedAt DateTime? @map("deleted_at")
  createdAt DateTime  @default(now()) @map("created_at")
  updatedAt DateTime  @updatedAt @map("updated_at")
  authorId  String    @map("author_id")
  author    User      @relation(fields: [authorId], references: [id], onDelete: Cascade)

  @@index([deletedAt]) // deletedAt에 인덱스 생성
  // Soft Delete 조회가 빈번하므로 성능 향상
  @@map("posts")
}
```

### Index 전략

**언제 Index를 생성해야 하나요?**

```
✅ Index 생성 권장:
- WHERE 절에 자주 사용되는 컬럼 (deletedAt, email, status)
- JOIN에 사용되는 외래 키 (authorId)
- ORDER BY에 사용되는 컬럼 (createdAt)
- UNIQUE 제약 조건 (Prisma가 자동 생성)

❌ Index 불필요:
- 거의 사용되지 않는 컬럼
- 카디널리티가 낮은 컬럼 (예: boolean, 성별)
- 자주 업데이트되는 컬럼 (Index 유지 비용 증가)
```

### Composite Index (복합 인덱스)

```prisma
model Post {
  authorId  Int
  deletedAt DateTime?
  createdAt DateTime

  // 복합 인덱스: WHERE authorId = X AND deletedAt IS NULL
  @@index([authorId, deletedAt])

  // 정렬 포함: WHERE deletedAt IS NULL ORDER BY createdAt DESC
  @@index([deletedAt, createdAt])
}
```

---

## N+1 Query Problem

### 개념

**N+1 Problem**은 관계된 데이터를 조회할 때 불필요하게 많은 쿼리가 실행되는 문제입니다.

### 시나리오

```typescript
// ❌ N+1 Problem 발생
async getAllPostsWithAuthors() {
  const posts = await this.prisma.post.findMany(); // 1번 쿼리

  for (const post of posts) {
    const author = await this.prisma.user.findUnique({
      where: { id: post.authorId },
    }); // N번 쿼리 (posts 개수만큼)
    post.author = author;
  }

  // 총 쿼리: 1 + N = N+1
  // 100개 게시글 → 101번 쿼리 실행!
}
```

**쿼리 로그:**

```sql
SELECT * FROM posts;                     -- 1번
SELECT * FROM users WHERE id = 1;        -- 2번
SELECT * FROM users WHERE id = 2;        -- 3번
SELECT * FROM users WHERE id = 1;        -- 4번 (중복!)
...
SELECT * FROM users WHERE id = 50;       -- 101번
```

### 해결 방법 1: Include (Eager Loading)

```typescript
// ✅ 해결: Include 사용
async getAllPostsWithAuthors() {
  const posts = await this.prisma.post.findMany({
    include: { author: true },
  });

  // 총 쿼리: 1번 (JOIN 사용)
  return posts;
}
```

**쿼리 로그:**

```sql
SELECT posts.*, users.*
FROM posts
LEFT JOIN users ON posts.authorId = users.id;
-- 1번 쿼리로 모든 데이터 조회!
```

### 해결 방법 2: DataLoader (고급)

대규모 애플리케이션에서는 DataLoader 패턴을 사용합니다.

```typescript
// 여러 ID를 한 번에 조회
async batchLoadUsers(userIds: number[]) {
  const users = await this.prisma.user.findMany({
    where: { id: { in: userIds } },
  });

  // ID별로 매핑
  const userMap = new Map(users.map(u => [u.id, u]));
  return userIds.map(id => userMap.get(id));
}

// 사용:
// [1, 2, 1, 3, 2] → SELECT * FROM users WHERE id IN (1, 2, 3)
// 중복 제거하여 1번 쿼리로 해결
```

---

## 💪 실습 과제

### 과제 1: Hard Delete 기능 추가

완전히 삭제하는 기능을 추가하세요.

```typescript
// src/post/post.service.ts
async permanentDelete(id: number, userId: number): Promise<void> {
  // TODO:
  // 1. 게시글 조회 (deletedAt 필터 없이)
  // 2. 권한 확인
  // 3. prisma.post.delete() 실행
}
```

### 과제 2: Cursor-based Pagination 구현

```typescript
// src/post/post.service.ts
async findAllCursor(cursor?: number, limit: number = 10) {
  // TODO: Cursor 방식으로 구현
  // 힌트: take, skip, cursor 옵션 사용
}
```

### 과제 3: Transaction으로 게시글 이동

게시글의 작성자를 변경하면서 통계도 함께 업데이트하세요.

```typescript
// src/post/post.service.ts
async transferPost(postId: number, newAuthorId: number) {
  return this.prisma.$transaction(async (tx) => {
    // TODO:
    // 1. 게시글의 기존 작성자 ID 조회
    // 2. 기존 작성자의 postCount - 1
    // 3. 새 작성자의 postCount + 1
    // 4. 게시글의 authorId 업데이트
  });
}
```

---

## ⚠️ 자주 하는 실수

### 1. Soft Delete 필터 누락

```typescript
// ❌ 삭제된 데이터도 조회됨
const posts = await this.prisma.post.findMany();

// ✅ deletedAt 필터 추가
const posts = await this.prisma.post.findMany({
  where: { deletedAt: null },
});
```

### 2. Pagination에서 count 누락

```typescript
// ❌ 총 페이지 수를 알 수 없음
const posts = await this.prisma.post.findMany({ skip, take });

// ✅ count도 함께 조회
const [posts, total] = await Promise.all([
  this.prisma.post.findMany({ skip, take }),
  this.prisma.post.count(),
]);
```

### 3. Transaction 내부에서 일반 prisma 사용

```typescript
// ❌ Transaction 외부의 prisma 사용
await this.prisma.$transaction(async (tx) => {
  await this.prisma.post.create({ data }); // 트랜잭션 적용 안 됨!
});

// ✅ Transaction 파라미터(tx) 사용
await this.prisma.$transaction(async (tx) => {
  await tx.post.create({ data }); // 트랜잭션 적용됨
});
```

### 4. N+1 Problem 무시

```typescript
// ❌ 루프 안에서 쿼리
for (const post of posts) {
  post.author = await this.prisma.user.findUnique({
    where: { id: post.authorId },
  });
}

// ✅ Include 사용
const posts = await this.prisma.post.findMany({
  include: { author: true },
});
```

---

## ✅ 체크리스트

### Soft Delete

- [ ] `deletedAt` 필드가 스키마에 정의되어 있는가?
- [ ] `deletedAt`에 인덱스가 생성되어 있는가?
- [ ] 모든 조회 쿼리에 `where: { deletedAt: null }` 필터가 적용되어 있는가?
- [ ] `remove()` 메서드가 `update({ deletedAt: new Date() })`를 사용하는가?

### Pagination

- [ ] `skip`과 `take`가 올바르게 계산되는가?
- [ ] `total`, `totalPages`, `hasNextPage` 등 메타데이터를 반환하는가?
- [ ] `limit` 최대값이 제한되어 있는가? (예: 100)
- [ ] 데이터 조회와 count를 `Promise.all()`로 병렬 실행하는가?

### Transactions

- [ ] 여러 작업을 원자적으로 처리해야 할 때 Transaction을 사용하는가?
- [ ] Transaction 내부에서 `tx` 파라미터를 사용하는가?
- [ ] 에러 발생 시 자동으로 롤백되는가?

### Relations

- [ ] 외래 키가 올바르게 정의되어 있는가? (`@relation`)
- [ ] N+1 Problem을 피하기 위해 `include`를 사용하는가?
- [ ] 민감한 정보(비밀번호)를 제외하기 위해 `select`를 사용하는가?

### Performance

- [ ] 자주 조회되는 컬럼에 인덱스가 생성되어 있는가?
- [ ] WHERE, JOIN, ORDER BY에 사용되는 컬럼에 인덱스가 있는가?
- [ ] 불필요한 인덱스는 제거되어 있는가?

---

## 다음 단계

- **[12. Project Structure](./12-project-structure.md)** ⭐⭐  
  NestJS 프로젝트 구조, 3-Layer Architecture, 모듈 조직화 학습

- **[이전: 10. Security Best Practices](./10-security-best-practices.md)** ⭐⭐⭐  
  JWT, bcrypt, Refresh Token Rotation, Rate Limiting 복습
