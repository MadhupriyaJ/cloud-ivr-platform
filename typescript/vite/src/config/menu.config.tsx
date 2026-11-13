import { type TMenuConfig } from '@/components/menu';
import { N8N_IVR_BUILDER_ENABLED, N8N_IVR_BUILDER_PATH, N8N_IVR_BUILDER_TITLE } from '@/config/ivr-builder.config';

export const MENU_SIDEBAR: TMenuConfig = [
  {
    title: 'Common IVR',
    icon: 'phone',
    children: [
      {
        title: 'Overview',
        path: '/ivr/overview'
      },
      {
        title: 'Domains',
        path: '/domains'
      },
      {
        title: 'Intents & Rules',
        path: '/ivr/intents-rules'
      },
      {
        title: 'Prompts & Tools',
        path: '/ivr/prompts-tools'
      },
      {
        title: 'Conversations',
        path: '/ivr/conversations'
      },
      {
        title: 'Escalations',
        path: '/ivr/escalations'
      },
      {
        title: 'Escalation Console',
        path: '/ivr/escalation-console'
      },
      {
        title: 'Telephony',
        path: '/ivr/telephony'
      },
      {
        title: 'Agents',
        path: '/ivr/agents'
      },
      {
        title: 'IVR Test (Last)',
        path: '/ivr/test'
      },
      {
        title: 'New Domain',
        path: '/domains/new'
      },
      ...(N8N_IVR_BUILDER_ENABLED
        ? [
            {
              title: N8N_IVR_BUILDER_TITLE,
              path: N8N_IVR_BUILDER_PATH
            }
          ]
        : [])
    ]
  },
  {
    title: 'IVR Flow Engine',
    icon: 'setting',
    children: [
      {
        title: 'IVR Flows',
        path: '/ivr/flows'
      },
      {
        title: 'API Endpoints',
        path: '/ivr/api-endpoints'
      },
      {
        title: 'Flow Simulator',
        path: '/ivr/simulator'
      },
      {
        title: 'Sessions & Logs',
        path: '/ivr/sessions'
      }
    ]
  },
  {
    title: 'Domain Workspaces',
    icon: 'component',
    children: [
      {
        title: 'Hospital Workspace',
        path: '/ivr/hospital'
      }
    ]
  }
];

/** Quick links shown in the top header bar. */
export const MENU_MEGA: TMenuConfig = [
  { title: 'Overview', path: '/ivr/overview' },
  { title: 'Domains', path: '/domains' },
  { title: 'Escalation Console', path: '/ivr/escalation-console' },
  { title: 'Telephony', path: '/ivr/telephony' },
  { title: 'Simulator', path: '/ivr/simulator' }
];
