export declare class BillingEntity {
    billingId: string;
    patientId: string;
    appointmentId: string | null;
    invoiceNumber: string;
    totalAmount: string;
    paidAmount: string;
    billingStatus: string;
    dueDate: string | null;
    createdAt: Date;
    updatedAt: Date;
}
