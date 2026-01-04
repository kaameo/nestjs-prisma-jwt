import { NestFactory } from '@nestjs/core';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { ZodValidationPipe } from 'nestjs-zod';
import helmet from 'helmet';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // Security Headers
  app.use(helmet());

  // CORS Configuration
  app.enableCors({
    origin: process.env.NODE_ENV === 'production'
      ? ['https://yourdomain.com']
      : ['http://localhost:3000', 'http://localhost:5173'],
    credentials: true,
  });

  // Zod Validation
  app.useGlobalPipes(new ZodValidationPipe());

  // Swagger
  const config = new DocumentBuilder()
    .setTitle('Blog API')
    .setDescription('NestJS Blog API with JWT Authentication')
    .setVersion('1.0')
    .addBearerAuth()
    .build();

  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('api', app, document);

  await app.listen(process.env.PORT ?? 3000);
  console.log(`Application is running on: http://localhost:3000`);
  console.log(`Swagger docs: http://localhost:3000/api`);
}
bootstrap();
