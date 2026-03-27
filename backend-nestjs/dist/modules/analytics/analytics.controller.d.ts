import { AnalyticsService } from './analytics.service';
export declare class AnalyticsController {
    private readonly service;
    constructor(service: AnalyticsService);
    overview(): unknown;
    conversationTrends(): unknown;
    domainDistribution(): unknown;
    health(): unknown;
}
