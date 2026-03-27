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
export declare class AdapterIntegrationService {
    private readonly logger;
    private circuitBreakers;
    inferAdapterType(industry: string): string;
    buildAdapterConfig(domainId: string, industry: string, organizationName: string, overrides?: Partial<AdapterConfig>): AdapterConfig;
    executeTool(config: AdapterConfig, toolName: string, args: Record<string, any>): Promise<AdapterResponse>;
    private callExternalApi;
    private getCircuitBreaker;
    private canExecute;
    private recordSuccess;
    private recordFailure;
    private delay;
}
