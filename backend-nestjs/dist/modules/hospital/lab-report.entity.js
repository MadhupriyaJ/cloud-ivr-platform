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
exports.LabReportEntity = void 0;
const typeorm_1 = require("typeorm");
let LabReportEntity = class LabReportEntity {
    labReportId;
    patientId;
    appointmentId;
    reportNumber;
    testName;
    reportStatus;
    resultSummary;
    reportDate;
    createdAt;
    updatedAt;
};
exports.LabReportEntity = LabReportEntity;
__decorate([
    (0, typeorm_1.PrimaryGeneratedColumn)('uuid', { name: 'LabReportId' }),
    __metadata("design:type", String)
], LabReportEntity.prototype, "labReportId", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'PatientId', type: 'uniqueidentifier' }),
    __metadata("design:type", String)
], LabReportEntity.prototype, "patientId", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'AppointmentId', type: 'uniqueidentifier', nullable: true }),
    __metadata("design:type", Object)
], LabReportEntity.prototype, "appointmentId", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'ReportNumber', type: 'nvarchar', length: 40 }),
    __metadata("design:type", String)
], LabReportEntity.prototype, "reportNumber", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'TestName', type: 'nvarchar', length: 120 }),
    __metadata("design:type", String)
], LabReportEntity.prototype, "testName", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'ReportStatus', type: 'nvarchar', length: 40 }),
    __metadata("design:type", String)
], LabReportEntity.prototype, "reportStatus", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'ResultSummary', type: 'nvarchar', length: 500, nullable: true }),
    __metadata("design:type", Object)
], LabReportEntity.prototype, "resultSummary", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'ReportDate', type: 'datetime2', nullable: true }),
    __metadata("design:type", Object)
], LabReportEntity.prototype, "reportDate", void 0);
__decorate([
    (0, typeorm_1.CreateDateColumn)({ name: 'CreatedAt', type: 'datetime2' }),
    __metadata("design:type", Date)
], LabReportEntity.prototype, "createdAt", void 0);
__decorate([
    (0, typeorm_1.UpdateDateColumn)({ name: 'UpdatedAt', type: 'datetime2' }),
    __metadata("design:type", Date)
], LabReportEntity.prototype, "updatedAt", void 0);
exports.LabReportEntity = LabReportEntity = __decorate([
    (0, typeorm_1.Entity)({ name: 'LabReports' })
], LabReportEntity);
//# sourceMappingURL=lab-report.entity.js.map