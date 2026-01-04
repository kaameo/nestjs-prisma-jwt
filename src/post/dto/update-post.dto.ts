import { createZodDto } from 'nestjs-zod';
import { CreatePostSchema } from './create-post.dto';

export const UpdatePostSchema = CreatePostSchema.partial();

export class UpdatePostDto extends createZodDto(UpdatePostSchema) {}
