import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { DomainIntentEntity } from './domain-intent.entity';
import { DomainIntentsController } from './domain-intents.controller';
import { DomainIntentsService } from './domain-intents.service';

@Module({
  imports: [TypeOrmModule.forFeature([DomainIntentEntity])],
  controllers: [DomainIntentsController],
  providers: [DomainIntentsService],
  exports: [DomainIntentsService],
})
export class DomainIntentsModule {}
