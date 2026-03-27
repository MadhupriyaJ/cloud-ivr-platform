import { Injectable, Logger } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { DomainApiEndpoint, IvrNodeAction } from './ivr-flow-loader.service';

/**
 * ApiIntegrationService
 * 
 * Flexible REST adapter that executes API calls based on domain configuration.
 * Handles request/response mapping, authentication, retries, and fallbacks.
 * 
 * No hardcoded API logic — everything is driven by DomainApiEndpoints config.
 */

export interface ApiCallResult {
  success: boolean;
  data: Record<string, any> | null;
  error: string | null;
  statusCode: number | null;
  durationMs: number;
}

@Injectable()
export class ApiIntegrationService {
  private readonly logger = new Logger(ApiIntegrationService.name);

  constructor(
    @InjectDataSource()
    private readonly dataSource: DataSource,
  ) {}

  /**
   * Execute an API call based on the node action configuration and endpoint definition.
   * 
   * @param action - The IvrNodeAction that defines request/response mapping
   * @param endpoint - The DomainApiEndpoint that defines the actual HTTP call
   * @param sessionVars - Current session variables (collected inputs, etc.)
   * @returns ApiCallResult with mapped response data or fallback
   */
  async executeApiCall(
    action: IvrNodeAction,
    endpoint: DomainApiEndpoint,
    sessionVars: Record<string, any>,
  ): Promise<ApiCallResult> {
    const startTime = Date.now();

    try {
      // 1. Build the request URL (resolve template variables in path)
      const resolvedPath = this.resolveTemplate(endpoint.path, sessionVars);
      const fullUrl = `${endpoint.baseUrl}${resolvedPath}`;

      // 2. Build request headers
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
        ...(endpoint.headersJson || {}),
      };

      // 3. Apply authentication
      this.applyAuth(headers, endpoint);

      // 4. Build request body from mapping
      let body: any = undefined;
      if (action.requestMapping && ['POST', 'PUT', 'PATCH'].includes(endpoint.httpMethod.toUpperCase())) {
        body = this.buildRequestBody(action.requestMapping, sessionVars);
      }

      // 5. Execute with retries
      let lastError: string | null = null;
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

            // Log error to DB
            await this.logError(endpoint, lastError, response.status, sessionVars);

            if (attempt < endpoint.retryCount) continue;

            // All retries exhausted — return fallback
            return this.buildFallbackResult(action, lastError, Date.now() - startTime);
          }

          const responseData = await response.json();

          // 6. Map response data to session variables
          const mappedData = this.mapResponse(action.responseMapping, responseData);

          this.logger.log(`API call success: ${endpoint.endpointCode} (${Date.now() - startTime}ms)`);

          return {
            success: true,
            data: mappedData,
            error: null,
            statusCode: response.status,
            durationMs: Date.now() - startTime,
          };
        } catch (fetchError: any) {
          lastError = fetchError.name === 'AbortError'
            ? `Timeout after ${endpoint.timeoutMs}ms`
            : fetchError.message || 'Unknown fetch error';

          this.logger.warn(`API call attempt ${attempt + 1} failed: ${lastError}`);
          await this.logError(endpoint, lastError || 'Unknown error', null, sessionVars);

          if (attempt < endpoint.retryCount) {
            // Exponential backoff
            await new Promise(r => setTimeout(r, Math.pow(2, attempt) * 500));
          }
        }
      }

      // All retries exhausted
      return this.buildFallbackResult(action, lastError || 'All retries exhausted', Date.now() - startTime);

    } catch (error: any) {
      this.logger.error(`API integration error: ${error.message}`);
      return this.buildFallbackResult(action, error.message, Date.now() - startTime);
    }
  }

  /**
   * Execute a mock API call (for domains without real core systems).
   * Returns realistic mock data based on the endpoint code.
   */
  async executeMockApiCall(
    action: IvrNodeAction,
    endpoint: DomainApiEndpoint,
    sessionVars: Record<string, any>,
  ): Promise<ApiCallResult> {
    const startTime = Date.now();
    this.logger.log(`Mock API call: ${endpoint.endpointCode}`);

    // Simulate network delay
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

  /**
   * Resolve template variables in a string.
   * e.g., "/api/hospital/billing/{{patient_id}}" + { patient_id: "P123" }
   *     → "/api/hospital/billing/P123"
   */
  private resolveTemplate(template: string, vars: Record<string, any>): string {
    return template.replace(/\{\{(\w+)\}\}/g, (_, key) => {
      const value = vars[key];
      return value !== undefined && value !== null ? String(value) : '';
    });
  }

  /**
   * Build request body from mapping config.
   * Mapping: { "department": "{{department}}", "date": "{{preferred_date}}" }
   * Session: { department: "Cardiology", preferred_date: "2025-04-01" }
   * Result:  { department: "Cardiology", date: "2025-04-01" }
   */
  private buildRequestBody(
    mapping: Record<string, string>,
    sessionVars: Record<string, any>,
  ): Record<string, any> {
    const body: Record<string, any> = {};
    for (const [key, template] of Object.entries(mapping)) {
      body[key] = this.resolveTemplate(String(template), sessionVars);
    }
    return body;
  }

  /**
   * Map API response fields to session variable names.
   * Mapping: { "billing_amount": "outstandingAmount", "last_payment": "lastPaymentDate" }
   * Response: { outstandingAmount: 1500, lastPaymentDate: "2025-03-15" }
   * Result:   { billing_amount: 1500, last_payment: "2025-03-15" }
   */
  private mapResponse(
    mapping: Record<string, string> | null,
    responseData: Record<string, any>,
  ): Record<string, any> {
    if (!mapping) return responseData;

    const mapped: Record<string, any> = {};
    for (const [sessionKey, responseKey] of Object.entries(mapping)) {
      // Support nested keys with dot notation
      mapped[sessionKey] = this.getNestedValue(responseData, responseKey);
    }
    return mapped;
  }

  private getNestedValue(obj: any, path: string): any {
    return path.split('.').reduce((current, key) => current?.[key], obj);
  }

  /**
   * Apply authentication to request headers based on endpoint config.
   */
  private applyAuth(headers: Record<string, string>, endpoint: DomainApiEndpoint): void {
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
          const encoded = Buffer.from(
            `${endpoint.authConfig.username}:${endpoint.authConfig.password}`,
          ).toString('base64');
          headers['Authorization'] = `Basic ${encoded}`;
        }
        break;
      case 'none':
      default:
        break;
    }
  }

  /**
   * Build a fallback result when the API call fails.
   */
  private buildFallbackResult(
    action: IvrNodeAction,
    error: string,
    durationMs: number,
  ): ApiCallResult {
    return {
      success: false,
      data: action.fallbackResponse || { message: 'Service temporarily unavailable. Please try again later.' },
      error,
      statusCode: null,
      durationMs,
    };
  }

  /**
   * Generate mock data based on endpoint code.
   * Used when real core systems are not available.
   */
  private generateMockData(endpointCode: string, sessionVars: Record<string, any>): Record<string, any> {
    const mockResponses: Record<string, () => Record<string, any>> = {
      // Hospital mocks
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

      // Banking mocks
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
    if (generator) return generator();

    // Generic mock for unknown endpoints
    return {
      status: 'success',
      message: `Mock response for ${endpointCode}`,
      timestamp: new Date().toISOString(),
    };
  }

  /**
   * Log API errors to the ErrorLogs table.
   */
  private async logError(
    endpoint: DomainApiEndpoint,
    errorMessage: string,
    statusCode: number | null,
    sessionVars: Record<string, any>,
  ): Promise<void> {
    try {
      await this.dataSource.query(
        `INSERT INTO ErrorLogs (DomainId, Source, ErrorType, ErrorMessage, ContextJson)
         VALUES (@0, @1, @2, @3, @4)`,
        [
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
        ],
      );
    } catch (logError) {
      this.logger.error('Failed to log error:', logError);
    }
  }
}
