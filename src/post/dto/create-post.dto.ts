import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

export const CreatePostSchema = z.object({
  title: z.string().min(1, 'Title is required'),
  content: z.string().min(1, 'Content is required'),
  published: z.boolean().default(false).optional(),
});

export class CreatePostDto extends createZodDto(CreatePostSchema) {}

export type CreatePostType = z.infer<typeof CreatePostSchema>;
