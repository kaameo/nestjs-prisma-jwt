import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException, ForbiddenException } from '@nestjs/common';
import { PostService } from './post.service';
import { PrismaService } from '../prisma/prisma.service';

describe('PostService', () => {
  let service: PostService;
  let prismaService: PrismaService;

  const mockAuthor = {
    id: 'author-123',
    name: 'Test Author',
  };

  const mockPost = {
    id: 'post-123',
    title: 'Test Post',
    content: 'Test content',
    published: false,
    authorId: mockAuthor.id,
    createdAt: new Date('2024-01-01'),
    updatedAt: new Date('2024-01-01'),
    author: mockAuthor,
  };

  const mockCreatePostDto = {
    title: 'New Post',
    content: 'New content',
    published: false,
  };

  const mockUpdatePostDto = {
    title: 'Updated Post',
    content: 'Updated content',
  };

  const mockPrismaService = {
    post: {
      create: jest.fn(),
      findMany: jest.fn(),
      findFirst: jest.fn(),
      findUnique: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
      count: jest.fn(),
    },
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PostService,
        {
          provide: PrismaService,
          useValue: mockPrismaService,
        },
      ],
    }).compile();

    service = module.get<PostService>(PostService);
    prismaService = module.get<PrismaService>(PrismaService);

    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('create', () => {
    it('새 게시물을 성공적으로 생성해야 함', async () => {
      // Given
      mockPrismaService.post.create.mockResolvedValue(mockPost);

      // When
      const result = await service.create(mockAuthor.id, mockCreatePostDto);

      // Then
      expect(result).toEqual(mockPost);
      expect(mockPrismaService.post.create).toHaveBeenCalledWith({
        data: {
          ...mockCreatePostDto,
          authorId: mockAuthor.id,
        },
        include: {
          author: {
            select: { id: true, name: true },
          },
        },
      });
    });

    it('작성자 ID와 함께 게시물을 생성해야 함', async () => {
      // Given
      const authorId = 'specific-author-id';
      mockPrismaService.post.create.mockResolvedValue({
        ...mockPost,
        authorId,
      });

      // When
      await service.create(authorId, mockCreatePostDto);

      // Then: authorId가 포함되어야 함
      expect(mockPrismaService.post.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            authorId,
          }),
        }),
      );
    });

    it('생성 시 작성자 정보를 포함해야 함', async () => {
      // Given
      mockPrismaService.post.create.mockResolvedValue(mockPost);

      // When
      await service.create(mockAuthor.id, mockCreatePostDto);

      // Then: author 정보 include
      expect(mockPrismaService.post.create).toHaveBeenCalledWith(
        expect.objectContaining({
          include: {
            author: {
              select: { id: true, name: true },
            },
          },
        }),
      );
    });
  });

  describe('findAll', () => {
    const mockPosts = [mockPost, { ...mockPost, id: 'post-456' }];
    const mockPagination = { page: 1, limit: 20, sortOrder: 'desc' as const };

    it('페이지네이션과 함께 게시물을 반환해야 함', async () => {
      // Given
      mockPrismaService.post.findMany.mockResolvedValue(mockPosts);
      mockPrismaService.post.count.mockResolvedValue(2);

      // When
      const result = await service.findAll(mockPagination);

      // Then
      expect(result.data).toEqual(mockPosts);
      expect(result.meta.total).toBe(2);
      expect(result.meta.page).toBe(1);
      expect(mockPrismaService.post.findMany).toHaveBeenCalled();
      expect(mockPrismaService.post.count).toHaveBeenCalled();
    });

    it('published 필터와 함께 작동해야 함', async () => {
      // Given
      const publishedPosts = [{ ...mockPost, published: true }];
      mockPrismaService.post.findMany.mockResolvedValue(publishedPosts);
      mockPrismaService.post.count.mockResolvedValue(1);

      // When
      const result = await service.findAll(mockPagination, true);

      // Then
      expect(result.data).toEqual(publishedPosts);
      expect(mockPrismaService.post.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ published: true }),
        }),
      );
    });

    it('최신 순으로 정렬되어야 함', async () => {
      // Given
      mockPrismaService.post.findMany.mockResolvedValue(mockPosts);
      mockPrismaService.post.count.mockResolvedValue(2);

      // When
      await service.findAll(mockPagination);

      // Then
      expect(mockPrismaService.post.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          orderBy: { createdAt: 'desc' },
        }),
      );
    });
  });

  describe('findOne', () => {
    it('ID로 게시물을 찾아 반환해야 함', async () => {
      // Given
      mockPrismaService.post.findFirst.mockResolvedValue(mockPost);

      // When
      const result = await service.findOne(mockPost.id);

      // Then
      expect(result).toEqual(mockPost);
      expect(mockPrismaService.post.findFirst).toHaveBeenCalled();
    });

    it('존재하지 않는 게시물 조회 시 NotFoundException을 던져야 함', async () => {
      // Given
      const postId = 'non-existent-id';
      mockPrismaService.post.findFirst.mockResolvedValue(null);

      // When & Then
      await expect(service.findOne(postId)).rejects.toThrow(NotFoundException);
      await expect(service.findOne(postId)).rejects.toThrow(
        `Post with ID ${postId} not found`,
      );
    });

    it('작성자 정보를 포함해야 함', async () => {
      // Given
      const mockPostWithAuthor = { ...mockPost, author: mockAuthor };
      mockPrismaService.post.findFirst.mockResolvedValue(mockPostWithAuthor);

      // When
      const result = await service.findOne(mockPost.id);

      // Then
      expect(result).toHaveProperty('author');
      expect(mockPrismaService.post.findFirst).toHaveBeenCalled();
    });
  });

  describe('update', () => {
    it('본인의 게시물을 성공적으로 수정해야 함', async () => {
      // Given
      const updatedPost = { ...mockPost, ...mockUpdatePostDto };
      mockPrismaService.post.findFirst.mockResolvedValue(mockPost);
      mockPrismaService.post.update.mockResolvedValue(updatedPost);

      // When
      const result = await service.update(
        mockPost.id,
        mockAuthor.id,
        mockUpdatePostDto,
      );

      // Then
      expect(result).toEqual(updatedPost);
      expect(mockPrismaService.post.update).toHaveBeenCalled();
    });

    it('다른 사람의 게시물 수정 시 ForbiddenException을 던져야 함', async () => {
      // Given
      const otherUserId = 'other-user-id';
      mockPrismaService.post.findFirst.mockResolvedValue(mockPost);

      // When & Then
      await expect(
        service.update(mockPost.id, otherUserId, mockUpdatePostDto),
      ).rejects.toThrow(ForbiddenException);

      // update가 호출되지 않아야 함
      expect(mockPrismaService.post.update).not.toHaveBeenCalled();
    });

    it('존재하지 않는 게시물 수정 시 NotFoundException을 던져야 함', async () => {
      // Given
      mockPrismaService.post.findFirst.mockResolvedValue(null);

      // When & Then
      await expect(
        service.update('non-existent-id', mockAuthor.id, mockUpdatePostDto),
      ).rejects.toThrow(NotFoundException);
    });

    it('수정 전 게시물 소유권을 확인해야 함', async () => {
      // Given
      mockPrismaService.post.findFirst.mockResolvedValue(mockPost);
      mockPrismaService.post.update.mockResolvedValue(mockPost);

      // When
      await service.update(mockPost.id, mockAuthor.id, mockUpdatePostDto);

      // Then: findFirst와 update가 모두 호출됨
      expect(mockPrismaService.post.findFirst).toHaveBeenCalled();
      expect(mockPrismaService.post.update).toHaveBeenCalled();
    });
  });

  describe('remove', () => {
    it('본인의 게시물을 성공적으로 삭제해야 함 (Soft Delete)', async () => {
      // Given
      mockPrismaService.post.findFirst.mockResolvedValue(mockPost);
      mockPrismaService.post.update.mockResolvedValue({
        ...mockPost,
        deletedAt: new Date(),
      });

      // When
      const result = await service.remove(mockPost.id, mockAuthor.id);

      // Then
      expect(result).toEqual({ message: 'Post deleted successfully' });
      expect(mockPrismaService.post.update).toHaveBeenCalledWith({
        where: { id: mockPost.id },
        data: expect.objectContaining({ deletedAt: expect.any(Date) }),
      });
    });

    it('다른 사람의 게시물 삭제 시 ForbiddenException을 던져야 함', async () => {
      // Given
      const otherUserId = 'other-user-id';
      mockPrismaService.post.findFirst.mockResolvedValue(mockPost);

      // When & Then
      await expect(service.remove(mockPost.id, otherUserId)).rejects.toThrow(
        ForbiddenException,
      );

      // update가 호출되지 않아야 함
      expect(mockPrismaService.post.update).not.toHaveBeenCalled();
    });

    it('존재하지 않는 게시물 삭제 시 NotFoundException을 던져야 함', async () => {
      // Given
      mockPrismaService.post.findFirst.mockResolvedValue(null);

      // When & Then
      await expect(
        service.remove('non-existent-id', mockAuthor.id),
      ).rejects.toThrow(NotFoundException);
    });

    it('삭제 전 게시물 소유권을 확인해야 함', async () => {
      // Given
      mockPrismaService.post.findFirst.mockResolvedValue(mockPost);
      mockPrismaService.post.update.mockResolvedValue({
        ...mockPost,
        deletedAt: new Date(),
      });

      // When
      await service.remove(mockPost.id, mockAuthor.id);

      // Then: findFirst와 update가 모두 호출됨
      expect(mockPrismaService.post.findFirst).toHaveBeenCalled();
      expect(mockPrismaService.post.update).toHaveBeenCalled();
    });
  });

  describe('findByAuthor', () => {
    it('특정 작성자의 모든 게시물을 반환해야 함', async () => {
      // Given
      const authorPosts = [mockPost, { ...mockPost, id: 'post-456' }];
      mockPrismaService.post.findMany.mockResolvedValue(authorPosts);

      // When
      const result = await service.findByAuthor(mockAuthor.id);

      // Then
      expect(result).toEqual(authorPosts);
      expect(mockPrismaService.post.findMany).toHaveBeenCalledWith({
        where: {
          authorId: mockAuthor.id,
          deletedAt: null,
        },
        include: {
          author: {
            select: { id: true, name: true },
          },
        },
        orderBy: { createdAt: 'desc' },
      });
    });

    it('최신 순으로 정렬되어야 함', async () => {
      // Given
      mockPrismaService.post.findMany.mockResolvedValue([mockPost]);

      // When
      await service.findByAuthor(mockAuthor.id);

      // Then
      expect(mockPrismaService.post.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          orderBy: { createdAt: 'desc' },
        }),
      );
    });

    it('작성자에게 게시물이 없으면 빈 배열을 반환해야 함', async () => {
      // Given
      mockPrismaService.post.findMany.mockResolvedValue([]);

      // When
      const result = await service.findByAuthor('author-with-no-posts');

      // Then
      expect(result).toEqual([]);
    });
  });
});
