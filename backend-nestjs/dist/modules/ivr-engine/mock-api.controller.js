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
var MockApiController_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.MockApiController = void 0;
const common_1 = require("@nestjs/common");
let MockApiController = MockApiController_1 = class MockApiController {
    logger = new common_1.Logger(MockApiController_1.name);
    async bookAppointment(body) {
        this.logger.log(`[MOCK] Hospital book-appointment: ${JSON.stringify(body)}`);
        const departments = ['Cardiology', 'Orthopedics', 'General Medicine', 'Pediatrics', 'Neurology'];
        const department = body.department || 'General Medicine';
        if (!departments.includes(department)) {
            return {
                success: false,
                error: 'INVALID_DEPARTMENT',
                message: `Department "${department}" not found. Available: ${departments.join(', ')}`,
            };
        }
        const appointmentId = `APT-${Date.now().toString(36).toUpperCase()}`;
        return {
            success: true,
            data: {
                appointmentId,
                department,
                date: body.date || 'Next available',
                patientName: body.patientName || 'Guest Patient',
                doctorName: this.randomDoctor(department),
                timeSlot: this.randomTimeSlot(),
                status: 'confirmed',
                confirmationMessage: `Your appointment ${appointmentId} with Dr. ${this.randomDoctor(department)} in ${department} is confirmed for ${body.date || 'next available slot'}.`,
            },
        };
    }
    async checkLabReports(body) {
        this.logger.log(`[MOCK] Hospital check-lab-reports: ${JSON.stringify(body)}`);
        const patientId = body.patientId || body.phone || 'UNKNOWN';
        return {
            success: true,
            data: {
                patientId,
                reports: [
                    {
                        reportId: `LAB-${Date.now().toString(36).toUpperCase()}`,
                        testName: 'Complete Blood Count (CBC)',
                        date: '2026-03-25',
                        status: 'ready',
                        summary: 'All values within normal range. Hemoglobin: 14.2 g/dL, WBC: 7,500/μL.',
                    },
                    {
                        reportId: `LAB-${(Date.now() + 1).toString(36).toUpperCase()}`,
                        testName: 'Lipid Profile',
                        date: '2026-03-24',
                        status: 'ready',
                        summary: 'Total Cholesterol: 195 mg/dL (Normal). LDL: 120 mg/dL.',
                    },
                ],
                message: `Found 2 lab reports for patient ${patientId}. Latest: Complete Blood Count - all values normal.`,
            },
        };
    }
    async billingInquiry(body) {
        this.logger.log(`[MOCK] Hospital billing-inquiry: ${JSON.stringify(body)}`);
        return {
            success: true,
            data: {
                patientId: body.patientId || 'GUEST',
                totalOutstanding: 2500.00,
                currency: 'INR',
                bills: [
                    { billId: 'BILL-001', description: 'Consultation - Cardiology', amount: 1500, date: '2026-03-20', status: 'unpaid' },
                    { billId: 'BILL-002', description: 'Lab Tests - CBC + Lipid', amount: 1000, date: '2026-03-24', status: 'unpaid' },
                ],
                message: `You have 2 pending bills totaling ₹2,500. Would you like to make a payment or get more details?`,
            },
        };
    }
    async getDepartments() {
        return {
            success: true,
            data: [
                { id: 1, name: 'Cardiology', doctors: 5, available: true },
                { id: 2, name: 'Orthopedics', doctors: 3, available: true },
                { id: 3, name: 'General Medicine', doctors: 8, available: true },
                { id: 4, name: 'Pediatrics', doctors: 4, available: true },
                { id: 5, name: 'Neurology', doctors: 2, available: false },
            ],
        };
    }
    async doctorAvailability(department) {
        return {
            success: true,
            data: {
                department: department || 'General Medicine',
                slots: [
                    { time: '09:00 AM', doctor: 'Dr. Sharma', available: true },
                    { time: '10:30 AM', doctor: 'Dr. Patel', available: true },
                    { time: '02:00 PM', doctor: 'Dr. Kumar', available: false },
                    { time: '04:00 PM', doctor: 'Dr. Singh', available: true },
                ],
            },
        };
    }
    async checkBalance(body) {
        this.logger.log(`[MOCK] Banking check-balance: ${JSON.stringify(body)}`);
        const accountNumber = body.accountNumber || body.phone || 'XXXX-1234';
        return {
            success: true,
            data: {
                accountNumber: `****${accountNumber.slice(-4)}`,
                accountType: 'Savings',
                balance: 45750.50,
                currency: 'INR',
                lastTransaction: {
                    type: 'credit',
                    amount: 25000,
                    date: '2026-03-26',
                    description: 'Salary Credit',
                },
                message: `Your savings account ending ${accountNumber.slice(-4)} has a balance of ₹45,750.50. Last transaction: Salary Credit of ₹25,000 on March 26.`,
            },
        };
    }
    async recentTransactions(body) {
        this.logger.log(`[MOCK] Banking recent-transactions: ${JSON.stringify(body)}`);
        return {
            success: true,
            data: {
                accountNumber: `****${(body.accountNumber || '1234').slice(-4)}`,
                transactions: [
                    { id: 'TXN-001', type: 'credit', amount: 25000, date: '2026-03-26', description: 'Salary Credit', balance: 45750.50 },
                    { id: 'TXN-002', type: 'debit', amount: 5000, date: '2026-03-25', description: 'UPI Transfer', balance: 20750.50 },
                    { id: 'TXN-003', type: 'debit', amount: 1200, date: '2026-03-24', description: 'Electricity Bill', balance: 25750.50 },
                    { id: 'TXN-004', type: 'credit', amount: 3000, date: '2026-03-23', description: 'Refund - Amazon', balance: 26950.50 },
                    { id: 'TXN-005', type: 'debit', amount: 800, date: '2026-03-22', description: 'Mobile Recharge', balance: 23950.50 },
                ],
                message: 'Here are your last 5 transactions. Your most recent was a Salary Credit of ₹25,000.',
            },
        };
    }
    async fundTransfer(body) {
        this.logger.log(`[MOCK] Banking fund-transfer: ${JSON.stringify(body)}`);
        const amount = body.amount || 0;
        if (amount > 50000) {
            return {
                success: false,
                error: 'LIMIT_EXCEEDED',
                message: 'Transfer amount exceeds the daily IVR limit of ₹50,000. Please use net banking for higher amounts.',
            };
        }
        return {
            success: true,
            data: {
                transactionId: `TXN-${Date.now().toString(36).toUpperCase()}`,
                amount,
                beneficiary: body.beneficiary || 'Unknown',
                accountNumber: body.toAccount || 'XXXX-5678',
                status: 'completed',
                newBalance: 45750.50 - amount,
                message: `₹${amount} has been transferred successfully to ${body.beneficiary || 'the beneficiary'}. Transaction ID: TXN-${Date.now().toString(36).toUpperCase()}.`,
            },
        };
    }
    async cardBlock(body) {
        this.logger.log(`[MOCK] Banking card-block: ${JSON.stringify(body)}`);
        return {
            success: true,
            data: {
                cardNumber: `****${(body.cardNumber || '9876').slice(-4)}`,
                cardType: body.cardType || 'Debit',
                status: 'blocked',
                referenceNumber: `BLK-${Date.now().toString(36).toUpperCase()}`,
                message: `Your ${body.cardType || 'Debit'} card ending ${(body.cardNumber || '9876').slice(-4)} has been blocked successfully. Reference: BLK-${Date.now().toString(36).toUpperCase()}. Please visit the nearest branch for a replacement.`,
            },
        };
    }
    async loanStatus(body) {
        this.logger.log(`[MOCK] Banking loan-status: ${JSON.stringify(body)}`);
        return {
            success: true,
            data: {
                loanId: body.loanId || 'LN-2024-001',
                loanType: 'Home Loan',
                sanctionedAmount: 5000000,
                outstandingAmount: 4250000,
                emiAmount: 42500,
                nextEmiDate: '2026-04-05',
                status: 'active',
                message: 'Your Home Loan LN-2024-001: Outstanding ₹42,50,000. Next EMI of ₹42,500 is due on April 5, 2026.',
            },
        };
    }
    async orderStatus(body) {
        this.logger.log(`[MOCK] E-commerce order-status: ${JSON.stringify(body)}`);
        return {
            success: true,
            data: {
                orderId: body.orderId || 'ORD-2026-001',
                status: 'shipped',
                items: [
                    { name: 'Wireless Headphones', qty: 1, price: 2999 },
                    { name: 'Phone Case', qty: 2, price: 499 },
                ],
                trackingId: 'TRACK-XYZ-123',
                estimatedDelivery: '2026-03-29',
                message: 'Your order ORD-2026-001 has been shipped. Tracking: TRACK-XYZ-123. Expected delivery: March 29, 2026.',
            },
        };
    }
    async returnRequest(body) {
        this.logger.log(`[MOCK] E-commerce return-request: ${JSON.stringify(body)}`);
        return {
            success: true,
            data: {
                returnId: `RET-${Date.now().toString(36).toUpperCase()}`,
                orderId: body.orderId || 'ORD-2026-001',
                reason: body.reason || 'Product not as described',
                status: 'initiated',
                pickupDate: '2026-03-30',
                refundEstimate: '5-7 business days',
                message: `Return request initiated for order ${body.orderId || 'ORD-2026-001'}. Pickup scheduled for March 30. Refund within 5-7 business days.`,
            },
        };
    }
    async productInquiry(body) {
        this.logger.log(`[MOCK] E-commerce product-inquiry: ${JSON.stringify(body)}`);
        const products = {
            'headphones': { name: 'Wireless Headphones Pro', price: 2999, stock: 'in_stock', rating: 4.5, delivery: '2-3 days' },
            'laptop': { name: 'UltraBook 15 Pro', price: 89999, stock: 'in_stock', rating: 4.7, delivery: '3-5 days' },
            'phone': { name: 'SmartPhone X12', price: 24999, stock: 'low_stock', rating: 4.3, delivery: '1-2 days' },
        };
        const query = (body.productName || body.query || 'headphones').toLowerCase();
        const product = products[query] || products['headphones'];
        return {
            success: true,
            data: {
                ...product,
                message: `${product.name} is priced at ₹${product.price}. Stock: ${product.stock}. Rating: ${product.rating}/5. Estimated delivery: ${product.delivery}.`,
            },
        };
    }
    async cancelOrder(body) {
        this.logger.log(`[MOCK] E-commerce cancel-order: ${JSON.stringify(body)}`);
        const orderId = body.orderId || 'ORD-2026-001';
        return {
            success: true,
            data: {
                orderId,
                cancellationId: `CAN-${Date.now().toString(36).toUpperCase()}`,
                status: 'cancelled',
                refundAmount: 3997,
                refundMethod: 'Original payment method',
                refundTimeline: '3-5 business days',
                message: `Order ${orderId} has been cancelled. Refund of ₹3,997 will be processed to your original payment method within 3-5 business days.`,
            },
        };
    }
    async deliveryReschedule(body) {
        this.logger.log(`[MOCK] E-commerce delivery-reschedule: ${JSON.stringify(body)}`);
        return {
            success: true,
            data: {
                orderId: body.orderId || 'ORD-2026-001',
                newDeliveryDate: body.preferredDate || '2026-04-01',
                timeSlot: body.timeSlot || '2:00 PM - 6:00 PM',
                status: 'rescheduled',
                message: `Delivery for order ${body.orderId || 'ORD-2026-001'} has been rescheduled to ${body.preferredDate || 'April 1, 2026'}, ${body.timeSlot || '2:00 PM - 6:00 PM'}.`,
            },
        };
    }
    randomDoctor(department) {
        const doctors = {
            'Cardiology': ['Dr. Sharma', 'Dr. Reddy', 'Dr. Gupta'],
            'Orthopedics': ['Dr. Patel', 'Dr. Verma'],
            'General Medicine': ['Dr. Kumar', 'Dr. Singh', 'Dr. Joshi'],
            'Pediatrics': ['Dr. Mehta', 'Dr. Nair'],
            'Neurology': ['Dr. Rao', 'Dr. Iyer'],
        };
        const list = doctors[department] || doctors['General Medicine'];
        return list[Math.floor(Math.random() * list.length)];
    }
    randomTimeSlot() {
        const slots = ['09:00 AM', '10:30 AM', '11:00 AM', '02:00 PM', '03:30 PM', '04:00 PM'];
        return slots[Math.floor(Math.random() * slots.length)];
    }
};
exports.MockApiController = MockApiController;
__decorate([
    (0, common_1.Post)('hospital/book-appointment'),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], MockApiController.prototype, "bookAppointment", null);
__decorate([
    (0, common_1.Post)('hospital/check-lab-reports'),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], MockApiController.prototype, "checkLabReports", null);
__decorate([
    (0, common_1.Post)('hospital/billing-inquiry'),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], MockApiController.prototype, "billingInquiry", null);
__decorate([
    (0, common_1.Get)('hospital/departments'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", Promise)
], MockApiController.prototype, "getDepartments", null);
__decorate([
    (0, common_1.Get)('hospital/doctor-availability'),
    __param(0, (0, common_1.Query)('department')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", Promise)
], MockApiController.prototype, "doctorAvailability", null);
__decorate([
    (0, common_1.Post)('banking/check-balance'),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], MockApiController.prototype, "checkBalance", null);
__decorate([
    (0, common_1.Post)('banking/recent-transactions'),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], MockApiController.prototype, "recentTransactions", null);
__decorate([
    (0, common_1.Post)('banking/fund-transfer'),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], MockApiController.prototype, "fundTransfer", null);
__decorate([
    (0, common_1.Post)('banking/card-block'),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], MockApiController.prototype, "cardBlock", null);
__decorate([
    (0, common_1.Post)('banking/loan-status'),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], MockApiController.prototype, "loanStatus", null);
__decorate([
    (0, common_1.Post)('ecommerce/order-status'),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], MockApiController.prototype, "orderStatus", null);
__decorate([
    (0, common_1.Post)('ecommerce/return-request'),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], MockApiController.prototype, "returnRequest", null);
__decorate([
    (0, common_1.Post)('ecommerce/product-inquiry'),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], MockApiController.prototype, "productInquiry", null);
__decorate([
    (0, common_1.Post)('ecommerce/cancel-order'),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], MockApiController.prototype, "cancelOrder", null);
__decorate([
    (0, common_1.Post)('ecommerce/delivery-reschedule'),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], MockApiController.prototype, "deliveryReschedule", null);
exports.MockApiController = MockApiController = MockApiController_1 = __decorate([
    (0, common_1.Controller)('mock')
], MockApiController);
//# sourceMappingURL=mock-api.controller.js.map