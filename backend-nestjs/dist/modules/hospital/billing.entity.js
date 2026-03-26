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
exports.BillingEntity = void 0;
const typeorm_1 = require("typeorm");
let BillingEntity = class BillingEntity {
    billingId;
    patientId;
    appointmentId;
    invoiceNumber;
    totalAmount;
    paidAmount;
    billingStatus;
    dueDate;
    createdAt;
    updatedAt;
};
exports.BillingEntity = BillingEntity;
__decorate([
    (0, typeorm_1.PrimaryGeneratedColumn)('uuid', { name: 'BillingId' }),
    __metadata("design:type", String)
], BillingEntity.prototype, "billingId", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'PatientId', type: 'uniqueidentifier' }),
    __metadata("design:type", String)
], BillingEntity.prototype, "patientId", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'AppointmentId', type: 'uniqueidentifier', nullable: true }),
    __metadata("design:type", Object)
], BillingEntity.prototype, "appointmentId", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'InvoiceNumber', type: 'nvarchar', length: 40 }),
    __metadata("design:type", String)
], BillingEntity.prototype, "invoiceNumber", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'TotalAmount', type: 'decimal', precision: 12, scale: 2 }),
    __metadata("design:type", String)
], BillingEntity.prototype, "totalAmount", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'PaidAmount', type: 'decimal', precision: 12, scale: 2, default: 0 }),
    __metadata("design:type", String)
], BillingEntity.prototype, "paidAmount", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'BillingStatus', type: 'nvarchar', length: 40 }),
    __metadata("design:type", String)
], BillingEntity.prototype, "billingStatus", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'DueDate', type: 'date', nullable: true }),
    __metadata("design:type", Object)
], BillingEntity.prototype, "dueDate", void 0);
__decorate([
    (0, typeorm_1.CreateDateColumn)({ name: 'CreatedAt', type: 'datetime2' }),
    __metadata("design:type", Date)
], BillingEntity.prototype, "createdAt", void 0);
__decorate([
    (0, typeorm_1.UpdateDateColumn)({ name: 'UpdatedAt', type: 'datetime2' }),
    __metadata("design:type", Date)
], BillingEntity.prototype, "updatedAt", void 0);
exports.BillingEntity = BillingEntity = __decorate([
    (0, typeorm_1.Entity)({ name: 'Billing' })
], BillingEntity);
//# sourceMappingURL=billing.entity.js.map