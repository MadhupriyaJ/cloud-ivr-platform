import { TypeOrmModuleAsyncOptions } from '@nestjs/typeorm';
type ParsedMssqlConfig = {
    host: string;
    port: number;
    username: string;
    password: string;
    database: string;
    encrypt: boolean;
    trustServerCertificate: boolean;
};
export declare const databaseConfig: (() => ParsedMssqlConfig) & import("@nestjs/config").ConfigFactoryKeyHost<ParsedMssqlConfig> & {
    asTypeOrmFactory(): TypeOrmModuleAsyncOptions;
};
export {};
