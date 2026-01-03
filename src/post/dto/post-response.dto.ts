import { ApiProperty } from '@nestjs/swagger';

export class PostAuthorDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  name: string;
}

export class PostResponseDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  title: string;

  @ApiProperty()
  content: string;

  @ApiProperty()
  published: boolean;

  @ApiProperty()
  createdAt: Date;

  @ApiProperty()
  updatedAt: Date;

  @ApiProperty({ type: PostAuthorDto })
  author: PostAuthorDto;
}
