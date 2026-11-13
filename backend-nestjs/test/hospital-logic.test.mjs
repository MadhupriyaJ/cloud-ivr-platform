import assert from 'node:assert/strict';
import { dirname, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const DIST = pathToFileURL(resolve(dirname(fileURLToPath(import.meta.url)), '..', 'dist')).href;
const tools = await import(`${DIST}/modules/hospital/hospital-tools.service.js`);
const importer = await import(`${DIST}/modules/hospital/doctor-import.service.js`);
const { upcomingIstDates, toDateOnly, toTimeText } = await import(`${DIST}/modules/hospital/hospital.service.js`);
const { RealtimeToolRunner } = await import(`${DIST}/modules/realtime/azure-realtime.js`);
const { extractJsonObject } = await import(`${DIST}/common/azure-responses.js`);

// Caller identity: spoken names are transliterated, so allow one edit — but not trivial matches.
assert.equal(tools.namesMatch('Suresh Kumar', 'Suresh Kumar'), true);
assert.equal(tools.namesMatch('suresh', 'Suresh Kumar'), true);
assert.equal(tools.namesMatch('Laxmi Devi', 'Lakshmi Devi'), true, 'shared surname');
assert.equal(tools.namesMatch('Lakshmy', 'Lakshmi Devi'), true, 'one edit');
assert.equal(tools.namesMatch('Ravi', 'Suresh Kumar'), false);
assert.equal(tools.namesMatch('Kumar', 'Arun Kumar'), true);
assert.equal(tools.namesMatch('Dr', 'Dr. Ram'), false, 'titles never count');
console.log('OK patient name matching');

// Directory search: "cardiologist" → Cardiology, "ortho" → Orthopedics, "heart" does not match by itself.
assert.equal(tools.termMatches('cardiologist', ['Cardiology', 'Interventional Cardiologist']), true);
assert.equal(tools.termMatches('Ortho', ['Orthopedics', '']), true);
assert.equal(tools.termMatches('neurology', ['Cardiology', 'Cardiologist']), false);
assert.equal(tools.referenceOf('APT-20261113093011-AB12CD'), 'AB12CD');
console.log('OK doctor directory matching and booking reference');

// Doctor import normalisation
assert.equal(importer.normalizeDoctorName('dr. s. kumar'), 'Dr. s. kumar');
assert.equal(importer.normalizeDoctorName('Prof Ravi Shankar'), 'Dr. Ravi Shankar');
assert.equal(importer.normalizeDepartment('Interventional Cardiologist'), 'Cardiology');
assert.equal(importer.normalizeDepartment('', 'Consultant Neurosurgeon'), 'Neurosurgery');
assert.equal(importer.normalizeDepartment('Obstetrics and Gynaecology'), 'Obstetrics & Gynecology');
assert.equal(importer.normalizeDepartment('ENT'), 'ENT');
const cleaned = importer.normalizeDoctors([
  { name: 'Dr. A. Ravi', specialization: 'Cardiologist', department: 'Cardiology', source_url: 'https://x.org/a' },
  { name: 'Dr A Ravi', specialization: 'Cardiology' }, // duplicate
  { name: '', specialization: 'x' }, // empty
  { name: 'Department of Cardiology Heart Care Centre Excellence Unit', specialization: 'x' }, // not a name
  { name: 'Meena S', speciality: 'Paediatrics', source_url: 'javascript:alert(1)' },
  'garbage',
]);
assert.equal(cleaned.length, 2);
assert.deepEqual(cleaned.map((d) => d.department), ['Cardiology', 'Pediatrics']);
assert.equal(cleaned[1].name, 'Dr. Meena S');
assert.equal(cleaned[1].source_url, null, 'only http(s) sources are kept');
assert.deepEqual(extractJsonObject('Here you go:\n```json\n{"doctors":[{"name":"X"}]}\n```'), { doctors: [{ name: 'X' }] });
assert.equal(extractJsonObject('no json here'), null);
console.log('OK doctor import normalisation');

// IST dates: 7 consecutive days starting today in India.
const dates = upcomingIstDates(7);
assert.equal(dates.length, 7);
assert.equal(dates[0], new Date(Date.now() + 5.5 * 3600 * 1000).toISOString().slice(0, 10));
for (let i = 1; i < dates.length; i++) {
  assert.equal(new Date(dates[i]) - new Date(dates[i - 1]), 86400000);
}
console.log('OK IST calendar dates');

// Raw DATE/TIME values arrive as local-time Dates (useUTC=false); read them back unchanged.
assert.equal(toDateOnly(new Date(2026, 10, 14)), '2026-11-14');
assert.equal(toTimeText(new Date(1970, 0, 1, 16, 0, 0)), '16:00:00');
assert.equal(toDateOnly('2026-11-14'), '2026-11-14');
assert.equal(toTimeText('09:00'), '09:00:00');
assert.equal(toTimeText('10:00:00.0000000'), '10:00:00');
console.log('OK DATE/TIME column normalisation');

// Tool runner: outputs go back immediately, the follow-up response.create only
// after the model's response is done AND every call has returned — once.
{
  const sent = [];
  const gates = {};
  const runner = new RealtimeToolRunner(
    (event) => sent.push(event.type === 'response.create' ? 'response.create' : `output:${event.item.call_id}`),
    (name) => new Promise((done) => (gates[name] = () => done({ ok: true, name }))),
  );
  runner.onResponseCreated();
  const a = runner.onFunctionCall({ name: 'find_doctors', call_id: 'c1', arguments: '{}' });
  const b = runner.onFunctionCall({ name: 'get_available_slots', call_id: 'c2', arguments: '{"doctor_id":"x"}' });
  gates.find_doctors();
  await a;
  assert.deepEqual(sent, ['output:c1'], 'no follow-up while a response is active');
  runner.onResponseDone();
  assert.deepEqual(sent, ['output:c1'], 'no follow-up while a call is still running');
  gates.get_available_slots();
  await b;
  assert.deepEqual(sent, ['output:c1', 'output:c2', 'response.create']);
  runner.onResponseDone(); // the follow-up response finishing must not trigger another
  assert.equal(sent.filter((item) => item === 'response.create').length, 1);
}
{
  const sent = [];
  const runner = new RealtimeToolRunner(
    (event) => sent.push(event),
    async () => {
      throw new Error('db down');
    },
  );
  await runner.onFunctionCall({ name: 'book_appointment', call_id: 'c9', arguments: 'not json' });
  assert.equal(JSON.parse(sent[0].item.output).ok, false, 'a failing tool still answers the model');
  assert.equal(sent[1].type, 'response.create');
}
console.log('OK realtime tool runner sequencing');

console.log('All hospital logic checks passed.');
