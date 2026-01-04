import {
  Injectable,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreatePostDto } from './dto/create-post.dto';
import { UpdatePostDto } from './dto/update-post.dto';
import { PaginationDto, PaginatedResponse } from '../common/dto/pagination.dto';

@Injectable()
export class PostService {
  constructor(private prisma: PrismaService) {}

  async create(authorId: string, dto: CreatePostDto) {
    return this.prisma.post.create({
      data: {
        ...dto,
        authorId,
      },
      include: {
        author: {
          select: { id: true, name: true },
        },
      },
    });
  }

  async findAll(
    pagination: PaginationDto,
    published?: boolean,
  ): Promise<PaginatedResponse<any>> {
    const { page, limit, sortBy, sortOrder } = pagination;
    const skip = (page - 1) * limit;

    const where = {
      deletedAt: null, // Exclude soft-deleted posts
      ...(published !== undefined && { published }),
    };

    const [data, total] = await Promise.all([
      this.prisma.post.findMany({
        where,
        skip,
        take: limit,
        orderBy: sortBy ? { [sortBy]: sortOrder } : { createdAt: sortOrder },
        include: {
          author: {
            select: { id: true, name: true },
          },
        },
      }),
      this.prisma.post.count({ where }),
    ]);

    const totalPages = Math.ceil(total / limit);

    return {
      data,
      meta: {
        page,
        limit,
        total,
        totalPages,
        hasNextPage: page < totalPages,
        hasPreviousPage: page > 1,
      },
    };
  }

  async findOne(id: string) {
    const post = await this.prisma.post.findFirst({
      where: {
        id,
        deletedAt: null, // Exclude soft-deleted posts
      },
      include: {
        author: {
          select: { id: true, name: true },
        },
      },
    });

    if (!post) {
      throw new NotFoundException(`Post with ID ${id} not found`);
    }

    return post;
  }

  async update(id: string, userId: string, dto: UpdatePostDto) {
    const post = await this.findOne(id);

    if (post.authorId !== userId) {
      throw new ForbiddenException('You can only update your own posts');
    }

    return this.prisma.post.update({
      where: { id },
      data: dto,
      include: {
        author: {
          select: { id: true, name: true },
        },
      },
    });
  }

  async remove(id: string, userId: string) {
    const post = await this.findOne(id);

    if (post.authorId !== userId) {
      throw new ForbiddenException('You can only delete your own posts');
    }

    // Soft delete: set deletedAt instead of actually deleting
    await this.prisma.post.update({
      where: { id },
      data: { deletedAt: new Date() },
    });

    return { message: 'Post deleted successfully' };
  }

  async findByAuthor(authorId: string) {
    return this.prisma.post.findMany({
      where: {
        authorId,
        deletedAt: null, // Exclude soft-deleted posts
      },
      include: {
        author: {
          select: { id: true, name: true },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
  }
}
