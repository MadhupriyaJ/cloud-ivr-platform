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
exports.DoctorScheduleEntity = void 0;
const typeorm_1 = require("typeorm");
let DoctorScheduleEntity = class DoctorScheduleEntity {
    scheduleId;
    doctorId;
    scheduleDate;
    startTime;
    endTime;
    maxSlots;
    availableSlots;
    status;
    createdAt;
    updatedAt;
};
exports.DoctorScheduleEntity = DoctorScheduleEntity;
__decorate([
    (0, typeorm_1.PrimaryGeneratedColumn)('uuid', { name: 'ScheduleId' }),
    __metadata("design:type", String)
], DoctorScheduleEntity.prototype, "scheduleId", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'DoctorId', type: 'uniqueidentifier' }),
    __metadata("design:type", String)
], DoctorScheduleEntity.prototype, "doctorId", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'ScheduleDate', type: 'date' }),
    __metadata("design:type", String)
], DoctorScheduleEntity.prototype, "scheduleDate", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'StartTime', type: 'time' }),
    __metadata("design:type", String)
], DoctorScheduleEntity.prototype, "startTime", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'EndTime', type: 'time' }),
    __metadata("design:type", String)
], DoctorScheduleEntity.prototype, "endTime", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'MaxSlots', type: 'int' }),
    __metadata("design:type", Number)
], DoctorScheduleEntity.prototype, "maxSlots", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'AvailableSlots', type: 'int' }),
    __metadata("design:type", Number)
], DoctorScheduleEntity.prototype, "availableSlots", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'Status', type: 'nvarchar', length: 40 }),
    __metadata("design:type", String)
], DoctorScheduleEntity.prototype, "status", void 0);
__decorate([
    (0, typeorm_1.CreateDateColumn)({ name: 'CreatedAt', type: 'datetime2' }),
    __metadata("design:type", Date)
], DoctorScheduleEntity.prototype, "createdAt", void 0);
__decorate([
    (0, typeorm_1.UpdateDateColumn)({ name: 'UpdatedAt', type: 'datetime2' }),
    __metadata("design:type", Date)
], DoctorScheduleEntity.prototype, "updatedAt", void 0);
exports.DoctorScheduleEntity = DoctorScheduleEntity = __decorate([
    (0, typeorm_1.Entity)({ name: 'DoctorSchedules' })
], DoctorScheduleEntity);
//# sourceMappingURL=doctor-schedule.entity.js.map