import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { DomainIntentsModule } from '../domain-intents/domain-intents.module';
import { DomainRulesModule } from '../domain-rules/domain-rules.module';
import { PromptTemplatesModule } from '../prompt-templates/prompt-templates.module';
import { DomainEntity } from './domain.entity';
import { DomainController } from './domain.controller';
import { DomainService } from './domain.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([DomainEntity]),
    DomainIntentsModule,
    DomainRulesModule,
    PromptTemplatesModule,
  ],
  controllers: [DomainController],
  providers: [DomainService],
  exports: [DomainService],
})
export class DomainModule {}
