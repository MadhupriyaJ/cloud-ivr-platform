import { DataSource } from 'typeorm';
import { IvrFlowLoaderService, LoadedFlow } from './ivr-flow-loader.service';
import { ApiIntegrationService } from './api-integration.service';
export interface FlowSession {
    sessionId: string;
    domainCode: string;
    flow: LoadedFlow;
    currentNodeCode: string;
    variables: Record<string, any>;
    history: FlowStepResult[];
    status: 'active' | 'completed' | 'transferred' | 'error';
    startedAt: number;
}
export interface FlowStepResult {
    nodeCode: string;
    nodeType: string;
    promptText: string | null;
    action: 'speak' | 'collect' | 'transfer' | 'end' | 'api_result' | 'error';
    data: Record<string, any>;
    nextNodeCode: string | null;
    timestamp: number;
}
export declare class FlowExecutorService {
    private readonly flowLoader;
    private readonly apiIntegration;
    private readonly dataSource;
    private readonly logger;
    private sessions;
    constructor(flowLoader: IvrFlowLoaderService, apiIntegration: ApiIntegrationService, dataSource: DataSource);
    startSession(domainCode: string, sessionId?: string): Promise<FlowStepResult | null>;
    processInput(sessionId: string, userInput: string, detectedIntent?: string): Promise<FlowStepResult | null>;
    getSession(sessionId: string): FlowSession | null;
    getActiveSessions(): FlowSession[];
    endSession(sessionId: string): void;
    private executeCurrentNode;
    private handleBranch;
    private handleCollectInput;
    private handleApiCall;
    private handleTransfer;
    private handleEnd;
    private advanceToNext;
    private buildPromptResult;
    private buildCollectResult;
    private buildErrorResult;
    private resolveTemplate;
}
