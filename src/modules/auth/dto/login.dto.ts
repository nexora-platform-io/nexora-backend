import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsString, MinLength, MaxLength } from 'class-validator';

export class LoginDto {
  @ApiProperty({ example: 'qwerty@example.com', format: 'email' })
  @IsEmail()
  @MaxLength(254)
  email!: string;

  @ApiProperty({
    example: 'correct-horse-battery-staple',
    minLength: 8,
    maxLength: 72,
  })
  @IsString()
  @MinLength(8)
  @MaxLength(72)
  password!: string;
}
