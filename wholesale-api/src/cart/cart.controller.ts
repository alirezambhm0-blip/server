import { Body, Controller, Delete, Get, Param, Patch, Post, Put, UseGuards } from '@nestjs/common';
import { CartService } from './cart.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { GetUser } from '../auth/get-user.decorator';
import type { RequestUser } from '../auth/get-user.decorator';
import { AddItemDto } from './dto/add-item.dto';
import { UpdateItemDto } from './dto/update-item.dto';
import { MergeCartDto } from './dto/merge-cart.dto';

@UseGuards(JwtAuthGuard)
@Controller('cart')
export class CartController {
  constructor(private readonly cartService: CartService) {}

  @Get()
  getCart(@GetUser() user: RequestUser) {
    return this.cartService.getCart(user.userId);
  }

  @Post('items')
  addItem(@GetUser() user: RequestUser, @Body() dto: AddItemDto) {
    return this.cartService.addItem(user.userId, dto.productId, dto.quantity ?? 1);
  }

  @Put('items')
  updateItem(@GetUser() user: RequestUser, @Body() dto: UpdateItemDto) {
    return this.cartService.updateItem(user.userId, dto.productId, dto.quantity);
  }

  @Patch('items/:productId')
  updateItemPatch(
    @GetUser() user: RequestUser,
    @Param('productId') productId: string,
    @Body() body: { quantity: number }
  ) {
    return this.cartService.updateItem(user.userId, productId, body.quantity);
  }

  @Delete('items/:productId')
  removeItem(@GetUser() user: RequestUser, @Param('productId') productId: string) {
    return this.cartService.removeItem(user.userId, productId);
  }

  @Delete()
  clear(@GetUser() user: RequestUser) {
    return this.cartService.clearCart(user.userId);
  }

  @Post('merge')
  merge(@GetUser() user: RequestUser, @Body() dto: MergeCartDto) {
    return this.cartService.mergeWithServer(user.userId, dto.items || []);
  }

  @Post('validate')
  validate(@GetUser() user: RequestUser) {
    return this.cartService.validateCart(user.userId);
  }

  @Post('reorder')
  reorder(@GetUser() user: RequestUser, @Body() dto: { orderId: string; mode: 'add' | 'replace' }) {
    return this.cartService.reorder(user.userId, dto.orderId, dto.mode);
  }
}
