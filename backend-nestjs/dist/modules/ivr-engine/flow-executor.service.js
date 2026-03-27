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
var FlowExecutorService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.FlowExecutorService = void 0;
const common_1 = require("@nestjs/common");
const typeorm_1 = require("@nestjs/typeorm");
const typeorm_2 = require("typeorm");
const ivr_flow_loader_service_1 = require("./ivr-flow-loader.service");
const api_integration_service_1 = require("./api-integration.service");
let FlowExecutorService = FlowExecutorService_1 = class FlowExecutorService {
    flowLoader;
    apiIntegration;
    dataSource;
    logger = new common_1.Logger(FlowExecutorService_1.name);
    sessions = new Map();
    constructor(flowLoader, apiIntegration, dataSource) {
        this.flowLoader = flowLoader;
        this.apiIntegration = apiIntegration;
        this.dataSource = dataSource;
    }
    async startSession(domainCode, sessionId) {
        const flow = await this.flowLoader.loadEntryFlow(domainCode);
        if (!flow) {
            this.logger.error(`Cannot start session: no flow found for domain ${domainCode}`);
            return null;
        }
        const sid = sessionId || `sess_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
        const session = {
            sessionId: sid,
            domainCode,
            flow,
            currentNodeCode: flow.entryNodeCode,
            variables: { _sessionId: sid, _domainCode: domainCode },
            history: [],
            status: 'active',
            startedAt: Date.now(),
        };
        this.sessions.set(sid, session);
        this.logger.log(`Session started: ${sid} for domain: ${domainCode}, entry node: ${flow.entryNodeCode}`);
        return this.executeCurrentNode(session);
    }
    async processInput(sessionId, userInput, detectedIntent) {
        const session = this.sessions.get(sessionId);
        if (!session) {
            this.logger.warn(`Session not found: ${sessionId}`);
            return null;
        }
        if (session.status !== 'active') {
            this.logger.warn(`Session ${sessionId} is ${session.status}, cannot process input`);
            return null;
        }
        const currentNode = session.flow.nodes.get(session.currentNodeCode);
        if (!currentNode) {
            this.logger.error(`Current node not found: ${session.currentNodeCode}`);
            return this.buildErrorResult(session, 'Flow configuration error');
        }
        switch (currentNode.nodeType) {
            case 'prompt': {
                if (currentNode.nextNodeCode) {
                    session.currentNodeCode = currentNode.nextNodeCode;
                    const nextNode = session.flow.nodes.get(currentNode.nextNodeCode);
                    if (nextNode && (nextNode.nodeType === 'branch' || nextNode.nodeType === 'collect_input')) {
                        return this.processInput(sessionId, userInput, detectedIntent);
                    }
                    return this.executeCurrentNode(session);
                }
                return this.advanceToNext(session, currentNode);
            }
            case 'branch':
                return this.handleBranch(session, currentNode, userInput, detectedIntent);
            case 'collect_input':
                return this.handleCollectInput(session, currentNode, userInput);
            case 'api_call':
                return this.handleApiCall(session, currentNode);
            case 'transfer':
                return this.handleTransfer(session, currentNode);
            case 'end':
                return this.handleEnd(session, currentNode);
            default:
                this.logger.warn(`Unknown node type: ${currentNode.nodeType}`);
                return this.advanceToNext(session, currentNode);
        }
    }
    getSession(sessionId) {
        return this.sessions.get(sessionId) || null;
    }
    getActiveSessions() {
        return Array.from(this.sessions.values()).filter(s => s.status === 'active');
    }
    endSession(sessionId) {
        const session = this.sessions.get(sessionId);
        if (session) {
            session.status = 'completed';
            this.logger.log(`Session ended: ${sessionId}`);
        }
    }
    async executeCurrentNode(session) {
        const node = session.flow.nodes.get(session.currentNodeCode);
        if (!node) {
            return this.buildErrorResult(session, `Node not found: ${session.currentNodeCode}`);
        }
        this.logger.debug(`Executing node: ${node.nodeCode} (${node.nodeType})`);
        switch (node.nodeType) {
            case 'prompt':
                return this.buildPromptResult(session, node);
            case 'branch':
                return this.buildPromptResult(session, node);
            case 'collect_input':
                return this.buildCollectResult(session, node);
            case 'api_call':
                return this.handleApiCall(session, node);
            case 'transfer':
                return this.handleTransfer(session, node);
            case 'end':
                return this.handleEnd(session, node);
            default:
                return this.buildPromptResult(session, node);
        }
    }
    async handleBranch(session, node, userInput, detectedIntent) {
        const branchConfig = node.branchConfig;
        if (!branchConfig) {
            this.logger.warn(`Branch node ${node.nodeCode} has no branch config, advancing to next`);
            return this.advanceToNext(session, node);
        }
        let targetNodeCode = null;
        if (detectedIntent) {
            const normalizedIntent = detectedIntent.toLowerCase().replace(/[\s-]+/g, '_');
            targetNodeCode = branchConfig[normalizedIntent] || null;
            if (!targetNodeCode) {
                for (const [intentKey, nodeCode] of Object.entries(branchConfig)) {
                    if (normalizedIntent.includes(intentKey) || intentKey.includes(normalizedIntent)) {
                        targetNodeCode = nodeCode;
                        break;
                    }
                }
            }
        }
        if (!targetNodeCode && userInput) {
            const inputLower = userInput.toLowerCase();
            for (const [intentKey, nodeCode] of Object.entries(branchConfig)) {
                const keywords = intentKey.split('_');
                if (keywords.some(kw => inputLower.includes(kw))) {
                    targetNodeCode = nodeCode;
                    break;
                }
            }
        }
        if (!targetNodeCode) {
            this.logger.log(`No branch match for intent "${detectedIntent}" / input "${userInput}", using default`);
            targetNodeCode = node.nextNodeCode;
        }
        if (targetNodeCode) {
            session.currentNodeCode = targetNodeCode;
            session.variables._lastBranchIntent = detectedIntent || userInput;
            return this.executeCurrentNode(session);
        }
        return this.buildErrorResult(session, 'No valid branch target found');
    }
    handleCollectInput(session, node, userInput) {
        const varName = node.nodeCode.replace(/^collect_/, '');
        session.variables[varName] = userInput;
        this.logger.log(`Collected input: ${varName} = "${userInput}"`);
        return this.advanceToNext(session, node);
    }
    async handleApiCall(session, node) {
        const actions = session.flow.nodeActions.get(node.nodeCode);
        if (!actions || actions.length === 0) {
            this.logger.warn(`No actions defined for api_call node: ${node.nodeCode}`);
            return this.advanceToNext(session, node);
        }
        const endpoints = await this.flowLoader.loadDomainEndpoints(session.domainCode);
        let lastResult = null;
        for (const action of actions) {
            const endpoint = action.toolName ? endpoints.get(action.toolName) : null;
            if (!endpoint) {
                this.logger.warn(`Endpoint not found for tool: ${action.toolName}`);
                lastResult = {
                    success: false,
                    data: action.fallbackResponse || { message: 'Service configuration error' },
                    error: `Endpoint not found: ${action.toolName}`,
                    statusCode: null,
                    durationMs: 0,
                };
                continue;
            }
            const isMock = endpoint.baseUrl.includes('mock') || endpoint.path.includes('/mock/');
            if (isMock) {
                lastResult = await this.apiIntegration.executeMockApiCall(action, endpoint, session.variables);
            }
            else {
                lastResult = await this.apiIntegration.executeApiCall(action, endpoint, session.variables);
            }
            if (lastResult.data) {
                Object.assign(session.variables, lastResult.data);
            }
        }
        const resolvedPrompt = node.promptText
            ? this.resolveTemplate(node.promptText, session.variables)
            : (lastResult?.success ? 'Done.' : 'Sorry, there was an issue.');
        const result = {
            nodeCode: node.nodeCode,
            nodeType: node.nodeType,
            promptText: resolvedPrompt,
            action: lastResult?.success ? 'api_result' : 'error',
            data: {
                apiSuccess: lastResult?.success,
                apiData: lastResult?.data,
                apiError: lastResult?.error,
            },
            nextNodeCode: node.nextNodeCode,
            timestamp: Date.now(),
        };
        session.history.push(result);
        if (node.nextNodeCode) {
            session.currentNodeCode = node.nextNodeCode;
            return this.executeCurrentNode(session);
        }
        return result;
    }
    handleTransfer(session, node) {
        session.status = 'transferred';
        const result = {
            nodeCode: node.nodeCode,
            nodeType: node.nodeType,
            promptText: node.promptText || 'Transferring you to an agent.',
            action: 'transfer',
            data: { transferTarget: node.metadataJson?.transferTarget || 'agent' },
            nextNodeCode: null,
            timestamp: Date.now(),
        };
        session.history.push(result);
        return result;
    }
    handleEnd(session, node) {
        session.status = 'completed';
        const result = {
            nodeCode: node.nodeCode,
            nodeType: node.nodeType,
            promptText: node.promptText || 'Thank you. Goodbye.',
            action: 'end',
            data: { sessionDurationMs: Date.now() - session.startedAt },
            nextNodeCode: null,
            timestamp: Date.now(),
        };
        session.history.push(result);
        return result;
    }
    advanceToNext(session, currentNode) {
        const result = this.buildPromptResult(session, currentNode);
        if (currentNode.nextNodeCode) {
            session.currentNodeCode = currentNode.nextNodeCode;
        }
        return result;
    }
    buildPromptResult(session, node) {
        const resolvedPrompt = node.promptText
            ? this.resolveTemplate(node.promptText, session.variables)
            : '';
        const result = {
            nodeCode: node.nodeCode,
            nodeType: node.nodeType,
            promptText: resolvedPrompt,
            action: node.nodeType === 'collect_input' ? 'collect' : 'speak',
            data: {},
            nextNodeCode: node.nextNodeCode,
            timestamp: Date.now(),
        };
        session.history.push(result);
        return result;
    }
    buildCollectResult(session, node) {
        const resolvedPrompt = node.promptText
            ? this.resolveTemplate(node.promptText, session.variables)
            : 'Please provide your input.';
        const result = {
            nodeCode: node.nodeCode,
            nodeType: node.nodeType,
            promptText: resolvedPrompt,
            action: 'collect',
            data: { collectField: node.nodeCode.replace(/^collect_/, '') },
            nextNodeCode: node.nextNodeCode,
            timestamp: Date.now(),
        };
        session.history.push(result);
        return result;
    }
    buildErrorResult(session, errorMessage) {
        session.status = 'error';
        return {
            nodeCode: session.currentNodeCode,
            nodeType: 'error',
            promptText: 'I apologize, but I encountered a technical issue. Let me connect you to an agent.',
            action: 'error',
            data: { error: errorMessage },
            nextNodeCode: null,
            timestamp: Date.now(),
        };
    }
    resolveTemplate(template, vars) {
        return template.replace(/\{\{(\w+)\}\}/g, (_, key) => {
            const value = vars[key];
            return value !== undefined && value !== null ? String(value) : `[${key}]`;
        });
    }
};
exports.FlowExecutorService = FlowExecutorService;
exports.FlowExecutorService = FlowExecutorService = FlowExecutorService_1 = __decorate([
    (0, common_1.Injectable)(),
    __param(2, (0, typeorm_1.InjectDataSource)()),
    __metadata("design:paramtypes", [ivr_flow_loader_service_1.IvrFlowLoaderService,
        api_integration_service_1.ApiIntegrationService,
        typeorm_2.DataSource])
], FlowExecutorService);
//# sourceMappingURL=flow-executor.service.js.map