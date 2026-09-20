import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { DistanceModule } from '../distance/distance.module';
import { QuotesController } from './quotes.controller';
import { QuotesService } from './quotes.service';

@Module({
  imports: [ConfigModule, DistanceModule],
  controllers: [QuotesController],
  providers: [QuotesService],
})
export class QuotesModule {}
