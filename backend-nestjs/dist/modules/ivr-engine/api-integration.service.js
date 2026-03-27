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
var ApiIntegrationService_1;
var _a;
Object.defineProperty(exports, "__esModule", { value: true });
exports.ApiIntegrationService = void 0;
const common_1 = require("@nestjs/common");
const typeorm_1 = require("@nestjs/typeorm");
const typeorm_2 = require("typeorm");
let ApiIntegrationService = ApiIntegrationService_1 = class ApiIntegrationService {
    dataSource;
    logger = new common_1.Logger(ApiIntegrationService_1.name);
    constructor(dataSource) {
        this.dataSource = dataSource;
    }
    async executeApiCall(action, endpoint, sessionVars) {
        const startTime = Date.now();
        try {
            const resolvedPath = this.resolveTemplate(endpoint.path, sessionVars);
            const fullUrl = `${endpoint.baseUrl}${resolvedPath}`;
            const headers = {
                'Content-Type': 'application/json',
                ...(endpoint.headersJson || {}),
            };
            this.applyAuth(headers, endpoint);
            let body = undefined;
            if (action.requestMapping && ['POST', 'PUT', 'PATCH'].includes(endpoint.httpMethod.toUpperCase())) {
                body = this.buildRequestBody(action.requestMapping, sessionVars);
            }
            let lastError = null;
            for (let attempt = 0; attempt <= endpoint.retryCount; attempt++) {
                try {
                    this.logger.log(`API call [${attempt + 1}/${endpoint.retryCount + 1}]: ${endpoint.httpMethod} ${fullUrl}`);
                    const controller = new AbortController();
                    const timeout = setTimeout(() => controller.abort(), endpoint.timeoutMs);
                    const response = await fetch(fullUrl, {
                        method: endpoint.httpMethod.toUpperCase(),
                        headers,
                        body: body ? JSON.stringify(body) : undefined,
                        signal: controller.signal,
                    });
                    clearTimeout(timeout);
                    if (!response.ok) {
                        lastError = `HTTP ${response.status}: ${response.statusText}`;
                        this.logger.warn(`API call failed: ${lastError}`);
                        await this.logError(endpoint, lastError, response.status, sessionVars);
                        if (attempt < endpoint.retryCount)
                            continue;
                        return this.buildFallbackResult(action, lastError, Date.now() - startTime);
                    }
                    const responseData = await response.json();
                    const mappedData = this.mapResponse(action.responseMapping, responseData);
                    this.logger.log(`API call success: ${endpoint.endpointCode} (${Date.now() - startTime}ms)`);
                    return {
                        success: true,
                        data: mappedData,
                        error: null,
                        statusCode: response.status,
                        durationMs: Date.now() - startTime,
                    };
                }
                catch (fetchError) {
                    lastError = fetchError.name === 'AbortError'
                        ? `Timeout after ${endpoint.timeoutMs}ms`
                        : fetchError.message || 'Unknown fetch error';
                    this.logger.warn(`API call attempt ${attempt + 1} failed: ${lastError}`);
                    await this.logError(endpoint, lastError || 'Unknown error', null, sessionVars);
                    if (attempt < endpoint.retryCount) {
                        await new Promise(r => setTimeout(r, Math.pow(2, attempt) * 500));
                    }
                }
            }
            return this.buildFallbackResult(action, lastError || 'All retries exhausted', Date.now() - startTime);
        }
        catch (error) {
            this.logger.error(`API integration error: ${error.message}`);
            return this.buildFallbackResult(action, error.message, Date.now() - startTime);
        }
    }
    async executeMockApiCall(action, endpoint, sessionVars) {
        const startTime = Date.now();
        this.logger.log(`Mock API call: ${endpoint.endpointCode}`);
        await new Promise(r => setTimeout(r, 200 + Math.random() * 300));
        const mockData = this.generateMockData(endpoint.endpointCode, sessionVars);
        const mappedData = this.mapResponse(action.responseMapping, mockData);
        return {
            success: true,
            data: mappedData,
            error: null,
            statusCode: 200,
            durationMs: Date.now() - startTime,
        };
    }
    resolveTemplate(template, vars) {
        return template.replace(/\{\{(\w+)\}\}/g, (_, key) => {
            const value = vars[key];
            return value !== undefined && value !== null ? String(value) : '';
        });
    }
    buildRequestBody(mapping, sessionVars) {
        const body = {};
        for (const [key, template] of Object.entries(mapping)) {
            body[key] = this.resolveTemplate(String(template), sessionVars);
        }
        return body;
    }
    mapResponse(mapping, responseData) {
        if (!mapping)
            return responseData;
        const mapped = {};
        for (const [sessionKey, responseKey] of Object.entries(mapping)) {
            mapped[sessionKey] = this.getNestedValue(responseData, responseKey);
        }
        return mapped;
    }
    getNestedValue(obj, path) {
        return path.split('.').reduce((current, key) => current?.[key], obj);
    }
    applyAuth(headers, endpoint) {
        switch (endpoint.authType) {
            case 'bearer':
                if (endpoint.authConfig?.token) {
                    headers['Authorization'] = `Bearer ${endpoint.authConfig.token}`;
                }
                break;
            case 'api_key':
                if (endpoint.authConfig?.headerName && endpoint.authConfig?.apiKey) {
                    headers[endpoint.authConfig.headerName] = endpoint.authConfig.apiKey;
                }
                break;
            case 'basic':
                if (endpoint.authConfig?.username && endpoint.authConfig?.password) {
                    const encoded = Buffer.from(`${endpoint.authConfig.username}:${endpoint.authConfig.password}`).toString('base64');
                    headers['Authorization'] = `Basic ${encoded}`;
                }
                break;
            case 'none':
            default:
                break;
        }
    }
    buildFallbackResult(action, error, durationMs) {
        return {
            success: false,
            data: action.fallbackResponse || { message: 'Service temporarily unavailable. Please try again later.' },
            error,
            statusCode: null,
            durationMs,
        };
    }
    generateMockData(endpointCode, sessionVars) {
        const mockResponses = {
            book_appointment: () => ({
                appointmentId: `APT-${Date.now().toString(36).toUpperCase()}`,
                confirmationMessage: `Appointment confirmed for ${sessionVars.department || 'General'} on ${sessionVars.preferred_date || 'next available date'}`,
                status: 'confirmed',
            }),
            get_lab_reports: () => ({
                summary: 'Blood test results: Hemoglobin 14.2 g/dL (Normal), WBC 7,500 (Normal), Platelets 250,000 (Normal). All values within healthy range.',
                reportDate: new Date().toISOString().split('T')[0],
                patientName: sessionVars.patient_name || 'Patient',
            }),
            get_billing_info: () => ({
                outstandingAmount: '$1,250.00',
                lastPaymentDate: '2025-03-15',
                totalBilled: '$3,500.00',
                insuranceCovered: '$2,250.00',
            }),
            get_departments: () => ({
                departments: ['Cardiology', 'Orthopedics', 'General Medicine', 'Pediatrics', 'Neurology', 'Dermatology'],
            }),
            get_doctors: () => ({
                doctors: [
                    { name: 'Dr. Smith', specialization: 'Cardiology', available: true },
                    { name: 'Dr. Johnson', specialization: 'Cardiology', available: false },
                ],
            }),
            check_balance: () => ({
                currentBalance: '$12,450.75',
                lastTransactionDescription: 'Online purchase at Amazon - $89.99',
                accountType: 'Savings',
                accountHolder: sessionVars.account_holder || 'Account Holder',
            }),
            execute_transfer: () => ({
                referenceNumber: `TXN-${Date.now().toString(36).toUpperCase()}`,
                transferStatus: 'completed',
                transferAmount: sessionVars.transfer_amount || '$0.00',
                timestamp: new Date().toISOString(),
            }),
            block_card: () => ({
                status: 'Card blocked successfully',
                estimatedDelivery: '5-7 business days',
                referenceNumber: `BLK-${Date.now().toString(36).toUpperCase()}`,
            }),
            request_new_card: () => ({
                status: 'New card requested',
                estimatedDelivery: '7-10 business days',
                trackingId: `CRD-${Date.now().toString(36).toUpperCase()}`,
            }),
            card_status: () => ({
                cardStatus: 'Active',
                cardType: 'Visa Platinum',
                expiryDate: '12/2027',
                lastUsed: '2025-03-25 at Grocery Store',
            }),
        };
        const generator = mockResponses[endpointCode];
        if (generator)
            return generator();
        return {
            status: 'success',
            message: `Mock response for ${endpointCode}`,
            timestamp: new Date().toISOString(),
        };
    }
    async logError(endpoint, errorMessage, statusCode, sessionVars) {
        try {
            await this.dataSource.query(`INSERT INTO ErrorLogs (DomainId, Source, ErrorType, ErrorMessage, ContextJson)
         VALUES (@0, @1, @2, @3, @4)`, [
                endpoint.domainId,
                `API:${endpoint.endpointCode}`,
                statusCode ? `HTTP_${statusCode}` : 'CONNECTION_ERROR',
                errorMessage,
                JSON.stringify({
                    endpoint: endpoint.endpointCode,
                    method: endpoint.httpMethod,
                    url: `${endpoint.baseUrl}${endpoint.path}`,
                    sessionId: sessionVars._sessionId || null,
                }),
            ]);
        }
        catch (logError) {
            this.logger.error('Failed to log error:', logError);
        }
    }
};
exports.ApiIntegrationService = ApiIntegrationService;
exports.ApiIntegrationService = ApiIntegrationService = ApiIntegrationService_1 = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, typeorm_1.InjectDataSource)()),
    __metadata("design:paramtypes", [typeof (_a = typeof typeorm_2.DataSource !== "undefined" && typeorm_2.DataSource) === "function" ? _a : Object])
], ApiIntegrationService);
//# sourceMappingURL=api-integration.service.js.map