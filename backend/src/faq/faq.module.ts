import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { FaqService } from './faq.service';
import { FaqController } from './faq.controller';
import { FaqNode } from './faq-node.entity';

@Module({
  imports: [TypeOrmModule.forFeature([FaqNode])],
  providers: [FaqService],
  controllers: [FaqController],
})
export class FaqModule {}
