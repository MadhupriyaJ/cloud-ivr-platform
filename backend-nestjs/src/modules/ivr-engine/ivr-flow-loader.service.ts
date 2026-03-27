import { Injectable, Logger } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';

/**
 * IvrFlowLoaderService
 * 
 * Dynamically loads IVR flow configurations from the database.
 * No hardcoded flows — everything is DB-driven.
 * 
 * Supports caching for performance (flows don't change often).
 */

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

@Injectable()
export class IvrFlowLoaderService {
  private readonly logger = new Logger(IvrFlowLoaderService.name);
  
  // In-memory cache: domainCode -> LoadedFlow
  private flowCache: Map<string, { data: LoadedFlow; loadedAt: number }> = new Map();
  private endpointCache: Map<string, Map<string, DomainApiEndpoint>> = new Map();
  private readonly CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

  constructor(
    @InjectDataSource()
    private readonly dataSource: DataSource,
  ) {}

  /**
   * Load the entry flow for a domain by its DomainCode.
   * Returns the full flow graph (nodes + actions) ready for execution.
   */
  async loadEntryFlow(domainCode: string): Promise<LoadedFlow | null> {
    // Check cache
    const cached = this.flowCache.get(domainCode);
    if (cached && Date.now() - cached.loadedAt < this.CACHE_TTL_MS) {
      this.logger.debug(`Cache hit for domain: ${domainCode}`);
      return cached.data;
    }

    this.logger.log(`Loading entry flow for domain: ${domainCode}`);

    try {
      // 1. Resolve DomainId from DomainCode
      const domainResult = await this.dataSource.query(
        `SELECT DomainId FROM Domains WHERE DomainCode = @0 AND IsActive = 1`,
        [domainCode],
      );
      if (!domainResult || domainResult.length === 0) {
        this.logger.warn(`Domain not found: ${domainCode}`);
        return null;
      }
      const domainId = domainResult[0].DomainId;

      // 2. Load the entry flow
      const flowResult = await this.dataSource.query(
        `SELECT FlowId, DomainId, FlowCode, FlowName, Description, IsEntryFlow, FlowVersion, IsActive
         FROM IvrFlows
         WHERE DomainId = @0 AND IsEntryFlow = 1 AND IsActive = 1`,
        [domainId],
      );
      if (!flowResult || flowResult.length === 0) {
        this.logger.warn(`No entry flow found for domain: ${domainCode}`);
        return null;
      }
      const flow: IvrFlow = {
        flowId: flowResult[0].FlowId,
        domainId: flowResult[0].DomainId,
        flowCode: flowResult[0].FlowCode,
        flowName: flowResult[0].FlowName,
        description: flowResult[0].Description,
        isEntryFlow: flowResult[0].IsEntryFlow,
        flowVersion: flowResult[0].FlowVersion,
        isActive: flowResult[0].IsActive,
      };

      // 3. Load all nodes for this flow
      const nodesResult = await this.dataSource.query(
        `SELECT NodeId, FlowId, NodeCode, NodeType, NodeLabel, PromptText, SortOrder,
                NextNodeCode, BranchConfig, TimeoutSeconds, MaxRetries, MetadataJson, IsActive
         FROM IvrFlowNodes
         WHERE FlowId = @0 AND IsActive = 1
         ORDER BY SortOrder`,
        [flow.flowId],
      );

      const nodes = new Map<string, IvrFlowNode>();
      let entryNodeCode = '';

      for (const row of nodesResult) {
        const node: IvrFlowNode = {
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

      // 4. Load all actions for these nodes
      const nodeIds = Array.from(nodes.values()).map(n => `'${n.nodeId}'`).join(',');
      const nodeActions = new Map<string, IvrNodeAction[]>();

      if (nodeIds.length > 0) {
        const actionsResult = await this.dataSource.query(
          `SELECT ActionId, NodeId, ActionType, ActionOrder, ToolName, EndpointId,
                  RequestMapping, ResponseMapping, FallbackResponse, IsActive
           FROM IvrNodeActions
           WHERE NodeId IN (${nodeIds}) AND IsActive = 1
           ORDER BY ActionOrder`,
        );

        for (const row of actionsResult) {
          const action: IvrNodeAction = {
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

          // Group by nodeCode (find the node that owns this action)
          const ownerNode = Array.from(nodes.values()).find(n => n.nodeId === action.nodeId);
          if (ownerNode) {
            const existing = nodeActions.get(ownerNode.nodeCode) || [];
            existing.push(action);
            nodeActions.set(ownerNode.nodeCode, existing);
          }
        }
      }

      const loadedFlow: LoadedFlow = { flow, nodes, nodeActions, entryNodeCode };

      // Cache it
      this.flowCache.set(domainCode, { data: loadedFlow, loadedAt: Date.now() });
      this.logger.log(`Loaded flow "${flow.flowName}" with ${nodes.size} nodes for domain: ${domainCode}`);

      return loadedFlow;
    } catch (error) {
      this.logger.error(`Failed to load flow for domain ${domainCode}:`, error);
      return null;
    }
  }

  /**
   * Load a specific flow by FlowId (for sub-flows or non-entry flows).
   */
  async loadFlowById(flowId: string): Promise<LoadedFlow | null> {
    try {
      const flowResult = await this.dataSource.query(
        `SELECT FlowId, DomainId, FlowCode, FlowName, Description, IsEntryFlow, FlowVersion, IsActive
         FROM IvrFlows WHERE FlowId = @0 AND IsActive = 1`,
        [flowId],
      );
      if (!flowResult || flowResult.length === 0) return null;

      // Reuse the same loading logic via domain code
      const domainResult = await this.dataSource.query(
        `SELECT DomainCode FROM Domains WHERE DomainId = @0`,
        [flowResult[0].DomainId],
      );
      if (!domainResult || domainResult.length === 0) return null;

      return this.loadEntryFlow(domainResult[0].DomainCode);
    } catch (error) {
      this.logger.error(`Failed to load flow by ID ${flowId}:`, error);
      return null;
    }
  }

  /**
   * Load API endpoints for a domain.
   * Returns a map of endpointCode -> DomainApiEndpoint.
   */
  async loadDomainEndpoints(domainCode: string): Promise<Map<string, DomainApiEndpoint>> {
    // Check cache
    const cached = this.endpointCache.get(domainCode);
    if (cached) return cached;

    try {
      const domainResult = await this.dataSource.query(
        `SELECT DomainId FROM Domains WHERE DomainCode = @0`,
        [domainCode],
      );
      if (!domainResult || domainResult.length === 0) return new Map();

      const result = await this.dataSource.query(
        `SELECT EndpointId, DomainId, EndpointCode, EndpointName, HttpMethod, BaseUrl, Path,
                HeadersJson, AuthType, AuthConfig, TimeoutMs, RetryCount, IsActive
         FROM DomainApiEndpoints
         WHERE DomainId = @0 AND IsActive = 1`,
        [domainResult[0].DomainId],
      );

      const endpoints = new Map<string, DomainApiEndpoint>();
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
    } catch (error) {
      this.logger.error(`Failed to load endpoints for domain ${domainCode}:`, error);
      return new Map();
    }
  }

  /**
   * List all flows for a domain (for management UI).
   */
  async listFlowsForDomain(domainCode: string): Promise<IvrFlow[]> {
    try {
      const domainResult = await this.dataSource.query(
        `SELECT DomainId FROM Domains WHERE DomainCode = @0`,
        [domainCode],
      );
      if (!domainResult || domainResult.length === 0) return [];

      const result = await this.dataSource.query(
        `SELECT FlowId, DomainId, FlowCode, FlowName, Description, IsEntryFlow, FlowVersion, IsActive, CreatedAt, UpdatedAt
         FROM IvrFlows WHERE DomainId = @0 ORDER BY IsEntryFlow DESC, FlowCode`,
        [domainResult[0].DomainId],
      );

      return result.map((r: any) => ({
        flowId: r.FlowId,
        domainId: r.DomainId,
        flowCode: r.FlowCode,
        flowName: r.FlowName,
        description: r.Description,
        isEntryFlow: r.IsEntryFlow,
        flowVersion: r.FlowVersion,
        isActive: r.IsActive,
      }));
    } catch (error) {
      this.logger.error(`Failed to list flows for domain ${domainCode}:`, error);
      return [];
    }
  }

  /**
   * Invalidate cache for a domain (after config changes).
   */
  invalidateCache(domainCode?: string) {
    if (domainCode) {
      this.flowCache.delete(domainCode);
      this.endpointCache.delete(domainCode);
      this.logger.log(`Cache invalidated for domain: ${domainCode}`);
    } else {
      this.flowCache.clear();
      this.endpointCache.clear();
      this.logger.log('All caches invalidated');
    }
  }

  private safeJsonParse(value: string): any {
    try {
      return JSON.parse(value);
    } catch {
      return null;
    }
  }
}
