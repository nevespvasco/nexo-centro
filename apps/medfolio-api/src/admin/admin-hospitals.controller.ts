import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import {
  createHospitalSchema,
  updateHospitalSchema,
  type CreateHospital,
  type UpdateHospital,
} from '@nexo-centro/schemas';
import { ZodValidationPipe } from '../common/zod-validation.pipe';
import { AdminGuard, type AdminRequest } from './admin.guard';
import { AdminHospitalsService } from './admin-hospitals.service';

@Controller('admin')
@UseGuards(AdminGuard)
export class AdminHospitalsController {
  constructor(private readonly adminHospitalsService: AdminHospitalsService) {}

  @Get('hospitals')
  listHospitals(@Req() req: AdminRequest) {
    return this.adminHospitalsService.listHospitals(req.adminHospitalId);
  }

  @Post('hospitals')
  create(
    @Req() req: AdminRequest,
    @Body(new ZodValidationPipe(createHospitalSchema)) body: CreateHospital,
  ) {
    return this.adminHospitalsService.create(
      req.adminHospitalId,
      body,
      req.adminUserId,
    );
  }

  @Patch('hospitals/:id')
  update(
    @Req() req: AdminRequest,
    @Param('id', ParseUUIDPipe) id: string,
    @Body(new ZodValidationPipe(updateHospitalSchema)) body: UpdateHospital,
  ) {
    return this.adminHospitalsService.update(
      req.adminHospitalId,
      id,
      body,
      req.adminUserId,
    );
  }
}
