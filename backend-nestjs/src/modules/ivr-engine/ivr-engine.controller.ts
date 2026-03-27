import { Controller, Get, Post, Put, Delete, Body, Param, Query, Logger, HttpException, HttpStatus } from '@nestjs/common';
import { IvrFlowLoaderService } from './ivr-flow-loader.service';
import { FlowExecutorService, FlowStepResult } from './flow-executor.service';
import { ApiIntegrationService } from './api-integration.service';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { CacheService } from '../../common/cache.service';

/**
 * IvrEngineController
 * 
 * REST API for the Generic IVR Engine.
 * Provides endpoints for:
 * 1. Flow execution (start session, process input, get session state)
 * 2. Flow management (CRUD for flows, nodes, actions)
 * 3. API endpoint management (CRUD for domain API mappings)
 * 4. Error logs and monitoring
 */
@Controller('ivr-engine')
export class IvrEngineController {
  private readonly logger = new Logger(IvrEngineController.name);

  constructor(
    private readonly flowLoader: IvrFlowLoaderService,
    private readonly flowExecutor: FlowExecutorService,
    private readonly apiIntegration: ApiIntegrationService,
    @InjectDataSource()
    private readonly dataSource: DataSource,
    private readonly cache: CacheService,
  ) {}

  // ============================================================
  // Flow Execution Endpoints
  // ============================================================

  /**
   * Start a new IVR session for a domain.
   * POST /api/ivr-engine/session/start
   */
  @Post('session/start')
  async startSession(@Body() body: { domainCode: string; sessionId?: string }): Promise<any> {
    if (!body.domainCode) {
      throw new HttpException('domainCode is required', HttpStatus.BAD_REQUEST);
    }

    // Generate sessionId upfront so we can return it
    const sid = body.sessionId || `sess_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    const result = await this.flowExecutor.startSession(body.domainCode, sid);
    if (!result) {
      throw new HttpException(
        `No IVR flow configured for domain: ${body.domainCode}`,
        HttpStatus.NOT_FOUND,
      );
    }

    const session = this.flowExecutor.getSession(sid);
    return {
      sessionId: sid,
      step: result,
      status: session?.status || 'active',
    };
  }

  /**
   * Process user input for an active session.
   * POST /api/ivr-engine/session/:sessionId/input
   */
  @Post('session/:sessionId/input')
  async processInput(
    @Param('sessionId') sessionId: string,
    @Body() body: { userInput: string; detectedIntent?: string },
  ): Promise<any> {
    const result = await this.flowExecutor.processInput(
      sessionId,
      body.userInput,
      body.detectedIntent,
    );

    if (!result) {
      throw new HttpException('Session not found or inactive', HttpStatus.NOT_FOUND);
    }

    const session = this.flowExecutor.getSession(sessionId);
    return {
      sessionId,
      step: result,
      status: session?.status || 'unknown',
      variables: session?.variables || {},
    };
  }

  /**
   * Get the current state of a session.
   * GET /api/ivr-engine/session/:sessionId
   */
  @Get('session/:sessionId')
  async getSession(@Param('sessionId') sessionId: string): Promise<any> {
    const session = this.flowExecutor.getSession(sessionId);
    if (!session) {
      throw new HttpException('Session not found', HttpStatus.NOT_FOUND);
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

  /**
   * End a session.
   * POST /api/ivr-engine/session/:sessionId/end
   */
  @Post('session/:sessionId/end')
  async endSession(@Param('sessionId') sessionId: string): Promise<any> {
    this.flowExecutor.endSession(sessionId);
    return { sessionId, status: 'completed' };
  }

  /**
   * Get all active sessions (monitoring).
   * GET /api/ivr-engine/sessions/active
   */
  @Get('sessions/active')
  async getActiveSessions(): Promise<any> {
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

  // ============================================================
  // Flow Management Endpoints (CRUD)
  // ============================================================

  /**
   * List all flows for a domain.
   * GET /api/ivr-engine/flows?domainCode=hospital-management
   */
  @Get('flows')
  async listFlows(@Query('domainCode') domainCode: string): Promise<any> {
    if (!domainCode) {
      return this.cache.getOrSet('ivr:flows:all', () => this.dataSource.query(
        `SELECT f.FlowId, f.DomainId, f.FlowCode, f.FlowName, f.Description, 
                f.IsEntryFlow, f.FlowVersion, f.IsActive, f.CreatedAt, f.UpdatedAt,
                d.DomainCode, d.DisplayName as DomainName,
                (SELECT COUNT(*) FROM IvrFlowNodes n WHERE n.FlowId = f.FlowId) as NodeCount
         FROM IvrFlows f
         JOIN Domains d ON d.DomainId = f.DomainId
         ORDER BY d.DomainCode, f.IsEntryFlow DESC`,
      ), 30_000);
    }

    return this.cache.getOrSet(`ivr:flows:${domainCode}`, () => this.flowLoader.listFlowsForDomain(domainCode), 30_000);
  }

  /**
   * Get a flow with all its nodes and actions.
   * GET /api/ivr-engine/flows/:flowId
   */
  @Get('flows/:flowId')
  async getFlow(@Param('flowId') flowId: string): Promise<any> {
    const flow = await this.dataSource.query(
      `SELECT FlowId, DomainId, FlowCode, FlowName, Description, IsEntryFlow, FlowVersion, IsActive
       FROM IvrFlows WHERE FlowId = @0`,
      [flowId],
    );
    if (!flow || flow.length === 0) {
      throw new HttpException('Flow not found', HttpStatus.NOT_FOUND);
    }

    const nodes = await this.dataSource.query(
      `SELECT n.NodeId, n.NodeCode, n.NodeType, n.NodeLabel, n.PromptText, n.SortOrder,
              n.NextNodeCode, n.BranchConfig, n.TimeoutSeconds, n.MaxRetries, n.IsActive
       FROM IvrFlowNodes n
       WHERE n.FlowId = @0
       ORDER BY n.SortOrder`,
      [flowId],
    );

    // Load all actions for this flow's nodes in a single query
    const nodeIds = nodes.map((n: any) => `'${n.NodeId}'`).join(',');
    let allActions: any[] = [];
    if (nodeIds.length > 0) {
      allActions = await this.dataSource.query(
        `SELECT ActionId, NodeId, ActionType, ActionOrder, ToolName, EndpointId,
                RequestMapping, ResponseMapping, FallbackResponse, IsActive
         FROM IvrNodeActions
         WHERE NodeId IN (${nodeIds})
         ORDER BY ActionOrder`,
      );
    }

    // Group actions by NodeId
    const actionsByNode = new Map<string, any[]>();
    for (const action of allActions) {
      const list = actionsByNode.get(action.NodeId) || [];
      list.push(action);
      actionsByNode.set(action.NodeId, list);
    }

    const nodesWithActions = nodes.map((node: any) => ({
      ...node,
      actions: actionsByNode.get(node.NodeId) || [],
    }));

    return { ...flow[0], nodes: nodesWithActions };
  }

  /**
   * Create a new flow.
   * POST /api/ivr-engine/flows
   */
  @Post('flows')
  async createFlow(@Body() body: {
    domainCode: string;
    flowCode: string;
    flowName: string;
    description?: string;
    isEntryFlow?: boolean;
  }): Promise<any> {
    const domainResult = await this.dataSource.query(
      `SELECT DomainId FROM Domains WHERE DomainCode = @0`,
      [body.domainCode],
    );
    if (!domainResult || domainResult.length === 0) {
      throw new HttpException('Domain not found', HttpStatus.NOT_FOUND);
    }

    const result = await this.dataSource.query(
      `INSERT INTO IvrFlows (DomainId, FlowCode, FlowName, Description, IsEntryFlow)
       OUTPUT INSERTED.*
       VALUES (@0, @1, @2, @3, @4)`,
      [domainResult[0].DomainId, body.flowCode, body.flowName, body.description || null, body.isEntryFlow ? 1 : 0],
    );

    this.flowLoader.invalidateCache(body.domainCode);
    return result[0];
  }

  /**
   * Update a flow.
   * PUT /api/ivr-engine/flows/:flowId
   */
  @Put('flows/:flowId')
  async updateFlow(
    @Param('flowId') flowId: string,
    @Body() body: { flowName?: string; description?: string; isEntryFlow?: boolean; isActive?: boolean },
  ): Promise<any> {
    const sets: string[] = [];
    const params: any[] = [flowId];
    let paramIdx = 1;

    if (body.flowName !== undefined) { sets.push(`FlowName = @${paramIdx}`); params.push(body.flowName); paramIdx++; }
    if (body.description !== undefined) { sets.push(`Description = @${paramIdx}`); params.push(body.description); paramIdx++; }
    if (body.isEntryFlow !== undefined) { sets.push(`IsEntryFlow = @${paramIdx}`); params.push(body.isEntryFlow ? 1 : 0); paramIdx++; }
    if (body.isActive !== undefined) { sets.push(`IsActive = @${paramIdx}`); params.push(body.isActive ? 1 : 0); paramIdx++; }

    if (sets.length === 0) {
      throw new HttpException('No fields to update', HttpStatus.BAD_REQUEST);
    }

    sets.push('UpdatedAt = GETUTCDATE()');
    sets.push(`FlowVersion = FlowVersion + 1`);

    await this.dataSource.query(
      `UPDATE IvrFlows SET ${sets.join(', ')} WHERE FlowId = @0`,
      params,
    );

    this.flowLoader.invalidateCache();
    return { success: true, flowId };
  }

  // ============================================================
  // Node Management Endpoints (CRUD)
  // ============================================================

  /**
   * Add a node to a flow.
   * POST /api/ivr-engine/flows/:flowId/nodes
   */
  @Post('flows/:flowId/nodes')
  async createNode(
    @Param('flowId') flowId: string,
    @Body() body: {
      nodeCode: string;
      nodeType: string;
      nodeLabel?: string;
      promptText?: string;
      sortOrder: number;
      nextNodeCode?: string;
      branchConfig?: Record<string, string>;
    },
  ): Promise<any> {
    const result = await this.dataSource.query(
      `INSERT INTO IvrFlowNodes (FlowId, NodeCode, NodeType, NodeLabel, PromptText, SortOrder, NextNodeCode, BranchConfig)
       OUTPUT INSERTED.*
       VALUES (@0, @1, @2, @3, @4, @5, @6, @7)`,
      [
        flowId, body.nodeCode, body.nodeType, body.nodeLabel || null,
        body.promptText || null, body.sortOrder, body.nextNodeCode || null,
        body.branchConfig ? JSON.stringify(body.branchConfig) : null,
      ],
    );

    this.flowLoader.invalidateCache();
    return result[0];
  }

  /**
   * Update a node.
   * PUT /api/ivr-engine/nodes/:nodeId
   */
  @Put('nodes/:nodeId')
  async updateNode(
    @Param('nodeId') nodeId: string,
    @Body() body: {
      nodeLabel?: string;
      promptText?: string;
      sortOrder?: number;
      nextNodeCode?: string;
      branchConfig?: Record<string, string>;
      isActive?: boolean;
    },
  ): Promise<any> {
    const sets: string[] = [];
    const params: any[] = [nodeId];
    let paramIdx = 1;

    if (body.nodeLabel !== undefined) { sets.push(`NodeLabel = @${paramIdx}`); params.push(body.nodeLabel); paramIdx++; }
    if (body.promptText !== undefined) { sets.push(`PromptText = @${paramIdx}`); params.push(body.promptText); paramIdx++; }
    if (body.sortOrder !== undefined) { sets.push(`SortOrder = @${paramIdx}`); params.push(body.sortOrder); paramIdx++; }
    if (body.nextNodeCode !== undefined) { sets.push(`NextNodeCode = @${paramIdx}`); params.push(body.nextNodeCode); paramIdx++; }
    if (body.branchConfig !== undefined) { sets.push(`BranchConfig = @${paramIdx}`); params.push(JSON.stringify(body.branchConfig)); paramIdx++; }
    if (body.isActive !== undefined) { sets.push(`IsActive = @${paramIdx}`); params.push(body.isActive ? 1 : 0); paramIdx++; }

    if (sets.length === 0) {
      throw new HttpException('No fields to update', HttpStatus.BAD_REQUEST);
    }

    await this.dataSource.query(
      `UPDATE IvrFlowNodes SET ${sets.join(', ')} WHERE NodeId = @0`,
      params,
    );

    this.flowLoader.invalidateCache();
    return { success: true, nodeId };
  }

  /**
   * Delete a node.
   * DELETE /api/ivr-engine/nodes/:nodeId
   */
  @Delete('nodes/:nodeId')
  async deleteNode(@Param('nodeId') nodeId: string): Promise<any> {
    await this.dataSource.query(`DELETE FROM IvrNodeActions WHERE NodeId = @0`, [nodeId]);
    await this.dataSource.query(`DELETE FROM IvrFlowNodes WHERE NodeId = @0`, [nodeId]);
    this.flowLoader.invalidateCache();
    return { success: true, nodeId };
  }

  // ============================================================
  // Node Action Management
  // ============================================================

  /**
   * Add an action to a node.
   * POST /api/ivr-engine/nodes/:nodeId/actions
   */
  @Post('nodes/:nodeId/actions')
  async createAction(
    @Param('nodeId') nodeId: string,
    @Body() body: {
      actionType: string;
      actionOrder?: number;
      toolName?: string;
      requestMapping?: Record<string, string>;
      responseMapping?: Record<string, string>;
      fallbackResponse?: Record<string, string>;
    },
  ): Promise<any> {
    const result = await this.dataSource.query(
      `INSERT INTO IvrNodeActions (NodeId, ActionType, ActionOrder, ToolName, RequestMapping, ResponseMapping, FallbackResponse)
       OUTPUT INSERTED.*
       VALUES (@0, @1, @2, @3, @4, @5, @6)`,
      [
        nodeId, body.actionType, body.actionOrder || 1, body.toolName || null,
        body.requestMapping ? JSON.stringify(body.requestMapping) : null,
        body.responseMapping ? JSON.stringify(body.responseMapping) : null,
        body.fallbackResponse ? JSON.stringify(body.fallbackResponse) : null,
      ],
    );

    this.flowLoader.invalidateCache();
    return result[0];
  }

  // ============================================================
  // API Endpoint Management (CRUD)
  // ============================================================

  /**
   * List API endpoints for a domain.
   * GET /api/ivr-engine/endpoints?domainCode=hospital-management
   */
  @Get('endpoints')
  async listEndpoints(@Query('domainCode') domainCode?: string): Promise<any> {
    const cacheKey = domainCode ? `ivr:endpoints:${domainCode}` : 'ivr:endpoints:all';
    return this.cache.getOrSet(cacheKey, async () => {
      if (domainCode) {
        const domainResult = await this.dataSource.query(
          `SELECT DomainId FROM Domains WHERE DomainCode = @0`,
          [domainCode],
        );
        if (!domainResult || domainResult.length === 0) return [];

        return this.dataSource.query(
          `SELECT * FROM DomainApiEndpoints WHERE DomainId = @0 ORDER BY EndpointCode`,
          [domainResult[0].DomainId],
        );
      }

      return this.dataSource.query(
        `SELECT e.*, d.DomainCode, d.DisplayName as DomainName
         FROM DomainApiEndpoints e
         JOIN Domains d ON d.DomainId = e.DomainId
         ORDER BY d.DomainCode, e.EndpointCode`,
      );
    }, 30_000);
  }

  /**
   * Create an API endpoint.
   * POST /api/ivr-engine/endpoints
   */
  @Post('endpoints')
  async createEndpoint(@Body() body: {
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
  }): Promise<any> {
    const domainResult = await this.dataSource.query(
      `SELECT DomainId FROM Domains WHERE DomainCode = @0`,
      [body.domainCode],
    );
    if (!domainResult || domainResult.length === 0) {
      throw new HttpException('Domain not found', HttpStatus.NOT_FOUND);
    }

    const result = await this.dataSource.query(
      `INSERT INTO DomainApiEndpoints (DomainId, EndpointCode, EndpointName, HttpMethod, BaseUrl, Path, HeadersJson, AuthType, AuthConfig, TimeoutMs, RetryCount)
       OUTPUT INSERTED.*
       VALUES (@0, @1, @2, @3, @4, @5, @6, @7, @8, @9, @10)`,
      [
        domainResult[0].DomainId, body.endpointCode, body.endpointName,
        body.httpMethod, body.baseUrl, body.path,
        body.headersJson ? JSON.stringify(body.headersJson) : null,
        body.authType || 'none',
        body.authConfig ? JSON.stringify(body.authConfig) : null,
        body.timeoutMs || 30000,
        body.retryCount || 2,
      ],
    );

    this.flowLoader.invalidateCache(body.domainCode);
    return result[0];
  }

  /**
   * Update an API endpoint.
   * PUT /api/ivr-engine/endpoints/:endpointId
   */
  @Put('endpoints/:endpointId')
  async updateEndpoint(
    @Param('endpointId') endpointId: string,
    @Body() body: Record<string, any>,
  ): Promise<any> {
    const sets: string[] = [];
    const params: any[] = [endpointId];
    let paramIdx = 1;

    const fields = ['EndpointName', 'HttpMethod', 'BaseUrl', 'Path', 'AuthType', 'TimeoutMs', 'RetryCount', 'IsActive'];
    const bodyMap: Record<string, string> = {
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
      throw new HttpException('No fields to update', HttpStatus.BAD_REQUEST);
    }

    await this.dataSource.query(
      `UPDATE DomainApiEndpoints SET ${sets.join(', ')} WHERE EndpointId = @0`,
      params,
    );

    this.flowLoader.invalidateCache();
    return { success: true, endpointId };
  }

  // ============================================================
  // Error Logs & Monitoring
  // ============================================================

  /**
   * Get error logs.
   * GET /api/ivr-engine/errors?domainCode=hospital-management&limit=50
   */
  @Get('errors')
  async getErrorLogs(
    @Query('domainCode') domainCode?: string,
    @Query('limit') limit?: string,
  ): Promise<any> {
    const maxRows = parseInt(limit || '50');

    if (domainCode) {
      const domainResult = await this.dataSource.query(
        `SELECT DomainId FROM Domains WHERE DomainCode = @0`,
        [domainCode],
      );
      if (!domainResult || domainResult.length === 0) return [];

      return this.dataSource.query(
        `SELECT TOP (${maxRows}) * FROM ErrorLogs WHERE DomainId = @0 ORDER BY CreatedAt DESC`,
        [domainResult[0].DomainId],
      );
    }

    return this.dataSource.query(
      `SELECT TOP (${maxRows}) e.*, d.DomainCode, d.DisplayName as DomainName
       FROM ErrorLogs e
       LEFT JOIN Domains d ON d.DomainId = e.DomainId
       ORDER BY e.CreatedAt DESC`,
    );
  }

  /**
   * Invalidate flow cache (after config changes via UI).
   * POST /api/ivr-engine/cache/invalidate
   */
  @Post('cache/invalidate')
  async invalidateCache(@Body() body: { domainCode?: string }): Promise<any> {
    this.flowLoader.invalidateCache(body.domainCode);
    // Also invalidate the in-memory query cache
    if (body.domainCode) {
      this.cache.invalidate(`ivr:flows:${body.domainCode}`);
      this.cache.invalidate(`ivr:endpoints:${body.domainCode}`);
    }
    this.cache.invalidatePrefix('ivr:');
    return { success: true, message: body.domainCode ? `Cache invalidated for ${body.domainCode}` : 'All caches invalidated' };
  }

  /**
   * Get engine health and stats.
   * GET /api/ivr-engine/health
   */
  @Get('health')
  async getHealth(): Promise<any> {
    try {
      const stats = await this.cache.getOrSet('ivr:health:stats', async () => {
        // Run all 4 COUNT queries in parallel instead of sequential
        const [flowCount, nodeCount, endpointCount, errorCount] = await Promise.all([
          this.dataSource.query('SELECT COUNT(*) as cnt FROM IvrFlows WHERE IsActive = 1'),
          this.dataSource.query('SELECT COUNT(*) as cnt FROM IvrFlowNodes WHERE IsActive = 1'),
          this.dataSource.query('SELECT COUNT(*) as cnt FROM DomainApiEndpoints WHERE IsActive = 1'),
          this.dataSource.query(`SELECT COUNT(*) as cnt FROM ErrorLogs WHERE CreatedAt >= DATEADD(HOUR, -24, GETUTCDATE())`),
        ]);
        return {
          flows: flowCount[0].cnt,
          nodes: nodeCount[0].cnt,
          endpoints: endpointCount[0].cnt,
          errorsLast24h: errorCount[0].cnt,
        };
      }, 30_000); // 30s cache

      const activeSessions = this.flowExecutor.getActiveSessions();

      return {
        status: 'healthy',
        engine: {
          ...stats,
          activeSessions: activeSessions.length,
        },
        timestamp: new Date().toISOString(),
      };
    } catch (error: any) {
      return { status: 'unhealthy', error: error.message };
    }
  }
}
