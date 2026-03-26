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
exports.DoctorEntity = void 0;
const typeorm_1 = require("typeorm");
let DoctorEntity = class DoctorEntity {
    doctorId;
    domainId;
    departmentId;
    doctorCode;
    doctorName;
    qualification;
    specialization;
    availabilityStatus;
    consultationFee;
    isActive;
    createdAt;
    updatedAt;
};
exports.DoctorEntity = DoctorEntity;
__decorate([
    (0, typeorm_1.PrimaryGeneratedColumn)('uuid', { name: 'DoctorId' }),
    __metadata("design:type", String)
], DoctorEntity.prototype, "doctorId", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'DomainId', type: 'uniqueidentifier' }),
    __metadata("design:type", String)
], DoctorEntity.prototype, "domainId", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'DepartmentId', type: 'uniqueidentifier' }),
    __metadata("design:type", String)
], DoctorEntity.prototype, "departmentId", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'DoctorCode', type: 'nvarchar', length: 50 }),
    __metadata("design:type", String)
], DoctorEntity.prototype, "doctorCode", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'DoctorName', type: 'nvarchar', length: 120 }),
    __metadata("design:type", String)
], DoctorEntity.prototype, "doctorName", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'Qualification', type: 'nvarchar', length: 200, nullable: true }),
    __metadata("design:type", Object)
], DoctorEntity.prototype, "qualification", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'Specialization', type: 'nvarchar', length: 120, nullable: true }),
    __metadata("design:type", Object)
], DoctorEntity.prototype, "specialization", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'AvailabilityStatus', type: 'nvarchar', length: 40 }),
    __metadata("design:type", String)
], DoctorEntity.prototype, "availabilityStatus", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'ConsultationFee', type: 'decimal', precision: 12, scale: 2, nullable: true }),
    __metadata("design:type", Object)
], DoctorEntity.prototype, "consultationFee", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'IsActive', type: 'bit', default: true }),
    __metadata("design:type", Boolean)
], DoctorEntity.prototype, "isActive", void 0);
__decorate([
    (0, typeorm_1.CreateDateColumn)({ name: 'CreatedAt', type: 'datetime2' }),
    __metadata("design:type", Date)
], DoctorEntity.prototype, "createdAt", void 0);
__decorate([
    (0, typeorm_1.UpdateDateColumn)({ name: 'UpdatedAt', type: 'datetime2' }),
    __metadata("design:type", Date)
], DoctorEntity.prototype, "updatedAt", void 0);
exports.DoctorEntity = DoctorEntity = __decorate([
    (0, typeorm_1.Entity)({ name: 'Doctors' })
], DoctorEntity);
//# sourceMappingURL=doctor.entity.js.map