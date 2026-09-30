import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import {
  createZonaAnatomicaSchema,
  type CreateZonaAnatomica,
  type ReorderZonasAnatomicas,
  type UpdateZonaAnatomica,
  reorderZonasAnatomicasSchema,
  updateZonaAnatomicaSchema,
} from '@nexo-centro/schemas';
import { ZodValidationPipe } from '../common/zod-validation.pipe';
import { CurrentHospital } from '../common/current-hospital.decorator';
import { HospitalScopeGuard } from '../common/hospital-scope.guard';
import { JwtAuthGuard } from '../auth/jwt.guard';
import { ZonasAnatomicasService } from './zonas-anatomicas.service';

@Controller('zonas-anatomicas')
@UseGuards(JwtAuthGuard, HospitalScopeGuard)
export class ZonasAnatomicasController {
  constructor(
    private readonly zonasAnatomicasService: ZonasAnatomicasService,
  ) {}

  @Get()
  list(@CurrentHospital() hospitalId: string) {
    return this.zonasAnatomicasService.list(hospitalId);
  }

  @Patch('reorder')
  reorder(
    @CurrentHospital() hospitalId: string,
    @Body(new ZodValidationPipe(reorderZonasAnatomicasSchema))
    body: ReorderZonasAnatomicas,
  ) {
    return this.zonasAnatomicasService.reorder(hospitalId, body);
  }

  @Get(':id')
  findOne(
    @CurrentHospital() hospitalId: string,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.zonasAnatomicasService.findOne(hospitalId, id);
  }

  @Post()
  create(
    @CurrentHospital() hospitalId: string,
    @Body(new ZodValidationPipe(createZonaAnatomicaSchema))
    body: CreateZonaAnatomica,
  ) {
    return this.zonasAnatomicasService.create(hospitalId, body);
  }

  @Patch(':id')
  update(
    @CurrentHospital() hospitalId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @Body(new ZodValidationPipe(updateZonaAnatomicaSchema))
    body: UpdateZonaAnatomica,
  ) {
    return this.zonasAnatomicasService.update(hospitalId, id, body);
  }

  @Delete(':id')
  remove(
    @CurrentHospital() hospitalId: string,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.zonasAnatomicasService.remove(hospitalId, id);
  }
}
