import { ConfigService } from '@nestjs/config';
export declare class SpeechController {
    private readonly configService;
    constructor(configService: ConfigService);
    issueToken(): Promise<{
        token: string;
        region: string;
    }>;
}
