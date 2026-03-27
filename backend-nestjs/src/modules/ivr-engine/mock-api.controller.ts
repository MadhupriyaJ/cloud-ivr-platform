import { Controller, Post, Get, Body, Param, Query, Logger } from '@nestjs/common';

/**
 * Mock API Controller
 * 
 * Simulates core system APIs for demo domains (hospital, banking, e-commerce).
 * These endpoints mimic what real core systems would return.
 * In production, DomainApiEndpoints would point to real external APIs.
 * 
 * All endpoints follow the pattern: POST /api/mock/{domain}/{action}
 */
@Controller('mock')
export class MockApiController {
  private readonly logger = new Logger(MockApiController.name);

  // ─────────────────────────────────────────────────────────────
  // HOSPITAL MOCK APIs
  // ─────────────────────────────────────────────────────────────

  @Post('hospital/book-appointment')
  async bookAppointment(@Body() body: any) {
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

  @Post('hospital/check-lab-reports')
  async checkLabReports(@Body() body: any) {
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

  @Post('hospital/billing-inquiry')
  async billingInquiry(@Body() body: any) {
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

  @Get('hospital/departments')
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

  @Get('hospital/doctor-availability')
  async doctorAvailability(@Query('department') department: string) {
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

  // ─────────────────────────────────────────────────────────────
  // BANKING MOCK APIs
  // ─────────────────────────────────────────────────────────────

  @Post('banking/check-balance')
  async checkBalance(@Body() body: any) {
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

  @Post('banking/recent-transactions')
  async recentTransactions(@Body() body: any) {
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

  @Post('banking/fund-transfer')
  async fundTransfer(@Body() body: any) {
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

  @Post('banking/card-block')
  async cardBlock(@Body() body: any) {
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

  @Post('banking/loan-status')
  async loanStatus(@Body() body: any) {
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

  // ─────────────────────────────────────────────────────────────
  // E-COMMERCE MOCK APIs (for future domain extension demo)
  // ─────────────────────────────────────────────────────────────

  @Post('ecommerce/order-status')
  async orderStatus(@Body() body: any) {
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

  @Post('ecommerce/return-request')
  async returnRequest(@Body() body: any) {
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

  @Post('ecommerce/product-inquiry')
  async productInquiry(@Body() body: any) {
    this.logger.log(`[MOCK] E-commerce product-inquiry: ${JSON.stringify(body)}`);
    
    const products: Record<string, any> = {
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

  @Post('ecommerce/cancel-order')
  async cancelOrder(@Body() body: any) {
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

  @Post('ecommerce/delivery-reschedule')
  async deliveryReschedule(@Body() body: any) {
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

  // ─────────────────────────────────────────────────────────────
  // HELPER METHODS
  // ─────────────────────────────────────────────────────────────

  private randomDoctor(department: string): string {
    const doctors: Record<string, string[]> = {
      'Cardiology': ['Dr. Sharma', 'Dr. Reddy', 'Dr. Gupta'],
      'Orthopedics': ['Dr. Patel', 'Dr. Verma'],
      'General Medicine': ['Dr. Kumar', 'Dr. Singh', 'Dr. Joshi'],
      'Pediatrics': ['Dr. Mehta', 'Dr. Nair'],
      'Neurology': ['Dr. Rao', 'Dr. Iyer'],
    };
    const list = doctors[department] || doctors['General Medicine'];
    return list[Math.floor(Math.random() * list.length)];
  }

  private randomTimeSlot(): string {
    const slots = ['09:00 AM', '10:30 AM', '11:00 AM', '02:00 PM', '03:30 PM', '04:00 PM'];
    return slots[Math.floor(Math.random() * slots.length)];
  }
}
