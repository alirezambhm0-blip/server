import { Controller, Get, Post, Delete, Query, Param, Body, UseGuards } from '@nestjs/common';
import { SearchService } from './search.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { OptionalJwtAuthGuard } from '../auth/optional-jwt-auth.guard';
import { GetUser } from '../auth/get-user.decorator';
import type { RequestUser } from '../auth/get-user.decorator';

@Controller('search')
export class SearchController {
  constructor(private readonly searchService: SearchService) {}

  @UseGuards(OptionalJwtAuthGuard)
  @Get()
  async search(
    @GetUser() user: RequestUser,
    @Query('q') q: string,
    @Query('category_id') categoryId?: string,
    @Query('filter') filter?: string,
    @Query('sort') sort?: string,
    @Query('in_stock_only') inStockOnly?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string
  ) {
    return this.searchService.search({
      q,
      categoryId,
      filter,
      sort,
      inStockOnly: inStockOnly === 'true',
      page: page ? Number(page) : 1,
      limit: limit ? Number(limit) : 20,
      userId: user?.userId,
      // S7 — قیمت فقط برای مشتری تاییدشده یا ادمین
      canSeePrices: user?.role === 'ADMIN' || user?.customer?.status === 'APPROVED',
    });
  }

  @Get('suggestions')
  async suggestions(@Query('q') q: string, @Query('limit') limit?: string) {
    return this.searchService.getSuggestions(q, limit ? Number(limit) : 8);
  }

  @Get('popular')
  async popular() {
    return this.searchService.getPopular();
  }

  @UseGuards(JwtAuthGuard)
  @Get('history')
  async getHistory(@GetUser() user: RequestUser) {
    return this.searchService.getHistory(user.userId);
  }

  @UseGuards(JwtAuthGuard)
  @Post('history')
  async addHistory(@GetUser() user: RequestUser, @Body() body: { query: string; results_count: number }) {
    return this.searchService.addHistory(user.userId, body.query, body.results_count);
  }

  @UseGuards(JwtAuthGuard)
  @Delete('history')
  async clearAllHistory(@GetUser() user: RequestUser) {
    return this.searchService.clearHistory(user.userId);
  }

  @UseGuards(JwtAuthGuard)
  @Delete('history/:id')
  async deleteHistoryItem(@GetUser() user: RequestUser, @Param('id') id: string) {
    return this.searchService.clearHistory(user.userId, id);
  }
}
