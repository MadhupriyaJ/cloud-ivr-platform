export declare class LabReportEntity {
    labReportId: string;
    patientId: string;
    appointmentId: string | null;
    reportNumber: string;
    testName: string;
    reportStatus: string;
    resultSummary: string | null;
    reportDate: Date | null;
    createdAt: Date;
    updatedAt: Date;
}
