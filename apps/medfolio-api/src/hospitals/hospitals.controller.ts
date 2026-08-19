import { Body, Controller, Get, Post, UseGuards } from '@nestjs/common';
import { requestHospitalAccessSchema, type RequestHospitalAccess } from '@nexo-centro/schemas';
import { CurrentUser } from '../auth/current-user.decorator';
import { JwtAuthGuard } from '../auth/jwt.guard';
import { ZodValidationPipe } from '../common/zod-validation.pipe';
import { HospitalsService } from './hospitals.service';

@Controller('hospitals')
@UseGuards(JwtAuthGuard)
export class HospitalsController {
  constructor(private readonly hospitalsService: HospitalsService) {}

  @Get()
  list(@CurrentUser() userId: string) {
    return this.hospitalsService.listApproved(userId);
  }

  @Get('available')
  listAvailable(@CurrentUser() userId: string) {
    return this.hospitalsService.listRequestable(userId);
  }

  @Post('requests')
  requestAccess(
    @Body(new ZodValidationPipe(requestHospitalAccessSchema)) body: RequestHospitalAccess,
    @CurrentUser() userId: string,
  ) {
    return this.hospitalsService.requestAccess(userId, body.hospitalId);
  }
}
