/**
 * E-Commerce Domain Seed Script
 * 
 * Demonstrates adding a new domain to the Generic IVR Engine
 * using ONLY configuration (SQL inserts) - no code changes required.
 * 
 * This script inserts:
 * 1. Domain configuration (Domains table)
 * 2. IVR Flow definition (IvrFlows table)
 * 3. Flow nodes (IvrFlowNodes table)
 * 4. API endpoint mappings (DomainApiEndpoints table)
 * 5. Node actions (IvrNodeActions table)
 */

import mssql from 'mssql';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
dotenv.config({ path: join(__dirname, '.env') });

const config = {
  server: process.env.DB_HOST || process.env.MSSQL_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT || process.env.MSSQL_PORT || '1433'),
  database: process.env.DB_NAME || process.env.MSSQL_DATABASE || 'cloud_ivr',
  user: process.env.DB_USER || process.env.MSSQL_USERNAME || 'sa',
  password: process.env.DB_PASSWORD || process.env.MSSQL_PASSWORD || '',
  options: {
    encrypt: false,
    trustServerCertificate: true,
  },
};

async function seed() {
  console.log('🛒 Seeding E-Commerce domain...');
  console.log(`   Connecting to ${config.server}:${config.port}/${config.database}`);
  
  const pool = await mssql.connect(config);

  try {
    // 1. Check if e-commerce domain already exists
    const existing = await pool.request()
      .input('code', 'ecommerce')
      .query("SELECT DomainId FROM Domains WHERE DomainCode = @code");
    
    let domainId;
    
    if (existing.recordset.length > 0) {
      domainId = existing.recordset[0].DomainId;
      console.log(`   ✓ E-Commerce domain already exists (DomainId: ${domainId}), cleaning up for re-seed...`);
      
      // Clean up existing data for re-seed
      await pool.request().input('did', mssql.UniqueIdentifier, domainId).query(`
        DELETE FROM IvrNodeActions WHERE NodeId IN (SELECT NodeId FROM IvrFlowNodes WHERE FlowId IN (SELECT FlowId FROM IvrFlows WHERE DomainId = @did));
        DELETE FROM IvrFlowNodes WHERE FlowId IN (SELECT FlowId FROM IvrFlows WHERE DomainId = @did);
        DELETE FROM IvrFlows WHERE DomainId = @did;
        DELETE FROM DomainApiEndpoints WHERE DomainId = @did;
      `);
    } else {
      // Insert domain
      const domainResult = await pool.request().query(`
        DECLARE @newId UNIQUEIDENTIFIER = NEWID();
        INSERT INTO Domains (DomainId, DomainCode, DisplayName, OrganizationName, IndustryType, DefaultLanguage, DefaultVoice, WelcomeMessage, FallbackMessage, EscalationMessage, IsActive, CreatedAt, UpdatedAt)
        VALUES (@newId, 'ecommerce', 'E-Commerce Support', 'ShopEasy Inc.', 'E-Commerce', 'en', 'alloy', 
          'Welcome to ShopEasy customer support!', 
          'Sorry, I did not understand. Please try again or say "agent" to speak with a representative.',
          'Let me connect you to a customer service representative. Please hold.',
          1, GETDATE(), GETDATE());
        SELECT @newId AS DomainId;
      `);
      domainId = domainResult.recordset[0].DomainId;
      console.log(`   ✓ Created E-Commerce domain (DomainId: ${domainId})`);
    }

    // 2. Create the main IVR flow
    const flowResult = await pool.request().query(`
      DECLARE @flowId UNIQUEIDENTIFIER = NEWID();
      INSERT INTO IvrFlows (FlowId, DomainId, FlowCode, FlowName, Description, IsEntryFlow, FlowVersion, IsActive, CreatedAt, UpdatedAt)
      VALUES (@flowId, '${domainId}', 'ecommerce-main', 'E-Commerce Customer Support', 
        'Main IVR flow for e-commerce customer support - handles order status, returns, product inquiries, cancellations, and delivery rescheduling.', 
        1, 1, 1, GETDATE(), GETDATE());
      SELECT @flowId AS FlowId;
    `);
    const flowId = flowResult.recordset[0].FlowId;
    console.log(`   ✓ Created flow: ecommerce-main (FlowId: ${flowId})`);

    // 3. Create flow nodes
    const nodes = [
      { code: 'welcome', type: 'prompt', label: 'Welcome Greeting', prompt: 'Welcome to ShopEasy customer support! How can I help you today? You can say: Order Status, Return or Exchange, Product Inquiry, Cancel Order, or Reschedule Delivery.', sort: 10, next: 'main_menu' },
      { code: 'main_menu', type: 'branch', label: 'Main Menu Router', prompt: 'Please tell me what you need help with.', sort: 20, next: null, branch: { 'order_status': 'collect_order_id', 'return': 'collect_return_order', 'product': 'collect_product_name', 'cancel': 'collect_cancel_order', 'reschedule': 'collect_reschedule_order' } },
      { code: 'collect_order_id', type: 'collect_input', label: 'Collect Order ID', prompt: 'Please provide your order ID. It starts with ORD followed by numbers.', sort: 30, next: 'check_order_status' },
      { code: 'check_order_status', type: 'action', label: 'Check Order Status API', prompt: 'Let me check your order status...', sort: 40, next: 'end_call' },
      { code: 'collect_return_order', type: 'collect_input', label: 'Collect Return Order ID', prompt: 'Please provide the order ID for the item you want to return.', sort: 50, next: 'collect_return_reason' },
      { code: 'collect_return_reason', type: 'collect_input', label: 'Collect Return Reason', prompt: 'What is the reason for the return? You can say: Defective, Wrong item, Not as described, or Changed mind.', sort: 60, next: 'process_return' },
      { code: 'process_return', type: 'action', label: 'Process Return API', prompt: 'Processing your return request...', sort: 70, next: 'end_call' },
      { code: 'collect_product_name', type: 'collect_input', label: 'Collect Product Name', prompt: 'What product are you looking for? You can say the product name or category.', sort: 80, next: 'product_lookup' },
      { code: 'product_lookup', type: 'action', label: 'Product Inquiry API', prompt: 'Let me look that up for you...', sort: 90, next: 'end_call' },
      { code: 'collect_cancel_order', type: 'collect_input', label: 'Collect Cancel Order ID', prompt: 'Please provide the order ID you want to cancel.', sort: 100, next: 'process_cancel' },
      { code: 'process_cancel', type: 'action', label: 'Cancel Order API', prompt: 'Processing your cancellation...', sort: 110, next: 'end_call' },
      { code: 'collect_reschedule_order', type: 'collect_input', label: 'Collect Reschedule Order ID', prompt: 'Please provide the order ID for delivery rescheduling.', sort: 120, next: 'collect_new_date' },
      { code: 'collect_new_date', type: 'collect_input', label: 'Collect New Date', prompt: 'What date would you prefer for delivery? Please say the date.', sort: 130, next: 'process_reschedule' },
      { code: 'process_reschedule', type: 'action', label: 'Reschedule Delivery API', prompt: 'Rescheduling your delivery...', sort: 140, next: 'end_call' },
      { code: 'end_call', type: 'end', label: 'End Call', prompt: 'Thank you for contacting ShopEasy! Is there anything else I can help you with? If not, have a great day!', sort: 999, next: null },
    ];

    const nodeIdMap = {};
    for (const node of nodes) {
      const branchJson = node.branch ? JSON.stringify(node.branch).replace(/'/g, "''") : null;
      
      const result = await pool.request().query(`
        DECLARE @nodeId UNIQUEIDENTIFIER = NEWID();
        INSERT INTO IvrFlowNodes (NodeId, FlowId, NodeCode, NodeType, NodeLabel, PromptText, SortOrder, NextNodeCode, BranchConfig, TimeoutSeconds, MaxRetries, IsActive, CreatedAt)
        VALUES (@nodeId, '${flowId}', '${node.code}', '${node.type}', '${node.label}', '${node.prompt.replace(/'/g, "''")}', ${node.sort}, ${node.next ? `'${node.next}'` : 'NULL'}, ${branchJson ? `'${branchJson}'` : 'NULL'}, 30, 3, 1, GETDATE());
        SELECT @nodeId AS NodeId;
      `);
      nodeIdMap[node.code] = result.recordset[0].NodeId;
    }
    console.log(`   ✓ Created ${nodes.length} flow nodes`);

    // 4. Create API endpoints
    const endpoints = [
      { code: 'ecom_order_status', name: 'Order Status Check', method: 'POST', url: 'http://localhost:8010/api/mock/ecommerce/order-status' },
      { code: 'ecom_return_request', name: 'Return Request', method: 'POST', url: 'http://localhost:8010/api/mock/ecommerce/return-request' },
      { code: 'ecom_product_inquiry', name: 'Product Inquiry', method: 'POST', url: 'http://localhost:8010/api/mock/ecommerce/product-inquiry' },
      { code: 'ecom_cancel_order', name: 'Cancel Order', method: 'POST', url: 'http://localhost:8010/api/mock/ecommerce/cancel-order' },
      { code: 'ecom_delivery_reschedule', name: 'Delivery Reschedule', method: 'POST', url: 'http://localhost:8010/api/mock/ecommerce/delivery-reschedule' },
    ];

    const endpointIdMap = {};
    for (const ep of endpoints) {
      const result = await pool.request().query(`
        DECLARE @epId UNIQUEIDENTIFIER = NEWID();
        INSERT INTO DomainApiEndpoints (EndpointId, DomainId, EndpointCode, EndpointName, HttpMethod, BaseUrl, Path, AuthType, TimeoutMs, RetryCount, IsActive, CreatedAt, UpdatedAt)
        VALUES (@epId, '${domainId}', '${ep.code}', '${ep.name}', '${ep.method}', '${ep.url}', '', 'none', 30000, 2, 1, GETDATE(), GETDATE());
        SELECT @epId AS EndpointId;
      `);
      endpointIdMap[ep.code] = result.recordset[0].EndpointId;
    }
    console.log(`   ✓ Created ${endpoints.length} API endpoints`);

    // 5. Create node actions (link action nodes to API endpoints)
    const actions = [
      { nodeCode: 'check_order_status', endpointCode: 'ecom_order_status', reqMap: { orderId: '{{orderId}}' }, resMap: { confirmation: '{{data.message}}' } },
      { nodeCode: 'process_return', endpointCode: 'ecom_return_request', reqMap: { orderId: '{{orderId}}', reason: '{{reason}}' }, resMap: { confirmation: '{{data.message}}' } },
      { nodeCode: 'product_lookup', endpointCode: 'ecom_product_inquiry', reqMap: { productName: '{{productName}}' }, resMap: { confirmation: '{{data.message}}' } },
      { nodeCode: 'process_cancel', endpointCode: 'ecom_cancel_order', reqMap: { orderId: '{{orderId}}' }, resMap: { confirmation: '{{data.message}}' } },
      { nodeCode: 'process_reschedule', endpointCode: 'ecom_delivery_reschedule', reqMap: { orderId: '{{orderId}}', preferredDate: '{{preferredDate}}' }, resMap: { confirmation: '{{data.message}}' } },
    ];

    for (const action of actions) {
      const nodeId = nodeIdMap[action.nodeCode];
      const endpointId = endpointIdMap[action.endpointCode];
      await pool.request().query(`
        INSERT INTO IvrNodeActions (ActionId, NodeId, ActionType, ActionOrder, ToolName, EndpointId, RequestMapping, ResponseMapping, FallbackResponse, IsActive, CreatedAt)
        VALUES (NEWID(), '${nodeId}', 'api_call', 1, '${action.endpointCode}', '${endpointId}', '${JSON.stringify(action.reqMap).replace(/'/g, "''")}', '${JSON.stringify(action.resMap).replace(/'/g, "''")}', '{"message": "Sorry, the service is temporarily unavailable. Please try again later."}', 1, GETDATE());
      `);
    }
    console.log(`   ✓ Created ${actions.length} node actions`);

    console.log('\n🎉 E-Commerce domain seeded successfully!');
    console.log(`   Domain: ecommerce (ID: ${domainId})`);
    console.log(`   Flow: ecommerce-main (ID: ${flowId})`);
    console.log(`   Nodes: ${nodes.length}`);
    console.log(`   Endpoints: ${endpoints.length}`);
    console.log(`   Actions: ${actions.length}`);
    console.log('\n   Test it: POST /api/ivr-engine/session/start { "domainCode": "ecommerce" }');

  } catch (error) {
    console.error('❌ Seed failed:', error.message);
    throw error;
  } finally {
    await pool.close();
  }
}

seed().catch(err => {
  console.error(err);
  process.exit(1);
});
