export declare class AppointmentEntity {
    appointmentId: string;
    appointmentCode: string;
    patientId: string;
    doctorId: string;
    departmentId: string;
    appointmentDate: string;
    appointmentTime: string;
    reasonForVisit: string | null;
    appointmentStatus: string;
    bookedChannel: string;
    conversationId: string | null;
    createdAt: Date;
    updatedAt: Date;
}
