-- ============================================================
-- DML: Seed data for Generic IVR Engine
-- Seeds IVR flows for hospital-management and banking domains
-- Also seeds mock API endpoints for banking
-- ============================================================

-- ============================================================
-- 1. Hospital Management Domain - IVR Flow
-- DomainId: 03D19B01-9751-4DFE-9D33-ECBF99D3E7D9
-- ============================================================

DECLARE @hospitalDomainId uniqueidentifier = '03D19B01-9751-4DFE-9D33-ECBF99D3E7D9';
DECLARE @hospitalFlowId uniqueidentifier = NEWID();

INSERT INTO IvrFlows (FlowId, DomainId, FlowCode, FlowName, Description, IsEntryFlow, FlowVersion, IsActive)
VALUES (@hospitalFlowId, @hospitalDomainId, 'main_menu', 'Hospital Main Menu', 'Entry flow for hospital IVR - routes to appointments, lab reports, billing, or agent', 1, 1, 1);

-- Node 1: Welcome
DECLARE @n1 uniqueidentifier = NEWID();
INSERT INTO IvrFlowNodes (NodeId, FlowId, NodeCode, NodeType, NodeLabel, PromptText, SortOrder, NextNodeCode, IsActive)
VALUES (@n1, @hospitalFlowId, 'welcome', 'prompt', 'Welcome Message',
  'Welcome to City Care Hospital. How can I help you today? You can say: Book an appointment, Check lab reports, Billing inquiry, or speak to an agent.',
  1, 'route_intent', 1);

-- Node 2: Route by intent (AI-driven branching)
DECLARE @n2 uniqueidentifier = NEWID();
INSERT INTO IvrFlowNodes (NodeId, FlowId, NodeCode, NodeType, NodeLabel, PromptText, SortOrder, NextNodeCode, BranchConfig, IsActive)
VALUES (@n2, @hospitalFlowId, 'route_intent', 'branch', 'Route by Intent',
  'I understand. Let me help you with that.',
  2, 'fallback_response',
  '{"book_appointment":"collect_department","check_lab_report":"collect_patient_id","billing_inquiry":"collect_patient_id_billing","speak_to_agent":"transfer_agent"}',
  1);

-- Node 3: Collect department for appointment
DECLARE @n3 uniqueidentifier = NEWID();
INSERT INTO IvrFlowNodes (NodeId, FlowId, NodeCode, NodeType, NodeLabel, PromptText, SortOrder, NextNodeCode, TimeoutSeconds, MaxRetries, IsActive)
VALUES (@n3, @hospitalFlowId, 'collect_department', 'collect_input', 'Collect Department',
  'Which department would you like to visit? We have Cardiology, Orthopedics, General Medicine, and Pediatrics.',
  3, 'collect_date', 30, 3, 1);

-- Node 4: Collect date
DECLARE @n4 uniqueidentifier = NEWID();
INSERT INTO IvrFlowNodes (NodeId, FlowId, NodeCode, NodeType, NodeLabel, PromptText, SortOrder, NextNodeCode, IsActive)
VALUES (@n4, @hospitalFlowId, 'collect_date', 'collect_input', 'Collect Preferred Date',
  'What date would you prefer for your appointment?',
  4, 'book_appointment_api', 1);

-- Node 5: Call booking API
DECLARE @n5 uniqueidentifier = NEWID();
INSERT INTO IvrFlowNodes (NodeId, FlowId, NodeCode, NodeType, NodeLabel, PromptText, SortOrder, NextNodeCode, IsActive)
VALUES (@n5, @hospitalFlowId, 'book_appointment_api', 'api_call', 'Book Appointment',
  'Let me book that appointment for you.',
  5, 'confirm_booking', 1);

-- Node 6: Confirm booking
DECLARE @n6 uniqueidentifier = NEWID();
INSERT INTO IvrFlowNodes (NodeId, FlowId, NodeCode, NodeType, NodeLabel, PromptText, SortOrder, NextNodeCode, IsActive)
VALUES (@n6, @hospitalFlowId, 'confirm_booking', 'prompt', 'Confirm Booking',
  'Your appointment has been booked successfully. You will receive a confirmation message shortly. Is there anything else I can help you with?',
  6, 'end_call', 1);

-- Node 7: Collect patient ID for lab reports
DECLARE @n7 uniqueidentifier = NEWID();
INSERT INTO IvrFlowNodes (NodeId, FlowId, NodeCode, NodeType, NodeLabel, PromptText, SortOrder, NextNodeCode, IsActive)
VALUES (@n7, @hospitalFlowId, 'collect_patient_id', 'collect_input', 'Collect Patient ID',
  'Please provide your patient ID or registered phone number.',
  7, 'fetch_lab_report_api', 1);

-- Node 8: Fetch lab report API
DECLARE @n8 uniqueidentifier = NEWID();
INSERT INTO IvrFlowNodes (NodeId, FlowId, NodeCode, NodeType, NodeLabel, PromptText, SortOrder, NextNodeCode, IsActive)
VALUES (@n8, @hospitalFlowId, 'fetch_lab_report_api', 'api_call', 'Fetch Lab Report',
  'Let me look up your lab reports.',
  8, 'read_lab_report', 1);

-- Node 9: Read lab report
DECLARE @n9 uniqueidentifier = NEWID();
INSERT INTO IvrFlowNodes (NodeId, FlowId, NodeCode, NodeType, NodeLabel, PromptText, SortOrder, NextNodeCode, IsActive)
VALUES (@n9, @hospitalFlowId, 'read_lab_report', 'prompt', 'Read Lab Report',
  'Here are your latest lab results: {{lab_report_summary}}. Would you like me to email the full report?',
  9, 'end_call', 1);

-- Node 10: Collect patient ID for billing
DECLARE @n10 uniqueidentifier = NEWID();
INSERT INTO IvrFlowNodes (NodeId, FlowId, NodeCode, NodeType, NodeLabel, PromptText, SortOrder, NextNodeCode, IsActive)
VALUES (@n10, @hospitalFlowId, 'collect_patient_id_billing', 'collect_input', 'Collect Patient ID for Billing',
  'Please provide your patient ID for billing inquiry.',
  10, 'fetch_billing_api', 1);

-- Node 11: Fetch billing API
DECLARE @n11 uniqueidentifier = NEWID();
INSERT INTO IvrFlowNodes (NodeId, FlowId, NodeCode, NodeType, NodeLabel, PromptText, SortOrder, NextNodeCode, IsActive)
VALUES (@n11, @hospitalFlowId, 'fetch_billing_api', 'api_call', 'Fetch Billing Info',
  'Let me check your billing information.',
  11, 'read_billing', 1);

-- Node 12: Read billing
DECLARE @n12 uniqueidentifier = NEWID();
INSERT INTO IvrFlowNodes (NodeId, FlowId, NodeCode, NodeType, NodeLabel, PromptText, SortOrder, NextNodeCode, IsActive)
VALUES (@n12, @hospitalFlowId, 'read_billing', 'prompt', 'Read Billing Info',
  'Your current outstanding balance is {{billing_amount}}. Would you like to make a payment or speak to our billing department?',
  12, 'end_call', 1);

-- Node 13: Transfer to agent
DECLARE @n13 uniqueidentifier = NEWID();
INSERT INTO IvrFlowNodes (NodeId, FlowId, NodeCode, NodeType, NodeLabel, PromptText, SortOrder, NextNodeCode, IsActive)
VALUES (@n13, @hospitalFlowId, 'transfer_agent', 'transfer', 'Transfer to Agent',
  'I am transferring you to a live agent. Please hold.',
  13, NULL, 1);

-- Node 14: Fallback
DECLARE @n14 uniqueidentifier = NEWID();
INSERT INTO IvrFlowNodes (NodeId, FlowId, NodeCode, NodeType, NodeLabel, PromptText, SortOrder, NextNodeCode, IsActive)
VALUES (@n14, @hospitalFlowId, 'fallback_response', 'prompt', 'Fallback Response',
  'I am sorry, I did not understand that. Let me connect you to an agent who can help.',
  14, 'transfer_agent', 1);

-- Node 15: End call
DECLARE @n15 uniqueidentifier = NEWID();
INSERT INTO IvrFlowNodes (NodeId, FlowId, NodeCode, NodeType, NodeLabel, PromptText, SortOrder, IsActive)
VALUES (@n15, @hospitalFlowId, 'end_call', 'end', 'End Call',
  'Thank you for calling City Care Hospital. Have a great day!',
  15, 1);

-- Actions for book_appointment_api node
INSERT INTO IvrNodeActions (NodeId, ActionType, ActionOrder, ToolName, RequestMapping, ResponseMapping, FallbackResponse, IsActive)
VALUES (@n5, 'api_call', 1, 'book_appointment',
  '{"department":"{{department}}","date":"{{preferred_date}}","patient_name":"{{caller_name}}"}',
  '{"appointment_id":"appointmentId","confirmation":"confirmationMessage"}',
  '{"message":"I apologize, our booking system is temporarily unavailable. Please try again later or visit our website."}',
  1);

-- Actions for fetch_lab_report_api node
INSERT INTO IvrNodeActions (NodeId, ActionType, ActionOrder, ToolName, RequestMapping, ResponseMapping, FallbackResponse, IsActive)
VALUES (@n8, 'api_call', 1, 'get_lab_reports',
  '{"patient_id":"{{patient_id}}"}',
  '{"lab_report_summary":"summary","report_date":"reportDate"}',
  '{"message":"I apologize, our lab report system is currently unavailable. Please visit the hospital or check our patient portal."}',
  1);

-- Actions for fetch_billing_api node
INSERT INTO IvrNodeActions (NodeId, ActionType, ActionOrder, ToolName, RequestMapping, ResponseMapping, FallbackResponse, IsActive)
VALUES (@n11, 'api_call', 1, 'get_billing_info',
  '{"patient_id":"{{patient_id}}"}',
  '{"billing_amount":"outstandingAmount","last_payment":"lastPaymentDate"}',
  '{"message":"I apologize, our billing system is temporarily unavailable. Please contact our billing department directly."}',
  1);

-- ============================================================
-- 2. Hospital Domain API Endpoints (internal)
-- ============================================================

INSERT INTO DomainApiEndpoints (DomainId, EndpointCode, EndpointName, HttpMethod, BaseUrl, Path, AuthType, IsActive)
VALUES
(@hospitalDomainId, 'book_appointment', 'Book Appointment', 'POST', 'http://localhost:8010', '/api/hospital/appointments', 'none', 1),
(@hospitalDomainId, 'get_lab_reports', 'Get Lab Reports', 'GET', 'http://localhost:8010', '/api/hospital/lab-reports/{{patient_id}}', 'none', 1),
(@hospitalDomainId, 'get_billing_info', 'Get Billing Info', 'GET', 'http://localhost:8010', '/api/hospital/billing/{{patient_id}}', 'none', 1),
(@hospitalDomainId, 'get_departments', 'Get Departments', 'GET', 'http://localhost:8010', '/api/hospital/departments', 'none', 1),
(@hospitalDomainId, 'get_doctors', 'Get Doctors by Dept', 'GET', 'http://localhost:8010', '/api/hospital/doctors/{{department_id}}', 'none', 1);

-- ============================================================
-- 3. Banking Domain - IVR Flow
-- DomainId: F4A891A5-71EF-4BCF-888B-A898D5E44D5E
-- ============================================================

DECLARE @bankingDomainId uniqueidentifier = 'F4A891A5-71EF-4BCF-888B-A898D5E44D5E';
DECLARE @bankingFlowId uniqueidentifier = NEWID();

INSERT INTO IvrFlows (FlowId, DomainId, FlowCode, FlowName, Description, IsEntryFlow, FlowVersion, IsActive)
VALUES (@bankingFlowId, @bankingDomainId, 'main_menu', 'Banking Main Menu', 'Entry flow for banking IVR - balance, transfers, card services, agent', 1, 1, 1);

-- Banking Node 1: Welcome
DECLARE @b1 uniqueidentifier = NEWID();
INSERT INTO IvrFlowNodes (NodeId, FlowId, NodeCode, NodeType, NodeLabel, PromptText, SortOrder, NextNodeCode, IsActive)
VALUES (@b1, @bankingFlowId, 'welcome', 'prompt', 'Welcome',
  'Welcome to SecureBank. How can I assist you today? You can check your balance, make a transfer, manage your card, or speak to a representative.',
  1, 'route_intent', 1);

-- Banking Node 2: Route
DECLARE @b2 uniqueidentifier = NEWID();
INSERT INTO IvrFlowNodes (NodeId, FlowId, NodeCode, NodeType, NodeLabel, SortOrder, NextNodeCode, BranchConfig, IsActive)
VALUES (@b2, @bankingFlowId, 'route_intent', 'branch', 'Route by Intent',
  2, 'fallback_response',
  '{"check_balance":"collect_account","make_transfer":"collect_transfer_from","card_services":"card_menu","speak_to_agent":"transfer_agent"}',
  1);

-- Banking Node 3: Collect account number
DECLARE @b3 uniqueidentifier = NEWID();
INSERT INTO IvrFlowNodes (NodeId, FlowId, NodeCode, NodeType, NodeLabel, PromptText, SortOrder, NextNodeCode, IsActive)
VALUES (@b3, @bankingFlowId, 'collect_account', 'collect_input', 'Collect Account Number',
  'Please provide your account number or the last 4 digits of your registered phone number.',
  3, 'fetch_balance_api', 1);

-- Banking Node 4: Fetch balance
DECLARE @b4 uniqueidentifier = NEWID();
INSERT INTO IvrFlowNodes (NodeId, FlowId, NodeCode, NodeType, NodeLabel, PromptText, SortOrder, NextNodeCode, IsActive)
VALUES (@b4, @bankingFlowId, 'fetch_balance_api', 'api_call', 'Fetch Balance',
  'Let me check your account balance.',
  4, 'read_balance', 1);

-- Banking Node 5: Read balance
DECLARE @b5 uniqueidentifier = NEWID();
INSERT INTO IvrFlowNodes (NodeId, FlowId, NodeCode, NodeType, NodeLabel, PromptText, SortOrder, NextNodeCode, IsActive)
VALUES (@b5, @bankingFlowId, 'read_balance', 'prompt', 'Read Balance',
  'Your current account balance is {{balance}} dollars. Your last transaction was {{last_transaction}}. Is there anything else I can help with?',
  5, 'end_call', 1);

-- Banking Node 6: Collect transfer source
DECLARE @b6 uniqueidentifier = NEWID();
INSERT INTO IvrFlowNodes (NodeId, FlowId, NodeCode, NodeType, NodeLabel, PromptText, SortOrder, NextNodeCode, IsActive)
VALUES (@b6, @bankingFlowId, 'collect_transfer_from', 'collect_input', 'Collect Source Account',
  'Please provide the account number you want to transfer from.',
  6, 'collect_transfer_to', 1);

-- Banking Node 7: Collect transfer destination
DECLARE @b7 uniqueidentifier = NEWID();
INSERT INTO IvrFlowNodes (NodeId, FlowId, NodeCode, NodeType, NodeLabel, PromptText, SortOrder, NextNodeCode, IsActive)
VALUES (@b7, @bankingFlowId, 'collect_transfer_to', 'collect_input', 'Collect Destination Account',
  'Please provide the destination account number and the amount you wish to transfer.',
  7, 'execute_transfer_api', 1);

-- Banking Node 8: Execute transfer
DECLARE @b8 uniqueidentifier = NEWID();
INSERT INTO IvrFlowNodes (NodeId, FlowId, NodeCode, NodeType, NodeLabel, PromptText, SortOrder, NextNodeCode, IsActive)
VALUES (@b8, @bankingFlowId, 'execute_transfer_api', 'api_call', 'Execute Transfer',
  'Processing your transfer now.',
  8, 'confirm_transfer', 1);

-- Banking Node 9: Confirm transfer
DECLARE @b9 uniqueidentifier = NEWID();
INSERT INTO IvrFlowNodes (NodeId, FlowId, NodeCode, NodeType, NodeLabel, PromptText, SortOrder, NextNodeCode, IsActive)
VALUES (@b9, @bankingFlowId, 'confirm_transfer', 'prompt', 'Confirm Transfer',
  'Your transfer of {{transfer_amount}} dollars to account {{destination_account}} has been completed. Reference number: {{reference_id}}. Is there anything else?',
  9, 'end_call', 1);

-- Banking Node 10: Card menu
DECLARE @b10 uniqueidentifier = NEWID();
INSERT INTO IvrFlowNodes (NodeId, FlowId, NodeCode, NodeType, NodeLabel, PromptText, SortOrder, NextNodeCode, BranchConfig, IsActive)
VALUES (@b10, @bankingFlowId, 'card_menu', 'branch', 'Card Services Menu',
  'For card services, you can: Block your card, Request a new card, or Check card status.',
  10, 'fallback_response',
  '{"block_card":"block_card_api","request_new_card":"request_card_api","check_card_status":"card_status_api"}',
  1);

-- Banking Node 11: Block card API
DECLARE @b11 uniqueidentifier = NEWID();
INSERT INTO IvrFlowNodes (NodeId, FlowId, NodeCode, NodeType, NodeLabel, PromptText, SortOrder, NextNodeCode, IsActive)
VALUES (@b11, @bankingFlowId, 'block_card_api', 'api_call', 'Block Card',
  'I am blocking your card immediately for security.',
  11, 'confirm_card_blocked', 1);

-- Banking Node 12: Confirm card blocked
DECLARE @b12 uniqueidentifier = NEWID();
INSERT INTO IvrFlowNodes (NodeId, FlowId, NodeCode, NodeType, NodeLabel, PromptText, SortOrder, NextNodeCode, IsActive)
VALUES (@b12, @bankingFlowId, 'confirm_card_blocked', 'prompt', 'Confirm Card Blocked',
  'Your card has been blocked successfully. A new card will be mailed to your registered address within 5 business days.',
  12, 'end_call', 1);

-- Banking Node 13-15: Other nodes
DECLARE @b13 uniqueidentifier = NEWID();
INSERT INTO IvrFlowNodes (NodeId, FlowId, NodeCode, NodeType, NodeLabel, PromptText, SortOrder, NextNodeCode, IsActive)
VALUES (@b13, @bankingFlowId, 'transfer_agent', 'transfer', 'Transfer to Agent',
  'Connecting you to a banking representative. Please hold.',
  13, NULL, 1);

DECLARE @b14 uniqueidentifier = NEWID();
INSERT INTO IvrFlowNodes (NodeId, FlowId, NodeCode, NodeType, NodeLabel, PromptText, SortOrder, NextNodeCode, IsActive)
VALUES (@b14, @bankingFlowId, 'fallback_response', 'prompt', 'Fallback',
  'I did not understand that. Let me connect you to a representative.',
  14, 'transfer_agent', 1);

DECLARE @b15 uniqueidentifier = NEWID();
INSERT INTO IvrFlowNodes (NodeId, FlowId, NodeCode, NodeType, NodeLabel, PromptText, SortOrder, IsActive)
VALUES (@b15, @bankingFlowId, 'end_call', 'end', 'End Call',
  'Thank you for banking with SecureBank. Have a great day!',
  15, 1);

-- Banking node actions
INSERT INTO IvrNodeActions (NodeId, ActionType, ActionOrder, ToolName, RequestMapping, ResponseMapping, FallbackResponse, IsActive)
VALUES (@b4, 'api_call', 1, 'check_balance',
  '{"account_number":"{{account_number}}"}',
  '{"balance":"currentBalance","last_transaction":"lastTransactionDescription"}',
  '{"message":"Our banking system is temporarily unavailable. Please try again later or visit your nearest branch."}',
  1);

INSERT INTO IvrNodeActions (NodeId, ActionType, ActionOrder, ToolName, RequestMapping, ResponseMapping, FallbackResponse, IsActive)
VALUES (@b8, 'api_call', 1, 'execute_transfer',
  '{"from_account":"{{source_account}}","to_account":"{{destination_account}}","amount":"{{transfer_amount}}"}',
  '{"reference_id":"referenceNumber","status":"transferStatus"}',
  '{"message":"Transfer service is temporarily unavailable. Please try again later or visit your nearest branch."}',
  1);

INSERT INTO IvrNodeActions (NodeId, ActionType, ActionOrder, ToolName, RequestMapping, ResponseMapping, FallbackResponse, IsActive)
VALUES (@b11, 'api_call', 1, 'block_card',
  '{"account_number":"{{account_number}}","card_last_four":"{{card_last_four}}"}',
  '{"block_status":"status","new_card_eta":"estimatedDelivery"}',
  '{"message":"Card blocking service is temporarily unavailable. Please call our emergency hotline for immediate assistance."}',
  1);

-- ============================================================
-- 4. Banking Domain - Mock API Endpoints
-- ============================================================

INSERT INTO DomainApiEndpoints (DomainId, EndpointCode, EndpointName, HttpMethod, BaseUrl, Path, AuthType, IsActive)
VALUES
(@bankingDomainId, 'check_balance', 'Check Account Balance', 'GET', 'http://localhost:8010', '/api/mock/banking/balance/{{account_number}}', 'none', 1),
(@bankingDomainId, 'execute_transfer', 'Execute Transfer', 'POST', 'http://localhost:8010', '/api/mock/banking/transfer', 'none', 1),
(@bankingDomainId, 'block_card', 'Block Card', 'POST', 'http://localhost:8010', '/api/mock/banking/card/block', 'none', 1),
(@bankingDomainId, 'request_new_card', 'Request New Card', 'POST', 'http://localhost:8010', '/api/mock/banking/card/request', 'none', 1),
(@bankingDomainId, 'card_status', 'Check Card Status', 'GET', 'http://localhost:8010', '/api/mock/banking/card/status/{{account_number}}', 'none', 1);
GO
