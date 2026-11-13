import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { PhoneNumberEntity } from './phone-number.entity';
import { CallSessionEntity } from './call-session.entity';
import { TelephonyController } from './telephony.controller';
import { TelephonyService } from './telephony.service';
import { TelephonyBridgeService } from './telephony-bridge.service';
import { TwilioService } from './twilio.service';
import { AgentsModule } from '../agents/agents.module';
import { DomainModule } from '../domains/domain.module';
import { EscalationsModule } from '../escalations/escalations.module';
import { RealtimeModule } from '../realtime/realtime.module';
import { HospitalModule } from '../hospital/hospital.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([PhoneNumberEntity, CallSessionEntity]),
    AgentsModule,
    DomainModule,
    EscalationsModule,
    RealtimeModule,
    HospitalModule,
  ],
  controllers: [TelephonyController],
  providers: [TelephonyService, TelephonyBridgeService, TwilioService],
  exports: [TelephonyService, TelephonyBridgeService, TwilioService],
})
export class TelephonyModule {}
