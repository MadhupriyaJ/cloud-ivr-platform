import { DataSource } from 'typeorm';
export interface IvrFlow {
    flowId: string;
    domainId: string;
    flowCode: string;
    flowName: string;
    description: string | null;
    isEntryFlow: boolean;
    flowVersion: number;
    isActive: boolean;
}
export interface IvrFlowNode {
    nodeId: string;
    flowId: string;
    nodeCode: string;
    nodeType: 'prompt' | 'branch' | 'collect_input' | 'api_call' | 'transfer' | 'end';
    nodeLabel: string | null;
    promptText: string | null;
    sortOrder: number;
    nextNodeCode: string | null;
    branchConfig: Record<string, string> | null;
    timeoutSeconds: number;
    maxRetries: number;
    metadataJson: Record<string, any> | null;
    isActive: boolean;
}
export interface IvrNodeAction {
    actionId: string;
    nodeId: string;
    actionType: 'api_call' | 'db_query' | 'set_variable' | 'send_notification';
    actionOrder: number;
    toolName: string | null;
    endpointId: string | null;
    requestMapping: Record<string, string> | null;
    responseMapping: Record<string, string> | null;
    fallbackResponse: Record<string, string> | null;
    isActive: boolean;
}
export interface DomainApiEndpoint {
    endpointId: string;
    domainId: string;
    endpointCode: string;
    endpointName: string;
    httpMethod: string;
    baseUrl: string;
    path: string;
    headersJson: Record<string, string> | null;
    authType: 'none' | 'bearer' | 'api_key' | 'basic';
    authConfig: Record<string, string> | null;
    timeoutMs: number;
    retryCount: number;
    isActive: boolean;
}
export interface LoadedFlow {
    flow: IvrFlow;
    nodes: Map<string, IvrFlowNode>;
    nodeActions: Map<string, IvrNodeAction[]>;
    entryNodeCode: string;
}
export declare class IvrFlowLoaderService {
    private readonly dataSource;
    private readonly logger;
    private flowCache;
    private endpointCache;
    private readonly CACHE_TTL_MS;
    constructor(dataSource: DataSource);
    loadEntryFlow(domainCode: string): Promise<LoadedFlow | null>;
    loadFlowById(flowId: string): Promise<LoadedFlow | null>;
    loadDomainEndpoints(domainCode: string): Promise<Map<string, DomainApiEndpoint>>;
    listFlowsForDomain(domainCode: string): Promise<IvrFlow[]>;
    invalidateCache(domainCode?: string): void;
    private safeJsonParse;
}
