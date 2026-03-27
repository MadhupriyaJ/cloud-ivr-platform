import sql from 'mssql';
import { config as dotenvConfig } from 'dotenv';
import { resolve } from 'path';

dotenvConfig({ path: resolve('/tmp/cloud-ivr-platform/backend-nestjs/.env') });

const config = {
  server: process.env.MSSQL_HOST,
  port: parseInt(process.env.MSSQL_PORT || '1433'),
  user: process.env.MSSQL_USERNAME,
  password: process.env.MSSQL_PASSWORD,
  database: process.env.MSSQL_DATABASE,
  options: {
    encrypt: process.env.MSSQL_ENCRYPT === 'true',
    trustServerCertificate: process.env.MSSQL_TRUST_SERVER_CERTIFICATE === 'true'
  }
};

async function run() {
  const pool = await sql.connect(config);
  console.log('Connected to MSSQL');

  // Check if data already exists
  const existing = await pool.request().query('SELECT COUNT(*) as cnt FROM IvrFlows');
  if (existing.recordset[0].cnt > 0) {
    console.log('IvrFlows already has data, clearing for re-seed...');
    await pool.request().query('DELETE FROM IvrNodeActions');
    await pool.request().query('DELETE FROM IvrFlowNodes');
    await pool.request().query('DELETE FROM IvrFlows');
    await pool.request().query('DELETE FROM DomainApiEndpoints');
    console.log('Cleared existing data');
  }

  // ============================================================
  // Hospital Management Domain
  // ============================================================
  const hospitalDomainId = '03D19B01-9751-4DFE-9D33-ECBF99D3E7D9';

  // Create hospital flow
  const hfResult = await pool.request()
    .input('domainId', sql.UniqueIdentifier, hospitalDomainId)
    .query(`INSERT INTO IvrFlows (DomainId, FlowCode, FlowName, Description, IsEntryFlow) 
            OUTPUT INSERTED.FlowId
            VALUES (@domainId, 'main_menu', 'Hospital Main Menu', 'Entry flow for hospital IVR', 1)`);
  const hospitalFlowId = hfResult.recordset[0].FlowId;
  console.log('Created hospital flow:', hospitalFlowId);

  // Hospital nodes
  const hospitalNodes = [
    { code: 'welcome', type: 'prompt', label: 'Welcome Message', prompt: 'Welcome to City Care Hospital. How can I help you today? You can say: Book an appointment, Check lab reports, Billing inquiry, or speak to an agent.', sort: 1, next: 'route_intent' },
    { code: 'route_intent', type: 'branch', label: 'Route by Intent', prompt: 'I understand. Let me help you with that.', sort: 2, next: 'fallback_response', branch: '{"book_appointment":"collect_department","check_lab_report":"collect_patient_id","billing_inquiry":"collect_patient_id_billing","speak_to_agent":"transfer_agent"}' },
    { code: 'collect_department', type: 'collect_input', label: 'Collect Department', prompt: 'Which department would you like to visit? We have Cardiology, Orthopedics, General Medicine, and Pediatrics.', sort: 3, next: 'collect_date' },
    { code: 'collect_date', type: 'collect_input', label: 'Collect Preferred Date', prompt: 'What date would you prefer for your appointment?', sort: 4, next: 'book_appointment_api' },
    { code: 'book_appointment_api', type: 'api_call', label: 'Book Appointment', prompt: 'Let me book that appointment for you.', sort: 5, next: 'confirm_booking' },
    { code: 'confirm_booking', type: 'prompt', label: 'Confirm Booking', prompt: 'Your appointment has been booked successfully. You will receive a confirmation message shortly. Is there anything else I can help you with?', sort: 6, next: 'end_call' },
    { code: 'collect_patient_id', type: 'collect_input', label: 'Collect Patient ID', prompt: 'Please provide your patient ID or registered phone number.', sort: 7, next: 'fetch_lab_report_api' },
    { code: 'fetch_lab_report_api', type: 'api_call', label: 'Fetch Lab Report', prompt: 'Let me look up your lab reports.', sort: 8, next: 'read_lab_report' },
    { code: 'read_lab_report', type: 'prompt', label: 'Read Lab Report', prompt: 'Here are your latest lab results: {{lab_report_summary}}. Would you like me to email the full report?', sort: 9, next: 'end_call' },
    { code: 'collect_patient_id_billing', type: 'collect_input', label: 'Collect Patient ID for Billing', prompt: 'Please provide your patient ID for billing inquiry.', sort: 10, next: 'fetch_billing_api' },
    { code: 'fetch_billing_api', type: 'api_call', label: 'Fetch Billing Info', prompt: 'Let me check your billing information.', sort: 11, next: 'read_billing' },
    { code: 'read_billing', type: 'prompt', label: 'Read Billing Info', prompt: 'Your current outstanding balance is {{billing_amount}}. Would you like to make a payment or speak to our billing department?', sort: 12, next: 'end_call' },
    { code: 'transfer_agent', type: 'transfer', label: 'Transfer to Agent', prompt: 'I am transferring you to a live agent. Please hold.', sort: 13, next: null },
    { code: 'fallback_response', type: 'prompt', label: 'Fallback Response', prompt: 'I am sorry, I did not understand that. Let me connect you to an agent who can help.', sort: 14, next: 'transfer_agent' },
    { code: 'end_call', type: 'end', label: 'End Call', prompt: 'Thank you for calling City Care Hospital. Have a great day!', sort: 15, next: null },
  ];

  const hospitalNodeIds = {};
  for (const node of hospitalNodes) {
    const r = await pool.request()
      .input('flowId', sql.UniqueIdentifier, hospitalFlowId)
      .input('code', sql.NVarChar, node.code)
      .input('type', sql.NVarChar, node.type)
      .input('label', sql.NVarChar, node.label)
      .input('prompt', sql.NVarChar, node.prompt)
      .input('sort', sql.Int, node.sort)
      .input('next', sql.NVarChar, node.next)
      .input('branch', sql.NVarChar, node.branch || null)
      .query(`INSERT INTO IvrFlowNodes (FlowId, NodeCode, NodeType, NodeLabel, PromptText, SortOrder, NextNodeCode, BranchConfig)
              OUTPUT INSERTED.NodeId
              VALUES (@flowId, @code, @type, @label, @prompt, @sort, @next, @branch)`);
    hospitalNodeIds[node.code] = r.recordset[0].NodeId;
  }
  console.log('Created', Object.keys(hospitalNodeIds).length, 'hospital nodes');

  // Hospital node actions
  const hospitalActions = [
    { nodeCode: 'book_appointment_api', type: 'api_call', tool: 'book_appointment', reqMap: '{"department":"{{department}}","date":"{{preferred_date}}","patient_name":"{{caller_name}}"}', resMap: '{"appointment_id":"appointmentId","confirmation":"confirmationMessage"}', fallback: '{"message":"I apologize, our booking system is temporarily unavailable. Please try again later or visit our website."}' },
    { nodeCode: 'fetch_lab_report_api', type: 'api_call', tool: 'get_lab_reports', reqMap: '{"patient_id":"{{patient_id}}"}', resMap: '{"lab_report_summary":"summary","report_date":"reportDate"}', fallback: '{"message":"I apologize, our lab report system is currently unavailable. Please visit the hospital or check our patient portal."}' },
    { nodeCode: 'fetch_billing_api', type: 'api_call', tool: 'get_billing_info', reqMap: '{"patient_id":"{{patient_id}}"}', resMap: '{"billing_amount":"outstandingAmount","last_payment":"lastPaymentDate"}', fallback: '{"message":"I apologize, our billing system is temporarily unavailable. Please contact our billing department directly."}' },
  ];

  for (const action of hospitalActions) {
    await pool.request()
      .input('nodeId', sql.UniqueIdentifier, hospitalNodeIds[action.nodeCode])
      .input('type', sql.NVarChar, action.type)
      .input('tool', sql.NVarChar, action.tool)
      .input('reqMap', sql.NVarChar, action.reqMap)
      .input('resMap', sql.NVarChar, action.resMap)
      .input('fallback', sql.NVarChar, action.fallback)
      .query(`INSERT INTO IvrNodeActions (NodeId, ActionType, ActionOrder, ToolName, RequestMapping, ResponseMapping, FallbackResponse)
              VALUES (@nodeId, @type, 1, @tool, @reqMap, @resMap, @fallback)`);
  }
  console.log('Created hospital node actions');

  // Hospital API endpoints
  const hospitalEndpoints = [
    { code: 'book_appointment', name: 'Book Appointment', method: 'POST', path: '/api/hospital/appointments' },
    { code: 'get_lab_reports', name: 'Get Lab Reports', method: 'GET', path: '/api/hospital/lab-reports/{{patient_id}}' },
    { code: 'get_billing_info', name: 'Get Billing Info', method: 'GET', path: '/api/hospital/billing/{{patient_id}}' },
    { code: 'get_departments', name: 'Get Departments', method: 'GET', path: '/api/hospital/departments' },
    { code: 'get_doctors', name: 'Get Doctors by Dept', method: 'GET', path: '/api/hospital/doctors/{{department_id}}' },
  ];

  for (const ep of hospitalEndpoints) {
    await pool.request()
      .input('domainId', sql.UniqueIdentifier, hospitalDomainId)
      .input('code', sql.NVarChar, ep.code)
      .input('name', sql.NVarChar, ep.name)
      .input('method', sql.NVarChar, ep.method)
      .input('baseUrl', sql.NVarChar, 'http://localhost:8010')
      .input('path', sql.NVarChar, ep.path)
      .query(`INSERT INTO DomainApiEndpoints (DomainId, EndpointCode, EndpointName, HttpMethod, BaseUrl, Path, AuthType)
              VALUES (@domainId, @code, @name, @method, @baseUrl, @path, 'none')`);
  }
  console.log('Created hospital API endpoints');

  // ============================================================
  // Banking Domain
  // ============================================================
  const bankingDomainId = 'F4A891A5-71EF-4BCF-888B-A898D5E44D5E';

  const bfResult = await pool.request()
    .input('domainId', sql.UniqueIdentifier, bankingDomainId)
    .query(`INSERT INTO IvrFlows (DomainId, FlowCode, FlowName, Description, IsEntryFlow)
            OUTPUT INSERTED.FlowId
            VALUES (@domainId, 'main_menu', 'Banking Main Menu', 'Entry flow for banking IVR', 1)`);
  const bankingFlowId = bfResult.recordset[0].FlowId;
  console.log('Created banking flow:', bankingFlowId);

  const bankingNodes = [
    { code: 'welcome', type: 'prompt', label: 'Welcome', prompt: 'Welcome to SecureBank. How can I assist you today? You can check your balance, make a transfer, manage your card, or speak to a representative.', sort: 1, next: 'route_intent' },
    { code: 'route_intent', type: 'branch', label: 'Route by Intent', prompt: null, sort: 2, next: 'fallback_response', branch: '{"check_balance":"collect_account","make_transfer":"collect_transfer_from","card_services":"card_menu","speak_to_agent":"transfer_agent"}' },
    { code: 'collect_account', type: 'collect_input', label: 'Collect Account Number', prompt: 'Please provide your account number or the last 4 digits of your registered phone number.', sort: 3, next: 'fetch_balance_api' },
    { code: 'fetch_balance_api', type: 'api_call', label: 'Fetch Balance', prompt: 'Let me check your account balance.', sort: 4, next: 'read_balance' },
    { code: 'read_balance', type: 'prompt', label: 'Read Balance', prompt: 'Your current account balance is {{balance}} dollars. Your last transaction was {{last_transaction}}. Is there anything else I can help with?', sort: 5, next: 'end_call' },
    { code: 'collect_transfer_from', type: 'collect_input', label: 'Collect Source Account', prompt: 'Please provide the account number you want to transfer from.', sort: 6, next: 'collect_transfer_to' },
    { code: 'collect_transfer_to', type: 'collect_input', label: 'Collect Destination', prompt: 'Please provide the destination account number and the amount you wish to transfer.', sort: 7, next: 'execute_transfer_api' },
    { code: 'execute_transfer_api', type: 'api_call', label: 'Execute Transfer', prompt: 'Processing your transfer now.', sort: 8, next: 'confirm_transfer' },
    { code: 'confirm_transfer', type: 'prompt', label: 'Confirm Transfer', prompt: 'Your transfer of {{transfer_amount}} dollars to account {{destination_account}} has been completed. Reference number: {{reference_id}}.', sort: 9, next: 'end_call' },
    { code: 'card_menu', type: 'branch', label: 'Card Services Menu', prompt: 'For card services, you can: Block your card, Request a new card, or Check card status.', sort: 10, next: 'fallback_response', branch: '{"block_card":"block_card_api","request_new_card":"request_card_api","check_card_status":"card_status_api"}' },
    { code: 'block_card_api', type: 'api_call', label: 'Block Card', prompt: 'I am blocking your card immediately for security.', sort: 11, next: 'confirm_card_blocked' },
    { code: 'confirm_card_blocked', type: 'prompt', label: 'Confirm Card Blocked', prompt: 'Your card has been blocked successfully. A new card will be mailed to your registered address within 5 business days.', sort: 12, next: 'end_call' },
    { code: 'transfer_agent', type: 'transfer', label: 'Transfer to Agent', prompt: 'Connecting you to a banking representative. Please hold.', sort: 13, next: null },
    { code: 'fallback_response', type: 'prompt', label: 'Fallback', prompt: 'I did not understand that. Let me connect you to a representative.', sort: 14, next: 'transfer_agent' },
    { code: 'end_call', type: 'end', label: 'End Call', prompt: 'Thank you for banking with SecureBank. Have a great day!', sort: 15, next: null },
  ];

  const bankingNodeIds = {};
  for (const node of bankingNodes) {
    const r = await pool.request()
      .input('flowId', sql.UniqueIdentifier, bankingFlowId)
      .input('code', sql.NVarChar, node.code)
      .input('type', sql.NVarChar, node.type)
      .input('label', sql.NVarChar, node.label)
      .input('prompt', sql.NVarChar, node.prompt)
      .input('sort', sql.Int, node.sort)
      .input('next', sql.NVarChar, node.next)
      .input('branch', sql.NVarChar, node.branch || null)
      .query(`INSERT INTO IvrFlowNodes (FlowId, NodeCode, NodeType, NodeLabel, PromptText, SortOrder, NextNodeCode, BranchConfig)
              OUTPUT INSERTED.NodeId
              VALUES (@flowId, @code, @type, @label, @prompt, @sort, @next, @branch)`);
    bankingNodeIds[node.code] = r.recordset[0].NodeId;
  }
  console.log('Created', Object.keys(bankingNodeIds).length, 'banking nodes');

  // Banking node actions
  const bankingActions = [
    { nodeCode: 'fetch_balance_api', type: 'api_call', tool: 'check_balance', reqMap: '{"account_number":"{{account_number}}"}', resMap: '{"balance":"currentBalance","last_transaction":"lastTransactionDescription"}', fallback: '{"message":"Our banking system is temporarily unavailable. Please try again later or visit your nearest branch."}' },
    { nodeCode: 'execute_transfer_api', type: 'api_call', tool: 'execute_transfer', reqMap: '{"from_account":"{{source_account}}","to_account":"{{destination_account}}","amount":"{{transfer_amount}}"}', resMap: '{"reference_id":"referenceNumber","status":"transferStatus"}', fallback: '{"message":"Transfer service is temporarily unavailable. Please try again later or visit your nearest branch."}' },
    { nodeCode: 'block_card_api', type: 'api_call', tool: 'block_card', reqMap: '{"account_number":"{{account_number}}","card_last_four":"{{card_last_four}}"}', resMap: '{"block_status":"status","new_card_eta":"estimatedDelivery"}', fallback: '{"message":"Card blocking service is temporarily unavailable. Please call our emergency hotline for immediate assistance."}' },
  ];

  for (const action of bankingActions) {
    await pool.request()
      .input('nodeId', sql.UniqueIdentifier, bankingNodeIds[action.nodeCode])
      .input('type', sql.NVarChar, action.type)
      .input('tool', sql.NVarChar, action.tool)
      .input('reqMap', sql.NVarChar, action.reqMap)
      .input('resMap', sql.NVarChar, action.resMap)
      .input('fallback', sql.NVarChar, action.fallback)
      .query(`INSERT INTO IvrNodeActions (NodeId, ActionType, ActionOrder, ToolName, RequestMapping, ResponseMapping, FallbackResponse)
              VALUES (@nodeId, @type, 1, @tool, @reqMap, @resMap, @fallback)`);
  }
  console.log('Created banking node actions');

  // Banking API endpoints (mock)
  const bankingEndpoints = [
    { code: 'check_balance', name: 'Check Account Balance', method: 'GET', path: '/api/mock/banking/balance/{{account_number}}' },
    { code: 'execute_transfer', name: 'Execute Transfer', method: 'POST', path: '/api/mock/banking/transfer' },
    { code: 'block_card', name: 'Block Card', method: 'POST', path: '/api/mock/banking/card/block' },
    { code: 'request_new_card', name: 'Request New Card', method: 'POST', path: '/api/mock/banking/card/request' },
    { code: 'card_status', name: 'Check Card Status', method: 'GET', path: '/api/mock/banking/card/status/{{account_number}}' },
  ];

  for (const ep of bankingEndpoints) {
    await pool.request()
      .input('domainId', sql.UniqueIdentifier, bankingDomainId)
      .input('code', sql.NVarChar, ep.code)
      .input('name', sql.NVarChar, ep.name)
      .input('method', sql.NVarChar, ep.method)
      .input('baseUrl', sql.NVarChar, 'http://localhost:8010')
      .input('path', sql.NVarChar, ep.path)
      .query(`INSERT INTO DomainApiEndpoints (DomainId, EndpointCode, EndpointName, HttpMethod, BaseUrl, Path, AuthType)
              VALUES (@domainId, @code, @name, @method, @baseUrl, @path, 'none')`);
  }
  console.log('Created banking API endpoints');

  // Verify
  const flows = await pool.request().query('SELECT COUNT(*) as cnt FROM IvrFlows');
  const nodes = await pool.request().query('SELECT COUNT(*) as cnt FROM IvrFlowNodes');
  const actions = await pool.request().query('SELECT COUNT(*) as cnt FROM IvrNodeActions');
  const endpoints = await pool.request().query('SELECT COUNT(*) as cnt FROM DomainApiEndpoints');
  console.log('\n=== Seed Summary ===');
  console.log('Flows:', flows.recordset[0].cnt);
  console.log('Nodes:', nodes.recordset[0].cnt);
  console.log('Actions:', actions.recordset[0].cnt);
  console.log('API Endpoints:', endpoints.recordset[0].cnt);

  await pool.close();
  console.log('\nSeed complete!');
}

run().catch(e => { console.error(e); process.exit(1); });
