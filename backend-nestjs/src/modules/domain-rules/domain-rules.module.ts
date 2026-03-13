import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { DomainRuleEntity } from './domain-rule.entity';
import { DomainRulesController } from './domain-rules.controller';
import { DomainRulesService } from './domain-rules.service';

@Module({
  imports: [TypeOrmModule.forFeature([DomainRuleEntity])],
  controllers: [DomainRulesController],
  providers: [DomainRulesService],
  exports: [DomainRulesService],
})
export class DomainRulesModule {}
