# Prisma 사용법

## 기본 명령어

```bash
# Prisma Client 생성 (스키마 변경 후 필수)
npx prisma generate

# 마이그레이션 생성 및 적용 (개발용)
npx prisma migrate dev --name migration-name

# 마이그레이션 적용만 (프로덕션)
npx prisma migrate deploy

# DB 스키마 초기화 (데이터 삭제됨!)
npx prisma migrate reset

# Prisma Studio (DB GUI)
npx prisma studio
```

---

## 스키마 정의

```prisma
// prisma/schema.prisma

generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

model User {
  id        String   @id @default(uuid())   // UUID 기본키
  email     String   @unique                 // 유니크 제약
  password  String
  name      String
  role      Role     @default(USER)          // 열거형 + 기본값
  createdAt DateTime @default(now()) @map("created_at")  // 컬럼명 매핑
  updatedAt DateTime @updatedAt @map("updated_at")       // 자동 업데이트
  posts     Post[]                           // 1:N 관계
  profile   Profile?                         // 1:1 관계 (선택적)

  @@map("users")  // 테이블명 매핑
}

model Post {
  id        String   @id @default(uuid())
  title     String
  content   String   @db.Text               // TEXT 타입
  published Boolean  @default(false)
  authorId  String   @map("author_id")
  author    User     @relation(fields: [authorId], references: [id], onDelete: Cascade)
  tags      Tag[]                            // N:M 관계

  @@index([authorId])                        // 인덱스
  @@map("posts")
}

model Profile {
  id     String @id @default(uuid())
  bio    String?
  userId String @unique @map("user_id")
  user   User   @relation(fields: [userId], references: [id])

  @@map("profiles")
}

model Tag {
  id    String @id @default(uuid())
  name  String @unique
  posts Post[]

  @@map("tags")
}

enum Role {
  USER
  ADMIN
}
```

---

## 관계 정의

### 1:N 관계 (User ↔ Post)
```prisma
model User {
  id    String @id
  posts Post[]           // 한 유저가 여러 게시글
}

model Post {
  id       String @id
  authorId String
  author   User   @relation(fields: [authorId], references: [id])
}
```

### 1:1 관계 (User ↔ Profile)
```prisma
model User {
  id      String   @id
  profile Profile?         // 선택적 1:1
}

model Profile {
  id     String @id
  userId String @unique    // unique 필수!
  user   User   @relation(fields: [userId], references: [id])
}
```

### N:M 관계 (Post ↔ Tag)
```prisma
model Post {
  id   String @id
  tags Tag[]              // 암시적 조인 테이블 생성
}

model Tag {
  id    String @id
  posts Post[]
}
```

---

## CRUD 쿼리 예시

### Create
```typescript
// 단일 생성
const user = await prisma.user.create({
  data: {
    email: 'test@test.com',
    password: 'hashed',
    name: 'Test',
  },
});

// 관계와 함께 생성
const post = await prisma.post.create({
  data: {
    title: 'Hello',
    content: 'World',
    author: { connect: { id: userId } },  // 기존 유저 연결
  },
});

// 여러 개 생성
await prisma.user.createMany({
  data: [
    { email: 'a@a.com', password: '...', name: 'A' },
    { email: 'b@b.com', password: '...', name: 'B' },
  ],
});
```

### Read
```typescript
// 전체 조회
const users = await prisma.user.findMany();

// 조건 조회
const users = await prisma.user.findMany({
  where: { role: 'ADMIN' },
  orderBy: { createdAt: 'desc' },
  take: 10,  // LIMIT
  skip: 0,   // OFFSET
});

// 단일 조회
const user = await prisma.user.findUnique({
  where: { id: userId },
});

// 관계 포함 조회
const post = await prisma.post.findUnique({
  where: { id: postId },
  include: {
    author: { select: { id: true, name: true } },
    tags: true,
  },
});

// 조건부 조회 (첫 번째 매칭)
const user = await prisma.user.findFirst({
  where: { email: { contains: 'test' } },
});
```

### Update
```typescript
// 단일 업데이트
const user = await prisma.user.update({
  where: { id: userId },
  data: { name: 'New Name' },
});

// 여러 개 업데이트
await prisma.post.updateMany({
  where: { authorId: userId },
  data: { published: true },
});

// upsert (있으면 업데이트, 없으면 생성)
const user = await prisma.user.upsert({
  where: { email: 'test@test.com' },
  update: { name: 'Updated' },
  create: { email: 'test@test.com', password: '...', name: 'New' },
});
```

### Delete
```typescript
// 단일 삭제
await prisma.user.delete({
  where: { id: userId },
});

// 여러 개 삭제
await prisma.post.deleteMany({
  where: { published: false },
});
```

---

## 고급 쿼리

### 필터 연산자
```typescript
const posts = await prisma.post.findMany({
  where: {
    title: { contains: 'hello' },      // LIKE '%hello%'
    title: { startsWith: 'Hello' },    // LIKE 'Hello%'
    createdAt: { gte: new Date('2024-01-01') },  // >=
    createdAt: { lt: new Date('2024-12-31') },   // <
    authorId: { in: ['id1', 'id2'] },  // IN
    authorId: { notIn: ['id3'] },      // NOT IN
    content: { not: null },            // IS NOT NULL
  },
});
```

### AND / OR
```typescript
const posts = await prisma.post.findMany({
  where: {
    AND: [
      { published: true },
      { title: { contains: 'nest' } },
    ],
  },
});

const posts = await prisma.post.findMany({
  where: {
    OR: [
      { title: { contains: 'nest' } },
      { content: { contains: 'nest' } },
    ],
  },
});
```

### 집계
```typescript
// 개수
const count = await prisma.post.count({
  where: { published: true },
});

// 그룹화
const grouped = await prisma.post.groupBy({
  by: ['authorId'],
  _count: { id: true },
});
```

---

## 트랜잭션

```typescript
// 여러 쿼리를 하나의 트랜잭션으로
const [user, post] = await prisma.$transaction([
  prisma.user.create({ data: { ... } }),
  prisma.post.create({ data: { ... } }),
]);

// 인터랙티브 트랜잭션
await prisma.$transaction(async (tx) => {
  const user = await tx.user.findUnique({ where: { id } });
  if (!user) throw new Error('User not found');

  await tx.post.create({ data: { authorId: user.id, ... } });
});
```
