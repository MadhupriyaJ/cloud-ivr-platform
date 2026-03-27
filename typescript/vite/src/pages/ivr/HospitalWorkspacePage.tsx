import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router';
import { KeenIcon } from '@/components';
import {
  bootstrapHospital,
  cancelHospitalAppointment,
  createConversation,
  createConversationMessage,
  createHospitalAppointment,
  createHospitalPatient,
  fetchDomain,
  fetchAvailableHospitalDoctors,
  fetchHospitalAppointments,
  fetchHospitalBilling,
  fetchHospitalDepartments,
  fetchHospitalDoctors,
  fetchHospitalDoctorSlots,
  fetchHospitalLabReports,
  lookupHospitalPatient,
  rescheduleHospitalAppointment,
  verifyHospitalAppointment
} from './api';
import {
  EmptyRow,
  formatDateTime,
  getErrorText,
  IvrPageHeader,
  IvrStatCard,
  IvrToast,
  useToast
} from './admin';
import type {
  Conversation,
  DomainConfig,
  HospitalAppointment,
  HospitalBilling,
  HospitalDepartment,
  HospitalDoctor,
  HospitalLabReport,
  HospitalPatient,
  HospitalSchedule
} from './types';

type Toast = { kind: 'success' | 'danger'; text: string } | null;
type ViewMode = 'directory' | 'booking' | 'appointments' | 'verification';
type ConsoleEntry = { role: 'system' | 'caller' | 'ivr'; text: string };

function getLocalDateInputValue(date = new Date()) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

const today = getLocalDateInputValue();

function formatScheduleDate(value?: string) {
  if (!value) return '-';
  if (value.includes('T')) {
    return value.split('T')[0];
  }
  return value.slice(0, 10);
}

function formatClockTime(value?: string) {
  if (!value) return '-';
  const isoMatch = value.match(/T(\d{2}:\d{2})/);
  if (isoMatch) return isoMatch[1];
  const plainMatch = value.match(/^(\d{2}:\d{2})/);
  if (plainMatch) return plainMatch[1];
  return value;
}

const HospitalWorkspacePage = () => {
  const navigate = useNavigate();
  const [view, setView] = useState<ViewMode>('directory');
  const [busy, setBusy] = useState(false);
  const [toast, setToast] = useState<Toast>(null);
  const [departments, setDepartments] = useState<HospitalDepartment[]>([]);
  const [doctors, setDoctors] = useState<HospitalDoctor[]>([]);
  const [availableDoctors, setAvailableDoctors] = useState<HospitalDoctor[]>([]);
  const [appointments, setAppointments] = useState<HospitalAppointment[]>([]);
  const [hospitalDomain, setHospitalDomain] = useState<DomainConfig | null>(null);
  const [activeConversation, setActiveConversation] = useState<Conversation | null>(null);
  const [consoleEntries, setConsoleEntries] = useState<ConsoleEntry[]>([]);
  const [selectedDepartmentId, setSelectedDepartmentId] = useState('');
  const [selectedDoctorId, setSelectedDoctorId] = useState('');
  const [slots, setSlots] = useState<HospitalSchedule[]>([]);
  const [bookingResult, setBookingResult] = useState<HospitalAppointment | null>(null);
  const [patientLookup, setPatientLookup] = useState<HospitalPatient | null>(null);
  const [verifiedAppointment, setVerifiedAppointment] = useState<HospitalAppointment | null>(null);
  const [billingRows, setBillingRows] = useState<HospitalBilling[]>([]);
  const [labRows, setLabRows] = useState<HospitalLabReport[]>([]);
  const [bootstrapForm, setBootstrapForm] = useState({
    domainCode: 'hospital',
    displayName: 'Hospital IVR',
    organizationName: 'Meenakshi Mission Hospital'
  });
  const [patientForm, setPatientForm] = useState({
    fullName: '',
    phoneNumber: '',
    email: ''
  });
  const [appointmentForm, setAppointmentForm] = useState({
    patientCode: '',
    patientName: '',
    phoneNumber: '',
    appointmentDate: today,
    appointmentTime: '',
    reasonForVisit: ''
  });
  const [verifyForm, setVerifyForm] = useState({
    patientCode: '',
    phone: ''
  });
  const [consoleInput, setConsoleInput] = useState('');
  const [rescheduleForm, setRescheduleForm] = useState({
    appointmentId: '',
    appointmentDate: today,
    appointmentTime: ''
  });

  useToast(toast, () => setToast(null));

  const selectedDepartment = useMemo(
    () => departments.find((item) => item.departmentId === selectedDepartmentId) || null,
    [departments, selectedDepartmentId]
  );

  const selectedDoctor = useMemo(
    () =>
      [...availableDoctors, ...doctors].find((item) => item.doctorId === selectedDoctorId) || null,
    [availableDoctors, doctors, selectedDoctorId]
  );

  const loadHospitalDomain = useCallback(async () => {
    try {
      setHospitalDomain(await fetchDomain('hospital'));
    } catch {
      setHospitalDomain(null);
    }
  }, []);

  const loadAppointments = useCallback(
    async (filters?: { departmentId?: string; date?: string; patientCode?: string; phone?: string }) => {
      setAppointments(
        await fetchHospitalAppointments({
          departmentId: filters?.departmentId,
          date: filters?.date || appointmentForm.appointmentDate,
          patientCode: filters?.patientCode,
          phone: filters?.phone
        })
      );
    },
    [appointmentForm.appointmentDate]
  );

  const loadDirectory = useCallback(async (departmentId?: string, date?: string) => {
    const [departmentItems, doctorItems, availableItems, appointmentItems] = await Promise.all([
      fetchHospitalDepartments(),
      fetchHospitalDoctors(departmentId),
      fetchAvailableHospitalDoctors({ departmentId, date: date || today }),
      fetchHospitalAppointments({ departmentId, date: date || today })
    ]);
    setDepartments(departmentItems);
    setDoctors(doctorItems);
    setAvailableDoctors(availableItems);
    setAppointments(appointmentItems);
  }, []);

  useEffect(() => {
    const run = async () => {
      setBusy(true);
      try {
        await loadHospitalDomain();
        await loadDirectory(undefined, today);
      } catch (error) {
        setToast({ kind: 'danger', text: `Failed to load hospital workspace: ${getErrorText(error)}` });
      } finally {
        setBusy(false);
      }
    };
    void run();
  }, [loadDirectory, loadHospitalDomain]);

  useEffect(() => {
    const run = async () => {
      try {
        await loadDirectory(selectedDepartmentId || undefined, appointmentForm.appointmentDate);
        if (selectedDoctorId) {
          setSlots(await fetchHospitalDoctorSlots(selectedDoctorId, appointmentForm.appointmentDate));
        }
      } catch (error) {
        setToast({ kind: 'danger', text: `Failed to refresh hospital data: ${getErrorText(error)}` });
      }
    };

    void run();
  }, [appointmentForm.appointmentDate, loadDirectory, selectedDepartmentId, selectedDoctorId]);

  const onBootstrap = useCallback(async () => {
    setBusy(true);
    try {
      const result = await bootstrapHospital(bootstrapForm);
      setToast({
        kind: 'success',
        text: `Hospital workspace ready. ${result.departmentsCreated} departments and ${result.doctorsCreated} doctors.`
      });
      await loadHospitalDomain();
      await loadDirectory(selectedDepartmentId || undefined, appointmentForm.appointmentDate);
    } catch (error) {
      setToast({ kind: 'danger', text: `Bootstrap failed: ${getErrorText(error)}` });
    } finally {
      setBusy(false);
    }
  }, [appointmentForm.appointmentDate, bootstrapForm, loadDirectory, loadHospitalDomain, selectedDepartmentId]);

  const onDepartmentChange = useCallback(
    async (departmentId: string) => {
      setSelectedDepartmentId(departmentId);
      setSelectedDoctorId('');
      setSlots([]);
      setBusy(true);
      try {
        await loadDirectory(departmentId || undefined, appointmentForm.appointmentDate);
      } catch (error) {
        setToast({ kind: 'danger', text: `Failed to filter doctors: ${getErrorText(error)}` });
      } finally {
        setBusy(false);
      }
    },
    [appointmentForm.appointmentDate, loadDirectory]
  );

  const onDoctorChange = useCallback(
    async (doctorId: string) => {
      setSelectedDoctorId(doctorId);
      setAppointmentForm((prev) => ({ ...prev, appointmentTime: '' }));
      if (!doctorId) {
        setSlots([]);
        return;
      }
      setBusy(true);
      try {
        setSlots(await fetchHospitalDoctorSlots(doctorId, appointmentForm.appointmentDate));
      } catch (error) {
        setToast({ kind: 'danger', text: `Failed to load slots: ${getErrorText(error)}` });
      } finally {
        setBusy(false);
      }
    },
    [appointmentForm.appointmentDate]
  );

  const onCreatePatient = useCallback(async () => {
    if (!patientForm.fullName.trim() || !patientForm.phoneNumber.trim()) {
      setToast({ kind: 'danger', text: 'Patient name and phone number are required.' });
      return;
    }
    setBusy(true);
    try {
      const patient = await createHospitalPatient({
        fullName: patientForm.fullName,
        phoneNumber: patientForm.phoneNumber,
        email: patientForm.email || undefined
      });
      setPatientLookup(patient);
      setAppointmentForm((prev) => ({
        ...prev,
        patientCode: patient.patientCode,
        patientName: patient.fullName,
        phoneNumber: patient.phoneNumber
      }));
      setToast({ kind: 'success', text: `Patient saved with ID ${patient.patientCode}.` });
    } catch (error) {
      setToast({ kind: 'danger', text: `Failed to save patient: ${getErrorText(error)}` });
    } finally {
      setBusy(false);
    }
  }, [patientForm]);

  const onBookAppointment = useCallback(async () => {
    if (!selectedDepartmentId || !selectedDoctorId || !appointmentForm.appointmentTime) {
      setToast({ kind: 'danger', text: 'Select department, doctor, and slot before booking.' });
      return;
    }
    setBusy(true);
    try {
      const appointment = await createHospitalAppointment({
        patientCode: appointmentForm.patientCode || undefined,
        patientName: appointmentForm.patientName || undefined,
        phoneNumber: appointmentForm.phoneNumber || undefined,
        doctorId: selectedDoctorId,
        departmentId: selectedDepartmentId,
        appointmentDate: appointmentForm.appointmentDate,
        appointmentTime: appointmentForm.appointmentTime,
        reasonForVisit: appointmentForm.reasonForVisit || undefined
      });
      setBookingResult(appointment);
      setVerifyForm({ patientCode: appointment.patientCode, phone: appointment.phoneNumber });
      setRescheduleForm((prev) => ({
        ...prev,
        appointmentId: appointment.appointmentId,
        appointmentDate: appointment.appointmentDate,
        appointmentTime: appointment.appointmentTime
      }));
      await loadAppointments({
        departmentId: selectedDepartmentId,
        date: appointmentForm.appointmentDate
      });
      setView('verification');
      setToast({ kind: 'success', text: `Appointment booked: ${appointment.appointmentCode}` });
    } catch (error) {
      setToast({ kind: 'danger', text: `Booking failed: ${getErrorText(error)}` });
    } finally {
      setBusy(false);
    }
  }, [appointmentForm, loadAppointments, selectedDepartmentId, selectedDoctorId]);

  const onVerify = useCallback(async () => {
    if (!verifyForm.patientCode.trim() && !verifyForm.phone.trim()) {
      setToast({ kind: 'danger', text: 'Enter patient ID or phone number.' });
      return;
    }
    setBusy(true);
    try {
      const [appointment, patient, billing, labReports] = await Promise.all([
        verifyHospitalAppointment({
          patientCode: verifyForm.patientCode || undefined,
          phone: verifyForm.phone || undefined
        }),
        lookupHospitalPatient({
          patientCode: verifyForm.patientCode || undefined,
          phone: verifyForm.phone || undefined
        }),
        fetchHospitalBilling({
          patientCode: verifyForm.patientCode || undefined,
          phone: verifyForm.phone || undefined
        }),
        fetchHospitalLabReports({
          patientCode: verifyForm.patientCode || undefined,
          phone: verifyForm.phone || undefined
        })
      ]);
      setVerifiedAppointment(appointment);
      setPatientLookup(patient);
      setBillingRows(billing);
      setLabRows(labReports);
      await loadAppointments({
        patientCode: verifyForm.patientCode || undefined,
        phone: verifyForm.phone || undefined
      });
      setToast({
        kind: appointment ? 'success' : 'danger',
        text: appointment ? 'Appointment verified.' : 'No appointment found for this patient.'
      });
    } catch (error) {
      setToast({ kind: 'danger', text: `Verification failed: ${getErrorText(error)}` });
    } finally {
      setBusy(false);
    }
  }, [loadAppointments, verifyForm]);

  const onRescheduleAppointment = useCallback(async () => {
    if (!rescheduleForm.appointmentId || !rescheduleForm.appointmentDate || !rescheduleForm.appointmentTime) {
      setToast({ kind: 'danger', text: 'Choose appointment, new date, and new time.' });
      return;
    }
    setBusy(true);
    try {
      const updated = await rescheduleHospitalAppointment(rescheduleForm.appointmentId, {
        appointmentDate: rescheduleForm.appointmentDate,
        appointmentTime: rescheduleForm.appointmentTime
      });
      setBookingResult(updated);
      setVerifiedAppointment(updated);
      await loadDirectory(selectedDepartmentId || undefined, rescheduleForm.appointmentDate);
      setToast({ kind: 'success', text: `Appointment moved to ${updated.appointmentDate} ${updated.appointmentTime}.` });
    } catch (error) {
      setToast({ kind: 'danger', text: `Reschedule failed: ${getErrorText(error)}` });
    } finally {
      setBusy(false);
    }
  }, [loadDirectory, rescheduleForm, selectedDepartmentId]);

  const onCancelAppointment = useCallback(async (appointmentId: string) => {
    setBusy(true);
    try {
      const updated = await cancelHospitalAppointment(appointmentId);
      if (verifiedAppointment?.appointmentId === appointmentId) {
        setVerifiedAppointment(updated);
      }
      if (bookingResult?.appointmentId === appointmentId) {
        setBookingResult(updated);
      }
      await loadAppointments({
        departmentId: selectedDepartmentId || undefined,
        date: appointmentForm.appointmentDate,
        patientCode: verifyForm.patientCode || undefined,
        phone: verifyForm.phone || undefined
      });
      setToast({ kind: 'success', text: `Appointment ${updated.appointmentCode} cancelled.` });
    } catch (error) {
      setToast({ kind: 'danger', text: `Cancellation failed: ${getErrorText(error)}` });
    } finally {
      setBusy(false);
    }
  }, [appointmentForm.appointmentDate, bookingResult, loadAppointments, selectedDepartmentId, verifiedAppointment, verifyForm.patientCode, verifyForm.phone]);

  const onStartConsole = useCallback(async () => {
    if (!hospitalDomain) {
      setToast({ kind: 'danger', text: 'Hospital domain not found. Seed or create the domain first.' });
      return;
    }
    setBusy(true);
    try {
      const conversation = await createConversation({
        domainId: hospitalDomain.domain_uuid || '',
        channelType: 'ivr_test',
        customerIdentifier: verifyForm.phone || appointmentForm.phoneNumber || undefined
      });
      setActiveConversation(conversation);
      setConsoleEntries([
        {
          role: 'system',
          text: `Conversation ${conversation.conversationId.slice(0, 8)} started for hospital IVR testing.`
        }
      ]);
    } catch (error) {
      setToast({ kind: 'danger', text: `Failed to start IVR test: ${getErrorText(error)}` });
    } finally {
      setBusy(false);
    }
  }, [appointmentForm.phoneNumber, hospitalDomain, verifyForm.phone]);

  const onSendConsole = useCallback(async () => {
    if (!activeConversation || !consoleInput.trim()) {
      setToast({ kind: 'danger', text: 'Start a session and enter caller input first.' });
      return;
    }
    const messageText = consoleInput.trim();
    setBusy(true);
    try {
      await createConversationMessage({
        conversationId: activeConversation.conversationId,
        speakerType: 'customer',
        messageType: 'text',
        messageText,
        sequenceNo: consoleEntries.length + 1
      });

      const response = await fetch(`${(import.meta.env.VITE_BACKEND_HTTP_URL as string | undefined)?.replace(/\/$/, '') || ''}/api/hospital/ivr/next`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          step: 'entry',
          utterance: messageText,
          patientCode: verifyForm.patientCode || appointmentForm.patientCode || undefined,
          phoneNumber: verifyForm.phone || appointmentForm.phoneNumber || undefined
        })
      });

      if (!response.ok) {
        throw new Error(`IVR console failed (${response.status})`);
      }

      const payload = (await response.json()) as {
        prompt?: string;
        nextStep?: string;
        state?: Record<string, unknown>;
      };

      setConsoleEntries((prev) => [
        ...prev,
        { role: 'caller', text: messageText },
        {
          role: 'ivr',
          text: payload.prompt || `Next step: ${payload.nextStep || 'unknown'}`
        }
      ]);
      setConsoleInput('');
    } catch (error) {
      setToast({ kind: 'danger', text: `IVR console failed: ${getErrorText(error)}` });
    } finally {
      setBusy(false);
    }
  }, [activeConversation, appointmentForm.patientCode, appointmentForm.phoneNumber, consoleEntries.length, consoleInput, verifyForm.patientCode, verifyForm.phone]);

  return (
    <div className="container-fluid grid gap-5">
      <IvrPageHeader
        title="Hospital Domain Workspace"
        description="Use the common IVR platform to manage hospital master data, bookings, follow-up actions, and domain-specific flow testing."
        actions={
          <>
            <button className="btn btn-light" onClick={() => navigate('/domains')}>
              Back to Domains
            </button>
            <button className="btn btn-primary" onClick={() => void onBootstrap()} disabled={busy}>
              <KeenIcon icon="rocket" className="me-2" />
              Seed Sample Hospital Data
            </button>
          </>
        }
      />

      <div className="grid gap-5 xl:grid-cols-4">
        <IvrStatCard label="Departments" value={departments.length} meta="Configured workspace units" tone="blue" />
        <IvrStatCard label="Doctors" value={doctors.length} meta="Registered directory" tone="teal" />
        <IvrStatCard label="Open Slots" value={availableDoctors.reduce((sum, item) => sum + (item.availableSlots || 0), 0)} meta="Available on selected date" tone="amber" />
        <IvrStatCard label="Appointments" value={appointments.length} meta="Loaded for selected filters" tone="rose" />
      </div>

      <div className="grid gap-5 xl:grid-cols-[340px_1fr]">
        <div className="card border border-gray-200 shadow-none dark:border-coal-100">
          <div className="card-header">
            <h3 className="card-title">Workspace Setup</h3>
          </div>
          <div className="card-body">
            <input className="input" value={bootstrapForm.domainCode} onChange={(event) => setBootstrapForm((prev) => ({ ...prev, domainCode: event.target.value }))} placeholder="Domain code" />
            <input className="input" value={bootstrapForm.displayName} onChange={(event) => setBootstrapForm((prev) => ({ ...prev, displayName: event.target.value }))} placeholder="Display name" />
            <input className="input" value={bootstrapForm.organizationName} onChange={(event) => setBootstrapForm((prev) => ({ ...prev, organizationName: event.target.value }))} placeholder="Organization" />
            <div className="rounded-xl border border-dashed border-gray-300 bg-gray-50 px-4 py-3 text-xs leading-5 text-gray-700">
              Use this only when the hospital tables are empty. It creates domain metadata, departments, sample doctors, and one week of schedules so the UI is not blank.
            </div>
            <div className="rounded-xl bg-light-active px-4 py-3 text-xs leading-5 text-gray-700">
              Current domain: <span className="font-semibold">{hospitalDomain?.display_name || 'Not found yet'}</span>
            </div>
          </div>
        </div>

        <div className="card border border-gray-200 shadow-none dark:border-coal-100">
          <div className="card-header flex-wrap gap-3">
            <h3 className="card-title">Operations</h3>
            <div className="ms-auto flex flex-wrap gap-2">
              <button className={`btn btn-sm ${view === 'directory' ? 'btn-primary' : 'btn-light'}`} onClick={() => setView('directory')}>Directory</button>
              <button className={`btn btn-sm ${view === 'booking' ? 'btn-primary' : 'btn-light'}`} onClick={() => setView('booking')}>Booking</button>
              <button className={`btn btn-sm ${view === 'appointments' ? 'btn-primary' : 'btn-light'}`} onClick={() => setView('appointments')}>Appointments</button>
              <button className={`btn btn-sm ${view === 'verification' ? 'btn-primary' : 'btn-light'}`} onClick={() => setView('verification')}>Verification</button>
            </div>
          </div>

          <div className="card-body">
            {view === 'directory' && (
              <div className="grid gap-5">
                <div className="grid gap-3 md:grid-cols-[240px_240px_1fr]">
                  <select className="select" value={selectedDepartmentId} onChange={(event) => void onDepartmentChange(event.target.value)}>
                    <option value="">All departments</option>
                    {departments.map((department) => (
                      <option key={department.departmentId} value={department.departmentId}>
                        {department.departmentName}
                      </option>
                    ))}
                  </select>
                  <input className="input" type="date" value={appointmentForm.appointmentDate} onChange={(event) => setAppointmentForm((prev) => ({ ...prev, appointmentDate: event.target.value }))} />
                  <div className="flex items-center text-xs text-gray-600">
                    {selectedDepartment ? `Filtering ${selectedDepartment.departmentName}` : 'Showing all departments'}
                    <span className="ms-2">Each row represents one available doctor slot.</span>
                  </div>
                </div>

                <div className="card-table scrollable-x-auto pb-3">
                  <table className="table table-auto table-border align-middle text-sm">
                    <thead>
                      <tr>
                        <th>Doctor</th>
                        <th>Department</th>
                        <th>Availability</th>
                        <th>Slot Date</th>
                        <th>Slot Time</th>
                        <th>Open Slots</th>
                      </tr>
                    </thead>
                    <tbody>
                      {availableDoctors.length === 0 && <EmptyRow colSpan={6} text={busy ? 'Loading available doctors...' : 'No doctor availability found.'} />}
                      {availableDoctors.map((doctor) => (
                        <tr key={`${doctor.doctorId}-${doctor.scheduleId || doctor.scheduleDate || doctor.startTime}`}>
                          <td>
                            <div className="font-semibold text-gray-900">{doctor.doctorName}</div>
                            <div className="text-xs text-gray-600">{doctor.specialization || doctor.doctorCode || '-'}</div>
                          </td>
                          <td>{doctor.departmentName}</td>
                          <td>{doctor.availabilityStatus}</td>
                          <td>{formatScheduleDate(doctor.scheduleDate)}</td>
                          <td>{formatClockTime(doctor.startTime)}</td>
                          <td>{doctor.availableSlots ?? '-'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {view === 'booking' && (
              <div className="grid gap-5 xl:grid-cols-[320px_1fr]">
                <div className="grid gap-5">
                  <div className="rounded-2xl border border-gray-200 p-4">
                    <div className="mb-3 text-sm font-semibold text-gray-900">Patient Quick Create</div>
                    <div className="grid gap-3">
                      <input className="input" placeholder="Full name" value={patientForm.fullName} onChange={(event) => setPatientForm((prev) => ({ ...prev, fullName: event.target.value }))} />
                      <input className="input" placeholder="Phone number" value={patientForm.phoneNumber} onChange={(event) => setPatientForm((prev) => ({ ...prev, phoneNumber: event.target.value }))} />
                      <input className="input" placeholder="Email" value={patientForm.email} onChange={(event) => setPatientForm((prev) => ({ ...prev, email: event.target.value }))} />
                      <button className="btn btn-primary" onClick={() => void onCreatePatient()} disabled={busy}>
                        Save Patient
                      </button>
                    </div>
                  </div>

                  <div className="rounded-2xl border border-gray-200 p-4">
                    <div className="mb-3 text-sm font-semibold text-gray-900">Booking Result</div>
                    {bookingResult ? (
                      <div className="grid gap-1 text-sm">
                        <div><span className="font-semibold">Patient:</span> {bookingResult.patientName}</div>
                        <div><span className="font-semibold">Patient ID:</span> {bookingResult.patientCode}</div>
                        <div><span className="font-semibold">Doctor:</span> {bookingResult.doctorName}</div>
                        <div><span className="font-semibold">Department:</span> {bookingResult.departmentName}</div>
                        <div><span className="font-semibold">Time:</span> {bookingResult.appointmentDate} {bookingResult.appointmentTime}</div>
                        <div><span className="font-semibold">Status:</span> {bookingResult.appointmentStatus}</div>
                      </div>
                    ) : (
                      <div className="text-sm text-gray-600">No booking created yet. Create a patient or enter an existing patient code, then select doctor and slot.</div>
                    )}
                  </div>
                </div>

                <div className="grid gap-4">
                  <div className="grid gap-3 md:grid-cols-2">
                    <select className="select" value={selectedDepartmentId} onChange={(event) => void onDepartmentChange(event.target.value)}>
                      <option value="">Select department</option>
                      {departments.map((department) => (
                        <option key={department.departmentId} value={department.departmentId}>
                          {department.departmentName}
                        </option>
                      ))}
                    </select>
                    <input className="input" type="date" value={appointmentForm.appointmentDate} onChange={(event) => setAppointmentForm((prev) => ({ ...prev, appointmentDate: event.target.value }))} />
                    <select className="select" value={selectedDoctorId} onChange={(event) => void onDoctorChange(event.target.value)}>
                      <option value="">Select doctor</option>
                      {availableDoctors.map((doctor) => (
                        <option key={`${doctor.doctorId}-${doctor.scheduleId || doctor.startTime}`} value={doctor.doctorId}>
                          {doctor.doctorName} - {doctor.departmentName}
                        </option>
                      ))}
                    </select>
                    <select className="select" value={appointmentForm.appointmentTime} onChange={(event) => setAppointmentForm((prev) => ({ ...prev, appointmentTime: event.target.value }))}>
                      <option value="">Select slot</option>
                      {slots.filter((slot) => slot.availableSlots > 0).map((slot) => (
                        <option key={slot.scheduleId} value={slot.startTime}>
                          {formatScheduleDate(slot.scheduleDate)} {formatClockTime(slot.startTime)} ({slot.availableSlots} left)
                        </option>
                      ))}
                    </select>
                    <input className="input" placeholder="Patient code" value={appointmentForm.patientCode} onChange={(event) => setAppointmentForm((prev) => ({ ...prev, patientCode: event.target.value }))} />
                    <input className="input" placeholder="Patient name" value={appointmentForm.patientName} onChange={(event) => setAppointmentForm((prev) => ({ ...prev, patientName: event.target.value }))} />
                    <input className="input md:col-span-2" placeholder="Phone number" value={appointmentForm.phoneNumber} onChange={(event) => setAppointmentForm((prev) => ({ ...prev, phoneNumber: event.target.value }))} />
                    <textarea className="textarea md:col-span-2" rows={3} placeholder="Reason for visit" value={appointmentForm.reasonForVisit} onChange={(event) => setAppointmentForm((prev) => ({ ...prev, reasonForVisit: event.target.value }))} />
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <button className="btn btn-primary" onClick={() => void onBookAppointment()} disabled={busy}>
                      Book Appointment
                    </button>
                    {selectedDoctor && (
                      <div className="flex items-center text-xs text-gray-600">
                        Selected: {selectedDoctor.doctorName} {selectedDoctor.departmentName ? `in ${selectedDoctor.departmentName}` : ''}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}

            {view === 'appointments' && (
              <div className="grid gap-5 xl:grid-cols-[320px_1fr]">
                <div className="grid gap-5">
                  <div className="rounded-2xl border border-gray-200 p-4">
                    <div className="mb-3 text-sm font-semibold text-gray-900">Appointment Actions</div>
                    <div className="grid gap-3">
                      <select
                        className="select"
                        value={rescheduleForm.appointmentId}
                        onChange={(event) => setRescheduleForm((prev) => ({ ...prev, appointmentId: event.target.value }))}
                      >
                        <option value="">Select appointment</option>
                        {appointments.map((appointment) => (
                          <option key={appointment.appointmentId} value={appointment.appointmentId}>
                            {appointment.appointmentCode} - {appointment.patientName}
                          </option>
                        ))}
                      </select>
                      <input
                        className="input"
                        type="date"
                        value={rescheduleForm.appointmentDate}
                        onChange={(event) => setRescheduleForm((prev) => ({ ...prev, appointmentDate: event.target.value }))}
                      />
                      <input
                        className="input"
                        type="time"
                        value={rescheduleForm.appointmentTime.slice(0, 5)}
                        onChange={(event) =>
                          setRescheduleForm((prev) => ({ ...prev, appointmentTime: `${event.target.value}:00` }))
                        }
                      />
                      <button className="btn btn-primary" onClick={() => void onRescheduleAppointment()} disabled={busy}>
                        Reschedule
                      </button>
                    </div>
                  </div>

                  <div className="rounded-2xl border border-gray-200 p-4">
                    <div className="mb-3 text-sm font-semibold text-gray-900">Quick Filters</div>
                    <div className="grid gap-3 text-xs text-gray-600">
                      <div>Department: {selectedDepartment?.departmentName || 'All departments'}</div>
                      <div>Date: {appointmentForm.appointmentDate}</div>
                      <div>Patient: {verifyForm.patientCode || verifyForm.phone || 'Not filtered'}</div>
                    </div>
                    <button
                      className="btn btn-light mt-3"
                      onClick={() =>
                        void loadAppointments({
                          departmentId: selectedDepartmentId || undefined,
                          date: appointmentForm.appointmentDate,
                          patientCode: verifyForm.patientCode || undefined,
                          phone: verifyForm.phone || undefined
                        })
                      }
                    >
                      Refresh List
                    </button>
                  </div>
                </div>

                <div className="card-table scrollable-x-auto pb-3">
                  <table className="table table-auto table-border align-middle text-sm">
                    <thead>
                      <tr>
                        <th>Appointment</th>
                        <th>Patient</th>
                        <th>Doctor</th>
                        <th>Department</th>
                        <th>Date</th>
                        <th>Status</th>
                        <th>Reason</th>
                        <th className="text-end">Action</th>
                      </tr>
                    </thead>
                    <tbody>
                      {appointments.length === 0 && (
                        <EmptyRow
                          colSpan={8}
                          text={
                            busy
                              ? 'Loading appointments...'
                              : 'No appointments found for the current filters. Seed sample data or create a booking first.'
                          }
                        />
                      )}
                      {appointments.map((appointment) => (
                        <tr key={appointment.appointmentId}>
                          <td>
                            <div className="font-semibold text-gray-900">{appointment.appointmentCode}</div>
                            <div className="text-xs text-gray-600">{appointment.patientCode}</div>
                          </td>
                          <td>{appointment.patientName}</td>
                          <td>{appointment.doctorName}</td>
                          <td>{appointment.departmentName}</td>
                          <td>
                            {appointment.appointmentDate} {appointment.appointmentTime.slice(0, 5)}
                          </td>
                          <td>{appointment.appointmentStatus}</td>
                          <td>{appointment.reasonForVisit || '-'}</td>
                          <td className="text-end">
                            <div className="flex justify-end gap-2">
                              <button
                                className="btn btn-sm btn-light"
                                onClick={() =>
                                  setRescheduleForm({
                                    appointmentId: appointment.appointmentId,
                                    appointmentDate: appointment.appointmentDate,
                                    appointmentTime: appointment.appointmentTime
                                  })
                                }
                              >
                                Pick
                              </button>
                              <button
                                className="btn btn-sm btn-danger btn-outline"
                                onClick={() => void onCancelAppointment(appointment.appointmentId)}
                                disabled={busy || appointment.appointmentStatus === 'cancelled'}
                              >
                                Cancel
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {view === 'verification' && (
              <div className="grid gap-5 xl:grid-cols-[320px_1fr]">
                <div className="rounded-2xl border border-gray-200 p-4">
                  <div className="mb-3 text-sm font-semibold text-gray-900">Patient Verification</div>
                  <div className="grid gap-3">
                    <input className="input" placeholder="Patient code" value={verifyForm.patientCode} onChange={(event) => setVerifyForm((prev) => ({ ...prev, patientCode: event.target.value }))} />
                    <input className="input" placeholder="Phone number" value={verifyForm.phone} onChange={(event) => setVerifyForm((prev) => ({ ...prev, phone: event.target.value }))} />
                    <button className="btn btn-primary" onClick={() => void onVerify()} disabled={busy}>
                      Verify Appointment
                    </button>
                  </div>
                </div>

                <div className="grid gap-5">
                  <div className="grid gap-5 lg:grid-cols-3">
                    <div className="rounded-2xl border border-gray-200 p-4">
                      <div className="mb-2 text-xs uppercase tracking-wide text-gray-600">Patient</div>
                      {patientLookup ? (
                        <div className="grid gap-1 text-sm">
                          <div className="font-semibold text-gray-900">{patientLookup.fullName}</div>
                          <div>{patientLookup.patientCode}</div>
                          <div>{patientLookup.phoneNumber}</div>
                        </div>
                      ) : (
                        <div className="text-sm text-gray-600">No patient loaded. Verify by patient ID or phone number to fetch details.</div>
                      )}
                    </div>
                    <div className="rounded-2xl border border-gray-200 p-4 lg:col-span-2">
                      <div className="mb-2 text-xs uppercase tracking-wide text-gray-600">Appointment</div>
                      {verifiedAppointment ? (
                        <div className="grid gap-1 text-sm">
                          <div className="font-semibold text-gray-900">{verifiedAppointment.doctorName}</div>
                          <div>{verifiedAppointment.departmentName}</div>
                          <div>{verifiedAppointment.appointmentDate} {verifiedAppointment.appointmentTime}</div>
                          <div>{verifiedAppointment.reasonForVisit || 'No reason captured'}</div>
                        </div>
                      ) : (
                        <div className="text-sm text-gray-600">No appointment verified yet. Existing bookings will appear here after lookup.</div>
                      )}
                    </div>
                  </div>

                  <div className="grid gap-5 lg:grid-cols-2">
                    <div className="card border border-gray-200 shadow-none dark:border-coal-100">
                      <div className="card-header">
                        <h3 className="card-title">Billing Details</h3>
                      </div>
                      <div className="card-table scrollable-x-auto pb-3">
                        <table className="table table-auto table-border align-middle text-sm">
                          <thead>
                            <tr>
                              <th>Invoice</th>
                              <th>Status</th>
                              <th>Total</th>
                              <th>Due</th>
                            </tr>
                          </thead>
                          <tbody>
                            {billingRows.length === 0 && <EmptyRow colSpan={4} text="No billing rows found." />}
                            {billingRows.map((row) => (
                              <tr key={row.billingId}>
                                <td>{row.invoiceNumber}</td>
                                <td>{row.billingStatus}</td>
                                <td>{row.totalAmount}</td>
                                <td>{row.dueDate || '-'}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>

                    <div className="card border border-gray-200 shadow-none dark:border-coal-100">
                      <div className="card-header">
                        <h3 className="card-title">Lab Reports</h3>
                      </div>
                      <div className="card-table scrollable-x-auto pb-3">
                        <table className="table table-auto table-border align-middle text-sm">
                          <thead>
                            <tr>
                              <th>Report</th>
                              <th>Test</th>
                              <th>Status</th>
                              <th>Date</th>
                            </tr>
                          </thead>
                          <tbody>
                            {labRows.length === 0 && <EmptyRow colSpan={4} text="No lab reports found." />}
                            {labRows.map((row) => (
                              <tr key={row.labReportId}>
                                <td>{row.reportNumber}</td>
                                <td>{row.testName}</td>
                                <td>{row.reportStatus}</td>
                                <td>{formatDateTime(row.reportDate)}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      <IvrToast toast={toast} />
    </div>
  );
};

export { HospitalWorkspacePage };
