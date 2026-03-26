"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.databaseConfig = void 0;
const config_1 = require("@nestjs/config");
function parseBooleanFlag(value, fallback) {
    if (!value) {
        return fallback;
    }
    return ['true', 'yes', '1'].includes(value.trim().toLowerCase());
}
function parseServer(server) {
    const fallback = { host: 'localhost', port: 1433 };
    if (!server) {
        return fallback;
    }
    const normalized = server.trim();
    const commaParts = normalized.split(',');
    if (commaParts.length === 2 && commaParts[1]) {
        return {
            host: commaParts[0],
            port: Number(commaParts[1]) || fallback.port,
        };
    }
    const colonParts = normalized.split(':');
    if (colonParts.length === 2 && colonParts[1]) {
        return {
            host: colonParts[0],
            port: Number(colonParts[1]) || fallback.port,
        };
    }
    return { host: normalized, port: fallback.port };
}
function parseConnectionString(connectionString) {
    if (!connectionString) {
        return {};
    }
    const values = connectionString
        .split(';')
        .map((part) => part.trim())
        .filter(Boolean)
        .reduce((acc, part) => {
        const separatorIndex = part.indexOf('=');
        if (separatorIndex === -1) {
            return acc;
        }
        const key = part.slice(0, separatorIndex).trim().toUpperCase();
        const value = part.slice(separatorIndex + 1).trim();
        acc[key] = value;
        return acc;
    }, {});
    const server = parseServer(values.SERVER);
    return {
        host: server.host,
        port: server.port,
        username: values.UID,
        password: values.PWD,
        database: values.DATABASE,
        encrypt: parseBooleanFlag(values.ENCRYPT, false),
        trustServerCertificate: parseBooleanFlag(values.TRUSTSERVERCERTIFICATE, false),
    };
}
function resolveDatabaseConfig() {
    const fromConnectionString = parseConnectionString(process.env.MSSQL_CONN_STR);
    return {
        host: process.env.MSSQL_HOST ?? fromConnectionString.host ?? 'localhost',
        port: Number(process.env.MSSQL_PORT ?? fromConnectionString.port ?? 1433),
        username: process.env.MSSQL_USERNAME ?? fromConnectionString.username ?? 'sa',
        password: process.env.MSSQL_PASSWORD ??
            fromConnectionString.password ??
            'YourStrongPassword123',
        database: process.env.MSSQL_DATABASE ?? fromConnectionString.database ?? 'ivr_platform',
        encrypt: parseBooleanFlag(process.env.MSSQL_ENCRYPT, fromConnectionString.encrypt ?? false),
        trustServerCertificate: parseBooleanFlag(process.env.MSSQL_TRUST_SERVER_CERTIFICATE, fromConnectionString.trustServerCertificate ?? false),
    };
}
exports.databaseConfig = Object.assign((0, config_1.registerAs)('database', () => resolveDatabaseConfig()), {
    asTypeOrmFactory() {
        return {
            useFactory: () => {
                const config = resolveDatabaseConfig();
                return {
                    type: 'mssql',
                    host: config.host,
                    port: config.port,
                    username: config.username,
                    password: config.password,
                    database: config.database,
                    autoLoadEntities: true,
                    synchronize: false,
                    options: {
                        enableArithAbort: true,
                        encrypt: config.encrypt,
                        trustServerCertificate: config.trustServerCertificate,
                    },
                };
            },
        };
    },
});
//# sourceMappingURL=database.config.js.map