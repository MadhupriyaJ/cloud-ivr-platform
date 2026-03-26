"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.AppointmentEntity = void 0;
const typeorm_1 = require("typeorm");
let AppointmentEntity = class AppointmentEntity {
    appointmentId;
    appointmentCode;
    patientId;
    doctorId;
    departmentId;
    appointmentDate;
    appointmentTime;
    reasonForVisit;
    appointmentStatus;
    bookedChannel;
    conversationId;
    createdAt;
    updatedAt;
};
exports.AppointmentEntity = AppointmentEntity;
__decorate([
    (0, typeorm_1.PrimaryGeneratedColumn)('uuid', { name: 'AppointmentId' }),
    __metadata("design:type", String)
], AppointmentEntity.prototype, "appointmentId", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'AppointmentCode', type: 'nvarchar', length: 30 }),
    __metadata("design:type", String)
], AppointmentEntity.prototype, "appointmentCode", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'PatientId', type: 'uniqueidentifier' }),
    __metadata("design:type", String)
], AppointmentEntity.prototype, "patientId", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'DoctorId', type: 'uniqueidentifier' }),
    __metadata("design:type", String)
], AppointmentEntity.prototype, "doctorId", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'DepartmentId', type: 'uniqueidentifier' }),
    __metadata("design:type", String)
], AppointmentEntity.prototype, "departmentId", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'AppointmentDate', type: 'date' }),
    __metadata("design:type", String)
], AppointmentEntity.prototype, "appointmentDate", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'AppointmentTime', type: 'time' }),
    __metadata("design:type", String)
], AppointmentEntity.prototype, "appointmentTime", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'ReasonForVisit', type: 'nvarchar', length: 500, nullable: true }),
    __metadata("design:type", Object)
], AppointmentEntity.prototype, "reasonForVisit", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'AppointmentStatus', type: 'nvarchar', length: 40 }),
    __metadata("design:type", String)
], AppointmentEntity.prototype, "appointmentStatus", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'BookedChannel', type: 'nvarchar', length: 40, default: 'ivr' }),
    __metadata("design:type", String)
], AppointmentEntity.prototype, "bookedChannel", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'ConversationId', type: 'uniqueidentifier', nullable: true }),
    __metadata("design:type", Object)
], AppointmentEntity.prototype, "conversationId", void 0);
__decorate([
    (0, typeorm_1.CreateDateColumn)({ name: 'CreatedAt', type: 'datetime2' }),
    __metadata("design:type", Date)
], AppointmentEntity.prototype, "createdAt", void 0);
__decorate([
    (0, typeorm_1.UpdateDateColumn)({ name: 'UpdatedAt', type: 'datetime2' }),
    __metadata("design:type", Date)
], AppointmentEntity.prototype, "updatedAt", void 0);
exports.AppointmentEntity = AppointmentEntity = __decorate([
    (0, typeorm_1.Entity)({ name: 'Appointments' })
], AppointmentEntity);
//# sourceMappingURL=appointment.entity.js.map