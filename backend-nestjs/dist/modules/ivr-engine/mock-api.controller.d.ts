export declare class MockApiController {
    private readonly logger;
    bookAppointment(body: any): unknown;
    checkLabReports(body: any): unknown;
    billingInquiry(body: any): unknown;
    getDepartments(): unknown;
    doctorAvailability(department: string): unknown;
    checkBalance(body: any): unknown;
    recentTransactions(body: any): unknown;
    fundTransfer(body: any): unknown;
    cardBlock(body: any): unknown;
    loanStatus(body: any): unknown;
    orderStatus(body: any): unknown;
    returnRequest(body: any): unknown;
    productInquiry(body: any): unknown;
    cancelOrder(body: any): unknown;
    deliveryReschedule(body: any): unknown;
    private randomDoctor;
    private randomTimeSlot;
}
