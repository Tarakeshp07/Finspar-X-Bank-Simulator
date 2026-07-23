import { Module } from '@nestjs/common';
import { AnalystService } from './analyst.service';
import { AnalystController } from './analyst.controller';

@Module({
  controllers: [AnalystController],
  providers: [AnalystService],
})
export class AnalystModule {}
