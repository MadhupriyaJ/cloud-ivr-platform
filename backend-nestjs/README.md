# Generic IVR Platform Backend

This is a NestJS scaffold for a generic multi-domain realtime IVR platform.

## Setup

1. Copy `.env.example` to `.env`
2. Update MSSQL and Azure credentials
3. Install dependencies
4. Run SQL in `../database/mssql/001_initial_schema.sql`
5. Run SQL in `../database/mssql/002_hospital_schema.sql` for the hospital domain tables
6. Start backend

## Commands

```bash
npm install
npm run start:dev
```
