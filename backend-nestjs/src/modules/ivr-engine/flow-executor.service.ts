import { Injectable, Logger } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { IvrFlowLoaderService, LoadedFlow, IvrFlowNode, DomainApiEndpoint } from './ivr-flow-loader.service';
import { ApiIntegrationService, ApiCallResult } from './api-integration.service';

/**
 * FlowExecutorService
 * 
 * The core IVR engine state machine. Executes flow nodes step-by-step,
 * handles branching, API calls, input collection, and transfers.
 * 
 * Uses Gen AI for intent classification (branch routing) instead of hard logic.
 * All flow configuration is loaded dynamically from the database.
 */

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

@Injectable()
export class FlowExecutorService {
  private readonly logger = new Logger(FlowExecutorService.name);
  
  // Active sessions: sessionId -> FlowSession
  private sessions: Map<string, FlowSession> = new Map();

  constructor(
    private readonly flowLoader: IvrFlowLoaderService,
    private readonly apiIntegration: ApiIntegrationService,
    @InjectDataSource()
    private readonly dataSource: DataSource,
  ) {}

  /**
   * Start a new IVR flow session for a domain.
   * Returns the first step (usually the welcome prompt).
   */
  async startSession(domainCode: string, sessionId?: string): Promise<FlowStepResult | null> {
    const flow = await this.flowLoader.loadEntryFlow(domainCode);
    if (!flow) {
      this.logger.error(`Cannot start session: no flow found for domain ${domainCode}`);
      return null;
    }

    const sid = sessionId || `sess_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

    const session: FlowSession = {
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

    // Execute the entry node
    return this.executeCurrentNode(session);
  }

  /**
   * Process user input for an active session.
   * Advances the flow based on the current node type and user response.
   */
  async processInput(sessionId: string, userInput: string, detectedIntent?: string): Promise<FlowStepResult | null> {
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

    // Handle based on current node type
    switch (currentNode.nodeType) {
      case 'prompt': {
        // After a prompt, advance to the next node and re-process input there
        if (currentNode.nextNodeCode) {
          session.currentNodeCode = currentNode.nextNodeCode;
          const nextNode = session.flow.nodes.get(currentNode.nextNodeCode);
          if (nextNode && (nextNode.nodeType === 'branch' || nextNode.nodeType === 'collect_input')) {
            // Re-process the same input on the next node
            return this.processInput(sessionId, userInput, detectedIntent);
          }
          return this.executeCurrentNode(session);
        }
        return this.advanceToNext(session, currentNode);
      }

      case 'branch':
        // Use the detected intent (from Gen AI) to route
        return this.handleBranch(session, currentNode, userInput, detectedIntent);

      case 'collect_input':
        // Store the collected input and advance
        return this.handleCollectInput(session, currentNode, userInput);

      case 'api_call':
        // Execute the API call and advance
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

  /**
   * Get the current state of a session.
   */
  getSession(sessionId: string): FlowSession | null {
    return this.sessions.get(sessionId) || null;
  }

  /**
   * Get all active sessions (for monitoring).
   */
  getActiveSessions(): FlowSession[] {
    return Array.from(this.sessions.values()).filter(s => s.status === 'active');
  }

  /**
   * End a session explicitly.
   */
  endSession(sessionId: string): void {
    const session = this.sessions.get(sessionId);
    if (session) {
      session.status = 'completed';
      this.logger.log(`Session ended: ${sessionId}`);
    }
  }

  // ============================================================
  // Private: Node execution handlers
  // ============================================================

  private async executeCurrentNode(session: FlowSession): Promise<FlowStepResult> {
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

  /**
   * Handle branch node — use detected intent to pick the right path.
   * If no intent matches, fall through to the default (NextNodeCode).
   */
  private async handleBranch(
    session: FlowSession,
    node: IvrFlowNode,
    userInput: string,
    detectedIntent?: string,
  ): Promise<FlowStepResult> {
    const branchConfig = node.branchConfig;
    if (!branchConfig) {
      this.logger.warn(`Branch node ${node.nodeCode} has no branch config, advancing to next`);
      return this.advanceToNext(session, node);
    }

    // Use Gen AI detected intent if available, otherwise try to match from input
    let targetNodeCode: string | null = null;

    if (detectedIntent) {
      // Normalize the intent key (lowercase, underscored)
      const normalizedIntent = detectedIntent.toLowerCase().replace(/[\s-]+/g, '_');
      targetNodeCode = branchConfig[normalizedIntent] || null;

      // Also try partial matching
      if (!targetNodeCode) {
        for (const [intentKey, nodeCode] of Object.entries(branchConfig)) {
          if (normalizedIntent.includes(intentKey) || intentKey.includes(normalizedIntent)) {
            targetNodeCode = nodeCode;
            break;
          }
        }
      }
    }

    // Fallback: try keyword matching from user input
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

    // If still no match, use the default next node
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

  /**
   * Handle collect_input node — store the user's input and advance.
   */
  private handleCollectInput(
    session: FlowSession,
    node: IvrFlowNode,
    userInput: string,
  ): FlowStepResult {
    // Derive variable name from node code (e.g., "collect_department" -> "department")
    const varName = node.nodeCode.replace(/^collect_/, '');
    session.variables[varName] = userInput;

    this.logger.log(`Collected input: ${varName} = "${userInput}"`);

    return this.advanceToNext(session, node);
  }

  /**
   * Handle api_call node — execute the API and merge results into session.
   */
  private async handleApiCall(
    session: FlowSession,
    node: IvrFlowNode,
  ): Promise<FlowStepResult> {
    const actions = session.flow.nodeActions.get(node.nodeCode);
    if (!actions || actions.length === 0) {
      this.logger.warn(`No actions defined for api_call node: ${node.nodeCode}`);
      return this.advanceToNext(session, node);
    }

    // Load domain endpoints
    const endpoints = await this.flowLoader.loadDomainEndpoints(session.domainCode);

    let lastResult: ApiCallResult | null = null;

    // Execute all actions in order
    for (const action of actions) {
      // Find the endpoint by toolName (maps to endpointCode)
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

      // Check if this is a mock endpoint (baseUrl contains 'mock')
      const isMock = endpoint.baseUrl.includes('mock') || endpoint.path.includes('/mock/');
      
      if (isMock) {
        lastResult = await this.apiIntegration.executeMockApiCall(action, endpoint, session.variables);
      } else {
        lastResult = await this.apiIntegration.executeApiCall(action, endpoint, session.variables);
      }

      // Merge result data into session variables
      if (lastResult.data) {
        Object.assign(session.variables, lastResult.data);
      }
    }

    // Build the prompt with resolved variables
    const resolvedPrompt = node.promptText
      ? this.resolveTemplate(node.promptText, session.variables)
      : (lastResult?.success ? 'Done.' : 'Sorry, there was an issue.');

    const result: FlowStepResult = {
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

    // Auto-advance to next node
    if (node.nextNodeCode) {
      session.currentNodeCode = node.nextNodeCode;
      return this.executeCurrentNode(session);
    }

    return result;
  }

  /**
   * Handle transfer node — mark session as transferred.
   */
  private handleTransfer(session: FlowSession, node: IvrFlowNode): FlowStepResult {
    session.status = 'transferred';

    const result: FlowStepResult = {
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

  /**
   * Handle end node — mark session as completed.
   */
  private handleEnd(session: FlowSession, node: IvrFlowNode): FlowStepResult {
    session.status = 'completed';

    const result: FlowStepResult = {
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

  /**
   * Advance to the next node in the flow.
   */
  private advanceToNext(session: FlowSession, currentNode: IvrFlowNode): FlowStepResult {
    const result = this.buildPromptResult(session, currentNode);

    if (currentNode.nextNodeCode) {
      session.currentNodeCode = currentNode.nextNodeCode;
    }

    return result;
  }

  /**
   * Build a prompt result (speak to caller).
   */
  private buildPromptResult(session: FlowSession, node: IvrFlowNode): FlowStepResult {
    const resolvedPrompt = node.promptText
      ? this.resolveTemplate(node.promptText, session.variables)
      : '';

    const result: FlowStepResult = {
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

  /**
   * Build a collect result (ask caller for input).
   */
  private buildCollectResult(session: FlowSession, node: IvrFlowNode): FlowStepResult {
    const resolvedPrompt = node.promptText
      ? this.resolveTemplate(node.promptText, session.variables)
      : 'Please provide your input.';

    const result: FlowStepResult = {
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

  /**
   * Build an error result.
   */
  private buildErrorResult(session: FlowSession, errorMessage: string): FlowStepResult {
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

  /**
   * Resolve template variables in a string.
   */
  private resolveTemplate(template: string, vars: Record<string, any>): string {
    return template.replace(/\{\{(\w+)\}\}/g, (_, key) => {
      const value = vars[key];
      return value !== undefined && value !== null ? String(value) : `[${key}]`;
    });
  }
}
