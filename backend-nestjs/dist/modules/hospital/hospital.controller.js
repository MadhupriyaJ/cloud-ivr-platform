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
var __param = (this && this.__param) || function (paramIndex, decorator) {
    return function (target, key) { decorator(target, key, paramIndex); }
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.HospitalController = void 0;
const common_1 = require("@nestjs/common");
const hospital_service_1 = require("./hospital.service");
const create_patient_dto_1 = require("./dto/create-patient.dto");
const create_appointment_dto_1 = require("./dto/create-appointment.dto");
const reschedule_appointment_dto_1 = require("./dto/reschedule-appointment.dto");
const hospital_ivr_request_dto_1 = require("./dto/hospital-ivr-request.dto");
const bootstrap_hospital_dto_1 = require("./dto/bootstrap-hospital.dto");
let HospitalController = class HospitalController {
    hospitalService;
    constructor(hospitalService) {
        this.hospitalService = hospitalService;
    }
    async bootstrap(payload) {
        return this.hospitalService.bootstrap(payload);
    }
    async listDepartments() {
        return { items: await this.hospitalService.listDepartments() };
    }
    async listDoctors(departmentId) {
        return { items: await this.hospitalService.listDoctors(departmentId) };
    }
    async listAvailableDoctors(departmentId, date) {
        return { items: await this.hospitalService.listAvailableDoctors(departmentId, date) };
    }
    async getDoctorSlots(doctorId, date) {
        return { items: await this.hospitalService.getDoctorSlots(doctorId, date) };
    }
    async createPatient(payload) {
        return this.hospitalService.createPatient(payload);
    }
    async lookupPatient(patientCode, phoneNumber) {
        return this.hospitalService.lookupPatient(patientCode, phoneNumber);
    }
    async createAppointment(payload) {
        return this.hospitalService.createAppointment(payload);
    }
    async verifyAppointment(patientCode, phoneNumber) {
        return this.hospitalService.verifyAppointment(patientCode, phoneNumber);
    }
    async listAppointments(departmentId, date, status, patientCode, phoneNumber) {
        return {
            items: await this.hospitalService.listAppointments({
                departmentId,
                date,
                status,
                patientCode,
                phoneNumber,
            }),
        };
    }
    async rescheduleAppointment(appointmentId, payload) {
        return this.hospitalService.rescheduleAppointment(appointmentId, payload);
    }
    async cancelAppointment(appointmentId) {
        return this.hospitalService.cancelAppointment(appointmentId);
    }
    async getBilling(patientCode, phoneNumber) {
        return { items: await this.hospitalService.getBilling(patientCode, phoneNumber) };
    }
    async getLabReports(patientCode, phoneNumber) {
        return { items: await this.hospitalService.getLabReports(patientCode, phoneNumber) };
    }
    async runIvrStep(payload) {
        return this.hospitalService.runIvrStep(payload);
    }
};
exports.HospitalController = HospitalController;
__decorate([
    (0, common_1.Post)('bootstrap'),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [bootstrap_hospital_dto_1.BootstrapHospitalDto]),
    __metadata("design:returntype", Promise)
], HospitalController.prototype, "bootstrap", null);
__decorate([
    (0, common_1.Get)('departments'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", Promise)
], HospitalController.prototype, "listDepartments", null);
__decorate([
    (0, common_1.Get)('doctors'),
    __param(0, (0, common_1.Query)('departmentId')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", Promise)
], HospitalController.prototype, "listDoctors", null);
__decorate([
    (0, common_1.Get)('doctors/available'),
    __param(0, (0, common_1.Query)('departmentId')),
    __param(1, (0, common_1.Query)('date')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String]),
    __metadata("design:returntype", Promise)
], HospitalController.prototype, "listAvailableDoctors", null);
__decorate([
    (0, common_1.Get)('doctors/:doctorId/slots'),
    __param(0, (0, common_1.Param)('doctorId')),
    __param(1, (0, common_1.Query)('date')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String]),
    __metadata("design:returntype", Promise)
], HospitalController.prototype, "getDoctorSlots", null);
__decorate([
    (0, common_1.Post)('patients'),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [create_patient_dto_1.CreatePatientDto]),
    __metadata("design:returntype", Promise)
], HospitalController.prototype, "createPatient", null);
__decorate([
    (0, common_1.Get)('patients/lookup'),
    __param(0, (0, common_1.Query)('patientCode')),
    __param(1, (0, common_1.Query)('phone')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String]),
    __metadata("design:returntype", Promise)
], HospitalController.prototype, "lookupPatient", null);
__decorate([
    (0, common_1.Post)('appointments'),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [create_appointment_dto_1.CreateAppointmentDto]),
    __metadata("design:returntype", Promise)
], HospitalController.prototype, "createAppointment", null);
__decorate([
    (0, common_1.Get)('appointments/verify'),
    __param(0, (0, common_1.Query)('patientCode')),
    __param(1, (0, common_1.Query)('phone')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String]),
    __metadata("design:returntype", Promise)
], HospitalController.prototype, "verifyAppointment", null);
__decorate([
    (0, common_1.Get)('appointments'),
    __param(0, (0, common_1.Query)('departmentId')),
    __param(1, (0, common_1.Query)('date')),
    __param(2, (0, common_1.Query)('status')),
    __param(3, (0, common_1.Query)('patientCode')),
    __param(4, (0, common_1.Query)('phone')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String, String, String, String]),
    __metadata("design:returntype", Promise)
], HospitalController.prototype, "listAppointments", null);
__decorate([
    (0, common_1.Put)('appointments/:appointmentId/reschedule'),
    __param(0, (0, common_1.Param)('appointmentId')),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, reschedule_appointment_dto_1.RescheduleAppointmentDto]),
    __metadata("design:returntype", Promise)
], HospitalController.prototype, "rescheduleAppointment", null);
__decorate([
    (0, common_1.Put)('appointments/:appointmentId/cancel'),
    __param(0, (0, common_1.Param)('appointmentId')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", Promise)
], HospitalController.prototype, "cancelAppointment", null);
__decorate([
    (0, common_1.Get)('billing'),
    __param(0, (0, common_1.Query)('patientCode')),
    __param(1, (0, common_1.Query)('phone')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String]),
    __metadata("design:returntype", Promise)
], HospitalController.prototype, "getBilling", null);
__decorate([
    (0, common_1.Get)('lab-reports'),
    __param(0, (0, common_1.Query)('patientCode')),
    __param(1, (0, common_1.Query)('phone')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String]),
    __metadata("design:returntype", Promise)
], HospitalController.prototype, "getLabReports", null);
__decorate([
    (0, common_1.Post)('ivr/next'),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [hospital_ivr_request_dto_1.HospitalIvrRequestDto]),
    __metadata("design:returntype", Promise)
], HospitalController.prototype, "runIvrStep", null);
exports.HospitalController = HospitalController = __decorate([
    (0, common_1.Controller)('hospital'),
    __metadata("design:paramtypes", [hospital_service_1.HospitalService])
], HospitalController);
//# sourceMappingURL=hospital.controller.js.map