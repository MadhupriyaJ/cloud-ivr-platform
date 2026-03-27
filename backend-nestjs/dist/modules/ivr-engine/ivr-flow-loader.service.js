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
var IvrFlowLoaderService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.IvrFlowLoaderService = void 0;
const common_1 = require("@nestjs/common");
const typeorm_1 = require("@nestjs/typeorm");
const typeorm_2 = require("typeorm");
let IvrFlowLoaderService = IvrFlowLoaderService_1 = class IvrFlowLoaderService {
    dataSource;
    logger = new common_1.Logger(IvrFlowLoaderService_1.name);
    flowCache = new Map();
    endpointCache = new Map();
    CACHE_TTL_MS = 5 * 60 * 1000;
    constructor(dataSource) {
        this.dataSource = dataSource;
    }
    async loadEntryFlow(domainCode) {
        const cached = this.flowCache.get(domainCode);
        if (cached && Date.now() - cached.loadedAt < this.CACHE_TTL_MS) {
            this.logger.debug(`Cache hit for domain: ${domainCode}`);
            return cached.data;
        }
        this.logger.log(`Loading entry flow for domain: ${domainCode}`);
        try {
            const domainResult = await this.dataSource.query(`SELECT DomainId FROM Domains WHERE DomainCode = @0 AND IsActive = 1`, [domainCode]);
            if (!domainResult || domainResult.length === 0) {
                this.logger.warn(`Domain not found: ${domainCode}`);
                return null;
            }
            const domainId = domainResult[0].DomainId;
            const flowResult = await this.dataSource.query(`SELECT FlowId, DomainId, FlowCode, FlowName, Description, IsEntryFlow, FlowVersion, IsActive
         FROM IvrFlows
         WHERE DomainId = @0 AND IsEntryFlow = 1 AND IsActive = 1`, [domainId]);
            if (!flowResult || flowResult.length === 0) {
                this.logger.warn(`No entry flow found for domain: ${domainCode}`);
                return null;
            }
            const flow = {
                flowId: flowResult[0].FlowId,
                domainId: flowResult[0].DomainId,
                flowCode: flowResult[0].FlowCode,
                flowName: flowResult[0].FlowName,
                description: flowResult[0].Description,
                isEntryFlow: flowResult[0].IsEntryFlow,
                flowVersion: flowResult[0].FlowVersion,
                isActive: flowResult[0].IsActive,
            };
            const nodesResult = await this.dataSource.query(`SELECT NodeId, FlowId, NodeCode, NodeType, NodeLabel, PromptText, SortOrder,
                NextNodeCode, BranchConfig, TimeoutSeconds, MaxRetries, MetadataJson, IsActive
         FROM IvrFlowNodes
         WHERE FlowId = @0 AND IsActive = 1
         ORDER BY SortOrder`, [flow.flowId]);
            const nodes = new Map();
            let entryNodeCode = '';
            for (const row of nodesResult) {
                const node = {
                    nodeId: row.NodeId,
                    flowId: row.FlowId,
                    nodeCode: row.NodeCode,
                    nodeType: row.NodeType,
                    nodeLabel: row.NodeLabel,
                    promptText: row.PromptText,
                    sortOrder: row.SortOrder,
                    nextNodeCode: row.NextNodeCode,
                    branchConfig: row.BranchConfig ? this.safeJsonParse(row.BranchConfig) : null,
                    timeoutSeconds: row.TimeoutSeconds || 30,
                    maxRetries: row.MaxRetries || 3,
                    metadataJson: row.MetadataJson ? this.safeJsonParse(row.MetadataJson) : null,
                    isActive: row.IsActive,
                };
                nodes.set(node.nodeCode, node);
                if (node.sortOrder === 1 || !entryNodeCode) {
                    entryNodeCode = node.nodeCode;
                }
            }
            const nodeIds = Array.from(nodes.values()).map(n => `'${n.nodeId}'`).join(',');
            const nodeActions = new Map();
            if (nodeIds.length > 0) {
                const actionsResult = await this.dataSource.query(`SELECT ActionId, NodeId, ActionType, ActionOrder, ToolName, EndpointId,
                  RequestMapping, ResponseMapping, FallbackResponse, IsActive
           FROM IvrNodeActions
           WHERE NodeId IN (${nodeIds}) AND IsActive = 1
           ORDER BY ActionOrder`);
                for (const row of actionsResult) {
                    const action = {
                        actionId: row.ActionId,
                        nodeId: row.NodeId,
                        actionType: row.ActionType,
                        actionOrder: row.ActionOrder,
                        toolName: row.ToolName,
                        endpointId: row.EndpointId,
                        requestMapping: row.RequestMapping ? this.safeJsonParse(row.RequestMapping) : null,
                        responseMapping: row.ResponseMapping ? this.safeJsonParse(row.ResponseMapping) : null,
                        fallbackResponse: row.FallbackResponse ? this.safeJsonParse(row.FallbackResponse) : null,
                        isActive: row.IsActive,
                    };
                    const ownerNode = Array.from(nodes.values()).find(n => n.nodeId === action.nodeId);
                    if (ownerNode) {
                        const existing = nodeActions.get(ownerNode.nodeCode) || [];
                        existing.push(action);
                        nodeActions.set(ownerNode.nodeCode, existing);
                    }
                }
            }
            const loadedFlow = { flow, nodes, nodeActions, entryNodeCode };
            this.flowCache.set(domainCode, { data: loadedFlow, loadedAt: Date.now() });
            this.logger.log(`Loaded flow "${flow.flowName}" with ${nodes.size} nodes for domain: ${domainCode}`);
            return loadedFlow;
        }
        catch (error) {
            this.logger.error(`Failed to load flow for domain ${domainCode}:`, error);
            return null;
        }
    }
    async loadFlowById(flowId) {
        try {
            const flowResult = await this.dataSource.query(`SELECT FlowId, DomainId, FlowCode, FlowName, Description, IsEntryFlow, FlowVersion, IsActive
         FROM IvrFlows WHERE FlowId = @0 AND IsActive = 1`, [flowId]);
            if (!flowResult || flowResult.length === 0)
                return null;
            const domainResult = await this.dataSource.query(`SELECT DomainCode FROM Domains WHERE DomainId = @0`, [flowResult[0].DomainId]);
            if (!domainResult || domainResult.length === 0)
                return null;
            return this.loadEntryFlow(domainResult[0].DomainCode);
        }
        catch (error) {
            this.logger.error(`Failed to load flow by ID ${flowId}:`, error);
            return null;
        }
    }
    async loadDomainEndpoints(domainCode) {
        const cached = this.endpointCache.get(domainCode);
        if (cached)
            return cached;
        try {
            const domainResult = await this.dataSource.query(`SELECT DomainId FROM Domains WHERE DomainCode = @0`, [domainCode]);
            if (!domainResult || domainResult.length === 0)
                return new Map();
            const result = await this.dataSource.query(`SELECT EndpointId, DomainId, EndpointCode, EndpointName, HttpMethod, BaseUrl, Path,
                HeadersJson, AuthType, AuthConfig, TimeoutMs, RetryCount, IsActive
         FROM DomainApiEndpoints
         WHERE DomainId = @0 AND IsActive = 1`, [domainResult[0].DomainId]);
            const endpoints = new Map();
            for (const row of result) {
                endpoints.set(row.EndpointCode, {
                    endpointId: row.EndpointId,
                    domainId: row.DomainId,
                    endpointCode: row.EndpointCode,
                    endpointName: row.EndpointName,
                    httpMethod: row.HttpMethod,
                    baseUrl: row.BaseUrl,
                    path: row.Path,
                    headersJson: row.HeadersJson ? this.safeJsonParse(row.HeadersJson) : null,
                    authType: row.AuthType || 'none',
                    authConfig: row.AuthConfig ? this.safeJsonParse(row.AuthConfig) : null,
                    timeoutMs: row.TimeoutMs || 30000,
                    retryCount: row.RetryCount || 2,
                    isActive: row.IsActive,
                });
            }
            this.endpointCache.set(domainCode, endpoints);
            return endpoints;
        }
        catch (error) {
            this.logger.error(`Failed to load endpoints for domain ${domainCode}:`, error);
            return new Map();
        }
    }
    async listFlowsForDomain(domainCode) {
        try {
            const domainResult = await this.dataSource.query(`SELECT DomainId FROM Domains WHERE DomainCode = @0`, [domainCode]);
            if (!domainResult || domainResult.length === 0)
                return [];
            const result = await this.dataSource.query(`SELECT FlowId, DomainId, FlowCode, FlowName, Description, IsEntryFlow, FlowVersion, IsActive, CreatedAt, UpdatedAt
         FROM IvrFlows WHERE DomainId = @0 ORDER BY IsEntryFlow DESC, FlowCode`, [domainResult[0].DomainId]);
            return result.map((r) => ({
                flowId: r.FlowId,
                domainId: r.DomainId,
                flowCode: r.FlowCode,
                flowName: r.FlowName,
                description: r.Description,
                isEntryFlow: r.IsEntryFlow,
                flowVersion: r.FlowVersion,
                isActive: r.IsActive,
            }));
        }
        catch (error) {
            this.logger.error(`Failed to list flows for domain ${domainCode}:`, error);
            return [];
        }
    }
    invalidateCache(domainCode) {
        if (domainCode) {
            this.flowCache.delete(domainCode);
            this.endpointCache.delete(domainCode);
            this.logger.log(`Cache invalidated for domain: ${domainCode}`);
        }
        else {
            this.flowCache.clear();
            this.endpointCache.clear();
            this.logger.log('All caches invalidated');
        }
    }
    safeJsonParse(value) {
        try {
            return JSON.parse(value);
        }
        catch {
            return null;
        }
    }
};
exports.IvrFlowLoaderService = IvrFlowLoaderService;
exports.IvrFlowLoaderService = IvrFlowLoaderService = IvrFlowLoaderService_1 = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, typeorm_1.InjectDataSource)()),
    __metadata("design:paramtypes", [typeorm_2.DataSource])
], IvrFlowLoaderService);
//# sourceMappingURL=ivr-flow-loader.service.js.map