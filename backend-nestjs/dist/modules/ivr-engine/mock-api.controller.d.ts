export declare class MockApiController {
    private readonly logger;
    bookAppointment(body: any): Promise<{
        success: boolean;
        error: string;
        message: string;
        data?: undefined;
    } | {
        success: boolean;
        data: {
            appointmentId: string;
            department: any;
            date: any;
            patientName: any;
            doctorName: string;
            timeSlot: string;
            status: string;
            confirmationMessage: string;
        };
        error?: undefined;
        message?: undefined;
    }>;
    checkLabReports(body: any): Promise<{
        success: boolean;
        data: {
            patientId: any;
            reports: {
                reportId: string;
                testName: string;
                date: string;
                status: string;
                summary: string;
            }[];
            message: string;
        };
    }>;
    billingInquiry(body: any): Promise<{
        success: boolean;
        data: {
            patientId: any;
            totalOutstanding: number;
            currency: string;
            bills: {
                billId: string;
                description: string;
                amount: number;
                date: string;
                status: string;
            }[];
            message: string;
        };
    }>;
    getDepartments(): Promise<{
        success: boolean;
        data: {
            id: number;
            name: string;
            doctors: number;
            available: boolean;
        }[];
    }>;
    doctorAvailability(department: string): Promise<{
        success: boolean;
        data: {
            department: string;
            slots: {
                time: string;
                doctor: string;
                available: boolean;
            }[];
        };
    }>;
    checkBalance(body: any): Promise<{
        success: boolean;
        data: {
            accountNumber: string;
            accountType: string;
            balance: number;
            currency: string;
            lastTransaction: {
                type: string;
                amount: number;
                date: string;
                description: string;
            };
            message: string;
        };
    }>;
    recentTransactions(body: any): Promise<{
        success: boolean;
        data: {
            accountNumber: string;
            transactions: {
                id: string;
                type: string;
                amount: number;
                date: string;
                description: string;
                balance: number;
            }[];
            message: string;
        };
    }>;
    fundTransfer(body: any): Promise<{
        success: boolean;
        error: string;
        message: string;
        data?: undefined;
    } | {
        success: boolean;
        data: {
            transactionId: string;
            amount: any;
            beneficiary: any;
            accountNumber: any;
            status: string;
            newBalance: number;
            message: string;
        };
        error?: undefined;
        message?: undefined;
    }>;
    cardBlock(body: any): Promise<{
        success: boolean;
        data: {
            cardNumber: string;
            cardType: any;
            status: string;
            referenceNumber: string;
            message: string;
        };
    }>;
    loanStatus(body: any): Promise<{
        success: boolean;
        data: {
            loanId: any;
            loanType: string;
            sanctionedAmount: number;
            outstandingAmount: number;
            emiAmount: number;
            nextEmiDate: string;
            status: string;
            message: string;
        };
    }>;
    orderStatus(body: any): Promise<{
        success: boolean;
        data: {
            orderId: any;
            status: string;
            items: {
                name: string;
                qty: number;
                price: number;
            }[];
            trackingId: string;
            estimatedDelivery: string;
            message: string;
        };
    }>;
    returnRequest(body: any): Promise<{
        success: boolean;
        data: {
            returnId: string;
            orderId: any;
            reason: any;
            status: string;
            pickupDate: string;
            refundEstimate: string;
            message: string;
        };
    }>;
    productInquiry(body: any): Promise<{
        success: boolean;
        data: any;
    }>;
    cancelOrder(body: any): Promise<{
        success: boolean;
        data: {
            orderId: any;
            cancellationId: string;
            status: string;
            refundAmount: number;
            refundMethod: string;
            refundTimeline: string;
            message: string;
        };
    }>;
    deliveryReschedule(body: any): Promise<{
        success: boolean;
        data: {
            orderId: any;
            newDeliveryDate: any;
            timeSlot: any;
            status: string;
            message: string;
        };
    }>;
    private randomDoctor;
    private randomTimeSlot;
}
