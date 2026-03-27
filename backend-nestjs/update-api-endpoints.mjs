import sql from 'mssql';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.join('/tmp/cloud-ivr-platform/backend-nestjs', '.env') });

const config = {
  server: process.env.MSSQL_HOST,
  port: parseInt(process.env.MSSQL_PORT || '1433'),
  database: process.env.MSSQL_DATABASE,
  user: process.env.MSSQL_USERNAME,
  password: process.env.MSSQL_PASSWORD,
  options: {
    encrypt: process.env.MSSQL_ENCRYPT === 'true',
    trustServerCertificate: process.env.MSSQL_TRUST_SERVER_CERTIFICATE === 'true',
  },
};

async function run() {
  const pool = await sql.connect(config);
  
  const BASE = 'http://localhost:8010/api/mock';
  
  // Update ALL endpoints with correct codes from DB
  const updates = [
    // Hospital
    { code: 'book_appointment',  url: `${BASE}/hospital/book-appointment`,     method: 'POST' },
    { code: 'get_lab_reports',   url: `${BASE}/hospital/check-lab-reports`,    method: 'POST' },
    { code: 'get_billing_info',  url: `${BASE}/hospital/billing-inquiry`,      method: 'POST' },
    { code: 'get_departments',   url: `${BASE}/hospital/departments`,          method: 'GET' },
    { code: 'get_doctors',       url: `${BASE}/hospital/doctor-availability`,  method: 'GET' },
    // Banking
    { code: 'check_balance',     url: `${BASE}/banking/check-balance`,         method: 'POST' },
    { code: 'execute_transfer',  url: `${BASE}/banking/fund-transfer`,         method: 'POST' },
    { code: 'block_card',        url: `${BASE}/banking/card-block`,            method: 'POST' },
    { code: 'request_new_card',  url: `${BASE}/banking/card-block`,            method: 'POST' },
    { code: 'card_status',       url: `${BASE}/banking/loan-status`,           method: 'POST' },
  ];

  for (const u of updates) {
    const result = await pool.request()
      .input('code', sql.NVarChar, u.code)
      .input('url', sql.NVarChar, u.url)
      .input('method', sql.NVarChar, u.method)
      .query(`UPDATE DomainApiEndpoints SET BaseUrl = @url, HttpMethod = @method WHERE EndpointCode = @code`);
    console.log(`Updated ${u.code}: ${result.rowsAffected[0]} rows → ${u.method} ${u.url}`);
  }

  console.log('\nAll endpoints updated!');
  
  // Verify
  const verify = await pool.request().query('SELECT EndpointCode, BaseUrl, HttpMethod FROM DomainApiEndpoints');
  console.log('\nCurrent endpoints:');
  verify.recordset.forEach(r => console.log(`  ${r.EndpointCode}: ${r.HttpMethod} ${r.BaseUrl}`));
  
  await pool.close();
}

run().catch(console.error);
