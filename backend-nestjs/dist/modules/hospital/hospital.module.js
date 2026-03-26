"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.HospitalModule = void 0;
const common_1 = require("@nestjs/common");
const typeorm_1 = require("@nestjs/typeorm");
const department_entity_1 = require("./department.entity");
const doctor_entity_1 = require("./doctor.entity");
const doctor_schedule_entity_1 = require("./doctor-schedule.entity");
const patient_entity_1 = require("./patient.entity");
const appointment_entity_1 = require("./appointment.entity");
const billing_entity_1 = require("./billing.entity");
const lab_report_entity_1 = require("./lab-report.entity");
const hospital_controller_1 = require("./hospital.controller");
const hospital_service_1 = require("./hospital.service");
const domain_entity_1 = require("../domains/domain.entity");
const domain_intent_entity_1 = require("../domain-intents/domain-intent.entity");
const domain_rule_entity_1 = require("../domain-rules/domain-rule.entity");
const prompt_template_entity_1 = require("../prompt-templates/prompt-template.entity");
const tool_definition_entity_1 = require("../tool-definitions/tool-definition.entity");
let HospitalModule = class HospitalModule {
};
exports.HospitalModule = HospitalModule;
exports.HospitalModule = HospitalModule = __decorate([
    (0, common_1.Module)({
        imports: [
            typeorm_1.TypeOrmModule.forFeature([
                domain_entity_1.DomainEntity,
                domain_intent_entity_1.DomainIntentEntity,
                domain_rule_entity_1.DomainRuleEntity,
                prompt_template_entity_1.PromptTemplateEntity,
                tool_definition_entity_1.ToolDefinitionEntity,
                department_entity_1.DepartmentEntity,
                doctor_entity_1.DoctorEntity,
                doctor_schedule_entity_1.DoctorScheduleEntity,
                patient_entity_1.PatientEntity,
                appointment_entity_1.AppointmentEntity,
                billing_entity_1.BillingEntity,
                lab_report_entity_1.LabReportEntity,
            ]),
        ],
        controllers: [hospital_controller_1.HospitalController],
        providers: [hospital_service_1.HospitalService],
        exports: [hospital_service_1.HospitalService],
    })
], HospitalModule);
//# sourceMappingURL=hospital.module.js.map