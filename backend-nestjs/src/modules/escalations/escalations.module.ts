import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { EscalationEntity } from './escalation.entity';
import { EscalationsController } from './escalations.controller';
import { EscalationsService } from './escalations.service';

@Module({
  imports: [TypeOrmModule.forFeature([EscalationEntity])],
  controllers: [EscalationsController],
  providers: [EscalationsService],
  exports: [EscalationsService],
})
export class EscalationsModule {}
