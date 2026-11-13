import { BadRequestException, HttpException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { randomUUID } from 'crypto';
import { AzureResponsesError, createResponse, extractJsonObject } from '../../common/azure-responses';
import { DomainEntity } from '../domains/domain.entity';
import { DepartmentEntity } from './department.entity';
import { DoctorEntity } from './doctor.entity';
import { HospitalService } from './hospital.service';

/**
 * Builds a hospital's real doctor directory from the public web.
 *
 *   1. search()  — Azure OpenAI Responses API with the web_search tool looks
 *                  up the hospital's doctors and returns them as JSON. Nothing
 *                  is written; an admin reviews the list first.
 *   2. apply()   — upserts the reviewed doctors and their departments, and
 *                  can deactivate doctors that are not in the list (e.g. the
 *                  demo seed). Doctors are deactivated, never deleted, so
 *                  existing appointments keep their history.
 *
 * Web results can be stale or incomplete, which is why the import is a
 * two-step, human-reviewed operation and every doctor keeps its source URL.
 */

export type ImportedDoctor = {
  name: string;
  specialization: string;
  department: string;
  qualification?: string | null;
  source_url?: string | null;
};

export type DoctorSearchResult = {
  hospital: { name: string; city: string | null; website: string | null };
  doctors: ImportedDoctor[];
  sources: string[];
  searches: number;
  warning?: string;
};

/** Common specialty wording → department name. Unmatched values pass through title-cased. */
const DEPARTMENT_ALIASES: [RegExp, string][] = [
  [/cardi|heart/i, 'Cardiology'],
  [/neuro.*surg/i, 'Neurosurgery'],
  [/neuro/i, 'Neurology'],
  [/ortho|joint|spine/i, 'Orthopedics'],
  [/paediat|pediat|child|neonat/i, 'Pediatrics'],
  [/gyn|obstet|maternity|women/i, 'Obstetrics & Gynecology'],
  [/derma|skin/i, 'Dermatology'],
  [/ent\b|otorhino|ear|nose|throat/i, 'ENT'],
  [/ophthal|eye/i, 'Ophthalmology'],
  [/gastro|hepat|liver/i, 'Gastroenterology'],
  [/nephro|kidney/i, 'Nephrology'],
  [/urolog/i, 'Urology'],
  [/onco|cancer/i, 'Oncology'],
  [/pulmon|chest|respirat/i, 'Pulmonology'],
  [/endocrin|diabet|thyroid/i, 'Endocrinology'],
  [/psychiat|mental/i, 'Psychiatry'],
  [/dent|oral/i, 'Dental'],
  [/radiol|imaging/i, 'Radiology'],
  [/anaesth|anesth/i, 'Anesthesiology'],
  [/emergenc|critical|intensiv/i, 'Emergency & Critical Care'],
  [/general\s*surg|laparo/i, 'General Surgery'],
  [/plastic|cosmetic/i, 'Plastic Surgery'],
  [/rheumat/i, 'Rheumatology'],
  [/physio|rehab/i, 'Physiotherapy'],
  [/internal|general\s*medicine|physician/i, 'General Medicine'],
];

export function normalizeDepartment(value: string, specialization = ''): string {
  const text = `${value || ''} ${specialization || ''}`.trim();
  for (const [pattern, department] of DEPARTMENT_ALIASES) {
    if (pattern.test(value || '')) return department;
  }
  for (const [pattern, department] of DEPARTMENT_ALIASES) {
    if (pattern.test(text)) return department;
  }
  const cleaned = (value || specialization || 'General Medicine').replace(/\s+/g, ' ').trim();
  return cleaned.replace(/\b\w/g, (letter) => letter.toUpperCase()).slice(0, 120);
}

export function normalizeDoctorName(value: string): string {
  const name = String(value || '')
    .replace(/\s+/g, ' ')
    .replace(/^(dr|doctor|prof|professor)\.?\s+/i, '')
    .trim();
  return name ? `Dr. ${name}`.slice(0, 160) : '';
}

/** Clean, validate and de-duplicate what the model returned. */
export function normalizeDoctors(raw: unknown): ImportedDoctor[] {
  const list = Array.isArray(raw) ? raw : [];
  const seen = new Set<string>();
  const doctors: ImportedDoctor[] = [];

  for (const item of list) {
    if (!item || typeof item !== 'object') continue;
    const entry = item as Record<string, unknown>;
    const name = normalizeDoctorName(String(entry.name || ''));
    const bare = name.replace(/^Dr\.\s*/, '');
    // A real name has letters and at most a handful of words.
    if (!bare || !/[a-z]/i.test(bare) || bare.split(' ').length > 6) continue;

    const key = bare.toLowerCase().replace(/[^a-z]/g, '');
    if (seen.has(key)) continue;
    seen.add(key);

    const specialization = String(entry.specialization || entry.speciality || entry.specialty || '').trim();
    doctors.push({
      name,
      specialization: (specialization || 'Consultant').slice(0, 160),
      department: normalizeDepartment(String(entry.department || ''), specialization),
      qualification: entry.qualification ? String(entry.qualification).trim().slice(0, 200) : null,
      source_url: typeof entry.source_url === 'string' && /^https?:\/\//.test(entry.source_url) ? entry.source_url : null,
    });
  }
  return doctors.slice(0, 200);
}

function slug(value: string): string {
  return value.toLowerCase().replace(/&/g, 'and').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 60) || 'general';
}

@Injectable()
export class DoctorImportService {
  private readonly logger = new Logger(DoctorImportService.name);

  constructor(
    private readonly hospital: HospitalService,
    @InjectRepository(DomainEntity) private readonly domains: Repository<DomainEntity>,
    @InjectRepository(DepartmentEntity) private readonly departments: Repository<DepartmentEntity>,
    @InjectRepository(DoctorEntity) private readonly doctors: Repository<DoctorEntity>,
  ) {}

  async search(input: { hospitalName: string; city?: string; website?: string }): Promise<DoctorSearchResult> {
    const hospitalName = String(input.hospitalName || '').trim();
    const city = String(input.city || '').trim() || null;
    if (hospitalName.length < 3) throw new BadRequestException('hospitalName is required.');

    let websiteHost: string | null = null;
    if (input.website?.trim()) {
      try {
        websiteHost = new URL(/^https?:\/\//.test(input.website) ? input.website : `https://${input.website}`).host.replace(/^www\./, '');
      } catch {
        throw new BadRequestException('website is not a valid URL.');
      }
    }

    const tool: Record<string, unknown> = {
      type: 'web_search',
      user_location: { type: 'approximate', country: 'IN', ...(city ? { city } : {}) },
    };
    if (websiteHost) tool.filters = { allowed_domains: [websiteHost] };

    const place = city ? ` in ${city}` : '';
    const prompt = [
      `Find the doctors who currently practise at "${hospitalName}"${place}, India.`,
      websiteHost
        ? `Use the hospital's official website (${websiteHost}): its "Find a doctor" / "Our doctors" / department pages.`
        : 'Prefer the hospital\'s official website ("Find a doctor", "Our doctors", department pages); use other reputable listings only to fill gaps.',
      'Include only doctors you actually saw listed for this hospital. Never invent or guess names.',
      'Reply with ONLY one JSON object, no prose, in this shape:',
      '{"hospital":{"name":string,"city":string|null,"website":string|null},' +
        '"doctors":[{"name":string,"qualification":string|null,"specialization":string,"department":string,"source_url":string|null}]}',
      'department is a standard hospital department in English (e.g. Cardiology, Orthopedics, Pediatrics).',
      'Return as many doctors as you can find, up to 150.',
    ].join('\n');

    let result;
    try {
      result = await createResponse({
        tools: [tool],
        tool_choice: 'auto',
        include: ['web_search_call.action.sources'],
        input: prompt,
      });
    } catch (error) {
      if (error instanceof AzureResponsesError) throw new HttpException(error.message, error.status ?? 502);
      throw error;
    }

    const parsed = extractJsonObject(result.text);
    if (!parsed) {
      this.logger.warn(`Doctor search for "${hospitalName}" returned no JSON: ${result.text.slice(0, 200)}`);
      throw new HttpException('The web search did not return a doctor list. Try adding the city or the hospital website.', 502);
    }

    const doctors = normalizeDoctors(parsed.doctors);
    const sources = [...new Set([...result.citations.map((item) => item.url), ...result.sources])];
    this.logger.log(`Doctor search "${hospitalName}": ${doctors.length} doctors from ${sources.length} sources (${result.searches} searches)`);

    return {
      hospital: {
        name: String(parsed.hospital?.name || hospitalName).slice(0, 160),
        city: parsed.hospital?.city ? String(parsed.hospital.city) : city,
        website: parsed.hospital?.website ? String(parsed.hospital.website) : websiteHost,
      },
      doctors,
      sources,
      searches: result.searches,
      warning: result.searches === 0 ? 'The model answered without searching the web; review carefully.' : undefined,
    };
  }

  async apply(input: {
    doctors: unknown;
    deactivateMissing?: boolean;
    organizationName?: string;
    domainCode?: string;
  }): Promise<{
    departmentsCreated: number;
    doctorsCreated: number;
    doctorsUpdated: number;
    doctorsDeactivated: number;
    upcomingAppointmentsAffected: number;
  }> {
    const doctors = normalizeDoctors(input.doctors);
    if (doctors.length === 0) throw new BadRequestException('No valid doctors to import.');

    const domain = await this.domains.findOne({ where: { domainCode: input.domainCode?.trim() || 'hospital' } });
    if (!domain) throw new NotFoundException('Hospital domain not found.');

    let departmentsCreated = 0;
    let doctorsCreated = 0;
    let doctorsUpdated = 0;

    const departmentByCode = new Map(
      (await this.departments.find({ where: { domainId: domain.domainId } })).map((item) => [item.departmentCode, item]),
    );
    const existingDoctors = await this.doctors.find({ where: { domainId: domain.domainId } });
    const doctorByName = new Map(existingDoctors.map((item) => [item.doctorName.toLowerCase(), item]));
    const importedIds = new Set<string>();

    for (const entry of doctors) {
      const code = slug(entry.department);
      let department = departmentByCode.get(code);
      if (!department) {
        department = await this.departments.save(
          this.departments.create({ domainId: domain.domainId, departmentCode: code, departmentName: entry.department, isActive: true }),
        );
        departmentByCode.set(code, department);
        departmentsCreated += 1;
      } else if (!department.isActive) {
        department.isActive = true;
        await this.departments.save(department);
      }

      const existing = doctorByName.get(entry.name.toLowerCase());
      if (existing) {
        Object.assign(existing, {
          departmentId: department.departmentId,
          specialization: entry.specialization,
          qualification: entry.qualification ?? existing.qualification,
          isActive: true,
        });
        await this.doctors.save(existing);
        importedIds.add(existing.doctorId.toLowerCase());
        doctorsUpdated += 1;
      } else {
        const created = await this.doctors.save(
          this.doctors.create({
            domainId: domain.domainId,
            departmentId: department.departmentId,
            doctorCode: `DOC-${code.slice(0, 4).toUpperCase()}-${randomUUID().slice(0, 6).toUpperCase()}`,
            doctorName: entry.name,
            qualification: entry.qualification ?? null,
            specialization: entry.specialization,
            availabilityStatus: 'available',
            consultationFee: null,
            isActive: true,
          }),
        );
        doctorByName.set(entry.name.toLowerCase(), created);
        importedIds.add(created.doctorId.toLowerCase());
        doctorsCreated += 1;
      }
    }

    let doctorsDeactivated = 0;
    const deactivatedIds: string[] = [];
    if (input.deactivateMissing) {
      for (const doctor of existingDoctors) {
        if (doctor.isActive && !importedIds.has(doctor.doctorId.toLowerCase())) {
          doctor.isActive = false;
          await this.doctors.save(doctor);
          deactivatedIds.push(doctor.doctorId);
          doctorsDeactivated += 1;
        }
      }
    }

    // Patients already booked with a doctor who is no longer listed need a
    // call from the front desk; report how many so the admin can follow up.
    let upcomingAppointmentsAffected = 0;
    if (deactivatedIds.length) {
      const [{ total }] = await this.doctors.query(
        `SELECT COUNT(*) AS total FROM Appointments
          WHERE DoctorId IN (${deactivatedIds.map((_, index) => `@${index}`).join(', ')})
            AND AppointmentStatus IN ('booked', 'rescheduled')
            AND AppointmentDate >= CAST(SYSDATETIMEOFFSET() AT TIME ZONE 'India Standard Time' AS date)`,
        deactivatedIds,
      );
      upcomingAppointmentsAffected = Number(total) || 0;
    }

    const newName = input.organizationName?.trim().slice(0, 160);
    if (newName && newName !== domain.organizationName) {
      const oldName = domain.organizationName;
      // The welcome/fallback/escalation texts usually contain the hospital
      // name ("Welcome to X…"), both on the domain and in its active prompt
      // templates, which is what the voice assistant actually reads.
      const rename = (text: string) => (oldName ? text.split(oldName).join(newName) : text);
      domain.organizationName = newName;
      domain.welcomeMessage = rename(domain.welcomeMessage);
      domain.fallbackMessage = rename(domain.fallbackMessage);
      domain.escalationMessage = rename(domain.escalationMessage);
      await this.domains.save(domain);
      if (oldName) {
        await this.domains.query(
          `UPDATE PromptTemplates SET TemplateText = REPLACE(TemplateText, @0, @1) WHERE DomainId = @2`,
          [oldName, newName, domain.domainId],
        );
      }
    }

    // Open the standard OPD slots for the new doctors right away.
    await this.hospital.listAvailableDoctors();

    return { departmentsCreated, doctorsCreated, doctorsUpdated, doctorsDeactivated, upcomingAppointmentsAffected };
  }
}
