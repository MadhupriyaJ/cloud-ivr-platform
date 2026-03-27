import { DataSource } from 'typeorm';
import { DomainApiEndpoint, IvrNodeAction } from './ivr-flow-loader.service';
export interface ApiCallResult {
    success: boolean;
    data: Record<string, any> | null;
    error: string | null;
    statusCode: number | null;
    durationMs: number;
}
export declare class ApiIntegrationService {
    private readonly dataSource;
    private readonly logger;
    constructor(dataSource: DataSource);
    executeApiCall(action: IvrNodeAction, endpoint: DomainApiEndpoint, sessionVars: Record<string, any>): Promise<ApiCallResult>;
    executeMockApiCall(action: IvrNodeAction, endpoint: DomainApiEndpoint, sessionVars: Record<string, any>): Promise<ApiCallResult>;
    private resolveTemplate;
    private buildRequestBody;
    private mapResponse;
    private getNestedValue;
    private applyAuth;
    private buildFallbackResult;
    private generateMockData;
    private logError;
}
