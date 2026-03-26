import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { DepartmentEntity } from './department.entity';
import { DoctorEntity } from './doctor.entity';
import { DoctorScheduleEntity } from './doctor-schedule.entity';
import { PatientEntity } from './patient.entity';
import { AppointmentEntity } from './appointment.entity';
import { BillingEntity } from './billing.entity';
import { LabReportEntity } from './lab-report.entity';
import { HospitalController } from './hospital.controller';
import { HospitalService } from './hospital.service';
import { DomainEntity } from '../domains/domain.entity';
import { DomainIntentEntity } from '../domain-intents/domain-intent.entity';
import { DomainRuleEntity } from '../domain-rules/domain-rule.entity';
import { PromptTemplateEntity } from '../prompt-templates/prompt-template.entity';
import { ToolDefinitionEntity } from '../tool-definitions/tool-definition.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      DomainEntity,
      DomainIntentEntity,
      DomainRuleEntity,
      PromptTemplateEntity,
      ToolDefinitionEntity,
      DepartmentEntity,
      DoctorEntity,
      DoctorScheduleEntity,
      PatientEntity,
      AppointmentEntity,
      BillingEntity,
      LabReportEntity,
    ]),
  ],
  controllers: [HospitalController],
  providers: [HospitalService],
  exports: [HospitalService],
})
export class HospitalModule {}
