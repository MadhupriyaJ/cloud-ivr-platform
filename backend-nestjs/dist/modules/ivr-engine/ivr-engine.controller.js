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
var IvrEngineController_1;
var _a, _b, _c, _d, _e, _f, _g, _h, _j, _k, _l, _m, _o, _p, _q, _r, _s, _t, _u, _v, _w;
Object.defineProperty(exports, "__esModule", { value: true });
exports.IvrEngineController = void 0;
const common_1 = require("@nestjs/common");
const ivr_flow_loader_service_1 = require("./ivr-flow-loader.service");
const flow_executor_service_1 = require("./flow-executor.service");
const api_integration_service_1 = require("./api-integration.service");
const typeorm_1 = require("@nestjs/typeorm");
const typeorm_2 = require("typeorm");
let IvrEngineController = IvrEngineController_1 = class IvrEngineController {
    flowLoader;
    flowExecutor;
    apiIntegration;
    dataSource;
    logger = new common_1.Logger(IvrEngineController_1.name);
    constructor(flowLoader, flowExecutor, apiIntegration, dataSource) {
        this.flowLoader = flowLoader;
        this.flowExecutor = flowExecutor;
        this.apiIntegration = apiIntegration;
        this.dataSource = dataSource;
    }
    async startSession(body) {
        if (!body.domainCode) {
            throw new common_1.HttpException('domainCode is required', common_1.HttpStatus.BAD_REQUEST);
        }
        const sid = body.sessionId || `sess_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
        const result = await this.flowExecutor.startSession(body.domainCode, sid);
        if (!result) {
            throw new common_1.HttpException(`No IVR flow configured for domain: ${body.domainCode}`, common_1.HttpStatus.NOT_FOUND);
        }
        const session = this.flowExecutor.getSession(sid);
        return {
            sessionId: sid,
            step: result,
            status: session?.status || 'active',
        };
    }
    async processInput(sessionId, body) {
        const result = await this.flowExecutor.processInput(sessionId, body.userInput, body.detectedIntent);
        if (!result) {
            throw new common_1.HttpException('Session not found or inactive', common_1.HttpStatus.NOT_FOUND);
        }
        const session = this.flowExecutor.getSession(sessionId);
        return {
            sessionId,
            step: result,
            status: session?.status || 'unknown',
            variables: session?.variables || {},
        };
    }
    async getSession(sessionId) {
        const session = this.flowExecutor.getSession(sessionId);
        if (!session) {
            throw new common_1.HttpException('Session not found', common_1.HttpStatus.NOT_FOUND);
        }
        return {
            sessionId: session.sessionId,
            domainCode: session.domainCode,
            currentNode: session.currentNodeCode,
            status: session.status,
            variables: session.variables,
            history: session.history,
            startedAt: session.startedAt,
            durationMs: Date.now() - session.startedAt,
        };
    }
    async endSession(sessionId) {
        this.flowExecutor.endSession(sessionId);
        return { sessionId, status: 'completed' };
    }
    async getActiveSessions() {
        const sessions = this.flowExecutor.getActiveSessions();
        return {
            count: sessions.length,
            sessions: sessions.map(s => ({
                sessionId: s.sessionId,
                domainCode: s.domainCode,
                currentNode: s.currentNodeCode,
                status: s.status,
                durationMs: Date.now() - s.startedAt,
            })),
        };
    }
    async listFlows(domainCode) {
        if (!domainCode) {
            const result = await this.dataSource.query(`SELECT f.FlowId, f.DomainId, f.FlowCode, f.FlowName, f.Description, 
                f.IsEntryFlow, f.FlowVersion, f.IsActive, f.CreatedAt, f.UpdatedAt,
                d.DomainCode, d.DomainName,
                (SELECT COUNT(*) FROM IvrFlowNodes n WHERE n.FlowId = f.FlowId) as NodeCount
         FROM IvrFlows f
         JOIN Domains d ON d.DomainId = f.DomainId
         ORDER BY d.DomainCode, f.IsEntryFlow DESC`);
            return result;
        }
        const flows = await this.flowLoader.listFlowsForDomain(domainCode);
        return flows;
    }
    async getFlow(flowId) {
        const flow = await this.dataSource.query(`SELECT FlowId, DomainId, FlowCode, FlowName, Description, IsEntryFlow, FlowVersion, IsActive
       FROM IvrFlows WHERE FlowId = @0`, [flowId]);
        if (!flow || flow.length === 0) {
            throw new common_1.HttpException('Flow not found', common_1.HttpStatus.NOT_FOUND);
        }
        const nodes = await this.dataSource.query(`SELECT n.NodeId, n.NodeCode, n.NodeType, n.NodeLabel, n.PromptText, n.SortOrder,
              n.NextNodeCode, n.BranchConfig, n.TimeoutSeconds, n.MaxRetries, n.IsActive
       FROM IvrFlowNodes n
       WHERE n.FlowId = @0
       ORDER BY n.SortOrder`, [flowId]);
        const nodesWithActions = [];
        for (const node of nodes) {
            const actions = await this.dataSource.query(`SELECT ActionId, ActionType, ActionOrder, ToolName, EndpointId,
                RequestMapping, ResponseMapping, FallbackResponse, IsActive
         FROM IvrNodeActions
         WHERE NodeId = @0
         ORDER BY ActionOrder`, [node.NodeId]);
            nodesWithActions.push({ ...node, actions });
        }
        return { ...flow[0], nodes: nodesWithActions };
    }
    async createFlow(body) {
        const domainResult = await this.dataSource.query(`SELECT DomainId FROM Domains WHERE DomainCode = @0`, [body.domainCode]);
        if (!domainResult || domainResult.length === 0) {
            throw new common_1.HttpException('Domain not found', common_1.HttpStatus.NOT_FOUND);
        }
        const result = await this.dataSource.query(`INSERT INTO IvrFlows (DomainId, FlowCode, FlowName, Description, IsEntryFlow)
       OUTPUT INSERTED.*
       VALUES (@0, @1, @2, @3, @4)`, [domainResult[0].DomainId, body.flowCode, body.flowName, body.description || null, body.isEntryFlow ? 1 : 0]);
        this.flowLoader.invalidateCache(body.domainCode);
        return result[0];
    }
    async updateFlow(flowId, body) {
        const sets = [];
        const params = [flowId];
        let paramIdx = 1;
        if (body.flowName !== undefined) {
            sets.push(`FlowName = @${paramIdx}`);
            params.push(body.flowName);
            paramIdx++;
        }
        if (body.description !== undefined) {
            sets.push(`Description = @${paramIdx}`);
            params.push(body.description);
            paramIdx++;
        }
        if (body.isEntryFlow !== undefined) {
            sets.push(`IsEntryFlow = @${paramIdx}`);
            params.push(body.isEntryFlow ? 1 : 0);
            paramIdx++;
        }
        if (body.isActive !== undefined) {
            sets.push(`IsActive = @${paramIdx}`);
            params.push(body.isActive ? 1 : 0);
            paramIdx++;
        }
        if (sets.length === 0) {
            throw new common_1.HttpException('No fields to update', common_1.HttpStatus.BAD_REQUEST);
        }
        sets.push('UpdatedAt = GETUTCDATE()');
        sets.push(`FlowVersion = FlowVersion + 1`);
        await this.dataSource.query(`UPDATE IvrFlows SET ${sets.join(', ')} WHERE FlowId = @0`, params);
        this.flowLoader.invalidateCache();
        return { success: true, flowId };
    }
    async createNode(flowId, body) {
        const result = await this.dataSource.query(`INSERT INTO IvrFlowNodes (FlowId, NodeCode, NodeType, NodeLabel, PromptText, SortOrder, NextNodeCode, BranchConfig)
       OUTPUT INSERTED.*
       VALUES (@0, @1, @2, @3, @4, @5, @6, @7)`, [
            flowId, body.nodeCode, body.nodeType, body.nodeLabel || null,
            body.promptText || null, body.sortOrder, body.nextNodeCode || null,
            body.branchConfig ? JSON.stringify(body.branchConfig) : null,
        ]);
        this.flowLoader.invalidateCache();
        return result[0];
    }
    async updateNode(nodeId, body) {
        const sets = [];
        const params = [nodeId];
        let paramIdx = 1;
        if (body.nodeLabel !== undefined) {
            sets.push(`NodeLabel = @${paramIdx}`);
            params.push(body.nodeLabel);
            paramIdx++;
        }
        if (body.promptText !== undefined) {
            sets.push(`PromptText = @${paramIdx}`);
            params.push(body.promptText);
            paramIdx++;
        }
        if (body.sortOrder !== undefined) {
            sets.push(`SortOrder = @${paramIdx}`);
            params.push(body.sortOrder);
            paramIdx++;
        }
        if (body.nextNodeCode !== undefined) {
            sets.push(`NextNodeCode = @${paramIdx}`);
            params.push(body.nextNodeCode);
            paramIdx++;
        }
        if (body.branchConfig !== undefined) {
            sets.push(`BranchConfig = @${paramIdx}`);
            params.push(JSON.stringify(body.branchConfig));
            paramIdx++;
        }
        if (body.isActive !== undefined) {
            sets.push(`IsActive = @${paramIdx}`);
            params.push(body.isActive ? 1 : 0);
            paramIdx++;
        }
        if (sets.length === 0) {
            throw new common_1.HttpException('No fields to update', common_1.HttpStatus.BAD_REQUEST);
        }
        await this.dataSource.query(`UPDATE IvrFlowNodes SET ${sets.join(', ')} WHERE NodeId = @0`, params);
        this.flowLoader.invalidateCache();
        return { success: true, nodeId };
    }
    async deleteNode(nodeId) {
        await this.dataSource.query(`DELETE FROM IvrNodeActions WHERE NodeId = @0`, [nodeId]);
        await this.dataSource.query(`DELETE FROM IvrFlowNodes WHERE NodeId = @0`, [nodeId]);
        this.flowLoader.invalidateCache();
        return { success: true, nodeId };
    }
    async createAction(nodeId, body) {
        const result = await this.dataSource.query(`INSERT INTO IvrNodeActions (NodeId, ActionType, ActionOrder, ToolName, RequestMapping, ResponseMapping, FallbackResponse)
       OUTPUT INSERTED.*
       VALUES (@0, @1, @2, @3, @4, @5, @6)`, [
            nodeId, body.actionType, body.actionOrder || 1, body.toolName || null,
            body.requestMapping ? JSON.stringify(body.requestMapping) : null,
            body.responseMapping ? JSON.stringify(body.responseMapping) : null,
            body.fallbackResponse ? JSON.stringify(body.fallbackResponse) : null,
        ]);
        this.flowLoader.invalidateCache();
        return result[0];
    }
    async listEndpoints(domainCode) {
        if (domainCode) {
            const domainResult = await this.dataSource.query(`SELECT DomainId FROM Domains WHERE DomainCode = @0`, [domainCode]);
            if (!domainResult || domainResult.length === 0)
                return [];
            return this.dataSource.query(`SELECT * FROM DomainApiEndpoints WHERE DomainId = @0 ORDER BY EndpointCode`, [domainResult[0].DomainId]);
        }
        return this.dataSource.query(`SELECT e.*, d.DomainCode, d.DomainName
       FROM DomainApiEndpoints e
       JOIN Domains d ON d.DomainId = e.DomainId
       ORDER BY d.DomainCode, e.EndpointCode`);
    }
    async createEndpoint(body) {
        const domainResult = await this.dataSource.query(`SELECT DomainId FROM Domains WHERE DomainCode = @0`, [body.domainCode]);
        if (!domainResult || domainResult.length === 0) {
            throw new common_1.HttpException('Domain not found', common_1.HttpStatus.NOT_FOUND);
        }
        const result = await this.dataSource.query(`INSERT INTO DomainApiEndpoints (DomainId, EndpointCode, EndpointName, HttpMethod, BaseUrl, Path, HeadersJson, AuthType, AuthConfig, TimeoutMs, RetryCount)
       OUTPUT INSERTED.*
       VALUES (@0, @1, @2, @3, @4, @5, @6, @7, @8, @9, @10)`, [
            domainResult[0].DomainId, body.endpointCode, body.endpointName,
            body.httpMethod, body.baseUrl, body.path,
            body.headersJson ? JSON.stringify(body.headersJson) : null,
            body.authType || 'none',
            body.authConfig ? JSON.stringify(body.authConfig) : null,
            body.timeoutMs || 30000,
            body.retryCount || 2,
        ]);
        this.flowLoader.invalidateCache(body.domainCode);
        return result[0];
    }
    async updateEndpoint(endpointId, body) {
        const sets = [];
        const params = [endpointId];
        let paramIdx = 1;
        const fields = ['EndpointName', 'HttpMethod', 'BaseUrl', 'Path', 'AuthType', 'TimeoutMs', 'RetryCount', 'IsActive'];
        const bodyMap = {
            endpointName: 'EndpointName', httpMethod: 'HttpMethod', baseUrl: 'BaseUrl',
            path: 'Path', authType: 'AuthType', timeoutMs: 'TimeoutMs', retryCount: 'RetryCount', isActive: 'IsActive',
        };
        for (const [bodyKey, dbCol] of Object.entries(bodyMap)) {
            if (body[bodyKey] !== undefined) {
                sets.push(`${dbCol} = @${paramIdx}`);
                params.push(body[bodyKey]);
                paramIdx++;
            }
        }
        if (body.headersJson !== undefined) {
            sets.push(`HeadersJson = @${paramIdx}`);
            params.push(JSON.stringify(body.headersJson));
            paramIdx++;
        }
        if (body.authConfig !== undefined) {
            sets.push(`AuthConfig = @${paramIdx}`);
            params.push(JSON.stringify(body.authConfig));
            paramIdx++;
        }
        if (sets.length === 0) {
            throw new common_1.HttpException('No fields to update', common_1.HttpStatus.BAD_REQUEST);
        }
        await this.dataSource.query(`UPDATE DomainApiEndpoints SET ${sets.join(', ')} WHERE EndpointId = @0`, params);
        this.flowLoader.invalidateCache();
        return { success: true, endpointId };
    }
    async getErrorLogs(domainCode, limit) {
        const maxRows = parseInt(limit || '50');
        if (domainCode) {
            const domainResult = await this.dataSource.query(`SELECT DomainId FROM Domains WHERE DomainCode = @0`, [domainCode]);
            if (!domainResult || domainResult.length === 0)
                return [];
            return this.dataSource.query(`SELECT TOP (${maxRows}) * FROM ErrorLogs WHERE DomainId = @0 ORDER BY CreatedAt DESC`, [domainResult[0].DomainId]);
        }
        return this.dataSource.query(`SELECT TOP (${maxRows}) e.*, d.DomainCode, d.DomainName
       FROM ErrorLogs e
       LEFT JOIN Domains d ON d.DomainId = e.DomainId
       ORDER BY e.CreatedAt DESC`);
    }
    async invalidateCache(body) {
        this.flowLoader.invalidateCache(body.domainCode);
        return { success: true, message: body.domainCode ? `Cache invalidated for ${body.domainCode}` : 'All caches invalidated' };
    }
    async getHealth() {
        try {
            const flowCount = await this.dataSource.query('SELECT COUNT(*) as cnt FROM IvrFlows WHERE IsActive = 1');
            const nodeCount = await this.dataSource.query('SELECT COUNT(*) as cnt FROM IvrFlowNodes WHERE IsActive = 1');
            const endpointCount = await this.dataSource.query('SELECT COUNT(*) as cnt FROM DomainApiEndpoints WHERE IsActive = 1');
            const errorCount = await this.dataSource.query(`SELECT COUNT(*) as cnt FROM ErrorLogs WHERE CreatedAt >= DATEADD(HOUR, -24, GETUTCDATE())`);
            const activeSessions = this.flowExecutor.getActiveSessions();
            return {
                status: 'healthy',
                engine: {
                    flows: flowCount[0].cnt,
                    nodes: nodeCount[0].cnt,
                    endpoints: endpointCount[0].cnt,
                    activeSessions: activeSessions.length,
                    errorsLast24h: errorCount[0].cnt,
                },
                timestamp: new Date().toISOString(),
            };
        }
        catch (error) {
            return { status: 'unhealthy', error: error.message };
        }
    }
};
exports.IvrEngineController = IvrEngineController;
__decorate([
    (0, common_1.Post)('session/start'),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", typeof (_b = typeof Promise !== "undefined" && Promise) === "function" ? _b : Object)
], IvrEngineController.prototype, "startSession", null);
__decorate([
    (0, common_1.Post)('session/:sessionId/input'),
    __param(0, (0, common_1.Param)('sessionId')),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object]),
    __metadata("design:returntype", typeof (_c = typeof Promise !== "undefined" && Promise) === "function" ? _c : Object)
], IvrEngineController.prototype, "processInput", null);
__decorate([
    (0, common_1.Get)('session/:sessionId'),
    __param(0, (0, common_1.Param)('sessionId')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", typeof (_d = typeof Promise !== "undefined" && Promise) === "function" ? _d : Object)
], IvrEngineController.prototype, "getSession", null);
__decorate([
    (0, common_1.Post)('session/:sessionId/end'),
    __param(0, (0, common_1.Param)('sessionId')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", typeof (_e = typeof Promise !== "undefined" && Promise) === "function" ? _e : Object)
], IvrEngineController.prototype, "endSession", null);
__decorate([
    (0, common_1.Get)('sessions/active'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", typeof (_f = typeof Promise !== "undefined" && Promise) === "function" ? _f : Object)
], IvrEngineController.prototype, "getActiveSessions", null);
__decorate([
    (0, common_1.Get)('flows'),
    __param(0, (0, common_1.Query)('domainCode')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", typeof (_g = typeof Promise !== "undefined" && Promise) === "function" ? _g : Object)
], IvrEngineController.prototype, "listFlows", null);
__decorate([
    (0, common_1.Get)('flows/:flowId'),
    __param(0, (0, common_1.Param)('flowId')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", typeof (_h = typeof Promise !== "undefined" && Promise) === "function" ? _h : Object)
], IvrEngineController.prototype, "getFlow", null);
__decorate([
    (0, common_1.Post)('flows'),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", typeof (_j = typeof Promise !== "undefined" && Promise) === "function" ? _j : Object)
], IvrEngineController.prototype, "createFlow", null);
__decorate([
    (0, common_1.Put)('flows/:flowId'),
    __param(0, (0, common_1.Param)('flowId')),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object]),
    __metadata("design:returntype", typeof (_k = typeof Promise !== "undefined" && Promise) === "function" ? _k : Object)
], IvrEngineController.prototype, "updateFlow", null);
__decorate([
    (0, common_1.Post)('flows/:flowId/nodes'),
    __param(0, (0, common_1.Param)('flowId')),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object]),
    __metadata("design:returntype", typeof (_l = typeof Promise !== "undefined" && Promise) === "function" ? _l : Object)
], IvrEngineController.prototype, "createNode", null);
__decorate([
    (0, common_1.Put)('nodes/:nodeId'),
    __param(0, (0, common_1.Param)('nodeId')),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object]),
    __metadata("design:returntype", typeof (_m = typeof Promise !== "undefined" && Promise) === "function" ? _m : Object)
], IvrEngineController.prototype, "updateNode", null);
__decorate([
    (0, common_1.Delete)('nodes/:nodeId'),
    __param(0, (0, common_1.Param)('nodeId')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", typeof (_o = typeof Promise !== "undefined" && Promise) === "function" ? _o : Object)
], IvrEngineController.prototype, "deleteNode", null);
__decorate([
    (0, common_1.Post)('nodes/:nodeId/actions'),
    __param(0, (0, common_1.Param)('nodeId')),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object]),
    __metadata("design:returntype", typeof (_p = typeof Promise !== "undefined" && Promise) === "function" ? _p : Object)
], IvrEngineController.prototype, "createAction", null);
__decorate([
    (0, common_1.Get)('endpoints'),
    __param(0, (0, common_1.Query)('domainCode')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", typeof (_q = typeof Promise !== "undefined" && Promise) === "function" ? _q : Object)
], IvrEngineController.prototype, "listEndpoints", null);
__decorate([
    (0, common_1.Post)('endpoints'),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", typeof (_r = typeof Promise !== "undefined" && Promise) === "function" ? _r : Object)
], IvrEngineController.prototype, "createEndpoint", null);
__decorate([
    (0, common_1.Put)('endpoints/:endpointId'),
    __param(0, (0, common_1.Param)('endpointId')),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, typeof (_s = typeof Record !== "undefined" && Record) === "function" ? _s : Object]),
    __metadata("design:returntype", typeof (_t = typeof Promise !== "undefined" && Promise) === "function" ? _t : Object)
], IvrEngineController.prototype, "updateEndpoint", null);
__decorate([
    (0, common_1.Get)('errors'),
    __param(0, (0, common_1.Query)('domainCode')),
    __param(1, (0, common_1.Query)('limit')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String]),
    __metadata("design:returntype", typeof (_u = typeof Promise !== "undefined" && Promise) === "function" ? _u : Object)
], IvrEngineController.prototype, "getErrorLogs", null);
__decorate([
    (0, common_1.Post)('cache/invalidate'),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", typeof (_v = typeof Promise !== "undefined" && Promise) === "function" ? _v : Object)
], IvrEngineController.prototype, "invalidateCache", null);
__decorate([
    (0, common_1.Get)('health'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", typeof (_w = typeof Promise !== "undefined" && Promise) === "function" ? _w : Object)
], IvrEngineController.prototype, "getHealth", null);
exports.IvrEngineController = IvrEngineController = IvrEngineController_1 = __decorate([
    (0, common_1.Controller)('ivr-engine'),
    __param(3, (0, typeorm_1.InjectDataSource)()),
    __metadata("design:paramtypes", [ivr_flow_loader_service_1.IvrFlowLoaderService,
        flow_executor_service_1.FlowExecutorService,
        api_integration_service_1.ApiIntegrationService, typeof (_a = typeof typeorm_2.DataSource !== "undefined" && typeorm_2.DataSource) === "function" ? _a : Object])
], IvrEngineController);
//# sourceMappingURL=ivr-engine.controller.js.map