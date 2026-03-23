import { IsEmail, IsString, MinLength } from 'class-validator';

export class CustomerPortalLoginDto {
  @IsEmail()
  email!: string;

  @IsString()
  @MinLength(8)
  password!: string;
}
