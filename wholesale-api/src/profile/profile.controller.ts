import { Controller, Get, Patch, Body, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { GetUser } from '../auth/get-user.decorator';
import type { RequestUser } from '../auth/get-user.decorator';
import { ProfileService } from './profile.service';

@UseGuards(JwtAuthGuard)
@Controller('user')
export class ProfileController {
  constructor(private readonly profileService: ProfileService) {}

  @Get('profile')
  getProfile(@GetUser() user: RequestUser) {
    return this.profileService.getProfile(user.userId);
  }

  @Patch('profile')
  updateProfile(
    @GetUser() user: RequestUser,
    @Body()
    body: {
      firstName?: string;
      lastName?: string;
      email?: string;
      storeName?: string;
      businessType?: string;
    }
  ) {
    return this.profileService.updateProfile(user.userId, body);
  }

  @Patch('address')
  updateAddress(@GetUser() user: RequestUser, @Body() body: { default_address: string }) {
    return this.profileService.updateAddress(user.userId, body.default_address);
  }
}
