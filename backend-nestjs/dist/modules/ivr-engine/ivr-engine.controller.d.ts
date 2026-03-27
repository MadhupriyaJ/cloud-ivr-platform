import { IvrFlowLoaderService } from './ivr-flow-loader.service';
import { FlowExecutorService } from './flow-executor.service';
import { ApiIntegrationService } from './api-integration.service';
import { DataSource } from 'typeorm';
export declare class IvrEngineController {
    private readonly flowLoader;
    private readonly flowExecutor;
    private readonly apiIntegration;
    private readonly dataSource;
    private readonly logger;
    constructor(flowLoader: IvrFlowLoaderService, flowExecutor: FlowExecutorService, apiIntegration: ApiIntegrationService, dataSource: DataSource);
    startSession(body: {
        domainCode: string;
        sessionId?: string;
    }): Promise<any>;
    processInput(sessionId: string, body: {
        userInput: string;
        detectedIntent?: string;
    }): Promise<any>;
    getSession(sessionId: string): Promise<any>;
    endSession(sessionId: string): Promise<any>;
    getActiveSessions(): Promise<any>;
    listFlows(domainCode: string): Promise<any>;
    getFlow(flowId: string): Promise<any>;
    createFlow(body: {
        domainCode: string;
        flowCode: string;
        flowName: string;
        description?: string;
        isEntryFlow?: boolean;
    }): Promise<any>;
    updateFlow(flowId: string, body: {
        flowName?: string;
        description?: string;
        isEntryFlow?: boolean;
        isActive?: boolean;
    }): Promise<any>;
    createNode(flowId: string, body: {
        nodeCode: string;
        nodeType: string;
        nodeLabel?: string;
        promptText?: string;
        sortOrder: number;
        nextNodeCode?: string;
        branchConfig?: Record<string, string>;
    }): Promise<any>;
    updateNode(nodeId: string, body: {
        nodeLabel?: string;
        promptText?: string;
        sortOrder?: number;
        nextNodeCode?: string;
        branchConfig?: Record<string, string>;
        isActive?: boolean;
    }): Promise<any>;
    deleteNode(nodeId: string): Promise<any>;
    createAction(nodeId: string, body: {
        actionType: string;
        actionOrder?: number;
        toolName?: string;
        requestMapping?: Record<string, string>;
        responseMapping?: Record<string, string>;
        fallbackResponse?: Record<string, string>;
    }): Promise<any>;
    listEndpoints(domainCode?: string): Promise<any>;
    createEndpoint(body: {
        domainCode: string;
        endpointCode: string;
        endpointName: string;
        httpMethod: string;
        baseUrl: string;
        path: string;
        headersJson?: Record<string, string>;
        authType?: string;
        authConfig?: Record<string, string>;
        timeoutMs?: number;
        retryCount?: number;
    }): Promise<any>;
    updateEndpoint(endpointId: string, body: Record<string, any>): Promise<any>;
    getErrorLogs(domainCode?: string, limit?: string): Promise<any>;
    invalidateCache(body: {
        domainCode?: string;
    }): Promise<any>;
    getHealth(): Promise<any>;
}
