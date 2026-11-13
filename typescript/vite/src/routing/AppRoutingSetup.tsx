import { ReactElement } from 'react';
import { Navigate, Route, Routes } from 'react-router';
import {
  AgentsPage,
  ConversationsPage,
  DomainConfigPage,
  DomainDetailPage,
  DomainsPage,
  DomainTestPage,
  EscalationsPage,
  IntentsRulesPage,
  IvrEntryPage,
  N8nDomainBuilderPage,
  OverviewPage,
  PromptsToolsPage,
  HospitalWorkspacePage,
  IvrFlowsPage,
  IvrFlowDetailPage,
  ApiEndpointsPage,
  IvrSimulatorPage,
  IvrSessionsPage,
  EscalationConsolePage,
  TelephonyPage
} from '@/pages/ivr';
import { N8N_IVR_BUILDER_ENABLED, N8N_IVR_BUILDER_PATH } from '@/config/ivr-builder.config';

import { AuthPage } from '@/auth';
import { Demo1Layout } from '@/layouts/demo1';
import { ErrorsRouting } from '@/errors';

const AppRoutingSetup = (): ReactElement => {
  return (
    <Routes>
      <Route path="/" element={<IvrEntryPage />} />
      <Route element={<Demo1Layout />}>
        <Route path="/ivr/overview" element={<OverviewPage />} />
        <Route path="/domains" element={<DomainsPage />} />
        <Route path="/domains/new" element={<DomainConfigPage />} />
        <Route path="/domains/:domainId" element={<DomainDetailPage />} />
        <Route path="/domains/:domainId/config" element={<DomainConfigPage />} />
        <Route path="/domains/:domainId/test" element={<DomainTestPage />} />
        <Route path="/ivr/intents-rules" element={<IntentsRulesPage />} />
        <Route path="/ivr/conversations" element={<ConversationsPage />} />
        <Route path="/ivr/escalations" element={<EscalationsPage />} />
        <Route path="/ivr/escalation-console" element={<EscalationConsolePage />} />
        <Route path="/ivr/telephony" element={<TelephonyPage />} />
        <Route path="/ivr/agents" element={<AgentsPage />} />
        <Route path="/ivr/prompts-tools" element={<PromptsToolsPage />} />
        <Route path="/ivr/hospital" element={<HospitalWorkspacePage />} />
        {N8N_IVR_BUILDER_ENABLED && (
          <Route path={N8N_IVR_BUILDER_PATH} element={<N8nDomainBuilderPage />} />
        )}
        <Route path="/ivr/test" element={<DomainTestPage />} />
        <Route path="/ivr/studio" element={<Navigate to="/domains" replace />} />
        <Route path="/ivr/flows" element={<IvrFlowsPage />} />
        <Route path="/ivr/flows/:flowId" element={<IvrFlowDetailPage />} />
        <Route path="/ivr/api-endpoints" element={<ApiEndpointsPage />} />
        <Route path="/ivr/simulator" element={<IvrSimulatorPage />} />
        <Route path="/ivr/sessions" element={<IvrSessionsPage />} />
      </Route>
      <Route path="error/*" element={<ErrorsRouting />} />
      <Route path="auth/*" element={<AuthPage />} />
      <Route path="*" element={<Navigate to="/error/404" />} />
    </Routes>
  );
};

export { AppRoutingSetup };
