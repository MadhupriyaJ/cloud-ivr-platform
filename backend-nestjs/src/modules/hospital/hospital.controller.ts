import { Body, Controller, Get, Param, Post, Put, Query } from '@nestjs/common';
import { HospitalService } from './hospital.service';
import { CreatePatientDto } from './dto/create-patient.dto';
import { CreateAppointmentDto } from './dto/create-appointment.dto';
import { RescheduleAppointmentDto } from './dto/reschedule-appointment.dto';
import { HospitalIvrRequestDto } from './dto/hospital-ivr-request.dto';
import { BootstrapHospitalDto } from './dto/bootstrap-hospital.dto';
import { CacheService } from '../../common/cache.service';

@Controller('hospital')
export class HospitalController {
  constructor(
    private readonly hospitalService: HospitalService,
    private readonly cache: CacheService,
  ) {}

  @Post('bootstrap')
  async bootstrap(@Body() payload: BootstrapHospitalDto) {
    this.cache.invalidatePrefix('hospital:');
    return this.hospitalService.bootstrap(payload);
  }

  @Get('departments')
  async listDepartments() {
    return this.cache.getOrSet('hospital:departments', async () => ({
      items: await this.hospitalService.listDepartments(),
    }), 120_000); // 2 min cache — departments rarely change
  }

  @Get('doctors')
  async listDoctors(@Query('departmentId') departmentId?: string) {
    const key = departmentId ? `hospital:doctors:${departmentId}` : 'hospital:doctors:all';
    return this.cache.getOrSet(key, async () => ({
      items: await this.hospitalService.listDoctors(departmentId),
    }), 60_000);
  }

  @Get('doctors/available')
  async listAvailableDoctors(
    @Query('departmentId') departmentId?: string,
    @Query('date') date?: string,
  ) {
    return { items: await this.hospitalService.listAvailableDoctors(departmentId, date) };
  }

  @Get('doctors/:doctorId/slots')
  async getDoctorSlots(@Param('doctorId') doctorId: string, @Query('date') date?: string) {
    return { items: await this.hospitalService.getDoctorSlots(doctorId, date) };
  }

  @Post('patients')
  async createPatient(@Body() payload: CreatePatientDto) {
    return this.hospitalService.createPatient(payload);
  }

  @Get('patients/lookup')
  async lookupPatient(@Query('patientCode') patientCode?: string, @Query('phone') phoneNumber?: string) {
    return this.hospitalService.lookupPatient(patientCode, phoneNumber);
  }

  @Post('appointments')
  async createAppointment(@Body() payload: CreateAppointmentDto) {
    this.cache.invalidatePrefix('hospital:appointments');
    return this.hospitalService.createAppointment(payload);
  }

  @Get('appointments/verify')
  async verifyAppointment(
    @Query('patientCode') patientCode?: string,
    @Query('phone') phoneNumber?: string,
  ) {
    return this.hospitalService.verifyAppointment(patientCode, phoneNumber);
  }

  @Get('appointments')
  async listAppointments(
    @Query('departmentId') departmentId?: string,
    @Query('date') date?: string,
    @Query('status') status?: string,
    @Query('patientCode') patientCode?: string,
    @Query('phone') phoneNumber?: string,
  ) {
    const key = `hospital:appointments:${departmentId || 'all'}:${date || 'all'}:${status || 'all'}`;
    return this.cache.getOrSet(key, async () => ({
      items: await this.hospitalService.listAppointments({
        departmentId,
        date,
        status,
        patientCode,
        phoneNumber,
      }),
    }), 15_000); // 15s cache for appointments
  }

  @Put('appointments/:appointmentId/reschedule')
  async rescheduleAppointment(
    @Param('appointmentId') appointmentId: string,
    @Body() payload: RescheduleAppointmentDto,
  ) {
    this.cache.invalidatePrefix('hospital:appointments');
    return this.hospitalService.rescheduleAppointment(appointmentId, payload);
  }

  @Put('appointments/:appointmentId/cancel')
  async cancelAppointment(@Param('appointmentId') appointmentId: string) {
    this.cache.invalidatePrefix('hospital:appointments');
    return this.hospitalService.cancelAppointment(appointmentId);
  }

  @Get('billing')
  async getBilling(@Query('patientCode') patientCode?: string, @Query('phone') phoneNumber?: string) {
    return { items: await this.hospitalService.getBilling(patientCode, phoneNumber) };
  }

  @Get('lab-reports')
  async getLabReports(@Query('patientCode') patientCode?: string, @Query('phone') phoneNumber?: string) {
    return { items: await this.hospitalService.getLabReports(patientCode, phoneNumber) };
  }

  @Post('ivr/next')
  async runIvrStep(@Body() payload: HospitalIvrRequestDto) {
    return this.hospitalService.runIvrStep(payload);
  }
}
