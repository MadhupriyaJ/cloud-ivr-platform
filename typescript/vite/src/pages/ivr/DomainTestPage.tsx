import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Navigate, useNavigate, useParams } from 'react-router';
import { KeenIcon } from '@/components';
import {
  createHospitalAppointment,
  fetchAvailableHospitalDoctors,
  fetchDomains,
  fetchHospitalBilling,
  fetchHospitalDepartments,
  fetchHospitalDoctorSlots,
  fetchHospitalLabReports,
  lookupHospitalPatient,
  verifyHospitalAppointment
} from './api';
import { IvrPageHeader } from './admin';
import { useRealtimeIvr } from './useRealtimeIvr';
import type {
  DomainConfig,
  HospitalAppointment,
  HospitalBilling,
  HospitalDepartment,
  HospitalDoctor,
  HospitalLabReport,
  HospitalPatient,
  HospitalSchedule
} from './types';

const LAST_TESTED_DOMAIN_KEY = 'ivr:last_tested_domain_id';
const today = (() => {
  const date = new Date();
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
})();

type GuidedIvrMessage = { role: 'caller' | 'ivr'; text: string };

const createInitialHospitalForm = () => ({
  intent: '',
  unsupportedCount: 0,
  patientCode: '',
  phoneNumber: '',
  patientName: '',
  departmentId: '',
  doctorId: '',
  appointmentDate: today,
  appointmentTime: '',
  reasonForVisit: ''
});

const resolveBackendBaseUrl = () =>
  (import.meta.env.VITE_BACKEND_HTTP_URL as string | undefined)?.replace(/\/$/, '') ||
  '';  // Use relative paths — requests go through the Vite proxy / reverse proxy

const DomainTestPage = () => {
  const { domainId } = useParams();
  const navigate = useNavigate();
  const {
    status,
    logs,
    avatarReady,
    setAvatarVideoElement,
    start,
    startScriptedSession,
    stop,
    clearLogs
  } =
    useRealtimeIvr();
  const [domains, setDomains] = useState<DomainConfig[]>([]);
  const [busy, setBusy] = useState(false);
  const [loadedOnce, setLoadedOnce] = useState(false);
  const [loadError, setLoadError] = useState('');
  const [hospitalBusy, setHospitalBusy] = useState(false);
  const [hospitalError, setHospitalError] = useState('');
  const [hospitalDepartments, setHospitalDepartments] = useState<HospitalDepartment[]>([]);
  const [hospitalDoctors, setHospitalDoctors] = useState<HospitalDoctor[]>([]);
  const [hospitalSlots, setHospitalSlots] = useState<HospitalSchedule[]>([]);
  const [hospitalPatient, setHospitalPatient] = useState<HospitalPatient | null>(null);
  const [hospitalAppointment, setHospitalAppointment] = useState<HospitalAppointment | null>(null);
  const [hospitalBilling, setHospitalBilling] = useState<HospitalBilling[]>([]);
  const [hospitalLabReports, setHospitalLabReports] = useState<HospitalLabReport[]>([]);
  const [guidedIvrInput, setGuidedIvrInput] = useState('');
  const [guidedIvrMessages, setGuidedIvrMessages] = useState<GuidedIvrMessage[]>([]);
  const [guidedIvrStep, setGuidedIvrStep] = useState('entry');
  const [hospitalForm, setHospitalForm] = useState(createInitialHospitalForm);
  const avatarVideoRef = useRef<HTMLVideoElement | null>(null);
  const guidedIvrStepRef = useRef(guidedIvrStep);
  const hospitalFormRef = useRef(hospitalForm);

  useEffect(() => {
    guidedIvrStepRef.current = guidedIvrStep;
  }, [guidedIvrStep]);

  useEffect(() => {
    hospitalFormRef.current = hospitalForm;
  }, [hospitalForm]);

  const statusClass = useMemo(() => {
    if (status === 'connected') return 'badge badge-success badge-outline';
    if (status === 'connecting') return 'badge badge-warning badge-outline';
    return 'badge badge-secondary badge-outline';
  }, [status]);

  const statusLabel = useMemo(() => {
    if (status === 'connected') return 'Live';
    if (status === 'connecting') return 'Connecting';
    return 'Idle';
  }, [status]);

  const loadDomains = useCallback(async () => {
    setBusy(true);
    setLoadError('');
    try {
      const items = await fetchDomains();
      setDomains(items);
    } catch (error) {
      setLoadError(`Failed to load domains: ${String(error)}`);
    } finally {
      setLoadedOnce(true);
      setBusy(false);
    }
  }, []);

  useEffect(() => {
    void loadDomains();
  }, [loadDomains]);

  useEffect(() => {
    if (!domainId) return;
    localStorage.setItem(LAST_TESTED_DOMAIN_KEY, domainId);
  }, [domainId]);

  useEffect(() => {
    return () => {
      stop();
    };
  }, [stop]);

  useEffect(() => {
    setAvatarVideoElement(avatarVideoRef.current);
    return () => setAvatarVideoElement(null);
  }, [setAvatarVideoElement]);

  const selectedDomain = useMemo(
    () => domains.find((item) => item.domain_id === domainId) ?? null,
    [domainId, domains]
  );

  const isHospitalDomain = selectedDomain?.domain_id === 'hospital';

  useEffect(() => {
    if (!isHospitalDomain) return;

    const loadHospitalData = async () => {
      setHospitalBusy(true);
      setHospitalError('');
      try {
        const departments = await fetchHospitalDepartments();
        setHospitalDepartments(departments);
        const doctors = await fetchAvailableHospitalDoctors({
          date: hospitalForm.appointmentDate,
          departmentId: hospitalForm.departmentId || undefined
        });
        setHospitalDoctors(doctors);
      } catch (error) {
        setHospitalError(`Failed to load hospital IVR data: ${String(error)}`);
      } finally {
        setHospitalBusy(false);
      }
    };

    void loadHospitalData();
  }, [hospitalForm.appointmentDate, hospitalForm.departmentId, isHospitalDomain]);

  useEffect(() => {
    if (!isHospitalDomain) return;
    const initialHospitalForm = createInitialHospitalForm();
    setGuidedIvrMessages([]);
    setGuidedIvrStep('entry');
    setHospitalPatient(null);
    setHospitalAppointment(null);
    setHospitalBilling([]);
    setHospitalLabReports([]);
    setHospitalForm(initialHospitalForm);
    hospitalFormRef.current = initialHospitalForm;
  }, [isHospitalDomain]);

  useEffect(() => {
    if (!isHospitalDomain || !hospitalForm.doctorId) {
      setHospitalSlots([]);
      return;
    }

    const loadSlots = async () => {
      try {
        const slots = await fetchHospitalDoctorSlots(
          hospitalForm.doctorId,
          hospitalForm.appointmentDate
        );
        setHospitalSlots(slots.filter((item) => item.availableSlots > 0));
      } catch (error) {
        setHospitalError(`Failed to load doctor slots: ${String(error)}`);
      }
    };

    void loadSlots();
  }, [hospitalForm.appointmentDate, hospitalForm.doctorId, isHospitalDomain]);

  const verifyHospitalFlow = useCallback(async () => {
    if (!hospitalForm.patientCode.trim() && !hospitalForm.phoneNumber.trim()) {
      setHospitalError('Enter patient ID or phone number to verify existing appointments.');
      return;
    }

    setHospitalBusy(true);
    setHospitalError('');
    try {
      const [patient, appointment] = await Promise.all([
        lookupHospitalPatient({
          patientCode: hospitalForm.patientCode || undefined,
          phone: hospitalForm.phoneNumber || undefined
        }),
        verifyHospitalAppointment({
          patientCode: hospitalForm.patientCode || undefined,
          phone: hospitalForm.phoneNumber || undefined
        })
      ]);

      setHospitalPatient(patient);
      setHospitalAppointment(appointment);
      setHospitalBilling([]);
      setHospitalLabReports([]);
      if (patient && !hospitalForm.patientName) {
        setHospitalForm((prev) => ({ ...prev, patientName: patient.fullName }));
      }
    } catch (error) {
      setHospitalError(`Hospital verification failed: ${String(error)}`);
    } finally {
      setHospitalBusy(false);
    }
  }, [hospitalForm.patientCode, hospitalForm.phoneNumber, hospitalForm.patientName]);

  const bookHospitalAppointment = useCallback(async () => {
    if (!hospitalForm.departmentId || !hospitalForm.doctorId || !hospitalForm.appointmentTime) {
      setHospitalError('Select department, doctor, and slot before booking.');
      return;
    }

    if (!hospitalForm.patientCode.trim() && !hospitalForm.phoneNumber.trim()) {
      setHospitalError('Patient ID or phone number is required for booking.');
      return;
    }

    setHospitalBusy(true);
    setHospitalError('');
    try {
      const appointment = await createHospitalAppointment({
        patientCode: hospitalForm.patientCode || undefined,
        phoneNumber: hospitalForm.phoneNumber || undefined,
        patientName: hospitalForm.patientName || undefined,
        doctorId: hospitalForm.doctorId,
        departmentId: hospitalForm.departmentId,
        appointmentDate: hospitalForm.appointmentDate,
        appointmentTime: hospitalForm.appointmentTime,
        reasonForVisit: hospitalForm.reasonForVisit || undefined
      });

      setHospitalAppointment(appointment);
      setHospitalPatient({
        patientId: appointment.patientId,
        patientCode: appointment.patientCode,
        fullName: appointment.patientName,
        phoneNumber: appointment.phoneNumber,
        email: null,
        gender: null,
        createdAt: '',
        updatedAt: ''
      });
      setHospitalBilling([]);
      setHospitalLabReports([]);
      setHospitalForm((prev) => ({
        ...prev,
        patientCode: appointment.patientCode,
        patientName: appointment.patientName,
        phoneNumber: appointment.phoneNumber,
        appointmentTime: appointment.appointmentTime
      }));
      await verifyHospitalFlow();
    } catch (error) {
      setHospitalError(`Hospital booking failed: ${String(error)}`);
    } finally {
      setHospitalBusy(false);
    }
  }, [hospitalForm, verifyHospitalFlow]);

  const runGuidedHospitalIvr = useCallback(async (rawUtterance: string) => {
    const utterance = rawUtterance.trim();
    if (!utterance) return '';
    const currentStep = guidedIvrStepRef.current;
    const currentForm = hospitalFormRef.current;

    setHospitalBusy(true);
    setHospitalError('');
    try {
      const response = await fetch(
        `${(import.meta.env.VITE_BACKEND_HTTP_URL as string | undefined)?.replace(/\/$/, '') || ''}/api/hospital/ivr/next`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            step: currentStep,
            utterance,
            intent: currentForm.intent || undefined,
            unsupportedCount: currentForm.unsupportedCount,
            departmentId: currentForm.departmentId || undefined,
            doctorId: currentForm.doctorId || undefined,
            patientCode: currentForm.patientCode || undefined,
            phoneNumber: currentForm.phoneNumber || undefined,
            patientName: currentForm.patientName || undefined,
            appointmentDate: currentForm.appointmentDate || undefined,
            appointmentTime: currentForm.appointmentTime || undefined,
            reasonForVisit: currentForm.reasonForVisit || undefined
          })
        }
      );

      if (!response.ok) {
        throw new Error(`Hospital IVR request failed (${response.status})`);
      }

      const payload = (await response.json()) as {
        nextStep?: string;
        prompt?: string;
        state?: Partial<typeof hospitalForm>;
        appointment?: HospitalAppointment | null;
        billing?: HospitalBilling[];
        labReports?: HospitalLabReport[];
      };

      setGuidedIvrMessages((prev) => [
        ...prev,
        { role: 'caller', text: utterance },
        { role: 'ivr', text: payload.prompt || 'No IVR response returned.' }
      ]);
      setGuidedIvrStep(payload.nextStep || 'entry');
      setHospitalForm((prev) => ({
        ...prev,
        intent: payload.state?.intent ?? prev.intent,
        unsupportedCount: payload.state?.unsupportedCount ?? prev.unsupportedCount,
        patientCode: payload.state?.patientCode ?? prev.patientCode,
        phoneNumber: payload.state?.phoneNumber ?? prev.phoneNumber,
        patientName: payload.state?.patientName ?? prev.patientName,
        departmentId: payload.state?.departmentId ?? prev.departmentId,
        doctorId: payload.state?.doctorId ?? prev.doctorId,
        appointmentDate: payload.state?.appointmentDate ?? prev.appointmentDate,
        appointmentTime: payload.state?.appointmentTime ?? prev.appointmentTime,
        reasonForVisit: payload.state?.reasonForVisit ?? prev.reasonForVisit
      }));
      if (payload.appointment) {
        setHospitalAppointment(payload.appointment);
        setHospitalPatient({
          patientId: payload.appointment.patientId,
          patientCode: payload.appointment.patientCode,
          fullName: payload.appointment.patientName,
          phoneNumber: payload.appointment.phoneNumber,
          email: null,
          gender: null,
          createdAt: '',
          updatedAt: ''
        });
      } else if ((payload.state?.intent || currentForm.intent) === 'book-appointment') {
        setHospitalPatient(null);
        setHospitalAppointment(null);
      }

      if (payload.billing) {
        setHospitalBilling(payload.billing);
      } else if ((payload.state?.intent || currentForm.intent) !== 'billing') {
        setHospitalBilling([]);
      }

      if (payload.labReports) {
        setHospitalLabReports(payload.labReports);
      } else if ((payload.state?.intent || currentForm.intent) !== 'lab-report') {
        setHospitalLabReports([]);
      }

      guidedIvrStepRef.current = payload.nextStep || 'entry';
      hospitalFormRef.current = {
        ...currentForm,
        intent: payload.state?.intent ?? currentForm.intent,
        unsupportedCount: payload.state?.unsupportedCount ?? currentForm.unsupportedCount,
        patientCode: payload.state?.patientCode ?? currentForm.patientCode,
        phoneNumber: payload.state?.phoneNumber ?? currentForm.phoneNumber,
        patientName: payload.state?.patientName ?? currentForm.patientName,
        departmentId: payload.state?.departmentId ?? currentForm.departmentId,
        doctorId: payload.state?.doctorId ?? currentForm.doctorId,
        appointmentDate: payload.state?.appointmentDate ?? currentForm.appointmentDate,
        appointmentTime: payload.state?.appointmentTime ?? currentForm.appointmentTime,
        reasonForVisit: payload.state?.reasonForVisit ?? currentForm.reasonForVisit
      };
      return payload.prompt || 'No IVR response returned.';
    } catch (error) {
      setHospitalError(`Guided hospital IVR failed: ${String(error)}`);
      throw error;
    } finally {
      setHospitalBusy(false);
    }
  }, []);

  const fetchInitialHospitalPrompt = useCallback(async () => {
    const initialForm = createInitialHospitalForm();
    const response = await fetch(`${resolveBackendBaseUrl()}/api/hospital/ivr/next`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        step: 'entry',
        utterance: '',
        unsupportedCount: 0,
        appointmentDate: initialForm.appointmentDate
      })
    });

    if (!response.ok) {
      throw new Error(`Hospital IVR init failed (${response.status})`);
    }

    const payload = (await response.json()) as {
      nextStep?: string;
      prompt?: string;
      state?: Partial<typeof initialForm>;
    };

    const nextForm = {
      ...initialForm,
      intent: payload.state?.intent ?? initialForm.intent,
      unsupportedCount: payload.state?.unsupportedCount ?? initialForm.unsupportedCount,
      patientCode: payload.state?.patientCode ?? initialForm.patientCode,
      phoneNumber: payload.state?.phoneNumber ?? initialForm.phoneNumber,
      patientName: payload.state?.patientName ?? initialForm.patientName,
      departmentId: payload.state?.departmentId ?? initialForm.departmentId,
      doctorId: payload.state?.doctorId ?? initialForm.doctorId,
      appointmentDate: payload.state?.appointmentDate ?? initialForm.appointmentDate,
      appointmentTime: payload.state?.appointmentTime ?? initialForm.appointmentTime,
      reasonForVisit: payload.state?.reasonForVisit ?? initialForm.reasonForVisit
    };

    setGuidedIvrStep(payload.nextStep || 'entry');
    guidedIvrStepRef.current = payload.nextStep || 'entry';
    setHospitalForm(nextForm);
    hospitalFormRef.current = nextForm;

    return payload.prompt || 'Welcome to hospital services. Please tell me how I can help you today.';
  }, []);

  const sendGuidedIvr = useCallback(async () => {
    if (!guidedIvrInput.trim()) return;

    try {
      await runGuidedHospitalIvr(guidedIvrInput);
      setGuidedIvrInput('');
    } catch {
      // Error state is already set by runGuidedHospitalIvr.
    }
  }, [guidedIvrInput, runGuidedHospitalIvr]);

  const startIvrSession = useCallback(async () => {
    if (!domainId) return;

    if (isHospitalDomain) {
      const initialHospitalForm = createInitialHospitalForm();
      setGuidedIvrMessages([]);
      setGuidedIvrStep('entry');
      guidedIvrStepRef.current = 'entry';
      setHospitalPatient(null);
      setHospitalAppointment(null);
      setHospitalBilling([]);
      setHospitalLabReports([]);
      setHospitalError('');
      setHospitalForm(initialHospitalForm);
      hospitalFormRef.current = initialHospitalForm;
      const initialPrompt = await fetchInitialHospitalPrompt();
      setGuidedIvrMessages([{ role: 'ivr', text: initialPrompt }]);

      await startScriptedSession(
        'hospital',
        runGuidedHospitalIvr,
        initialPrompt
      );
      return;
    }

    await start(domainId);
  }, [domainId, fetchInitialHospitalPrompt, isHospitalDomain, runGuidedHospitalIvr, start, startScriptedSession]);

  const hasHospitalResult = Boolean(
    hospitalPatient ||
      hospitalAppointment ||
      hospitalBilling.length ||
      hospitalLabReports.length ||
      hospitalError
  );

  if (!domainId) {
    const remembered = localStorage.getItem(LAST_TESTED_DOMAIN_KEY);
    if (remembered) {
      return <Navigate to={`/domains/${remembered}/test`} replace />;
    }
    if (!loadedOnce) {
      return <div className="text-sm text-gray-600">Loading IVR test...</div>;
    }
    const fallback = domains[0]?.domain_id;
    if (fallback) {
      return <Navigate to={`/domains/${fallback}/test`} replace />;
    }
    return <Navigate to="/domains" replace />;
  }

  return (
    <div className="container-fluid grid gap-5 xl:grid-cols-[320px_1fr]">
      <div className="xl:col-span-2">
        <IvrPageHeader
          title="Realtime IVR Test"
          description={selectedDomain ? `Live testing for ${selectedDomain.display_name}` : 'Load a domain and start a realtime IVR session.'}
          actions={
            <span className={`${statusClass}`}>{statusLabel}</span>
          }
        />
      </div>
      <div className="card border border-gray-200 shadow-none dark:border-coal-100">
        <div className="card-header border-b border-gray-200 dark:border-coal-100">
          <h3 className="card-title">Available Domains</h3>
        </div>
        <div className="card-body flex flex-col gap-3">
          <button className="btn btn-light justify-center" onClick={() => navigate('/domains')}>
            <KeenIcon icon="left" className="me-2" />
            Back to Domains
          </button>
          <button
            className="btn btn-primary justify-center"
            onClick={() => navigate(`/domains/${domainId}/config`)}
          >
            <KeenIcon icon="setting-2" className="me-2" />
            Edit This Domain
          </button>

          <div className="text-xs text-gray-600 mt-1">Switch domain and test immediately.</div>
          <div className="max-h-[560px] overflow-auto pe-1 flex flex-col gap-2">
            {domains.map((item) => (
              <button
                key={item.domain_id}
                onClick={() => navigate(`/domains/${item.domain_id}/test`)}
                className={`btn flex-col items-start !h-auto !py-3 !px-3 !justify-start border ${
                  item.domain_id === domainId
                    ? 'btn-primary'
                    : 'btn-light border-gray-200 text-gray-800'
                }`}
              >
                <span className="font-semibold">{item.display_name}</span>
                <span className="text-xs opacity-80">{item.domain_id}</span>
              </button>
            ))}
          </div>
          {busy && <div className="text-xs text-gray-600">Loading domains...</div>}
          {loadError && <div className="text-xs text-danger">{loadError}</div>}
        </div>
      </div>

      <div className="card border border-gray-200 shadow-none dark:border-coal-100">
        <div className="card-header flex-wrap gap-2 border-b border-gray-200 dark:border-coal-100">
          <div>
            <h3 className="card-title">Realtime IVR Test</h3>
            <div className="text-xs text-gray-600 mt-1">
              Domain: <span className="font-semibold text-gray-800">{selectedDomain?.display_name || domainId}</span>
            </div>
          </div>
          <span className={`${statusClass} ms-auto xl:hidden`}>{statusLabel}</span>
        </div>
        <div className="card-body flex flex-col gap-4">
          <div className="grid gap-3 md:grid-cols-3">
            <div className="rounded-xl border border-gray-200 bg-light p-4">
              <div className="text-xs text-gray-600">Connection State</div>
              <div className="mt-2 font-semibold text-gray-900">{statusLabel}</div>
            </div>
            <div className="rounded-xl border border-gray-200 bg-light p-4">
              <div className="text-xs text-gray-600">Domain Code</div>
              <div className="mt-2 font-semibold text-gray-900">{domainId}</div>
            </div>
            <div className="rounded-xl border border-gray-200 bg-light p-4">
              <div className="text-xs text-gray-600">Log Entries</div>
              <div className="mt-2 font-semibold text-gray-900">{logs.length}</div>
            </div>
          </div>
          <div className="flex flex-wrap gap-2.5">
            <button
              className="btn btn-primary"
              onClick={() => void startIvrSession()}
              disabled={status !== 'idle'}
            >
              <KeenIcon icon="phone" className="me-2" />
              {isHospitalDomain ? 'Start Hospital IVR with Avatar' : 'Start Session with Avatar'}
            </button>
            <button className="btn btn-warning" onClick={stop} disabled={status === 'idle'}>
              <KeenIcon icon="cross-circle" className="me-2" />
              Stop Session
            </button>
            <button className="btn btn-light" onClick={clearLogs}>
              <KeenIcon icon="eraser" className="me-2" />
              Clear Logs
            </button>
          </div>

          <div className="grid gap-4 xl:grid-cols-[minmax(360px,520px)_1fr]">
            <div className="rounded-xl border border-gray-200 bg-gray-900 p-4">
              <div className="mb-3 flex items-center justify-between gap-3">
                <div>
                  <div className="text-sm font-semibold text-gray-900">Azure Avatar</div>
                  <div className="mt-1 text-xs text-gray-600">
                    {avatarReady
                      ? 'Avatar connected and speaking.'
                      : 'Avatar will connect when the session starts.'}
                  </div>
                </div>
                <span
                  className={`badge badge-sm ${avatarReady ? 'badge-success' : 'badge-secondary'}`}
                >
                  {avatarReady ? 'Ready' : 'Idle'}
                </span>
              </div>

              <div className="relative h-[420px] overflow-hidden rounded-xl bg-gray-950">
                <video
                  ref={avatarVideoRef}
                  autoPlay
                  playsInline
                  muted={false}
                  className="absolute inset-0 h-full w-full object-cover"
                />
                {!avatarReady && (
                  <div className="absolute inset-0 flex items-center justify-center px-4 text-center text-xs text-gray-400">
                    Avatar will connect after clicking the Start Session button.
                  </div>
                )}
              </div>
            </div>

            <div className="rounded-xl border border-gray-200 bg-gray-900 p-4 text-sm text-gray-100">
              <div className="mb-3 flex items-center justify-between gap-3">
                <div>
                  <div className="text-sm font-semibold text-white">Live Transcription</div>
                  <div className="mt-1 text-xs text-gray-400">
                    User speech and IVR responses appear here in real time.
                  </div>
                </div>
                <div className="badge badge-outline badge-light">{logs.length} lines</div>
              </div>

              <div className="min-h-[420px] overflow-auto rounded-xl border border-white/10 bg-gray-950/80 p-4">
                {logs.length === 0 ? (
                  <div className="text-gray-500">Logs will appear here.</div>
                ) : (
                  logs.map((line, index) => <div key={`${line}-${index}`}>{line}</div>)
                )}
              </div>
            </div>
          </div>

          {isHospitalDomain && (
            <div className="grid gap-4 rounded-xl border border-primary/20 bg-primary-clarity p-4 xl:grid-cols-[340px_1fr]">
              <div className="grid gap-4">
                <div>
                  <div className="text-sm font-semibold text-gray-900">Hospital IVR Flow Test</div>
                  <div className="mt-1 text-xs text-gray-600">
                    Use the shared IVR test page to verify existing appointments, book new ones, and read billing or lab status.
                  </div>
                </div>

                <div className="grid gap-3">
                  <input
                    className="input"
                    placeholder="Patient ID"
                    value={hospitalForm.patientCode}
                    onChange={(event) => setHospitalForm((prev) => ({ ...prev, patientCode: event.target.value }))}
                  />
                  <input
                    className="input"
                    placeholder="Phone number"
                    value={hospitalForm.phoneNumber}
                    onChange={(event) => setHospitalForm((prev) => ({ ...prev, phoneNumber: event.target.value }))}
                  />
                  <input
                    className="input"
                    placeholder="Patient name for new booking"
                    value={hospitalForm.patientName}
                    onChange={(event) => setHospitalForm((prev) => ({ ...prev, patientName: event.target.value }))}
                  />
                  <button className="btn btn-light" onClick={() => void verifyHospitalFlow()} disabled={hospitalBusy}>
                    Verify Existing Appointment
                  </button>
                </div>

                <div className="grid gap-3">
                  <select
                    className="select"
                    value={hospitalForm.departmentId}
                    onChange={(event) =>
                      setHospitalForm((prev) => ({
                        ...prev,
                        departmentId: event.target.value,
                        doctorId: '',
                        appointmentTime: ''
                      }))
                    }
                  >
                    <option value="">Select department</option>
                    {hospitalDepartments.map((department) => (
                      <option key={department.departmentId} value={department.departmentId}>
                        {department.departmentName}
                      </option>
                    ))}
                  </select>
                  <input
                    className="input"
                    type="date"
                    value={hospitalForm.appointmentDate}
                    onChange={(event) => setHospitalForm((prev) => ({ ...prev, appointmentDate: event.target.value }))}
                  />
                  <select
                    className="select"
                    value={hospitalForm.doctorId}
                    onChange={(event) => setHospitalForm((prev) => ({ ...prev, doctorId: event.target.value, appointmentTime: '' }))}
                  >
                    <option value="">Select doctor</option>
                    {hospitalDoctors.map((doctor) => (
                      <option key={doctor.scheduleId || doctor.doctorId} value={doctor.doctorId}>
                        {doctor.doctorName} - {doctor.departmentName}
                      </option>
                    ))}
                  </select>
                  <select
                    className="select"
                    value={hospitalForm.appointmentTime}
                    onChange={(event) => setHospitalForm((prev) => ({ ...prev, appointmentTime: event.target.value }))}
                  >
                    <option value="">Select slot</option>
                    {hospitalSlots.map((slot) => (
                      <option key={slot.scheduleId} value={slot.startTime}>
                        {slot.scheduleDate} {slot.startTime} ({slot.availableSlots} left)
                      </option>
                    ))}
                  </select>
                  <textarea
                    className="textarea"
                    rows={3}
                    placeholder="Reason for visit"
                    value={hospitalForm.reasonForVisit}
                    onChange={(event) => setHospitalForm((prev) => ({ ...prev, reasonForVisit: event.target.value }))}
                  />
                  <button className="btn btn-primary" onClick={() => void bookHospitalAppointment()} disabled={hospitalBusy}>
                    Book Appointment Through IVR Flow
                  </button>
                </div>
              </div>

              <div className="grid gap-4">
                {hasHospitalResult ? (
                  <>
                    <div className="grid gap-4 md:grid-cols-2">
                      {hospitalPatient && (
                        <div className="rounded-xl border border-gray-200 bg-white p-4">
                          <div className="text-xs text-gray-600">Patient</div>
                          <div className="mt-2 text-sm text-gray-900">
                            <div className="font-semibold">{hospitalPatient.fullName}</div>
                            <div>{hospitalPatient.patientCode}</div>
                            <div>{hospitalPatient.phoneNumber}</div>
                          </div>
                        </div>
                      )}
                      {hospitalAppointment && (
                        <div className="rounded-xl border border-gray-200 bg-white p-4">
                          <div className="text-xs text-gray-600">Appointment</div>
                          <div className="mt-2 text-sm text-gray-900">
                            <div className="font-semibold">{hospitalAppointment.doctorName}</div>
                            <div>{hospitalAppointment.departmentName}</div>
                            <div>{hospitalAppointment.appointmentDate} {hospitalAppointment.appointmentTime}</div>
                            <div>{hospitalAppointment.reasonForVisit || 'No reason captured'}</div>
                            <div className="capitalize">{hospitalAppointment.appointmentStatus}</div>
                          </div>
                        </div>
                      )}
                    </div>

                    {(hospitalBilling.length > 0 || hospitalLabReports.length > 0) && (
                      <div className="grid gap-4 md:grid-cols-2">
                        {hospitalBilling.length > 0 && (
                          <div className="rounded-xl border border-gray-200 bg-white p-4">
                            <div className="mb-3 text-sm font-semibold text-gray-900">Billing</div>
                            <div className="grid gap-2 text-sm text-gray-900">
                              {hospitalBilling.map((row) => (
                                <div key={row.billingId} className="rounded-lg bg-light p-3">
                                  <div className="font-semibold">{row.invoiceNumber}</div>
                                  <div>{row.billingStatus}</div>
                                  <div>Total: {row.totalAmount}</div>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                        {hospitalLabReports.length > 0 && (
                          <div className="rounded-xl border border-gray-200 bg-white p-4">
                            <div className="mb-3 text-sm font-semibold text-gray-900">Lab Reports</div>
                            <div className="grid gap-2 text-sm text-gray-900">
                              {hospitalLabReports.map((row) => (
                                <div key={row.labReportId} className="rounded-lg bg-light p-3">
                                  <div className="font-semibold">{row.reportNumber}</div>
                                  <div>{row.testName}</div>
                                  <div>{row.reportStatus}</div>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    )}

                    {hospitalError && <div className="text-sm text-danger">{hospitalError}</div>}
                  </>
                ) : (
                  <div className="rounded-xl border border-dashed border-gray-300 bg-white p-6 text-sm text-gray-600">
                    Inga initial-aa available departments, doctors, and slots mattum dhaan use pannunga. Verification, billing, lab report, or cancellation request pannumbodhu dhaan patient-related details inga kaatum.
                  </div>
                )}
              </div>
            </div>
          )}

          {isHospitalDomain && (
            <div className="rounded-xl border border-gray-200 bg-white p-4">
              <div className="mb-3 flex items-center justify-between gap-3">
                <div>
                  <div className="text-sm font-semibold text-gray-900">Guided Hospital IVR</div>
                  <div className="mt-1 text-xs text-gray-600">
                    Use this for actual DB-backed hospital flow. It checks existing appointments, books new ones, and fetches billing or lab data.
                  </div>
                </div>
                <div className="badge badge-outline badge-info">Step: {guidedIvrStep}</div>
              </div>

              <div className="mb-4 max-h-[260px] overflow-auto rounded-xl bg-gray-50 p-4">
                {guidedIvrMessages.map((item, index) => (
                  <div
                    key={`${item.role}-${index}`}
                    className={`mb-3 rounded-xl px-4 py-3 text-sm ${
                      item.role === 'ivr' ? 'bg-white text-gray-800' : 'bg-primary text-white'
                    }`}
                  >
                    <div className="mb-1 text-[11px] font-semibold uppercase opacity-70">{item.role}</div>
                    <div>{item.text}</div>
                  </div>
                ))}
              </div>

              <div className="grid gap-3 md:grid-cols-[1fr_auto]">
                <input
                  className="input"
                  placeholder='Example: "book appointment", "cardiology", "Anita", "tomorrow 10 AM", "PAT-DEMO-001", "billing"'
                  value={guidedIvrInput}
                  onChange={(event) => setGuidedIvrInput(event.target.value)}
                />
                <button className="btn btn-primary" onClick={() => void sendGuidedIvr()} disabled={hospitalBusy}>
                  Send to Hospital IVR
                </button>
              </div>
            </div>
          )}

        </div>
      </div>
    </div>
  );
};

export { DomainTestPage, LAST_TESTED_DOMAIN_KEY };
