import { registerAs } from '@nestjs/config';
import { TypeOrmModuleAsyncOptions } from '@nestjs/typeorm';

export const databaseConfig = Object.assign(
  registerAs('database', () => ({
    host: process.env.MSSQL_HOST ?? 'localhost',
    port: Number(process.env.MSSQL_PORT ?? 1433),
    username: process.env.MSSQL_USERNAME ?? 'sa',
    password: process.env.MSSQL_PASSWORD ?? 'YourStrongPassword123',
    database: process.env.MSSQL_DATABASE ?? 'ivr_platform',
    encrypt: false,
  })),
  {
    asTypeOrmFactory(): TypeOrmModuleAsyncOptions {
      return {
        useFactory: () => ({
          type: 'mssql' as const,
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
  },
);
