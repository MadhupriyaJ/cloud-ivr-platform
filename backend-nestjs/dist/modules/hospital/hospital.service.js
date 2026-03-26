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
var HospitalService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.HospitalService = void 0;
const common_1 = require("@nestjs/common");
const typeorm_1 = require("@nestjs/typeorm");
const typeorm_2 = require("typeorm");
const crypto_1 = require("crypto");
const department_entity_1 = require("./department.entity");
const doctor_entity_1 = require("./doctor.entity");
const doctor_schedule_entity_1 = require("./doctor-schedule.entity");
const patient_entity_1 = require("./patient.entity");
const appointment_entity_1 = require("./appointment.entity");
const billing_entity_1 = require("./billing.entity");
const lab_report_entity_1 = require("./lab-report.entity");
const domain_entity_1 = require("../domains/domain.entity");
const domain_intent_entity_1 = require("../domain-intents/domain-intent.entity");
const domain_rule_entity_1 = require("../domain-rules/domain-rule.entity");
const prompt_template_entity_1 = require("../prompt-templates/prompt-template.entity");
const tool_definition_entity_1 = require("../tool-definitions/tool-definition.entity");
let HospitalService = HospitalService_1 = class HospitalService {
    domainRepository;
    domainIntentRepository;
    domainRuleRepository;
    promptTemplateRepository;
    toolDefinitionRepository;
    departmentRepository;
    doctorRepository;
    scheduleRepository;
    patientRepository;
    appointmentRepository;
    billingRepository;
    labReportRepository;
    logger = new common_1.Logger(HospitalService_1.name);
    constructor(domainRepository, domainIntentRepository, domainRuleRepository, promptTemplateRepository, toolDefinitionRepository, departmentRepository, doctorRepository, scheduleRepository, patientRepository, appointmentRepository, billingRepository, labReportRepository) {
        this.domainRepository = domainRepository;
        this.domainIntentRepository = domainIntentRepository;
        this.domainRuleRepository = domainRuleRepository;
        this.promptTemplateRepository = promptTemplateRepository;
        this.toolDefinitionRepository = toolDefinitionRepository;
        this.departmentRepository = departmentRepository;
        this.doctorRepository = doctorRepository;
        this.scheduleRepository = scheduleRepository;
        this.patientRepository = patientRepository;
        this.appointmentRepository = appointmentRepository;
        this.billingRepository = billingRepository;
        this.labReportRepository = labReportRepository;
    }
    async bootstrap(payload) {
        const domainCode = payload.domainCode?.trim() || 'hospital';
        const displayName = payload.displayName?.trim() || 'Hospital IVR';
        const organizationName = payload.organizationName?.trim() || 'Meenakshi Mission Hospital';
        let domain = await this.domainRepository.findOne({
            where: { domainCode },
        });
        if (!domain) {
            domain = await this.domainRepository.save(this.domainRepository.create({
                domainCode,
                displayName,
                organizationName,
                industryType: 'healthcare',
                defaultLanguage: 'English',
                defaultVoice: 'alloy',
                welcomeMessage: `Welcome to ${organizationName}. Please tell me how I can help you today.`,
                fallbackMessage: 'I can help with appointments, billing, lab reports, and operator support.',
                escalationMessage: 'Connecting you to a hospital operator.',
                isActive: true,
            }));
        }
        await this.seedHospitalMetadata(domain.domainId, organizationName);
        const departments = await this.seedDepartments(domain.domainId);
        const doctors = await this.seedDoctors(domain.domainId, departments);
        const schedules = await this.seedSchedules(doctors);
        return {
            seeded: true,
            domainId: domain.domainId,
            domainCode: domain.domainCode,
            departmentsCreated: departments.length,
            doctorsCreated: doctors.length,
            schedulesCreated: schedules.length,
        };
    }
    async listDepartments() {
        return this.departmentRepository.find({
            where: { isActive: true },
            order: { departmentName: 'ASC' },
        });
    }
    async listDoctors(departmentId) {
        const query = this.doctorRepository
            .createQueryBuilder('doctor')
            .leftJoin(department_entity_1.DepartmentEntity, 'department', 'department.DepartmentId = doctor.DepartmentId')
            .select([
            'doctor.doctorId AS doctorId',
            'doctor.doctorCode AS doctorCode',
            'doctor.doctorName AS doctorName',
            'doctor.specialization AS specialization',
            'doctor.availabilityStatus AS availabilityStatus',
            'doctor.consultationFee AS consultationFee',
            'department.departmentId AS departmentId',
            'department.departmentName AS departmentName',
        ])
            .where('doctor.IsActive = :isActive', { isActive: true });
        if (departmentId) {
            query.andWhere('doctor.DepartmentId = :departmentId', { departmentId });
        }
        return query.orderBy('doctor.DoctorName', 'ASC').getRawMany();
    }
    async listAvailableDoctors(departmentId, date) {
        await this.ensureSchedulesForActiveDoctors(departmentId);
        const query = this.doctorRepository
            .createQueryBuilder('doctor')
            .innerJoin(doctor_schedule_entity_1.DoctorScheduleEntity, 'schedule', 'schedule.DoctorId = doctor.DoctorId')
            .innerJoin(department_entity_1.DepartmentEntity, 'department', 'department.DepartmentId = doctor.DepartmentId')
            .select([
            'doctor.doctorId AS doctorId',
            'doctor.doctorName AS doctorName',
            'doctor.specialization AS specialization',
            'doctor.availabilityStatus AS availabilityStatus',
            'department.departmentId AS departmentId',
            'department.departmentName AS departmentName',
            'schedule.scheduleId AS scheduleId',
            'schedule.scheduleDate AS scheduleDate',
            'schedule.startTime AS startTime',
            'schedule.endTime AS endTime',
            'schedule.availableSlots AS availableSlots',
        ])
            .where('doctor.IsActive = :isActive', { isActive: true })
            .andWhere('doctor.AvailabilityStatus = :availabilityStatus', { availabilityStatus: 'available' })
            .andWhere('schedule.AvailableSlots > 0');
        if (departmentId) {
            query.andWhere('doctor.DepartmentId = :departmentId', { departmentId });
        }
        if (date) {
            query.andWhere('schedule.ScheduleDate = :date', { date });
        }
        return query
            .orderBy('department.DepartmentName', 'ASC')
            .addOrderBy('doctor.DoctorName', 'ASC')
            .addOrderBy('schedule.ScheduleDate', 'ASC')
            .addOrderBy('schedule.StartTime', 'ASC')
            .getRawMany();
    }
    async getDoctorSlots(doctorId, date) {
        await this.ensureSchedulesForDoctor(doctorId);
        const where = date ? { doctorId, scheduleDate: date } : { doctorId };
        return this.scheduleRepository.find({
            where,
            order: { scheduleDate: 'ASC', startTime: 'ASC' },
        });
    }
    async createPatient(payload) {
        const sanitizedName = this.cleanPatientName(payload.fullName);
        const existing = await this.patientRepository.findOne({
            where: { phoneNumber: payload.phoneNumber },
            order: { createdAt: 'DESC' },
        });
        if (existing) {
            const nextPayload = {
                ...payload,
            };
            if (sanitizedName && this.shouldReplacePatientName(existing.fullName, sanitizedName)) {
                nextPayload.fullName = sanitizedName;
            }
            else {
                delete nextPayload.fullName;
            }
            const merged = this.patientRepository.merge(existing, nextPayload);
            return this.patientRepository.save(merged);
        }
        const entity = this.patientRepository.create({
            ...payload,
            fullName: sanitizedName || payload.fullName,
            patientCode: this.buildCode('PAT'),
        });
        return this.patientRepository.save(entity);
    }
    async lookupPatient(patientCode, phoneNumber) {
        if (!patientCode && !phoneNumber) {
            return null;
        }
        const query = this.patientRepository.createQueryBuilder('patient');
        if (patientCode) {
            query.orWhere('patient.PatientCode = :patientCode', { patientCode });
        }
        if (phoneNumber) {
            query.orWhere('patient.PhoneNumber = :phoneNumber', { phoneNumber });
        }
        return query.orderBy('patient.CreatedAt', 'DESC').getOne();
    }
    async createAppointment(payload) {
        const appointmentTime = this.normalizeTime(payload.appointmentTime);
        let patient = payload.patientId
            ? await this.patientRepository.findOne({ where: { patientId: payload.patientId } })
            : null;
        if (!patient && (payload.patientCode || payload.phoneNumber)) {
            patient = await this.lookupPatient(payload.patientCode, payload.phoneNumber);
        }
        if (!patient) {
            if (!payload.patientName || !payload.phoneNumber) {
                throw new common_1.NotFoundException('Patient not found. Provide patientId, patientCode, or patientName with phoneNumber.');
            }
            patient = await this.createPatient({
                fullName: payload.patientName,
                phoneNumber: payload.phoneNumber,
            });
        }
        else if (payload.patientName) {
            const sanitizedName = this.cleanPatientName(payload.patientName);
            if (sanitizedName && this.shouldReplacePatientName(patient.fullName, sanitizedName)) {
                patient.fullName = sanitizedName;
                patient = await this.patientRepository.save(patient);
            }
        }
        const existingAppointment = await this.findActiveAppointmentForPatient(patient.patientId);
        if (existingAppointment) {
            throw new common_1.ConflictException(`An active appointment already exists for this patient with ${existingAppointment.doctorName} on ${existingAppointment.appointmentDate} at ${existingAppointment.appointmentTime}.`);
        }
        const doctor = await this.doctorRepository.findOne({ where: { doctorId: payload.doctorId } });
        if (!doctor) {
            throw new common_1.NotFoundException(`Doctor '${payload.doctorId}' not found.`);
        }
        const schedule = await this.findScheduleByDoctorDateTime(payload.doctorId, payload.appointmentDate, appointmentTime);
        if (!schedule || schedule.availableSlots <= 0) {
            throw new common_1.NotFoundException('No available slot found for the requested doctor, date, and time.');
        }
        schedule.availableSlots -= 1;
        await this.scheduleRepository.save(schedule);
        const appointment = this.appointmentRepository.create({
            appointmentCode: this.buildCode('APT'),
            patientId: patient.patientId,
            doctorId: payload.doctorId,
            departmentId: payload.departmentId,
            appointmentDate: payload.appointmentDate,
            appointmentTime,
            reasonForVisit: payload.reasonForVisit ?? null,
            appointmentStatus: 'booked',
            bookedChannel: 'ivr',
            conversationId: payload.conversationId ?? null,
        });
        const saved = await this.appointmentRepository.save(appointment);
        return this.getAppointmentDetails(saved.appointmentId);
    }
    async verifyAppointment(patientCode, phoneNumber) {
        const patient = await this.lookupPatient(patientCode, phoneNumber);
        if (!patient) {
            return null;
        }
        const appointment = await this.appointmentRepository.findOne({
            where: { patientId: patient.patientId },
            order: { appointmentDate: 'DESC', appointmentTime: 'DESC' },
        });
        if (!appointment) {
            return null;
        }
        return this.getAppointmentDetails(appointment.appointmentId);
    }
    async listAppointments(filters) {
        const query = this.appointmentRepository
            .createQueryBuilder('appointment')
            .innerJoin(patient_entity_1.PatientEntity, 'patient', 'patient.PatientId = appointment.PatientId')
            .innerJoin(doctor_entity_1.DoctorEntity, 'doctor', 'doctor.DoctorId = appointment.DoctorId')
            .innerJoin(department_entity_1.DepartmentEntity, 'department', 'department.DepartmentId = appointment.DepartmentId')
            .select([
            'appointment.appointmentId AS appointmentId',
            'appointment.appointmentCode AS appointmentCode',
            'appointment.appointmentDate AS appointmentDate',
            'appointment.appointmentTime AS appointmentTime',
            'appointment.appointmentStatus AS appointmentStatus',
            'appointment.reasonForVisit AS reasonForVisit',
            'appointment.bookedChannel AS bookedChannel',
            'patient.patientId AS patientId',
            'patient.patientCode AS patientCode',
            'patient.fullName AS patientName',
            'patient.phoneNumber AS phoneNumber',
            'doctor.doctorId AS doctorId',
            'doctor.doctorName AS doctorName',
            'department.departmentId AS departmentId',
            'department.departmentName AS departmentName',
        ]);
        if (filters.departmentId) {
            query.andWhere('appointment.DepartmentId = :departmentId', {
                departmentId: filters.departmentId,
            });
        }
        if (filters.date) {
            query.andWhere('appointment.AppointmentDate = :date', { date: filters.date });
        }
        if (filters.status) {
            query.andWhere('appointment.AppointmentStatus = :status', { status: filters.status });
        }
        if (filters.patientCode) {
            query.andWhere('patient.PatientCode = :patientCode', { patientCode: filters.patientCode });
        }
        if (filters.phoneNumber) {
            query.andWhere('patient.PhoneNumber = :phoneNumber', { phoneNumber: filters.phoneNumber });
        }
        return query
            .orderBy('appointment.AppointmentDate', 'DESC')
            .addOrderBy('appointment.AppointmentTime', 'DESC')
            .getRawMany();
    }
    async rescheduleAppointment(appointmentId, payload) {
        const appointmentTime = this.normalizeTime(payload.appointmentTime);
        const appointment = await this.appointmentRepository.findOne({ where: { appointmentId } });
        if (!appointment) {
            throw new common_1.NotFoundException(`Appointment '${appointmentId}' not found.`);
        }
        const nextSchedule = await this.findScheduleByDoctorDateTime(appointment.doctorId, payload.appointmentDate, appointmentTime);
        if (!nextSchedule || nextSchedule.availableSlots <= 0) {
            throw new common_1.NotFoundException('Requested reschedule slot is unavailable.');
        }
        const previousSchedule = await this.findScheduleByDoctorDateTime(appointment.doctorId, appointment.appointmentDate, appointment.appointmentTime);
        if (previousSchedule) {
            previousSchedule.availableSlots += 1;
            await this.scheduleRepository.save(previousSchedule);
        }
        nextSchedule.availableSlots -= 1;
        await this.scheduleRepository.save(nextSchedule);
        appointment.appointmentDate = payload.appointmentDate;
        appointment.appointmentTime = appointmentTime;
        appointment.appointmentStatus = 'rescheduled';
        await this.appointmentRepository.save(appointment);
        return this.getAppointmentDetails(appointmentId);
    }
    async cancelAppointment(appointmentId) {
        const appointment = await this.appointmentRepository.findOne({ where: { appointmentId } });
        if (!appointment) {
            throw new common_1.NotFoundException(`Appointment '${appointmentId}' not found.`);
        }
        const schedule = await this.findScheduleByDoctorDateTime(appointment.doctorId, appointment.appointmentDate, appointment.appointmentTime);
        if (schedule) {
            schedule.availableSlots += 1;
            await this.scheduleRepository.save(schedule);
        }
        appointment.appointmentStatus = 'cancelled';
        await this.appointmentRepository.save(appointment);
        return this.getAppointmentDetails(appointmentId);
    }
    async getBilling(patientCode, phoneNumber) {
        const patient = await this.lookupPatient(patientCode, phoneNumber);
        if (!patient) {
            return [];
        }
        return this.billingRepository.find({
            where: { patientId: patient.patientId },
            order: { createdAt: 'DESC' },
        });
    }
    async getLabReports(patientCode, phoneNumber) {
        const patient = await this.lookupPatient(patientCode, phoneNumber);
        if (!patient) {
            return [];
        }
        return this.labReportRepository.find({
            where: { patientId: patient.patientId },
            order: { createdAt: 'DESC' },
        });
    }
    async runIvrStep(payload) {
        const step = (payload.step ?? 'entry').toLowerCase();
        const utterance = (payload.utterance ?? '').trim();
        const nextIntent = this.resolveIntent(payload.intent, utterance);
        const appointmentDate = this.resolveDate(payload.appointmentDate, utterance);
        const appointmentTime = this.resolveTime(payload.appointmentTime, utterance);
        const patientCode = payload.patientCode ?? this.extractPatientCode(utterance);
        const phoneNumber = payload.phoneNumber ?? this.extractPhoneNumber(utterance);
        const patientName = payload.patientName ??
            (step === 'book-capture-patient' ? this.extractPatientName(utterance) : undefined);
        const reasonForVisit = payload.reasonForVisit ?? (step === 'book-capture-reason' ? utterance : undefined);
        const unsupportedCount = payload.unsupportedCount ?? 0;
        if (step === 'entry' || step === 'choose-service') {
            if (this.isDoctorDirectoryRequest(utterance)) {
                const departmentId = await this.matchDepartmentId(utterance);
                const doctors = await this.listDoctors(departmentId);
                const directoryPrompt = this.buildDoctorDirectorySummary(doctors);
                return {
                    nextStep: 'choose-service',
                    prompt: directoryPrompt,
                    doctors,
                    state: {
                        intent: null,
                        unsupportedCount: 0,
                    },
                };
            }
            if (!nextIntent) {
                const nextUnsupportedCount = utterance ? unsupportedCount + 1 : unsupportedCount;
                return {
                    nextStep: 'choose-service',
                    prompt: await this.composeHospitalReply({
                        goal: 'Guide the caller back to the supported hospital IVR services.',
                        fallback: this.buildUnsupportedPrompt(utterance, nextUnsupportedCount),
                        utterance,
                        currentState: { step, unsupportedCount: nextUnsupportedCount },
                    }),
                    state: {
                        intent: null,
                        unsupportedCount: nextUnsupportedCount,
                    },
                };
            }
            if (nextIntent === 'book-appointment') {
                const departments = await this.listDepartments();
                return {
                    nextStep: 'book-choose-department',
                    prompt: await this.composeHospitalReply({
                        goal: 'Ask the caller which department they want for appointment booking.',
                        fallback: 'Please tell me the department name. For example cardiology, neurology, orthopedics, or pediatrics.',
                        utterance,
                        currentState: { step, intent: nextIntent },
                        options: { departments: departments.map((item) => item.departmentName) },
                    }),
                    state: {
                        intent: nextIntent,
                        appointmentDate,
                        appointmentTime,
                        patientCode,
                        phoneNumber,
                        patientName,
                        unsupportedCount: 0,
                    },
                    departments,
                };
            }
            return {
                nextStep: 'capture-patient-reference',
                prompt: await this.composeHospitalReply({
                    goal: `Ask for the patient reference needed to continue the ${nextIntent} request.`,
                    fallback: 'Please tell me your patient ID or phone number.',
                    utterance,
                    currentState: { step, intent: nextIntent },
                }),
                state: { intent: nextIntent, patientCode, phoneNumber, unsupportedCount: 0 },
            };
        }
        if (step === 'capture-patient-reference') {
            if (!patientCode && !phoneNumber) {
                return {
                    nextStep: 'capture-patient-reference',
                    prompt: await this.composeHospitalReply({
                        goal: 'Explain that patient ID or phone number is required before continuing.',
                        fallback: 'I need your patient ID or phone number to continue.',
                        utterance,
                        currentState: { step, intent: nextIntent },
                    }),
                    state: { intent: nextIntent, unsupportedCount: 0 },
                };
            }
            if (nextIntent === 'verify-appointment') {
                const appointment = await this.verifyAppointment(patientCode, phoneNumber);
                const verifyPrompt = appointment
                    ? `You already have an appointment booked. ${this.buildExistingAppointmentSummary(appointment)}`
                    : 'No appointment found for this patient reference.';
                return {
                    nextStep: appointment ? 'done' : 'not-found',
                    prompt: verifyPrompt,
                    appointment,
                    state: { intent: nextIntent, patientCode, phoneNumber, unsupportedCount: 0 },
                };
            }
            if (nextIntent === 'billing') {
                const rows = await this.getBilling(patientCode, phoneNumber);
                return {
                    nextStep: 'done',
                    prompt: await this.composeHospitalReply({
                        goal: rows.length
                            ? 'Read a short billing summary based on the latest billing records.'
                            : 'Explain politely that no billing records were found.',
                        fallback: rows.length
                            ? `I found ${rows.length} billing record${rows.length > 1 ? 's' : ''}. The latest invoice status is ${rows[0].billingStatus}.`
                            : 'No billing records were found for this patient reference.',
                        utterance,
                        currentState: { step, intent: nextIntent, patientCode, phoneNumber },
                        options: { billing: rows },
                    }),
                    billing: rows,
                    state: { intent: nextIntent, patientCode, phoneNumber, unsupportedCount: 0 },
                };
            }
            if (nextIntent === 'cancel') {
                const appointment = await this.verifyAppointment(patientCode, phoneNumber);
                if (!appointment) {
                    return {
                        nextStep: 'not-found',
                        prompt: await this.composeHospitalReply({
                            goal: 'Explain politely that there was no appointment to cancel.',
                            fallback: 'No appointment found for this patient reference, so nothing was cancelled.',
                            utterance,
                            currentState: { step, intent: nextIntent, patientCode, phoneNumber },
                        }),
                        state: { intent: nextIntent, patientCode, phoneNumber, unsupportedCount: 0 },
                    };
                }
                const cancelled = await this.cancelAppointment(appointment.appointmentId);
                return {
                    nextStep: 'done',
                    prompt: this.buildCancelledAppointmentSummary(cancelled),
                    appointment: cancelled,
                    state: { intent: nextIntent, patientCode, phoneNumber, unsupportedCount: 0 },
                };
            }
            if (nextIntent === 'lab-report') {
                const rows = await this.getLabReports(patientCode, phoneNumber);
                return {
                    nextStep: 'done',
                    prompt: await this.composeHospitalReply({
                        goal: rows.length
                            ? 'Read a short lab report summary based on the latest lab records.'
                            : 'Explain politely that no lab reports were found.',
                        fallback: rows.length
                            ? `I found ${rows.length} lab report${rows.length > 1 ? 's' : ''}. The latest report status is ${rows[0].reportStatus}.`
                            : 'No lab reports were found for this patient reference.',
                        utterance,
                        currentState: { step, intent: nextIntent, patientCode, phoneNumber },
                        options: { labReports: rows },
                    }),
                    labReports: rows,
                    state: { intent: nextIntent, patientCode, phoneNumber, unsupportedCount: 0 },
                };
            }
        }
        if (step === 'book-choose-department') {
            const departmentId = payload.departmentId ?? (await this.matchDepartmentId(utterance));
            const departments = await this.listDepartments();
            if (!departmentId) {
                return {
                    nextStep: 'book-choose-department',
                    prompt: await this.composeHospitalReply({
                        goal: 'Explain that the selected department was invalid and ask the caller to choose from the available departments.',
                        fallback: 'Please choose a valid department such as cardiology, neurology, orthopedics, or pediatrics.',
                        utterance,
                        currentState: { step, intent: 'book-appointment' },
                        options: { departments: departments.map((item) => item.departmentName) },
                    }),
                    departments,
                    state: {
                        intent: 'book-appointment',
                        appointmentDate,
                        appointmentTime,
                        patientCode,
                        phoneNumber,
                        patientName,
                        unsupportedCount: 0,
                    },
                };
            }
            const doctors = await this.listAvailableDoctors(departmentId, appointmentDate || this.currentLocalDate());
            return {
                nextStep: 'book-choose-doctor',
                prompt: await this.composeHospitalReply({
                    goal: doctors.length
                        ? 'Tell the caller the available doctors and ask them to choose one.'
                        : 'Explain that no doctors are available for the chosen department and date.',
                    fallback: doctors.length
                        ? 'Please choose a doctor from the available list.'
                        : 'No doctors are available in that department for the selected date.',
                    utterance,
                    currentState: { step, intent: 'book-appointment', departmentId },
                    options: { doctors: doctors.map((item) => item.doctorName) },
                }),
                doctors,
                state: {
                    intent: 'book-appointment',
                    departmentId,
                    appointmentDate: appointmentDate || this.currentLocalDate(),
                    appointmentTime,
                    patientCode,
                    phoneNumber,
                    patientName,
                    unsupportedCount: 0,
                },
            };
        }
        if (step === 'book-choose-doctor') {
            if (payload.departmentId && this.isDoctorListRequest(utterance)) {
                const doctors = await this.listAvailableDoctors(payload.departmentId, appointmentDate || this.currentLocalDate());
                const doctorNames = doctors.map((item) => item.doctorName).join(', ');
                return {
                    nextStep: 'book-choose-doctor',
                    prompt: await this.composeHospitalReply({
                        goal: doctors.length
                            ? 'Read the available doctor names and ask the caller to choose one.'
                            : 'Explain that no doctors are available for the chosen department and date.',
                        fallback: doctors.length
                            ? `Available doctors are ${doctorNames}. Please choose one doctor name.`
                            : 'No doctors are available in this department for the selected date.',
                        utterance,
                        currentState: { step, intent: 'book-appointment', departmentId: payload.departmentId },
                        options: { doctors: doctors.map((item) => item.doctorName) },
                    }),
                    doctors,
                    state: {
                        intent: 'book-appointment',
                        departmentId: payload.departmentId,
                        appointmentDate: appointmentDate || this.currentLocalDate(),
                        appointmentTime,
                        patientCode,
                        phoneNumber,
                        patientName,
                        unsupportedCount: 0,
                    },
                };
            }
            const doctorId = payload.doctorId ??
                (payload.departmentId
                    ? await this.matchDoctorId(payload.departmentId, utterance, appointmentDate || this.currentLocalDate())
                    : undefined);
            if (!doctorId || !payload.departmentId) {
                const doctors = payload.departmentId
                    ? await this.listAvailableDoctors(payload.departmentId, appointmentDate || this.currentLocalDate())
                    : [];
                return {
                    nextStep: 'book-choose-doctor',
                    prompt: await this.composeHospitalReply({
                        goal: 'Explain that the selected doctor was invalid and ask the caller to choose from the available doctors.',
                        fallback: 'Please choose a valid doctor.',
                        utterance,
                        currentState: { step, intent: 'book-appointment', departmentId: payload.departmentId },
                        options: { doctors: doctors.map((item) => item.doctorName) },
                    }),
                    doctors,
                    state: {
                        intent: 'book-appointment',
                        departmentId: payload.departmentId,
                        appointmentDate: appointmentDate || this.currentLocalDate(),
                        appointmentTime,
                        patientCode,
                        phoneNumber,
                        patientName,
                        unsupportedCount: 0,
                    },
                };
            }
            const slots = await this.getDoctorSlots(doctorId, appointmentDate || this.currentLocalDate());
            const openSlots = slots.filter((item) => item.availableSlots > 0);
            return {
                nextStep: 'book-choose-slot',
                prompt: await this.composeHospitalReply({
                    goal: openSlots.length
                        ? 'Tell the caller the available slot times and ask them to choose one.'
                        : 'Explain that no open slots are available for the selected doctor and date.',
                    fallback: openSlots.length
                        ? 'Please tell me the preferred slot. For example 09:00 or 10:00.'
                        : 'No open slots are available for that doctor on the selected date.',
                    utterance,
                    currentState: { step, intent: 'book-appointment', doctorId },
                    options: { slots: openSlots.map((item) => item.startTime) },
                }),
                slots: openSlots,
                state: {
                    intent: 'book-appointment',
                    departmentId: payload.departmentId,
                    doctorId,
                    appointmentDate: appointmentDate || this.currentLocalDate(),
                    appointmentTime,
                    patientCode,
                    phoneNumber,
                    patientName,
                    unsupportedCount: 0,
                },
            };
        }
        if (step === 'book-choose-slot') {
            if (!payload.doctorId || !payload.departmentId) {
                const departments = await this.listDepartments();
                return {
                    nextStep: 'book-choose-department',
                    prompt: await this.composeHospitalReply({
                        goal: 'Explain that booking context was lost and ask the caller to start again from department selection.',
                        fallback: 'Let us start again. Please choose the department first.',
                        utterance,
                        currentState: { step, intent: 'book-appointment' },
                        options: { departments: departments.map((item) => item.departmentName) },
                    }),
                    departments,
                    state: { intent: 'book-appointment' },
                };
            }
            if (!appointmentTime) {
                const openSlots = (await this.getDoctorSlots(payload.doctorId, appointmentDate || this.currentLocalDate())).filter((item) => item.availableSlots > 0);
                return {
                    nextStep: 'book-choose-slot',
                    prompt: await this.composeHospitalReply({
                        goal: 'Ask the caller to clearly choose one available time slot.',
                        fallback: 'Please tell me the slot time clearly. For example 09:00, 10:00, or 16:00.',
                        utterance,
                        currentState: { step, intent: 'book-appointment', doctorId: payload.doctorId },
                        options: { slots: openSlots.map((item) => item.startTime) },
                    }),
                    slots: openSlots,
                    state: {
                        intent: 'book-appointment',
                        departmentId: payload.departmentId,
                        doctorId: payload.doctorId,
                        appointmentDate: appointmentDate || this.currentLocalDate(),
                        patientCode,
                        phoneNumber,
                        patientName,
                        unsupportedCount: 0,
                    },
                };
            }
            return {
                nextStep: 'book-capture-patient',
                prompt: await this.composeHospitalReply({
                    goal: 'Ask for patient ID or phone number, and mention that new patients should also provide their name.',
                    fallback: 'Please tell me the patient ID or phone number. If this is a new patient, also share the patient name.',
                    utterance,
                    currentState: { step, intent: 'book-appointment' },
                }),
                state: {
                    intent: 'book-appointment',
                    departmentId: payload.departmentId,
                    doctorId: payload.doctorId,
                    appointmentDate: appointmentDate || this.currentLocalDate(),
                    appointmentTime,
                    patientCode,
                    phoneNumber,
                    patientName,
                    unsupportedCount: 0,
                },
            };
        }
        if (step === 'book-capture-patient') {
            const existingPatient = !patientCode && phoneNumber ? await this.lookupPatient(undefined, phoneNumber) : null;
            const needsNewPatientName = !patientCode && !existingPatient && !patientName;
            if ((!patientCode && !phoneNumber) || needsNewPatientName) {
                return {
                    nextStep: 'book-capture-patient',
                    prompt: await this.composeHospitalReply({
                        goal: 'Explain that patient ID or phone number is required, and new patients must also share their name.',
                        fallback: 'Please share patient ID or phone number. For new patients, also tell the patient name.',
                        utterance,
                        currentState: { step, intent: 'book-appointment' },
                    }),
                    state: {
                        intent: 'book-appointment',
                        departmentId: payload.departmentId,
                        doctorId: payload.doctorId,
                        appointmentDate,
                        appointmentTime,
                        patientCode,
                        phoneNumber,
                        patientName,
                        unsupportedCount: 0,
                    },
                };
            }
            return {
                nextStep: 'book-capture-reason',
                prompt: await this.composeHospitalReply({
                    goal: 'Ask the caller for the reason for visit in one short sentence.',
                    fallback: 'Please tell me the reason for visit.',
                    utterance,
                    currentState: { step, intent: 'book-appointment' },
                }),
                state: {
                    intent: 'book-appointment',
                    departmentId: payload.departmentId,
                    doctorId: payload.doctorId,
                    appointmentDate,
                    appointmentTime,
                    patientCode,
                    phoneNumber,
                    patientName,
                    unsupportedCount: 0,
                },
            };
        }
        if (step === 'book-capture-reason') {
            if (!payload.departmentId || !payload.doctorId || !appointmentDate || !appointmentTime) {
                const departments = await this.listDepartments();
                return {
                    nextStep: 'book-choose-department',
                    prompt: await this.composeHospitalReply({
                        goal: 'Explain that the booking details are incomplete and ask the caller to restart from department selection.',
                        fallback: 'Booking details are incomplete. Please start with the department.',
                        utterance,
                        currentState: { step, intent: 'book-appointment' },
                        options: { departments: departments.map((item) => item.departmentName) },
                    }),
                    departments,
                    state: { intent: 'book-appointment' },
                };
            }
            if (this.isLikelyPatientNameUtterance(utterance, patientName)) {
                return {
                    nextStep: 'book-capture-reason',
                    prompt: 'Please tell me only the reason for visit, for example fever, chest pain, follow up, or general checkup.',
                    state: {
                        intent: 'book-appointment',
                        departmentId: payload.departmentId,
                        doctorId: payload.doctorId,
                        appointmentDate,
                        appointmentTime,
                        patientCode,
                        phoneNumber,
                        patientName,
                        unsupportedCount: 0,
                    },
                };
            }
            const confirmedReason = reasonForVisit || 'General consultation';
            const existingPatient = patientCode || phoneNumber
                ? await this.lookupPatient(patientCode, phoneNumber)
                : null;
            if (existingPatient) {
                if (patientName && this.shouldReplacePatientName(existingPatient.fullName, patientName)) {
                    existingPatient.fullName = patientName;
                    await this.patientRepository.save(existingPatient);
                }
                const existingAppointment = await this.findActiveAppointmentForPatient(existingPatient.patientId);
                if (existingAppointment) {
                    const correctedAppointment = patientName
                        ? { ...existingAppointment, patientName }
                        : existingAppointment;
                    const existingSummary = this.buildExistingAppointmentSummary(correctedAppointment);
                    return {
                        nextStep: 'done',
                        prompt: `You already have an appointment booked. ${existingSummary}`,
                        appointment: correctedAppointment,
                        state: {
                            intent: 'book-appointment',
                            departmentId: payload.departmentId,
                            doctorId: payload.doctorId,
                            appointmentDate,
                            appointmentTime,
                            patientCode: correctedAppointment.patientCode,
                            phoneNumber: correctedAppointment.phoneNumber,
                            patientName: correctedAppointment.patientName,
                            reasonForVisit: correctedAppointment.reasonForVisit || confirmedReason,
                            unsupportedCount: 0,
                        },
                    };
                }
            }
            const appointment = await this.createAppointment({
                patientCode,
                phoneNumber,
                patientName,
                doctorId: payload.doctorId,
                departmentId: payload.departmentId,
                appointmentDate,
                appointmentTime,
                reasonForVisit: confirmedReason,
            });
            const confirmationText = this.buildAppointmentConfirmation(appointment);
            return {
                nextStep: 'done',
                prompt: confirmationText,
                appointment,
                state: {
                    intent: 'book-appointment',
                    departmentId: payload.departmentId,
                    doctorId: payload.doctorId,
                    appointmentDate,
                    appointmentTime,
                    patientCode: appointment.patientCode,
                    phoneNumber: appointment.phoneNumber,
                    patientName: appointment.patientName,
                    reasonForVisit: confirmedReason,
                    unsupportedCount: 0,
                },
            };
        }
        return {
            nextStep: 'choose-service',
            prompt: await this.composeHospitalReply({
                goal: 'Bring the caller back to the supported hospital IVR services.',
                fallback: 'Please say booking, verify appointment, billing, lab report, or cancel appointment.',
                utterance,
                currentState: { step, intent: nextIntent },
            }),
            state: { intent: nextIntent, patientCode, phoneNumber, patientName, appointmentDate, appointmentTime, unsupportedCount: 0 },
        };
    }
    async getAppointmentDetails(appointmentId) {
        const result = await this.appointmentRepository
            .createQueryBuilder('appointment')
            .innerJoin(patient_entity_1.PatientEntity, 'patient', 'patient.PatientId = appointment.PatientId')
            .innerJoin(doctor_entity_1.DoctorEntity, 'doctor', 'doctor.DoctorId = appointment.DoctorId')
            .innerJoin(department_entity_1.DepartmentEntity, 'department', 'department.DepartmentId = appointment.DepartmentId')
            .select([
            'appointment.appointmentId AS appointmentId',
            'appointment.appointmentCode AS appointmentCode',
            'appointment.appointmentDate AS appointmentDate',
            'appointment.appointmentTime AS appointmentTime',
            'appointment.appointmentStatus AS appointmentStatus',
            'appointment.reasonForVisit AS reasonForVisit',
            'appointment.bookedChannel AS bookedChannel',
            'patient.patientId AS patientId',
            'patient.patientCode AS patientCode',
            'patient.fullName AS patientName',
            'patient.phoneNumber AS phoneNumber',
            'doctor.doctorId AS doctorId',
            'doctor.doctorName AS doctorName',
            'department.departmentId AS departmentId',
            'department.departmentName AS departmentName',
        ])
            .where('appointment.AppointmentId = :appointmentId', { appointmentId })
            .getRawOne();
        if (!result) {
            throw new common_1.NotFoundException(`Appointment '${appointmentId}' not found.`);
        }
        return result;
    }
    buildCode(prefix) {
        const stamp = new Date().toISOString().replace(/[-:TZ.]/g, '').slice(0, 14);
        const suffix = (0, crypto_1.randomUUID)().replace(/-/g, '').slice(0, 6).toUpperCase();
        return `${prefix}-${stamp}-${suffix}`;
    }
    resolveIntent(currentIntent, utterance) {
        const text = (utterance ?? '').toLowerCase();
        if (!text) {
            return currentIntent?.trim() ? currentIntent.trim().toLowerCase() : undefined;
        }
        if (text.includes('cancel') ||
            text.includes('stop appointment') ||
            text.includes('remove appointment') ||
            text.includes('rathu') ||
            text.includes('cancel pannu')) {
            return 'cancel';
        }
        if (text.includes('bill'))
            return 'billing';
        if (text.includes('lab') || text.includes('report'))
            return 'lab-report';
        if (text.includes('verify') ||
            text.includes('already booked') ||
            text.includes('existing appointment') ||
            text.includes('check appointment') ||
            text.includes('iruka')) {
            return 'verify-appointment';
        }
        if (text.includes('book') ||
            text.includes('appointment') ||
            text.includes('reserve') ||
            text.includes('booking pannu')) {
            return 'book-appointment';
        }
        return currentIntent?.trim() ? currentIntent.trim().toLowerCase() : undefined;
    }
    isDoctorListRequest(utterance) {
        const text = (utterance ?? '').toLowerCase();
        if (!text)
            return false;
        return ((text.includes('doctor') && text.includes('available')) ||
            text.includes('doctor list') ||
            text.includes('available doctor') ||
            text.includes('which doctor') ||
            text.includes('who is available') ||
            text.includes('doctor peru') ||
            text.includes('doctor name') ||
            text.includes('yaaru available'));
    }
    isDoctorDirectoryRequest(utterance) {
        const text = (utterance ?? '').toLowerCase();
        if (!text)
            return false;
        return ((text.includes('doctor') && text.includes('department')) ||
            (text.includes('department') && text.includes('available')) ||
            (text.includes('which doctor') && text.includes('department')) ||
            text.includes('doctor list') ||
            text.includes('doctors list') ||
            text.includes('entha department') ||
            text.includes('endha department') ||
            text.includes('yaaru irukanga') ||
            text.includes('yaar irukanga') ||
            text.includes('doctor peru') ||
            text.includes('doctors irukanga'));
    }
    buildUnsupportedPrompt(utterance, unsupportedCount = 0) {
        const text = (utterance ?? '').trim().toLowerCase();
        if (!text) {
            return 'Welcome to hospital services. Say booking, verify appointment, doctor directory, billing, lab report, or cancel appointment.';
        }
        if (text.includes('hello') || text.includes('hi') || text.includes('vanakkam')) {
            return 'Hello. I can help you with appointment booking, appointment verification, doctor directory, billing details, lab reports, or cancellation.';
        }
        if (text.includes('doctor available') || text.includes('available doctor')) {
            return 'I can tell you the doctor directory or help you book an appointment. Say doctor directory, or say booking appointment to continue.';
        }
        if (text.includes('emergency') || text.includes('ambulance')) {
            return 'For emergency support, please contact the hospital emergency desk immediately. I can still help you with booking, verification, billing, lab reports, or cancellation.';
        }
        if (unsupportedCount >= 2) {
            return 'I may not support that request directly right now. I can still help with booking, appointment verification, doctor directory, billing details, lab reports, or cancellation. If you need something else, please connect with a hospital operator.';
        }
        return 'I understood your question, but this IVR currently handles booking, appointment verification, doctor directory, billing details, lab reports, and cancellation. Please tell me which of these you need.';
    }
    async composeHospitalReply(input) {
        const endpoint = (process.env.AZURE_OPENAI_ENDPOINT || '').trim().replace(/\/+$/, '');
        const deployment = (process.env.AZURE_OPENAI_ORCHESTRATION_DEPLOYMENT ||
            process.env.AZURE_OPENAI_DEPLOYMENT ||
            '').trim();
        const apiKey = (process.env.AZURE_OPENAI_API_KEY || '').trim();
        const apiVersion = (process.env.AZURE_OPENAI_ORCHESTRATION_API_VERSION ||
            process.env.AZURE_OPENAI_API_VERSION ||
            '2024-10-01-preview').trim();
        if (!endpoint || !deployment || !apiKey) {
            this.logger.warn('Hospital AI reply fallback used because Azure OpenAI orchestration config is incomplete.');
            return input.fallback;
        }
        try {
            const systemPrompt = await this.getHospitalAiSystemPrompt();
            const response = await fetch(`${endpoint}/openai/deployments/${deployment}/chat/completions?api-version=${apiVersion}`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'api-key': apiKey,
                },
                body: JSON.stringify({
                    messages: [
                        {
                            role: 'system',
                            content: systemPrompt,
                        },
                        {
                            role: 'user',
                            content: JSON.stringify({
                                task: input.goal,
                                callerUtterance: input.utterance || '',
                                currentState: input.currentState || {},
                                options: input.options || {},
                                fallback: input.fallback,
                            }),
                        },
                    ],
                    temperature: 0.2,
                    max_tokens: 120,
                }),
            });
            if (!response.ok) {
                const errorText = await response.text();
                this.logger.warn(`Hospital AI reply fallback used because Azure OpenAI returned ${response.status}: ${errorText.slice(0, 300)}`);
                return input.fallback;
            }
            const payload = (await response.json());
            const content = payload.choices?.[0]?.message?.content?.trim();
            return content || input.fallback;
        }
        catch (error) {
            this.logger.warn(`Hospital AI reply fallback used because Azure OpenAI request failed: ${error instanceof Error ? error.message : String(error)}`);
            return input.fallback;
        }
    }
    async getHospitalAiSystemPrompt() {
        const domain = await this.domainRepository.findOne({ where: { domainCode: 'hospital' } });
        const activeSystemPrompt = domain
            ? await this.promptTemplateRepository.findOne({
                where: {
                    domainId: domain.domainId,
                    promptType: 'system',
                    isActive: true,
                },
            })
            : null;
        return (activeSystemPrompt?.templateText?.trim() ||
            'You are a hospital IVR voice assistant. Reply naturally, clearly, and briefly. Ask only one question at a time. Never invent doctors, slots, billing data, lab data, or patient details. Use only the provided context and options.');
    }
    extractPatientCode(text) {
        const match = (text ?? '').match(/PAT[-\w]+/i);
        return match?.[0];
    }
    extractPhoneNumber(text) {
        const digits = (text ?? '').replace(/\D/g, '');
        return digits.length >= 10 ? digits.slice(-10) : undefined;
    }
    extractPatientName(text) {
        const value = (text ?? '').trim();
        if (!value)
            return undefined;
        const lowerValue = value.toLowerCase();
        if (lowerValue.includes('cardio') ||
            lowerValue.includes('neurology') ||
            lowerValue.includes('ortho') ||
            lowerValue.includes('pediatrics')) {
            return undefined;
        }
        const explicitPatterns = [
            /(?:patient name is|my name is|name is|this is|i am|i'm)\s+([a-z][a-z\s.'-]{1,80})/i,
            /(?:new patient(?: name)?|patient)\s+([a-z][a-z\s.'-]{1,80})/i,
        ];
        for (const pattern of explicitPatterns) {
            const match = value.match(pattern);
            const extracted = this.cleanPatientName(match?.[1]);
            if (extracted) {
                return extracted;
            }
        }
        return this.cleanPatientName(value);
    }
    isLikelyPatientNameUtterance(text, knownPatientName) {
        const value = (text ?? '').trim();
        if (!value) {
            return false;
        }
        const extracted = this.extractPatientName(value);
        if (!extracted) {
            return false;
        }
        const normalizedValue = value.toLowerCase().replace(/[^a-z\s]/g, ' ').replace(/\s+/g, ' ').trim();
        const normalizedExtracted = extracted.toLowerCase().replace(/\s+/g, ' ').trim();
        const normalizedKnownName = (knownPatientName ?? '')
            .toLowerCase()
            .replace(/[^a-z\s]/g, ' ')
            .replace(/\s+/g, ' ')
            .trim();
        return (normalizedValue === normalizedExtracted ||
            normalizedValue === `name ${normalizedExtracted}` ||
            normalizedValue === `my name is ${normalizedExtracted}` ||
            normalizedValue === `patient name is ${normalizedExtracted}` ||
            (!!normalizedKnownName && normalizedValue === normalizedKnownName));
    }
    cleanPatientName(value) {
        if (!value)
            return undefined;
        const fillerWords = new Set([
            'a',
            'am',
            'appointment',
            'book',
            'booking',
            'call',
            'for',
            'hello',
            'hey',
            'hi',
            'i',
            'id',
            'is',
            'me',
            'mobile',
            'my',
            'name',
            'new',
            'number',
            'patient',
            'phone',
            'please',
            'slot',
            'ocean',
            'this',
            'to',
            'vanakkam',
            'want',
        ]);
        const sanitized = value
            .replace(/PAT[-\w]+/gi, ' ')
            .replace(/\d+/g, ' ')
            .replace(/[^a-zA-Z\s.'-]/g, ' ')
            .replace(/\s+/g, ' ')
            .trim();
        if (!sanitized) {
            return undefined;
        }
        const tokens = sanitized
            .split(' ')
            .map((token) => token.trim())
            .filter(Boolean);
        while (tokens.length && fillerWords.has(tokens[0].toLowerCase())) {
            tokens.shift();
        }
        while (tokens.length && fillerWords.has(tokens[tokens.length - 1].toLowerCase())) {
            tokens.pop();
        }
        if (!tokens.length) {
            return undefined;
        }
        const candidate = tokens.join(' ').trim();
        if (!candidate || candidate.length < 2) {
            return undefined;
        }
        const lowerCandidate = candidate.toLowerCase();
        if (fillerWords.has(lowerCandidate)) {
            return undefined;
        }
        return candidate.length <= 120 ? candidate : candidate.slice(0, 120);
    }
    shouldReplacePatientName(currentName, nextName) {
        const current = this.cleanPatientName(currentName ?? undefined);
        const next = this.cleanPatientName(nextName ?? undefined);
        if (!next) {
            return false;
        }
        if (!current) {
            return true;
        }
        if (this.isWeakPatientName(current) && !this.isWeakPatientName(next)) {
            return true;
        }
        return current.toLowerCase() !== next.toLowerCase() && next.length > current.length;
    }
    isWeakPatientName(value) {
        const normalized = value.toLowerCase().trim();
        return ['hello', 'hey', 'hi', 'name', 'patient', 'unknown'].includes(normalized);
    }
    buildAppointmentConfirmation(appointment) {
        const patientName = this.cleanPatientName(appointment.patientName) || appointment.patientName || 'Unknown patient';
        const reasonForVisit = appointment.reasonForVisit || 'General consultation';
        const doctorName = appointment.doctorName || 'Unknown doctor';
        const departmentName = appointment.departmentName || 'Unknown department';
        const appointmentDate = this.formatDateForSpeech(appointment.appointmentDate);
        const appointmentTime = this.formatTimeForSpeech(appointment.appointmentTime);
        const phoneNumber = appointment.phoneNumber || 'Not available';
        const patientCode = appointment.patientCode || 'Not available';
        const appointmentCode = appointment.appointmentCode || 'Not available';
        return `Appointment booked successfully. Patient name ${patientName}. Reason for visit ${reasonForVisit}. Doctor ${doctorName}, ${departmentName} department. Date ${appointmentDate}. Slot ${appointmentTime}. Phone number ${phoneNumber}. Patient ID ${patientCode}. Appointment ID ${appointmentCode}.`;
    }
    buildExistingAppointmentSummary(appointment) {
        const patientName = this.cleanPatientName(appointment.patientName) || appointment.patientName || 'Unknown patient';
        const doctorName = appointment.doctorName || 'Unknown doctor';
        const departmentName = appointment.departmentName || 'Unknown department';
        const appointmentDate = this.formatDateForSpeech(appointment.appointmentDate);
        const appointmentTime = this.formatTimeForSpeech(appointment.appointmentTime);
        const patientCode = appointment.patientCode || 'Not available';
        const appointmentCode = appointment.appointmentCode || 'Not available';
        return `Patient name ${patientName}. Doctor ${doctorName}, ${departmentName} department. Date ${appointmentDate}. Slot ${appointmentTime}. Patient ID ${patientCode}. Appointment ID ${appointmentCode}.`;
    }
    buildCancelledAppointmentSummary(appointment) {
        const doctorName = appointment.doctorName || 'Unknown doctor';
        const departmentName = appointment.departmentName || 'Unknown department';
        const appointmentDate = this.formatDateForSpeech(appointment.appointmentDate);
        const appointmentTime = this.formatTimeForSpeech(appointment.appointmentTime);
        return `Your appointment with ${doctorName}, ${departmentName} department, on ${appointmentDate} at ${appointmentTime} has been cancelled.`;
    }
    buildDoctorDirectorySummary(doctors) {
        if (!doctors.length) {
            return 'No doctors were found in the backend directory for that request right now.';
        }
        const grouped = new Map();
        for (const doctor of doctors) {
            const departmentName = String(doctor.departmentName || 'General');
            const doctorName = String(doctor.doctorName || '').trim();
            if (!doctorName)
                continue;
            const list = grouped.get(departmentName) || [];
            list.push(doctorName);
            grouped.set(departmentName, list);
        }
        const summary = Array.from(grouped.entries())
            .map(([departmentName, names]) => `${departmentName}: ${names.join(', ')}`)
            .join('. ');
        return `Current backend doctor directory is ${summary}.`;
    }
    async findActiveAppointmentForPatient(patientId) {
        const appointment = await this.appointmentRepository
            .createQueryBuilder('appointment')
            .where('appointment.PatientId = :patientId', { patientId })
            .andWhere('appointment.AppointmentStatus IN (:...statuses)', {
            statuses: ['booked', 'rescheduled'],
        })
            .andWhere('appointment.AppointmentDate >= :today', { today: this.currentLocalDate() })
            .orderBy('appointment.AppointmentDate', 'DESC')
            .addOrderBy('appointment.AppointmentTime', 'DESC')
            .getOne();
        if (!appointment) {
            return null;
        }
        return this.getAppointmentDetails(appointment.appointmentId);
    }
    formatDateForSpeech(value) {
        if (!value) {
            return 'not available';
        }
        const parsed = value instanceof Date
            ? value
            : this.tryParseDateValue(String(value).trim());
        if (!parsed || Number.isNaN(parsed.getTime())) {
            const raw = String(value).trim();
            return raw || 'not available';
        }
        return parsed.toLocaleDateString('en-IN', {
            weekday: 'short',
            day: '2-digit',
            month: 'short',
            year: 'numeric',
        });
    }
    formatTimeForSpeech(value) {
        if (!value) {
            return 'not available';
        }
        if (value instanceof Date) {
            return value.toLocaleTimeString('en-IN', {
                hour: '2-digit',
                minute: '2-digit',
                hour12: true,
            });
        }
        const raw = String(value).trim();
        const match = raw.match(/^(\d{2}):(\d{2})/);
        if (!match) {
            const parsed = this.tryParseDateValue(raw);
            if (parsed && !Number.isNaN(parsed.getTime())) {
                return parsed.toLocaleTimeString('en-IN', {
                    hour: '2-digit',
                    minute: '2-digit',
                    hour12: true,
                });
            }
            return raw;
        }
        const hour = Number(match[1]);
        const minute = Number(match[2]);
        const period = hour >= 12 ? 'PM' : 'AM';
        const hour12 = hour % 12 || 12;
        return `${String(hour12).padStart(2, '0')}:${String(minute).padStart(2, '0')} ${period}`;
    }
    tryParseDateValue(raw) {
        if (!raw) {
            return undefined;
        }
        const isoDateMatch = raw.match(/^(\d{4}-\d{2}-\d{2})/);
        if (isoDateMatch) {
            const [year, month, day] = isoDateMatch[1].split('-').map(Number);
            return new Date(year, month - 1, day);
        }
        const parsed = new Date(raw);
        return Number.isNaN(parsed.getTime()) ? undefined : parsed;
    }
    resolveDate(currentDate, utterance) {
        if (currentDate?.trim()) {
            return currentDate.trim();
        }
        const text = (utterance ?? '').toLowerCase();
        if (!text)
            return undefined;
        if (text.includes('today'))
            return this.currentLocalDate();
        if (text.includes('tomorrow'))
            return this.offsetLocalDate(1);
        const match = text.match(/\b(20\d{2}-\d{2}-\d{2})\b/);
        return match?.[1];
    }
    resolveTime(currentTime, utterance) {
        if (currentTime?.trim()) {
            return currentTime.trim();
        }
        const text = (utterance ?? '').toLowerCase();
        if (!text)
            return undefined;
        const hhmm = text.match(/\b(\d{1,2})(?::(\d{2}))?\s*(am|pm)?\b/);
        if (!hhmm)
            return undefined;
        let hour = Number(hhmm[1]);
        const minute = hhmm[2] ? Number(hhmm[2]) : 0;
        const meridian = hhmm[3];
        if (meridian === 'pm' && hour < 12)
            hour += 12;
        if (meridian === 'am' && hour === 12)
            hour = 0;
        return `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}:00`;
    }
    currentLocalDate() {
        return this.offsetLocalDate(0);
    }
    offsetLocalDate(offset) {
        const value = new Date();
        value.setDate(value.getDate() + offset);
        const year = value.getFullYear();
        const month = String(value.getMonth() + 1).padStart(2, '0');
        const day = String(value.getDate()).padStart(2, '0');
        return `${year}-${month}-${day}`;
    }
    async matchDepartmentId(utterance) {
        const value = (utterance ?? '').toLowerCase();
        if (!value)
            return undefined;
        const departments = await this.listDepartments();
        return departments.find((item) => value.includes(item.departmentName.toLowerCase()))?.departmentId;
    }
    async matchDoctorId(departmentId, utterance, date) {
        const value = (utterance ?? '').toLowerCase();
        if (!value)
            return undefined;
        const doctors = await this.listAvailableDoctors(departmentId, date);
        return doctors.find((item) => value.includes(String(item.doctorName).toLowerCase().replace(/^dr\.?\s*/i, '')) || value.includes(String(item.doctorName).toLowerCase()))?.doctorId;
    }
    normalizeTime(value) {
        const trimmed = value.trim();
        if (/^\d{2}:\d{2}$/.test(trimmed)) {
            return `${trimmed}:00`;
        }
        if (/^\d{2}:\d{2}:\d{2}$/.test(trimmed)) {
            return `${trimmed}.000`;
        }
        if (/^\d{2}:\d{2}:\d{2}\.\d{1,3}$/.test(trimmed)) {
            const [base, fractional = ''] = trimmed.split('.');
            return `${base}.${fractional.padEnd(3, '0').slice(0, 3)}`;
        }
        throw new common_1.NotFoundException('Invalid appointment time format. Use HH:mm or HH:mm:ss.');
    }
    async findScheduleByDoctorDateTime(doctorId, scheduleDate, startTime) {
        const normalizedTime = this.normalizeTime(startTime).slice(0, 8);
        return this.scheduleRepository
            .createQueryBuilder('schedule')
            .where('schedule.DoctorId = :doctorId', { doctorId })
            .andWhere('schedule.ScheduleDate = :scheduleDate', { scheduleDate })
            .andWhere("CONVERT(VARCHAR(8), schedule.StartTime, 108) = :startTime", {
            startTime: normalizedTime,
        })
            .getOne();
    }
    async seedHospitalMetadata(domainId, organizationName) {
        const intents = [
            ['book-appointment', 'Book Appointment', 'Book an appointment with a doctor'],
            ['verify-appointment', 'Verify Appointment', 'Verify an existing appointment'],
            ['billing', 'Billing Details', 'Get hospital billing details'],
            ['lab-report', 'Lab Report Status', 'Check lab report status'],
            ['reschedule', 'Reschedule Appointment', 'Reschedule an appointment'],
            ['cancel', 'Cancel Appointment', 'Cancel an appointment'],
        ];
        for (const [intentCode, intentLabel, description] of intents) {
            const exists = await this.domainIntentRepository.findOne({ where: { domainId, intentCode } });
            if (!exists) {
                await this.domainIntentRepository.save(this.domainIntentRepository.create({
                    domainId,
                    intentCode,
                    intentLabel,
                    description,
                    priority: 100,
                    isActive: true,
                }));
            }
        }
        const rules = [
            ['rule', 'Keep responses short and suitable for voice calls.'],
            ['rule', 'Ask only one question at a time.'],
            ['compliance', 'Do not disclose patient-sensitive details without patient verification.'],
        ];
        for (const [ruleType, ruleText] of rules) {
            const exists = await this.domainRuleRepository.findOne({ where: { domainId, ruleType, ruleText } });
            if (!exists) {
                await this.domainRuleRepository.save(this.domainRuleRepository.create({
                    domainId,
                    ruleType,
                    ruleText,
                    priority: 100,
                    isActive: true,
                }));
            }
        }
        const prompts = [
            ['welcome', `Welcome to ${organizationName}. Please tell me how I can help you today.`],
            ['fallback', 'I can help with appointments, billing, lab reports, reschedule, and cancellation.'],
            ['escalation', 'Connecting you to a hospital operator.'],
            ['system', `You are the IVR assistant for ${organizationName}. Keep responses concise and voice-friendly.`],
        ];
        for (const [promptType, templateText] of prompts) {
            const exists = await this.promptTemplateRepository.findOne({ where: { domainId, promptType } });
            if (!exists) {
                await this.promptTemplateRepository.save(this.promptTemplateRepository.create({
                    domainId,
                    promptType,
                    templateText,
                    versionNo: 1,
                    isActive: true,
                }));
            }
        }
        const tools = [
            ['get_available_doctors', 'Fetch doctors available for appointments', 'hospital.getAvailableDoctors', '{"type":"object","properties":{"departmentId":{"type":"string"},"date":{"type":"string"}}}'],
            ['get_doctor_slots', 'Fetch slots for a doctor', 'hospital.getDoctorSlots', '{"type":"object","properties":{"doctorId":{"type":"string"},"date":{"type":"string"}},"required":["doctorId"]}'],
            ['create_patient', 'Create or update a patient record', 'hospital.createPatient', '{"type":"object","properties":{"fullName":{"type":"string"},"phoneNumber":{"type":"string"}},"required":["fullName","phoneNumber"]}'],
            ['book_appointment', 'Book a hospital appointment', 'hospital.createAppointment', '{"type":"object","properties":{"doctorId":{"type":"string"},"departmentId":{"type":"string"},"appointmentDate":{"type":"string"},"appointmentTime":{"type":"string"}},"required":["doctorId","departmentId","appointmentDate","appointmentTime"]}'],
            ['verify_appointment', 'Verify a patient appointment', 'hospital.verifyAppointment', '{"type":"object","properties":{"patientCode":{"type":"string"},"phoneNumber":{"type":"string"}}}'],
            ['get_billing', 'Fetch hospital billing details', 'hospital.getBilling', '{"type":"object","properties":{"patientCode":{"type":"string"},"phoneNumber":{"type":"string"}}}'],
            ['get_lab_reports', 'Fetch hospital lab report status', 'hospital.getLabReports', '{"type":"object","properties":{"patientCode":{"type":"string"},"phoneNumber":{"type":"string"}}}'],
        ];
        for (const [toolName, description, handlerName, schemaJson] of tools) {
            const exists = await this.toolDefinitionRepository.findOne({ where: { domainId, toolName } });
            if (!exists) {
                await this.toolDefinitionRepository.save(this.toolDefinitionRepository.create({
                    domainId,
                    toolName,
                    description,
                    handlerName,
                    schemaJson,
                    isActive: true,
                }));
            }
        }
    }
    async seedDepartments(domainId) {
        const seeds = [
            ['cardiology', 'Cardiology'],
            ['orthopedics', 'Orthopedics'],
            ['neurology', 'Neurology'],
            ['pediatrics', 'Pediatrics'],
        ];
        const created = [];
        for (const [departmentCode, departmentName] of seeds) {
            let department = await this.departmentRepository.findOne({ where: { domainId, departmentCode } });
            if (!department) {
                department = await this.departmentRepository.save(this.departmentRepository.create({
                    domainId,
                    departmentCode,
                    departmentName,
                    isActive: true,
                }));
            }
            created.push(department);
        }
        return created;
    }
    async seedDoctors(domainId, departments) {
        const byCode = new Map(departments.map((item) => [item.departmentCode, item]));
        const seeds = [
            ['DOC-CAR-001', 'Dr. Ravi Kumar', 'cardiology', 'Cardiologist'],
            ['DOC-CAR-002', 'Dr. Anita Shah', 'cardiology', 'Interventional Cardiologist'],
            ['DOC-ORT-001', 'Dr. Manoj Kumar', 'orthopedics', 'Orthopedic Surgeon'],
            ['DOC-NEU-001', 'Dr. Priya Raman', 'neurology', 'Neurologist'],
            ['DOC-PED-001', 'Dr. Meera Nair', 'pediatrics', 'Pediatrician'],
        ];
        const created = [];
        for (const [doctorCode, doctorName, departmentCode, specialization] of seeds) {
            let doctor = await this.doctorRepository.findOne({ where: { doctorCode } });
            if (!doctor) {
                doctor = await this.doctorRepository.save(this.doctorRepository.create({
                    domainId,
                    departmentId: byCode.get(departmentCode).departmentId,
                    doctorCode,
                    doctorName,
                    specialization,
                    qualification: 'MBBS, MD',
                    availabilityStatus: 'available',
                    consultationFee: '500.00',
                    isActive: true,
                }));
            }
            created.push(doctor);
        }
        return created;
    }
    async seedSchedules(doctors) {
        const dates = this.nextThreeDates();
        const times = [
            ['09:00:00', '10:00:00'],
            ['10:00:00', '11:00:00'],
            ['16:00:00', '17:00:00'],
        ];
        const created = [];
        for (const doctor of doctors) {
            for (const date of dates) {
                for (const [startTime, endTime] of times) {
                    let schedule = await this.findScheduleByDoctorDateTime(doctor.doctorId, date, startTime);
                    if (!schedule) {
                        try {
                            await this.scheduleRepository.insert(this.scheduleRepository.create({
                                doctorId: doctor.doctorId,
                                scheduleDate: date,
                                startTime,
                                endTime,
                                maxSlots: 5,
                                availableSlots: 5,
                                status: 'open',
                                createdAt: new Date(),
                                updatedAt: new Date(),
                            }));
                            schedule = await this.scheduleRepository.findOne({
                                where: {
                                    doctorId: doctor.doctorId,
                                    scheduleDate: date,
                                },
                            });
                        }
                        catch {
                            schedule = await this.findScheduleByDoctorDateTime(doctor.doctorId, date, startTime);
                        }
                    }
                    if (schedule) {
                        created.push(schedule);
                    }
                }
            }
        }
        return created;
    }
    async ensureSchedulesForActiveDoctors(departmentId) {
        const where = departmentId
            ? { isActive: true, departmentId }
            : { isActive: true };
        const doctors = await this.doctorRepository.find({ where });
        if (doctors.length === 0) {
            return;
        }
        await this.seedSchedules(doctors);
    }
    async ensureSchedulesForDoctor(doctorId) {
        const doctor = await this.doctorRepository.findOne({ where: { doctorId, isActive: true } });
        if (!doctor) {
            return;
        }
        await this.seedSchedules([doctor]);
    }
    nextThreeDates() {
        return Array.from({ length: 7 }, (_, index) => {
            const current = new Date();
            current.setDate(current.getDate() + index);
            return current.toISOString().slice(0, 10);
        });
    }
};
exports.HospitalService = HospitalService;
exports.HospitalService = HospitalService = HospitalService_1 = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, typeorm_1.InjectRepository)(domain_entity_1.DomainEntity)),
    __param(1, (0, typeorm_1.InjectRepository)(domain_intent_entity_1.DomainIntentEntity)),
    __param(2, (0, typeorm_1.InjectRepository)(domain_rule_entity_1.DomainRuleEntity)),
    __param(3, (0, typeorm_1.InjectRepository)(prompt_template_entity_1.PromptTemplateEntity)),
    __param(4, (0, typeorm_1.InjectRepository)(tool_definition_entity_1.ToolDefinitionEntity)),
    __param(5, (0, typeorm_1.InjectRepository)(department_entity_1.DepartmentEntity)),
    __param(6, (0, typeorm_1.InjectRepository)(doctor_entity_1.DoctorEntity)),
    __param(7, (0, typeorm_1.InjectRepository)(doctor_schedule_entity_1.DoctorScheduleEntity)),
    __param(8, (0, typeorm_1.InjectRepository)(patient_entity_1.PatientEntity)),
    __param(9, (0, typeorm_1.InjectRepository)(appointment_entity_1.AppointmentEntity)),
    __param(10, (0, typeorm_1.InjectRepository)(billing_entity_1.BillingEntity)),
    __param(11, (0, typeorm_1.InjectRepository)(lab_report_entity_1.LabReportEntity)),
    __metadata("design:paramtypes", [typeorm_2.Repository,
        typeorm_2.Repository,
        typeorm_2.Repository,
        typeorm_2.Repository,
        typeorm_2.Repository,
        typeorm_2.Repository,
        typeorm_2.Repository,
        typeorm_2.Repository,
        typeorm_2.Repository,
        typeorm_2.Repository,
        typeorm_2.Repository,
        typeorm_2.Repository])
], HospitalService);
//# sourceMappingURL=hospital.service.js.map