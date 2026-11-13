import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import type { RealtimeTool } from '../realtime/azure-realtime';
import { SmsService } from '../notifications/sms.service';
import { PatientEntity } from './patient.entity';
import { HospitalService, toDateOnly, toTimeText, upcomingIstDates } from './hospital.service';

/**
 * Tools the realtime voice assistant calls to actually do hospital work:
 * find doctors, check slots, verify the caller, book / cancel / reschedule,
 * read lab reports and bills. Everything runs through HospitalService.
 *
 * Identity is enforced here, not left to the model: anything about a patient
 * (appointments, reports, bills) is refused until `verify_patient` or
 * `register_patient` has succeeded in this call.
 */

export type ToolCallContext = {
  /** Caller ID on phone calls; empty for the browser studio. */
  callerPhone?: string;
  conversationId?: string;
  organizationName: string;
};

type ToolSession = ToolCallContext & {
  patient?: { patientId: string; patientCode: string; fullName: string; phoneNumber: string };
  failedVerifications: number;
};

type ToolResult = Record<string, unknown>;

const MAX_VERIFY_ATTEMPTS = 3;

const TOOLS: RealtimeTool[] = [
  {
    type: 'function',
    name: 'find_doctors',
    description:
      'Search the hospital doctor directory. Use for any question about which doctors or departments exist. ' +
      'Pass English terms (e.g. "Cardiology" for heart, "Orthopedics" for bones). With no arguments returns all departments.',
    parameters: {
      type: 'object',
      properties: {
        department: { type: 'string', description: 'Department or speciality in English, e.g. Cardiology.' },
        doctor_name: { type: 'string', description: 'Part of the doctor name, in English letters.' },
      },
    },
  },
  {
    type: 'function',
    name: 'get_available_slots',
    description:
      'Free appointment slots for one doctor. Give a date to check that day, or omit it to get the next available slots.',
    parameters: {
      type: 'object',
      properties: {
        doctor_id: { type: 'string', description: 'doctor_id from find_doctors.' },
        date: { type: 'string', description: 'YYYY-MM-DD. Omit for the next available days.' },
      },
      required: ['doctor_id'],
    },
  },
  {
    type: 'function',
    name: 'verify_patient',
    description:
      'Verify an existing patient before anything personal (booking, appointments, reports, bills). ' +
      'Ask the caller for their registered mobile number (unless calling from it) and their full name or date of birth.',
    parameters: {
      type: 'object',
      properties: {
        phone_number: { type: 'string', description: 'Registered mobile number. Omit on a phone call to use the caller ID.' },
        full_name: { type: 'string', description: 'Patient full name in English letters.' },
        date_of_birth: { type: 'string', description: 'YYYY-MM-DD, if the caller gives it.' },
      },
    },
  },
  {
    type: 'function',
    name: 'register_patient',
    description: 'Register a new patient when verify_patient says the number is not registered.',
    parameters: {
      type: 'object',
      properties: {
        full_name: { type: 'string', description: 'Full name in English letters.' },
        phone_number: { type: 'string', description: 'Mobile number. Omit on a phone call to use the caller ID.' },
        date_of_birth: { type: 'string', description: 'YYYY-MM-DD, optional.' },
      },
      required: ['full_name'],
    },
  },
  {
    type: 'function',
    name: 'book_appointment',
    description:
      'Book a slot for the verified patient. Only call after the caller has confirmed doctor, date and time.',
    parameters: {
      type: 'object',
      properties: {
        doctor_id: { type: 'string' },
        date: { type: 'string', description: 'YYYY-MM-DD' },
        time: { type: 'string', description: 'HH:MM, 24-hour, one of the slot times from get_available_slots.' },
        reason: { type: 'string', description: 'Short reason for visit, in English.' },
      },
      required: ['doctor_id', 'date', 'time'],
    },
  },
  {
    type: 'function',
    name: 'list_my_appointments',
    description: 'Upcoming appointments of the verified patient.',
    parameters: { type: 'object', properties: {} },
  },
  {
    type: 'function',
    name: 'cancel_appointment',
    description: 'Cancel one of the verified patient\'s appointments, after the caller confirms.',
    parameters: {
      type: 'object',
      properties: { reference: { type: 'string', description: 'The 6-character booking reference.' } },
      required: ['reference'],
    },
  },
  {
    type: 'function',
    name: 'reschedule_appointment',
    description: 'Move one of the verified patient\'s appointments to another free slot of the same doctor.',
    parameters: {
      type: 'object',
      properties: {
        reference: { type: 'string', description: 'The 6-character booking reference.' },
        date: { type: 'string', description: 'YYYY-MM-DD' },
        time: { type: 'string', description: 'HH:MM, 24-hour' },
      },
      required: ['reference', 'date', 'time'],
    },
  },
  {
    type: 'function',
    name: 'get_lab_reports',
    description: 'Lab report status for the verified patient.',
    parameters: { type: 'object', properties: {} },
  },
  {
    type: 'function',
    name: 'get_bills',
    description: 'Bills and dues for the verified patient.',
    parameters: { type: 'object', properties: {} },
  },
];

@Injectable()
export class HospitalToolsService {
  private readonly logger = new Logger(HospitalToolsService.name);
  private readonly sessions = new Map<string, ToolSession>();

  constructor(
    private readonly hospital: HospitalService,
    private readonly sms: SmsService,
    @InjectRepository(PatientEntity)
    private readonly patients: Repository<PatientEntity>,
  ) {}

  /** Hospital tools apply to healthcare domains only. */
  appliesTo(domain: { domainCode: string; industryType?: string | null }): boolean {
    const industry = (domain.industryType || '').toLowerCase();
    return industry === 'healthcare' || industry === 'hospital' || /hospital|clinic/.test(domain.domainCode);
  }

  definitions(): RealtimeTool[] {
    return TOOLS;
  }

  handles(name: string): boolean {
    return TOOLS.some((tool) => tool.name === name);
  }

  /** Extra instructions that teach the model the booking workflow. */
  instructions(now = new Date()): string {
    const ist = new Date(now.getTime() + 5.5 * 60 * 60 * 1000);
    const today = ist.toISOString().slice(0, 10);
    const weekday = ist.toLocaleDateString('en-US', { weekday: 'long', timeZone: 'UTC' });
    const time = ist.toISOString().slice(11, 16);
    return [
      `Today is ${weekday}, ${today}; the time now is ${time} India time. Work out dates like "tomorrow" or "Monday" from this.`,
      'Use the tools for every fact about doctors, slots, appointments, lab reports and bills. Never invent a doctor, a time or a status.',
      'Tool arguments are always in English letters: dates as YYYY-MM-DD, times as HH:MM 24-hour, names transliterated to English.',
      'Booking flow: find the doctor, offer two or three free slots, verify or register the patient, read back doctor, date and time and get a yes, then book.',
      'Never call book_appointment, cancel_appointment or reschedule_appointment in the same turn as verify_patient or register_patient: after verification, read back the details, stop, and wait for the caller to say yes in their next turn.',
      'Before sharing or changing anything personal, the patient must be verified with verify_patient (or newly registered).',
      'After booking, tell the caller the 6-character reference, spelled out one character at a time, and whether an SMS was sent.',
      'Speak times in the caller\'s language in a natural way (e.g. "காலை பத்து மணி" or "ten in the morning").',
    ].join(' ');
  }

  startSession(key: string, context: ToolCallContext): void {
    this.sessions.set(key, { ...context, failedVerifications: 0 });
  }

  endSession(key: string): void {
    this.sessions.delete(key);
  }

  /** Run one tool call. Never throws: errors come back as `{ ok: false, error }`. */
  async execute(key: string, name: string, args: Record<string, any>): Promise<ToolResult> {
    const session = this.sessions.get(key);
    if (!session) return { ok: false, error: 'No active call session.' };

    try {
      switch (name) {
        case 'find_doctors':
          return await this.findDoctors(args);
        case 'get_available_slots':
          return await this.availableSlots(String(args.doctor_id || ''), args.date);
        case 'verify_patient':
          return await this.verifyPatient(session, args);
        case 'register_patient':
          return await this.registerPatient(session, args);
        case 'book_appointment':
          return await this.book(session, args);
        case 'list_my_appointments':
          return await this.myAppointments(session);
        case 'cancel_appointment':
          return await this.cancel(session, String(args.reference || ''));
        case 'reschedule_appointment':
          return await this.reschedule(session, args);
        case 'get_lab_reports':
          return await this.labReports(session);
        case 'get_bills':
          return await this.bills(session);
        default:
          return { ok: false, error: `Unknown tool ${name}.` };
      }
    } catch (error: any) {
      this.logger.warn(`Tool ${name} failed: ${error?.message || error}`);
      return { ok: false, error: error?.message || 'The hospital system could not complete this request.' };
    }
  }

  /* ───────────────────────────── directory ───────────────────────────── */

  private async findDoctors(args: Record<string, any>): Promise<ToolResult> {
    const doctors = await this.hospital.listDoctors();
    const departments = [...new Set(doctors.map((doctor) => String(doctor.departmentName)))].sort();
    const department = String(args.department || '').trim();
    const doctorName = String(args.doctor_name || '').trim();

    if (!department && !doctorName) {
      return { ok: true, departments };
    }

    const matches = doctors.filter(
      (doctor) =>
        (!department || termMatches(department, [doctor.departmentName, doctor.specialization])) &&
        (!doctorName || termMatches(doctorName, [doctor.doctorName])),
    );

    if (matches.length === 0) {
      return { ok: true, doctors: [], message: 'No matching doctor.', departments };
    }
    return {
      ok: true,
      doctors: matches.slice(0, 8).map((doctor) => ({
        doctor_id: doctor.doctorId,
        name: doctor.doctorName,
        specialization: doctor.specialization,
        department: doctor.departmentName,
        consultation_fee: doctor.consultationFee ? Number(doctor.consultationFee) : null,
      })),
      more: Math.max(0, matches.length - 8),
    };
  }

  private async availableSlots(doctorId: string, date?: string): Promise<ToolResult> {
    if (!doctorId) return { ok: false, error: 'doctor_id is required.' };
    const all = await this.hospital.getDoctorSlots(doctorId);
    const today = upcomingIstDates(1)[0];
    const nowTime = new Date(Date.now() + 5.5 * 3600 * 1000).toISOString().slice(11, 16);

    const open = all
      .map((slot) => ({
        date: toDateOnly(slot.scheduleDate),
        time: toTimeText(slot.startTime).slice(0, 5),
        seats: slot.availableSlots,
      }))
      // Skip full slots and slots that already started today.
      .filter((slot) => slot.seats > 0 && (slot.date > today || (slot.date === today && slot.time > nowTime)));

    if (date) {
      const sameDay = open.filter((slot) => slot.date === date);
      if (sameDay.length) return { ok: true, date, slots: sameDay.map(({ time, seats }) => ({ time, seats })) };
      return {
        ok: true,
        date,
        slots: [],
        message: 'No free slot that day.',
        next_available: open.slice(0, 4),
      };
    }
    return { ok: true, next_available: open.slice(0, 6) };
  }

  /* ───────────────────────────── identity ───────────────────────────── */

  private async findPatientByPhone(phone: string): Promise<PatientEntity | null> {
    const last10 = phone.replace(/\D/g, '').slice(-10);
    if (last10.length < 10) return null;
    return this.patients
      .createQueryBuilder('patient')
      .where('patient.PhoneNumber LIKE :suffix', { suffix: `%${last10}` })
      .orderBy('patient.CreatedAt', 'DESC')
      .getOne();
  }

  private async verifyPatient(session: ToolSession, args: Record<string, any>): Promise<ToolResult> {
    if (session.failedVerifications >= MAX_VERIFY_ATTEMPTS) {
      return { ok: false, verified: false, locked: true, error: 'Too many failed attempts. Offer to connect a staff member.' };
    }
    const phone = String(args.phone_number || session.callerPhone || '').trim();
    if (!phone) return { ok: false, verified: false, error: 'Ask the caller for their registered mobile number.' };

    const patient = await this.findPatientByPhone(phone);
    if (!patient) {
      return { ok: true, verified: false, registered: false, message: 'This number is not registered. Offer to register.' };
    }

    const dob = String(args.date_of_birth || '').trim();
    const name = String(args.full_name || '').trim();
    if (!dob && !name) {
      return { ok: false, verified: false, error: 'Ask for the patient full name or date of birth.' };
    }

    const storedDob = patient.dateOfBirth ? toDateOnly(patient.dateOfBirth) : '';
    const matched = storedDob && dob ? storedDob === dob : name ? namesMatch(name, patient.fullName) : false;

    if (!matched) {
      session.failedVerifications += 1;
      return {
        ok: true,
        verified: false,
        attempts_left: MAX_VERIFY_ATTEMPTS - session.failedVerifications,
        message: 'Details do not match our records.',
      };
    }

    session.patient = {
      patientId: patient.patientId,
      patientCode: patient.patientCode,
      fullName: patient.fullName,
      phoneNumber: patient.phoneNumber,
    };
    return { ok: true, verified: true, patient_name: patient.fullName };
  }

  private async registerPatient(session: ToolSession, args: Record<string, any>): Promise<ToolResult> {
    const fullName = String(args.full_name || '').trim();
    const phone = String(args.phone_number || session.callerPhone || '').trim();
    if (fullName.length < 2) return { ok: false, error: 'Ask for the full name.' };
    if (phone.replace(/\D/g, '').length < 10) return { ok: false, error: 'Ask for a 10-digit mobile number.' };

    if (await this.findPatientByPhone(phone)) {
      return { ok: false, already_registered: true, error: 'This number is already registered; use verify_patient.' };
    }

    const patient = await this.hospital.createPatient({
      fullName,
      phoneNumber: phone,
      dateOfBirth: /^\d{4}-\d{2}-\d{2}$/.test(String(args.date_of_birth || '')) ? args.date_of_birth : undefined,
    } as any);
    session.patient = {
      patientId: patient.patientId,
      patientCode: patient.patientCode,
      fullName: patient.fullName,
      phoneNumber: patient.phoneNumber,
    };
    return { ok: true, registered: true, verified: true, patient_name: patient.fullName };
  }

  private requirePatient(session: ToolSession): ToolResult | null {
    return session.patient
      ? null
      : { ok: false, needs_verification: true, error: 'Verify the patient first with verify_patient.' };
  }

  /* ───────────────────────────── appointments ───────────────────────────── */

  private async book(session: ToolSession, args: Record<string, any>): Promise<ToolResult> {
    const blocked = this.requirePatient(session);
    if (blocked) return blocked;
    const patient = session.patient!;

    const doctor = (await this.hospital.listDoctors()).find(
      (item) => String(item.doctorId).toLowerCase() === String(args.doctor_id || '').toLowerCase(),
    );
    if (!doctor) return { ok: false, error: 'Unknown doctor_id; call find_doctors again.' };

    const date = String(args.date || '');
    const time = String(args.time || '').slice(0, 5);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !/^\d{2}:\d{2}$/.test(time)) {
      return { ok: false, error: 'date must be YYYY-MM-DD and time HH:MM.' };
    }

    const appointment = await this.hospital.createAppointment({
      patientId: patient.patientId,
      doctorId: doctor.doctorId,
      departmentId: doctor.departmentId,
      appointmentDate: date,
      appointmentTime: time,
      reasonForVisit: args.reason ? String(args.reason).slice(0, 250) : undefined,
      conversationId: session.conversationId,
    } as any);

    const reference = referenceOf(appointment.appointmentCode);
    const sms = await this.sms.send(
      patient.phoneNumber,
      `${session.organizationName}: appointment confirmed with ${doctor.doctorName} (${doctor.departmentName}) on ` +
        `${date} at ${time}. Ref ${reference}. To cancel or change, call us.`,
    );

    return {
      ok: true,
      booked: true,
      reference,
      doctor: doctor.doctorName,
      department: doctor.departmentName,
      date,
      time,
      sms: sms.status,
    };
  }

  private async myAppointments(session: ToolSession): Promise<ToolResult> {
    const blocked = this.requirePatient(session);
    if (blocked) return blocked;
    const rows = await this.hospital.listUpcomingAppointmentsForPatient(session.patient!.patientId);
    return {
      ok: true,
      appointments: rows.slice(0, 5).map((row) => ({
        reference: referenceOf(row.appointmentCode),
        doctor: row.doctorName,
        department: row.departmentName,
        date: toDateOnly(row.appointmentDate),
        time: toTimeText(row.appointmentTime).slice(0, 5),
        status: row.appointmentStatus,
      })),
    };
  }

  private async cancel(session: ToolSession, reference: string): Promise<ToolResult> {
    const blocked = this.requirePatient(session);
    if (blocked) return blocked;
    const appointment = await this.hospital.findPatientAppointmentByReference(session.patient!.patientId, reference);
    if (!appointment) return { ok: false, error: 'No appointment with that reference for this patient.' };
    await this.hospital.cancelAppointment(appointment.appointmentId);
    return { ok: true, cancelled: true, reference: referenceOf(appointment.appointmentCode) };
  }

  private async reschedule(session: ToolSession, args: Record<string, any>): Promise<ToolResult> {
    const blocked = this.requirePatient(session);
    if (blocked) return blocked;
    const appointment = await this.hospital.findPatientAppointmentByReference(
      session.patient!.patientId,
      String(args.reference || ''),
    );
    if (!appointment) return { ok: false, error: 'No appointment with that reference for this patient.' };
    const updated = await this.hospital.rescheduleAppointment(appointment.appointmentId, {
      appointmentDate: String(args.date || ''),
      appointmentTime: String(args.time || '').slice(0, 5),
    });
    return {
      ok: true,
      rescheduled: true,
      reference: referenceOf(appointment.appointmentCode),
      date: toDateOnly(updated.appointmentDate),
      time: toTimeText(updated.appointmentTime).slice(0, 5),
    };
  }

  /* ───────────────────────────── reports & bills ───────────────────────────── */

  private async labReports(session: ToolSession): Promise<ToolResult> {
    const blocked = this.requirePatient(session);
    if (blocked) return blocked;
    const reports = await this.hospital.getLabReports(session.patient!.patientCode);
    return {
      ok: true,
      reports: reports.slice(0, 5).map((report) => ({
        test: report.testName,
        status: report.reportStatus,
        summary: report.resultSummary,
        date: report.reportDate ? toDateOnly(report.reportDate) : null,
      })),
    };
  }

  private async bills(session: ToolSession): Promise<ToolResult> {
    const blocked = this.requirePatient(session);
    if (blocked) return blocked;
    const bills = await this.hospital.getBilling(session.patient!.patientCode);
    return {
      ok: true,
      bills: bills.slice(0, 5).map((bill) => ({
        invoice: bill.invoiceNumber,
        total: Number(bill.totalAmount),
        paid: Number(bill.paidAmount),
        due: Number(bill.totalAmount) - Number(bill.paidAmount),
        status: bill.billingStatus,
        due_date: bill.dueDate ? toDateOnly(bill.dueDate) : null,
      })),
    };
  }
}

/* ───────────────────────────── matching helpers ───────────────────────────── */

/** Short, speakable booking reference: last 6 characters of the appointment code. */
export function referenceOf(appointmentCode: string): string {
  return String(appointmentCode || '').replace(/[^a-z0-9]/gi, '').slice(-6).toUpperCase();
}

function words(value: string): string[] {
  return value
    .toLowerCase()
    .replace(/\bdr\.?\s*/g, ' ')
    .split(/[^a-z0-9]+/)
    .filter((word) => word.length >= 3);
}

/**
 * "cardiologist" should find "Cardiology", "ortho" should find "Orthopedics":
 * compare on a shared stem of at least 5 letters (or a whole short word).
 */
export function termMatches(term: string, fields: unknown[]): boolean {
  const haystack = fields.map((field) => String(field ?? '').toLowerCase()).join(' ');
  return words(term).some((word) => {
    const stem = word.length > 5 ? word.slice(0, 5) : word;
    return haystack.includes(stem);
  });
}

function editDistance(a: string, b: string): number {
  const row = Array.from({ length: b.length + 1 }, (_, index) => index);
  for (let i = 1; i <= a.length; i += 1) {
    let previous = row[0];
    row[0] = i;
    for (let j = 1; j <= b.length; j += 1) {
      const current = row[j];
      row[j] = Math.min(row[j] + 1, row[j - 1] + 1, previous + (a[i - 1] === b[j - 1] ? 0 : 1));
      previous = current;
    }
  }
  return row[b.length];
}

/**
 * Spoken names come back transliterated ("Lakshmi" / "Laxmi"), so a name
 * matches when one of its words equals, or is one edit away from, a word of
 * the registered name (words of 4+ letters only, to avoid trivial matches).
 */
export function namesMatch(spoken: string, registered: string): boolean {
  const said = words(spoken).filter((word) => word.length >= 4);
  const onFile = words(registered).filter((word) => word.length >= 4);
  return said.some((a) => onFile.some((b) => a === b || (Math.min(a.length, b.length) >= 5 && editDistance(a, b) <= 1)));
}
