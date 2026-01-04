import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

export const RegisterSchema = z.object({
  email: z.string().email({ message: 'Invalid email format' }),
  password: z.string().min(6, 'Password must be at least 6 characters'),
  name: z.string().min(2, 'Name must be at least 2 characters'),
});

export class RegisterDto extends createZodDto(RegisterSchema) {}

export type RegisterType = z.infer<typeof RegisterSchema>;
