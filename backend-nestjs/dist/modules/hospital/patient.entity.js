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
exports.PatientEntity = void 0;
const typeorm_1 = require("typeorm");
let PatientEntity = class PatientEntity {
    patientId;
    patientCode;
    fullName;
    phoneNumber;
    email;
    dateOfBirth;
    gender;
    addressLine;
    emergencyContact;
    createdAt;
    updatedAt;
};
exports.PatientEntity = PatientEntity;
__decorate([
    (0, typeorm_1.PrimaryGeneratedColumn)('uuid', { name: 'PatientId' }),
    __metadata("design:type", String)
], PatientEntity.prototype, "patientId", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'PatientCode', type: 'nvarchar', length: 30 }),
    __metadata("design:type", String)
], PatientEntity.prototype, "patientCode", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'FullName', type: 'nvarchar', length: 120 }),
    __metadata("design:type", String)
], PatientEntity.prototype, "fullName", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'PhoneNumber', type: 'nvarchar', length: 30 }),
    __metadata("design:type", String)
], PatientEntity.prototype, "phoneNumber", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'Email', type: 'nvarchar', length: 180, nullable: true }),
    __metadata("design:type", Object)
], PatientEntity.prototype, "email", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'DateOfBirth', type: 'date', nullable: true }),
    __metadata("design:type", Object)
], PatientEntity.prototype, "dateOfBirth", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'Gender', type: 'nvarchar', length: 20, nullable: true }),
    __metadata("design:type", Object)
], PatientEntity.prototype, "gender", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'AddressLine', type: 'nvarchar', length: 255, nullable: true }),
    __metadata("design:type", Object)
], PatientEntity.prototype, "addressLine", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'EmergencyContact', type: 'nvarchar', length: 120, nullable: true }),
    __metadata("design:type", Object)
], PatientEntity.prototype, "emergencyContact", void 0);
__decorate([
    (0, typeorm_1.CreateDateColumn)({ name: 'CreatedAt', type: 'datetime2' }),
    __metadata("design:type", Date)
], PatientEntity.prototype, "createdAt", void 0);
__decorate([
    (0, typeorm_1.UpdateDateColumn)({ name: 'UpdatedAt', type: 'datetime2' }),
    __metadata("design:type", Date)
], PatientEntity.prototype, "updatedAt", void 0);
exports.PatientEntity = PatientEntity = __decorate([
    (0, typeorm_1.Entity)({ name: 'Patients' })
], PatientEntity);
//# sourceMappingURL=patient.entity.js.map