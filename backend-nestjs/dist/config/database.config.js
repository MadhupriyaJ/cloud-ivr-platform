"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.databaseConfig = void 0;
const config_1 = require("@nestjs/config");
exports.databaseConfig = Object.assign((0, config_1.registerAs)('database', () => ({
    host: process.env.MSSQL_HOST ?? 'localhost',
    port: Number(process.env.MSSQL_PORT ?? 1433),
    username: process.env.MSSQL_USERNAME ?? 'sa',
    password: process.env.MSSQL_PASSWORD ?? 'YourStrongPassword123',
    database: process.env.MSSQL_DATABASE ?? 'ivr_platform',
    encrypt: false,
})), {
    asTypeOrmFactory() {
        return {
            useFactory: () => ({
                type: 'mssql',
                host: process.env.MSSQL_HOST ?? 'localhost',
                port: Number(process.env.MSSQL_PORT ?? 1433),
                username: process.env.MSSQL_USERNAME ?? 'sa',
                password: process.env.MSSQL_PASSWORD ?? 'YourStrongPassword123',
                database: process.env.MSSQL_DATABASE ?? 'ivr_platform',
                autoLoadEntities: true,
                synchronize: false,
                options: {
                    enableArithAbort: true,
                    encrypt: false,
                },
            }),
        };
    },
});
//# sourceMappingURL=database.config.js.map