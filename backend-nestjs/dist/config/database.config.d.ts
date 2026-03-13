import { TypeOrmModuleAsyncOptions } from '@nestjs/typeorm';
export declare const databaseConfig: (() => {
    host: string;
    port: number;
    username: string;
    password: string;
    database: string;
    encrypt: boolean;
}) & import("@nestjs/config").ConfigFactoryKeyHost<{
    host: string;
    port: number;
    username: string;
    password: string;
    database: string;
    encrypt: boolean;
}> & {
    asTypeOrmFactory(): TypeOrmModuleAsyncOptions;
};
