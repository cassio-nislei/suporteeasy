import { Body, Controller, Get, Post, Req } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Request } from 'express';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Public } from '../common/decorators/public.decorator';
import { AuthUser } from '../common/interfaces/auth-user.interface';
import { AuthService } from './auth.service';
import { ConfirmEmailVerificationDto } from './dto/confirm-email-verification.dto';
import { ForgotPasswordDto } from './dto/forgot-password.dto';
import { LoginDto } from './dto/login.dto';
import { RefreshTokenDto } from './dto/refresh-token.dto';
import { RequestEmailVerificationDto } from './dto/request-email-verification.dto';
import { ResetPasswordDto } from './dto/reset-password.dto';

@ApiTags('auth')
@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('login')
  @Public()
  @ApiOperation({ summary: 'Login with email and password' })
  async login(@Body() dto: LoginDto, @Req() request: Request) {
    return this.authService.login(dto, request);
  }

  @Post('refresh')
  @Public()
  @ApiOperation({ summary: 'Refresh access token' })
  async refresh(@Body() dto: RefreshTokenDto, @Req() request: Request) {
    return this.authService.refresh(dto, request);
  }

  @Post('logout')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Logout and revoke refresh token' })
  async logout(@CurrentUser() user: AuthUser) {
    return this.authService.logout(user.sub);
  }

  @Get('me')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get current authenticated user' })
  async me(@CurrentUser() user: AuthUser) {
    return this.authService.me(user);
  }

  @Post('forgot-password')
  @Public()
  @ApiOperation({ summary: 'Request forgot password flow' })
  async forgotPassword(@Body() dto: ForgotPasswordDto, @Req() request: Request) {
    return this.authService.forgotPassword(dto, request);
  }

  @Post('reset-password')
  @Public()
  @ApiOperation({ summary: 'Reset password with reset token' })
  async resetPassword(@Body() dto: ResetPasswordDto, @Req() request: Request) {
    return this.authService.resetPassword(dto, request);
  }

  @Post('email-verification/request')
  @Public()
  @ApiOperation({ summary: 'Request email verification flow' })
  async requestEmailVerification(
    @Body() dto: RequestEmailVerificationDto,
    @Req() request: Request
  ) {
    return this.authService.requestEmailVerification(dto, request);
  }

  @Post('email-verification/confirm')
  @Public()
  @ApiOperation({ summary: 'Confirm email verification token' })
  async confirmEmailVerification(
    @Body() dto: ConfirmEmailVerificationDto,
    @Req() request: Request
  ) {
    return this.authService.confirmEmailVerification(dto, request);
  }
}
