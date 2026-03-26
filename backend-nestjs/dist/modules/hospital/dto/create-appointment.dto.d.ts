export declare class CreateAppointmentDto {
    patientId?: string;
    patientCode?: string;
    phoneNumber?: string;
    doctorId: string;
    departmentId: string;
    appointmentDate: string;
    appointmentTime: string;
    reasonForVisit?: string;
    conversationId?: string;
    patientName?: string;
}
