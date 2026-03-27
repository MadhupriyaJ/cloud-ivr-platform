"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var AdapterIntegrationService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.AdapterIntegrationService = void 0;
const common_1 = require("@nestjs/common");
const INDUSTRY_ADAPTER_MAP = {
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
let AdapterIntegrationService = AdapterIntegrationService_1 = class AdapterIntegrationService {
    logger = new common_1.Logger(AdapterIntegrationService_1.name);
    circuitBreakers = new Map();
    inferAdapterType(industry) {
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
    buildAdapterConfig(domainId, industry, organizationName, overrides) {
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
    async executeTool(config, toolName, args) {
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
                }
                else {
                    this.recordSuccess(cb);
                    return {
                        ok: true,
                        status: 'success',
                        data: { tool: toolName, args, mode: 'demo' },
                        message: `Demo response for ${toolName}`,
                    };
                }
            }
            catch (error) {
                lastError = error.message || String(error);
                this.logger.warn(`Tool execution attempt ${attempt}/${config.maxRetries} failed: ${lastError}`);
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
    async callExternalApi(config, toolName, args) {
        const url = `${config.apiBaseUrl.replace(/\/$/, '')}/api/${config.adapterType}/tools/${toolName}`;
        const headers = {
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
        }
        catch (error) {
            clearTimeout(timeout);
            if (error.name === 'AbortError') {
                return { ok: false, status: 'timeout', error: 'Request timed out' };
            }
            throw error;
        }
    }
    getCircuitBreaker(domainId) {
        if (!this.circuitBreakers.has(domainId)) {
            this.circuitBreakers.set(domainId, {
                failureCount: 0,
                lastFailureTime: 0,
                state: 'closed',
            });
        }
        return this.circuitBreakers.get(domainId);
    }
    canExecute(cb) {
        if (cb.state === 'closed')
            return true;
        if (cb.state === 'open') {
            const elapsed = Date.now() - cb.lastFailureTime;
            if (elapsed >= 60000) {
                cb.state = 'half_open';
                return true;
            }
            return false;
        }
        return true;
    }
    recordSuccess(cb) {
        cb.failureCount = 0;
        cb.state = 'closed';
    }
    recordFailure(cb) {
        cb.failureCount++;
        cb.lastFailureTime = Date.now();
        if (cb.failureCount >= 5) {
            cb.state = 'open';
            this.logger.warn('Circuit breaker OPENED');
        }
    }
    delay(ms) {
        return new Promise((resolve) => setTimeout(resolve, ms));
    }
};
exports.AdapterIntegrationService = AdapterIntegrationService;
exports.AdapterIntegrationService = AdapterIntegrationService = AdapterIntegrationService_1 = __decorate([
    (0, common_1.Injectable)()
], AdapterIntegrationService);
//# sourceMappingURL=adapter-integration.service.js.map