/**
 * Adapter Integration Service (NestJS)
 * =====================================
 * Provides the same adapter routing logic for the NestJS backend.
 * Resolves domain adapters, loads tools dynamically, and routes
 * tool calls to the correct core system.
 *
 * This mirrors the Python IntegrationRouter for NestJS deployments.
 */

import { Injectable, Logger } from '@nestjs/common';

// ── Types ─────────────────────────────────────────────────────────

export interface AdapterConfig {
  domainId: string;
  adapterType: string;
  organizationName: string;
  apiBaseUrl: string;
  apiKey: string;
  authType: 'none' | 'api_key' | 'oauth2' | 'basic';
  authConfig: Record<string, string>;
  customSettings: Record<string, any>;
  timeoutMs: number;
  maxRetries: number;
}

export interface AdapterResponse {
  ok: boolean;
  status: 'success' | 'error' | 'not_found' | 'timeout' | 'unauthorized' | 'escalate';
  data?: Record<string, any>;
  error?: string;
  message?: string;
}

export interface ToolDefinition {
  type: 'function';
  name: string;
  description: string;
  parameters: Record<string, any>;
}

// ── Industry to Adapter Mapping ───────────────────────────────────

const INDUSTRY_ADAPTER_MAP: Record<string, string> = {
  healthcare: 'hospital',
  hospital: 'hospital',
  clinic: 'hospital',
  medical: 'hospital',
  banking: 'banking',
  finance: 'banking',
  insurance: 'insurance',
  logistics: 'logistics',
  shipping: 'logistics',
  ecommerce: 'generic',
  retail: 'generic',
  telecom: 'generic',
  education: 'generic',
  general: 'generic',
};

// ── Circuit Breaker ───────────────────────────────────────────────

interface CircuitBreakerState {
  failureCount: number;
  lastFailureTime: number;
  state: 'closed' | 'open' | 'half_open';
}

@Injectable()
export class AdapterIntegrationService {
  private readonly logger = new Logger(AdapterIntegrationService.name);
  private circuitBreakers: Map<string, CircuitBreakerState> = new Map();

  /**
   * Infer adapter type from industry string.
   */
  inferAdapterType(industry: string): string {
    const key = industry.trim().toLowerCase();
    if (INDUSTRY_ADAPTER_MAP[key]) {
      return INDUSTRY_ADAPTER_MAP[key];
    }
    for (const [keyword, adapterType] of Object.entries(INDUSTRY_ADAPTER_MAP)) {
      if (key.includes(keyword)) {
        return adapterType;
      }
    }
    return 'generic';
  }

  /**
   * Build adapter config from domain metadata.
   */
  buildAdapterConfig(
    domainId: string,
    industry: string,
    organizationName: string,
    overrides?: Partial<AdapterConfig>,
  ): AdapterConfig {
    const adapterType = this.inferAdapterType(industry);
    return {
      domainId,
      adapterType,
      organizationName,
      apiBaseUrl: '',
      apiKey: '',
      authType: 'none',
      authConfig: {},
      customSettings: {},
      timeoutMs: 30000,
      maxRetries: 3,
      ...overrides,
    };
  }

  /**
   * Execute a tool call through the adapter.
   * In NestJS, this calls the Python adapter service via HTTP.
   */
  async executeTool(
    config: AdapterConfig,
    toolName: string,
    args: Record<string, any>,
  ): Promise<AdapterResponse> {
    const cb = this.getCircuitBreaker(config.domainId);
    if (!this.canExecute(cb)) {
      return {
        ok: false,
        status: 'error',
        error: 'Service temporarily unavailable (circuit breaker open).',
      };
    }

    let lastError = '';
    for (let attempt = 1; attempt <= config.maxRetries; attempt++) {
      try {
        // If apiBaseUrl is set, call the external API directly
        if (config.apiBaseUrl) {
          const result = await this.callExternalApi(config, toolName, args);
          if (result.ok) {
            this.recordSuccess(cb);
            return result;
          }
          lastError = result.error || 'Unknown error';
          if (result.status === 'not_found' || result.status === 'escalate') {
            return result;
          }
        } else {
          // Demo mode: return placeholder response
          this.recordSuccess(cb);
          return {
            ok: true,
            status: 'success',
            data: { tool: toolName, args, mode: 'demo' },
            message: `Demo response for ${toolName}`,
          };
        }
      } catch (error: any) {
        lastError = error.message || String(error);
        this.logger.warn(
          `Tool execution attempt ${attempt}/${config.maxRetries} failed: ${lastError}`,
        );
      }

      if (attempt < config.maxRetries) {
        await this.delay(500 * attempt);
      }
    }

    this.recordFailure(cb);
    return {
      ok: false,
      status: 'error',
      error: `All ${config.maxRetries} attempts failed: ${lastError}`,
    };
  }

  /**
   * Call an external API endpoint.
   */
  private async callExternalApi(
    config: AdapterConfig,
    toolName: string,
    args: Record<string, any>,
  ): Promise<AdapterResponse> {
    const url = `${config.apiBaseUrl.replace(/\/$/, '')}/api/${config.adapterType}/tools/${toolName}`;
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };

    if (config.authType === 'api_key' && config.apiKey) {
      headers['X-API-Key'] = config.apiKey;
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), config.timeoutMs);

    try {
      const response = await fetch(url, {
        method: 'POST',
        headers,
        body: JSON.stringify(args),
        signal: controller.signal,
      });

      clearTimeout(timeout);

      if (!response.ok) {
        return {
          ok: false,
          status: 'error',
          error: `HTTP ${response.status}: ${response.statusText}`,
        };
      }

      const data = await response.json();
      return { ok: true, status: 'success', data };
    } catch (error: any) {
      clearTimeout(timeout);
      if (error.name === 'AbortError') {
        return { ok: false, status: 'timeout', error: 'Request timed out' };
      }
      throw error;
    }
  }

  // ── Circuit Breaker ─────────────────────────────────────────────

  private getCircuitBreaker(domainId: string): CircuitBreakerState {
    if (!this.circuitBreakers.has(domainId)) {
      this.circuitBreakers.set(domainId, {
        failureCount: 0,
        lastFailureTime: 0,
        state: 'closed',
      });
    }
    return this.circuitBreakers.get(domainId)!;
  }

  private canExecute(cb: CircuitBreakerState): boolean {
    if (cb.state === 'closed') return true;
    if (cb.state === 'open') {
      const elapsed = Date.now() - cb.lastFailureTime;
      if (elapsed >= 60000) {
        cb.state = 'half_open';
        return true;
      }
      return false;
    }
    return true; // half_open
  }

  private recordSuccess(cb: CircuitBreakerState): void {
    cb.failureCount = 0;
    cb.state = 'closed';
  }

  private recordFailure(cb: CircuitBreakerState): void {
    cb.failureCount++;
    cb.lastFailureTime = Date.now();
    if (cb.failureCount >= 5) {
      cb.state = 'open';
      this.logger.warn('Circuit breaker OPENED');
    }
  }

  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
