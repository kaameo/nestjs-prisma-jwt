# NestJS 핵심 개념

## 1. Module (모듈)

**역할**: 관련 기능을 그룹화하고 의존성을 관리

```typescript
// auth.module.ts
@Module({
  imports: [PassportModule, JwtModule],  // 다른 모듈 가져오기
  controllers: [AuthController],          // 이 모듈의 컨트롤러
  providers: [AuthService, JwtStrategy],  // 이 모듈의 서비스/프로바이더
  exports: [AuthService],                 // 다른 모듈에서 사용 가능하게 내보내기
})
export class AuthModule {}
```

### @Global() 데코레이터
```typescript
@Global()  // 전역 모듈 - 한 번 import하면 어디서든 사용 가능
@Module({
  providers: [PrismaService],
  exports: [PrismaService],
})
export class PrismaModule {}
```

---

## 2. Controller (컨트롤러)

**역할**: HTTP 요청을 받아서 응답 반환 (라우팅 담당)

```typescript
// post.controller.ts
@ApiTags('Posts')           // Swagger 그룹
@Controller('posts')         // 기본 경로: /posts
export class PostController {
  constructor(private postService: PostService) {}  // DI

  @Post()                    // POST /posts
  @UseGuards(JwtAuthGuard)   // 인증 필요
  @ApiBearerAuth()           // Swagger에 자물쇠 표시
  create(
    @CurrentUser() user: { id: string },  // 커스텀 데코레이터
    @Body() dto: CreatePostDto,           // 요청 바디
  ) {
    return this.postService.create(user.id, dto);
  }

  @Get(':id')                // GET /posts/:id
  findOne(@Param('id') id: string) {  // URL 파라미터
    return this.postService.findOne(id);
  }

  @Get()                     // GET /posts?published=true
  findAll(@Query('published') published?: string) {  // 쿼리 파라미터
    return this.postService.findAll();
  }
}
```

### 주요 데코레이터
| 데코레이터 | 역할 | 예시 |
|-----------|------|------|
| `@Controller('path')` | 기본 경로 설정 | `@Controller('posts')` |
| `@Get()`, `@Post()`, `@Patch()`, `@Delete()` | HTTP 메서드 | `@Get(':id')` |
| `@Body()` | 요청 바디 | `@Body() dto: CreatePostDto` |
| `@Param()` | URL 파라미터 | `@Param('id') id: string` |
| `@Query()` | 쿼리스트링 | `@Query('page') page: number` |
| `@Headers()` | 요청 헤더 | `@Headers('authorization') token` |

---

## 3. Service (서비스)

**역할**: 비즈니스 로직 처리 (컨트롤러와 DB 사이)

```typescript
// post.service.ts
@Injectable()  // DI 가능하게 만드는 데코레이터
export class PostService {
  constructor(private prisma: PrismaService) {}  // DI

  async create(authorId: string, dto: CreatePostDto) {
    return this.prisma.post.create({
      data: { ...dto, authorId },
      include: { author: { select: { id: true, name: true } } },
    });
  }

  async findOne(id: string) {
    const post = await this.prisma.post.findUnique({
      where: { id },
      include: { author: { select: { id: true, name: true } } },
    });

    if (!post) {
      throw new NotFoundException(`Post with ID ${id} not found`);
    }

    return post;
  }
}
```

### 예외 처리
```typescript
// NestJS 내장 예외 클래스
throw new NotFoundException('Not found');      // 404
throw new BadRequestException('Invalid');      // 400
throw new UnauthorizedException('Unauthorized'); // 401
throw new ForbiddenException('Forbidden');     // 403
throw new ConflictException('Already exists'); // 409
```

---

## 4. DTO (Data Transfer Object)

**역할**: 요청/응답 데이터의 타입 정의 및 유효성 검증

```typescript
// create-post.dto.ts
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsString, IsBoolean, IsOptional, MinLength } from 'class-validator';

export class CreatePostDto {
  @ApiProperty({ example: 'My First Post' })  // Swagger 문서화
  @IsString()                                  // 문자열 검증
  @MinLength(1)                                // 최소 길이
  title: string;

  @ApiProperty({ example: 'Content here...' })
  @IsString()
  content: string;

  @ApiPropertyOptional({ default: false })     // 선택적 필드
  @IsBoolean()
  @IsOptional()
  published?: boolean;
}
```

### PartialType으로 Update DTO 만들기
```typescript
// update-post.dto.ts
import { PartialType } from '@nestjs/swagger';
import { CreatePostDto } from './create-post.dto';

// CreatePostDto의 모든 필드를 Optional로 만듦
export class UpdatePostDto extends PartialType(CreatePostDto) {}
```

### 주요 검증 데코레이터 (class-validator)
| 데코레이터 | 역할 |
|-----------|------|
| `@IsString()` | 문자열 검증 |
| `@IsNumber()` | 숫자 검증 |
| `@IsEmail()` | 이메일 형식 검증 |
| `@IsBoolean()` | 불린 검증 |
| `@IsOptional()` | 선택적 필드 |
| `@MinLength(n)` | 최소 길이 |
| `@MaxLength(n)` | 최대 길이 |
| `@Min(n)` / `@Max(n)` | 숫자 범위 |
| `@IsArray()` | 배열 검증 |
| `@IsEnum(Enum)` | 열거형 검증 |
