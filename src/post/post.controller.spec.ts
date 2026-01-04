import { Test, TestingModule } from '@nestjs/testing';
import { PostController } from './post.controller';
import { PostService } from './post.service';
import { CreatePostDto } from './dto/create-post.dto';
import { UpdatePostDto } from './dto/update-post.dto';

describe('PostController', () => {
  let controller: PostController;
  let service: PostService;

  const mockUser = {
    id: 'user-123',
    email: 'test@example.com',
    name: 'Test User',
  };

  const mockPost = {
    id: 'post-123',
    title: 'Test Post',
    content: 'Test content',
    published: false,
    authorId: mockUser.id,
    createdAt: new Date(),
    updatedAt: new Date(),
    author: {
      id: mockUser.id,
      name: mockUser.name,
    },
  };

  const mockCreatePostDto: CreatePostDto = {
    title: 'New Post',
    content: 'New content',
    published: false,
  };

  const mockUpdatePostDto: UpdatePostDto = {
    title: 'Updated Post',
  };

  const mockPostService = {
    create: jest.fn(),
    findAll: jest.fn(),
    findOne: jest.fn(),
    update: jest.fn(),
    remove: jest.fn(),
    findByAuthor: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [PostController],
      providers: [
        {
          provide: PostService,
          useValue: mockPostService,
        },
      ],
    }).compile();

    controller = module.get<PostController>(PostController);
    service = module.get<PostService>(PostService);

    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('create', () => {
    it('새 게시물을 생성하고 반환해야 함', async () => {
      // Given
      mockPostService.create.mockResolvedValue(mockPost);

      // When
      const result = await controller.create(mockUser, mockCreatePostDto);

      // Then
      expect(result).toEqual(mockPost);
      expect(service.create).toHaveBeenCalledWith(
        mockUser.id,
        mockCreatePostDto,
      );
    });

    it('현재 로그인한 사용자의 ID를 authorId로 사용해야 함', async () => {
      // Given
      mockPostService.create.mockResolvedValue(mockPost);
      const customUser = { id: 'custom-user-id' };

      // When
      await controller.create(customUser, mockCreatePostDto);

      // Then
      expect(service.create).toHaveBeenCalledWith(
        customUser.id,
        mockCreatePostDto,
      );
    });

    it('CreatePostDto를 서비스에 전달해야 함', async () => {
      // Given
      mockPostService.create.mockResolvedValue(mockPost);

      // When
      await controller.create(mockUser, mockCreatePostDto);

      // Then
      expect(service.create).toHaveBeenCalledWith(
        expect.any(String),
        mockCreatePostDto,
      );
    });
  });

  describe('findAll', () => {
    const mockPosts = [mockPost, { ...mockPost, id: 'post-456' }];

    it('모든 게시물을 반환해야 함 (쿼리 파라미터 없음)', async () => {
      // Given
      mockPostService.findAll.mockResolvedValue(mockPosts);

      // When
      const result = await controller.findAll();

      // Then
      expect(result).toEqual(mockPosts);
      expect(service.findAll).toHaveBeenCalledWith(undefined);
    });

    it('published=true 쿼리로 게시된 게시물만 반환해야 함', async () => {
      // Given
      const publishedPosts = [{ ...mockPost, published: true }];
      mockPostService.findAll.mockResolvedValue(publishedPosts);

      // When
      const result = await controller.findAll('true');

      // Then
      expect(result).toEqual(publishedPosts);
      expect(service.findAll).toHaveBeenCalledWith(true);
    });

    it('published=false 쿼리로 미게시 게시물만 반환해야 함', async () => {
      // Given
      mockPostService.findAll.mockResolvedValue([mockPost]);

      // When
      const result = await controller.findAll('false');

      // Then
      expect(result).toEqual([mockPost]);
      expect(service.findAll).toHaveBeenCalledWith(false);
    });

    it('invalid published 값은 undefined로 처리해야 함', async () => {
      // Given
      mockPostService.findAll.mockResolvedValue(mockPosts);

      // When
      await controller.findAll('invalid');

      // Then: true도 false도 아니므로 undefined 전달
      expect(service.findAll).toHaveBeenCalledWith(undefined);
    });

    it('빈 문자열은 undefined로 처리해야 함', async () => {
      // Given
      mockPostService.findAll.mockResolvedValue(mockPosts);

      // When
      await controller.findAll('');

      // Then
      expect(service.findAll).toHaveBeenCalledWith(undefined);
    });
  });

  describe('findMyPosts', () => {
    it('현재 사용자의 게시물만 반환해야 함', async () => {
      // Given
      const myPosts = [mockPost];
      mockPostService.findByAuthor.mockResolvedValue(myPosts);

      // When
      const result = await controller.findMyPosts(mockUser);

      // Then
      expect(result).toEqual(myPosts);
      expect(service.findByAuthor).toHaveBeenCalledWith(mockUser.id);
    });

    it('다른 사용자로 요청하면 해당 사용자의 게시물만 반환해야 함', async () => {
      // Given
      const otherUser = { id: 'other-user-id' };
      const otherPosts = [{ ...mockPost, authorId: otherUser.id }];
      mockPostService.findByAuthor.mockResolvedValue(otherPosts);

      // When
      const result = await controller.findMyPosts(otherUser);

      // Then
      expect(result).toEqual(otherPosts);
      expect(service.findByAuthor).toHaveBeenCalledWith(otherUser.id);
    });
  });

  describe('findOne', () => {
    it('ID로 특정 게시물을 반환해야 함', async () => {
      // Given
      mockPostService.findOne.mockResolvedValue(mockPost);

      // When
      const result = await controller.findOne(mockPost.id);

      // Then
      expect(result).toEqual(mockPost);
      expect(service.findOne).toHaveBeenCalledWith(mockPost.id);
    });

    it('올바른 게시물 ID를 서비스에 전달해야 함', async () => {
      // Given
      const postId = 'specific-post-id';
      mockPostService.findOne.mockResolvedValue(mockPost);

      // When
      await controller.findOne(postId);

      // Then
      expect(service.findOne).toHaveBeenCalledWith(postId);
    });
  });

  describe('update', () => {
    it('게시물을 수정하고 수정된 게시물을 반환해야 함', async () => {
      // Given
      const updatedPost = { ...mockPost, ...mockUpdatePostDto };
      mockPostService.update.mockResolvedValue(updatedPost);

      // When
      const result = await controller.update(
        mockPost.id,
        mockUser,
        mockUpdatePostDto,
      );

      // Then
      expect(result).toEqual(updatedPost);
      expect(service.update).toHaveBeenCalledWith(
        mockPost.id,
        mockUser.id,
        mockUpdatePostDto,
      );
    });

    it('현재 사용자 ID와 게시물 ID, DTO를 서비스에 전달해야 함', async () => {
      // Given
      mockPostService.update.mockResolvedValue(mockPost);

      // When
      await controller.update(mockPost.id, mockUser, mockUpdatePostDto);

      // Then
      expect(service.update).toHaveBeenCalledWith(
        mockPost.id,
        mockUser.id,
        mockUpdatePostDto,
      );
    });

    it('부분 수정(Patch)을 지원해야 함', async () => {
      // Given
      const partialUpdate: UpdatePostDto = { title: 'Only title updated' };
      mockPostService.update.mockResolvedValue({
        ...mockPost,
        ...partialUpdate,
      });

      // When
      await controller.update(mockPost.id, mockUser, partialUpdate);

      // Then: title만 포함된 DTO 전달
      expect(service.update).toHaveBeenCalledWith(
        mockPost.id,
        mockUser.id,
        partialUpdate,
      );
    });
  });

  describe('remove', () => {
    it('게시물을 삭제하고 성공 메시지를 반환해야 함', async () => {
      // Given
      const deleteResponse = { message: 'Post deleted successfully' };
      mockPostService.remove.mockResolvedValue(deleteResponse);

      // When
      const result = await controller.remove(mockPost.id, mockUser);

      // Then
      expect(result).toEqual(deleteResponse);
      expect(service.remove).toHaveBeenCalledWith(mockPost.id, mockUser.id);
    });

    it('현재 사용자 ID와 게시물 ID를 서비스에 전달해야 함', async () => {
      // Given
      mockPostService.remove.mockResolvedValue({
        message: 'Post deleted successfully',
      });

      // When
      await controller.remove(mockPost.id, mockUser);

      // Then
      expect(service.remove).toHaveBeenCalledWith(mockPost.id, mockUser.id);
    });

    it('다른 사용자로 삭제 요청 시 해당 사용자 ID를 전달해야 함', async () => {
      // Given
      const otherUser = { id: 'other-user-id' };
      mockPostService.remove.mockResolvedValue({
        message: 'Post deleted successfully',
      });

      // When
      await controller.remove(mockPost.id, otherUser);

      // Then
      expect(service.remove).toHaveBeenCalledWith(mockPost.id, otherUser.id);
    });
  });

  describe('Guard and Decorator Integration', () => {
    it('create는 인증이 필요해야 함 (@UseGuards(JwtAuthGuard))', () => {
      // Controller의 메타데이터를 확인하여 Guard가 적용되었는지 검증
      const guards = Reflect.getMetadata('__guards__', controller.create);
      expect(guards).toBeDefined();
    });

    it('update는 인증이 필요해야 함', () => {
      const guards = Reflect.getMetadata('__guards__', controller.update);
      expect(guards).toBeDefined();
    });

    it('remove는 인증이 필요해야 함', () => {
      const guards = Reflect.getMetadata('__guards__', controller.remove);
      expect(guards).toBeDefined();
    });

    it('findAll은 인증이 필요하지 않아야 함 (public endpoint)', () => {
      const guards = Reflect.getMetadata('__guards__', controller.findAll);
      // findAll은 Guard가 없어야 함
      expect(guards).toBeUndefined();
    });

    it('findOne은 인증이 필요하지 않아야 함 (public endpoint)', () => {
      const guards = Reflect.getMetadata('__guards__', controller.findOne);
      expect(guards).toBeUndefined();
    });
  });

  describe('DTO Validation', () => {
    it('CreatePostDto는 필수 필드를 포함해야 함', () => {
      // CreatePostDto의 필수 필드 검증
      const dto: CreatePostDto = {
        title: 'Test',
        content: 'Test content',
        published: false,
      };

      expect(dto.title).toBeDefined();
      expect(dto.content).toBeDefined();
      expect(dto.published).toBeDefined();
    });

    it('UpdatePostDto는 부분 업데이트를 지원해야 함', () => {
      // UpdatePostDto는 모든 필드가 선택적이어야 함
      const dto1: UpdatePostDto = { title: 'New title' };
      const dto2: UpdatePostDto = { content: 'New content' };
      const dto3: UpdatePostDto = { published: true };

      expect(dto1.title).toBeDefined();
      expect(dto2.content).toBeDefined();
      expect(dto3.published).toBeDefined();
    });
  });
});
