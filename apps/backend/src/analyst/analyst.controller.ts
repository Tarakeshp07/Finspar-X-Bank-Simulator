import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { AnalystService } from './analyst.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

@ApiTags('analyst')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('analyst')
export class AnalystController {
  constructor(private readonly analyst: AnalystService) {}

  @Get('stats')
  stats() {
    return this.analyst.stats();
  }

  @Get('feed')
  feed(@Query('limit') limit?: string) {
    return this.analyst.feed(limit ? Number(limit) : 30);
  }

  @Get('cases')
  cases() {
    return this.analyst.cases();
  }
}
