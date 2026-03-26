import { HospitalService } from './hospital.service';
import { CreatePatientDto } from './dto/create-patient.dto';
import { CreateAppointmentDto } from './dto/create-appointment.dto';
import { RescheduleAppointmentDto } from './dto/reschedule-appointment.dto';
import { HospitalIvrRequestDto } from './dto/hospital-ivr-request.dto';
import { BootstrapHospitalDto } from './dto/bootstrap-hospital.dto';
export declare class HospitalController {
    private readonly hospitalService;
    constructor(hospitalService: HospitalService);
    bootstrap(payload: BootstrapHospitalDto): Promise<any>;
    listDepartments(): Promise<{
        items: import("./department.entity").DepartmentEntity[];
    }>;
    listDoctors(departmentId?: string): Promise<{
        items: any[];
    }>;
    listAvailableDoctors(departmentId?: string, date?: string): Promise<{
        items: any[];
    }>;
    getDoctorSlots(doctorId: string, date?: string): Promise<{
        items: import("./doctor-schedule.entity").DoctorScheduleEntity[];
    }>;
    createPatient(payload: CreatePatientDto): Promise<import("./patient.entity").PatientEntity>;
    lookupPatient(patientCode?: string, phoneNumber?: string): Promise<import("./patient.entity").PatientEntity | null>;
    createAppointment(payload: CreateAppointmentDto): Promise<any>;
    verifyAppointment(patientCode?: string, phoneNumber?: string): Promise<any>;
    listAppointments(departmentId?: string, date?: string, status?: string, patientCode?: string, phoneNumber?: string): Promise<{
        items: any[];
    }>;
    rescheduleAppointment(appointmentId: string, payload: RescheduleAppointmentDto): Promise<any>;
    cancelAppointment(appointmentId: string): Promise<any>;
    getBilling(patientCode?: string, phoneNumber?: string): Promise<{
        items: import("./billing.entity").BillingEntity[];
    }>;
    getLabReports(patientCode?: string, phoneNumber?: string): Promise<{
        items: import("./lab-report.entity").LabReportEntity[];
    }>;
    runIvrStep(payload: HospitalIvrRequestDto): Promise<any>;
}
