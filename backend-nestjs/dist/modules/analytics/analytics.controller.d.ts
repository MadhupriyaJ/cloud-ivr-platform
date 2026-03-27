import { AnalyticsService } from './analytics.service';
export declare class AnalyticsController {
    private readonly service;
    constructor(service: AnalyticsService);
    overview(): Promise<{
        domains: {
            total: number;
            active: number;
        };
        conversations: {
            total: number;
            live: number;
            escalated: number;
            avgDurationSec: number;
        };
        agents: {
            total: number;
            available: number;
            busy: number;
        };
        escalations: {
            total: number;
            open: number;
            closed: number;
        };
        conversationsByChannel: {
            channel: string;
            count: number;
        }[];
        conversationsByStatus: {
            status: string;
            count: number;
        }[];
    }>;
    conversationTrends(): Promise<{
        items: {
            date: string;
            count: number;
        }[];
    }>;
    domainDistribution(): Promise<{
        items: {
            domainCode: string;
            displayName: string;
            count: number;
        }[];
    }>;
    health(): Promise<{
        status: string;
        database: string;
        timestamp: string;
    }>;
}
