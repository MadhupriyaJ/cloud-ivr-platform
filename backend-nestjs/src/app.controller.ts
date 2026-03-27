import { join } from 'path';
import { Controller, Get, Param, Res } from '@nestjs/common';
import { Response } from 'express';

@Controller()
export class AppController {
  @Get('health')
  health() {
    return {
      status: 'ok',
      service: 'generic-ivr-platform-backend',
    };
  }
}
