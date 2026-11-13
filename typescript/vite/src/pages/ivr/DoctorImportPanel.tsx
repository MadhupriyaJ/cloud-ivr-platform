import { useState } from 'react';
import { KeenIcon } from '@/components';
import { applyDoctorImport, searchDoctorsOnWeb, type DoctorWebSearchResult } from './api';
import { getErrorText } from './admin';

/**
 * Build the real doctor directory from the web: search by hospital name,
 * review the list, then import the selected doctors.
 */
export function DoctorImportPanel(props: {
  defaultHospitalName?: string;
  onImported: (message: string) => void | Promise<void>;
  onError: (message: string) => void;
}) {
  const [hospitalName, setHospitalName] = useState(props.defaultHospitalName || '');
  const [city, setCity] = useState('');
  const [website, setWebsite] = useState('');
  const [result, setResult] = useState<DoctorWebSearchResult | null>(null);
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [deactivateMissing, setDeactivateMissing] = useState(true);
  const [renameHospital, setRenameHospital] = useState(true);
  const [busy, setBusy] = useState<'search' | 'import' | null>(null);

  const search = async () => {
    if (hospitalName.trim().length < 3) {
      props.onError('Enter the hospital name.');
      return;
    }
    setBusy('search');
    setResult(null);
    try {
      const found = await searchDoctorsOnWeb({
        hospitalName: hospitalName.trim(),
        city: city.trim() || undefined,
        website: website.trim() || undefined
      });
      setResult(found);
      setSelected(new Set(found.doctors.map((_, index) => index)));
      if (found.doctors.length === 0) props.onError('No doctors found. Try adding the city or the hospital website.');
    } catch (error) {
      props.onError(`Web search failed: ${getErrorText(error)}`);
    } finally {
      setBusy(null);
    }
  };

  const importSelected = async () => {
    if (!result) return;
    const doctors = result.doctors.filter((_, index) => selected.has(index));
    if (doctors.length === 0) {
      props.onError('Select at least one doctor.');
      return;
    }
    setBusy('import');
    try {
      const outcome = await applyDoctorImport({
        doctors,
        deactivateMissing,
        organizationName: renameHospital ? result.hospital.name : undefined
      });
      const affected = outcome.upcomingAppointmentsAffected
        ? ` ${outcome.upcomingAppointmentsAffected} upcoming appointment(s) are with deactivated doctors — please call those patients.`
        : '';
      await props.onImported(
        `Imported: ${outcome.doctorsCreated} new, ${outcome.doctorsUpdated} updated, ` +
          `${outcome.departmentsCreated} new departments, ${outcome.doctorsDeactivated} deactivated.${affected}`
      );
      setResult(null);
    } catch (error) {
      props.onError(`Import failed: ${getErrorText(error)}`);
    } finally {
      setBusy(null);
    }
  };

  const toggle = (index: number) =>
    setSelected((previous) => {
      const next = new Set(previous);
      if (next.has(index)) next.delete(index);
      else next.add(index);
      return next;
    });

  return (
    <div className="card border border-gray-200 shadow-none dark:border-coal-100">
      <div className="card-header">
        <h3 className="card-title">Import Doctors from the Web</h3>
      </div>
      <div className="card-body grid gap-3">
        <div className="grid gap-3 md:grid-cols-[2fr_1fr_1.5fr_auto] md:items-end">
          <label className="form-label flex-col">
            Hospital name
            <input
              className="input mt-1.5"
              value={hospitalName}
              onChange={(event) => setHospitalName(event.target.value)}
              placeholder="e.g. Meenakshi Mission Hospital"
            />
          </label>
          <label className="form-label flex-col">
            City
            <input className="input mt-1.5" value={city} onChange={(event) => setCity(event.target.value)} placeholder="Madurai" />
          </label>
          <label className="form-label flex-col">
            Website (optional)
            <input
              className="input mt-1.5"
              value={website}
              onChange={(event) => setWebsite(event.target.value)}
              placeholder="hospital.example.com"
            />
          </label>
          <button className="btn btn-primary" onClick={() => void search()} disabled={busy !== null}>
            <KeenIcon icon="magnifier" className="me-2" />
            {busy === 'search' ? 'Searching…' : 'Search web'}
          </button>
        </div>

        <div className="text-xs text-gray-600">
          Uses Azure OpenAI web search. Results come from public web pages and can be outdated — review every
          doctor before importing. Nothing is saved until you click Import.
        </div>

        {result && (
          <>
            {result.warning && (
              <div className="rounded-lg border border-warning bg-warning-light px-3 py-2 text-xs">{result.warning}</div>
            )}
            <div className="text-sm">
              Found <span className="font-semibold">{result.doctors.length}</span> doctors for{' '}
              <span className="font-semibold">{result.hospital.name}</span>
              {result.hospital.city ? `, ${result.hospital.city}` : ''} from {result.sources.length} source(s).
            </div>

            <div className="scrollable-x-auto max-h-96 overflow-y-auto rounded-lg border border-gray-200">
              <table className="table table-border text-sm">
                <thead>
                  <tr>
                    <th className="w-10">
                      <input
                        type="checkbox"
                        className="checkbox checkbox-sm"
                        checked={selected.size === result.doctors.length}
                        onChange={(event) =>
                          setSelected(event.target.checked ? new Set(result.doctors.map((_, index) => index)) : new Set())
                        }
                      />
                    </th>
                    <th>Doctor</th>
                    <th>Department</th>
                    <th>Specialization</th>
                    <th>Qualification</th>
                    <th>Source</th>
                  </tr>
                </thead>
                <tbody>
                  {result.doctors.map((doctor, index) => (
                    <tr key={`${doctor.name}-${index}`}>
                      <td>
                        <input
                          type="checkbox"
                          className="checkbox checkbox-sm"
                          checked={selected.has(index)}
                          onChange={() => toggle(index)}
                        />
                      </td>
                      <td className="font-medium">{doctor.name}</td>
                      <td>{doctor.department}</td>
                      <td>{doctor.specialization}</td>
                      <td>{doctor.qualification || '—'}</td>
                      <td>
                        {doctor.source_url ? (
                          <a className="link" href={doctor.source_url} target="_blank" rel="noreferrer">
                            open
                          </a>
                        ) : (
                          '—'
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="flex flex-wrap items-center gap-5">
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  className="checkbox checkbox-sm"
                  checked={deactivateMissing}
                  onChange={(event) => setDeactivateMissing(event.target.checked)}
                />
                Deactivate doctors not in this list (e.g. sample data)
              </label>
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  className="checkbox checkbox-sm"
                  checked={renameHospital}
                  onChange={(event) => setRenameHospital(event.target.checked)}
                />
                Use "{result.hospital.name}" as the hospital name in the IVR
              </label>
              <button className="btn btn-success ms-auto" onClick={() => void importSelected()} disabled={busy !== null}>
                {busy === 'import' ? 'Importing…' : `Import ${selected.size} doctor(s)`}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
