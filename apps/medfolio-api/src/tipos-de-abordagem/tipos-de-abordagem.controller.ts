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
  createCatalogoItemSchema,
  type CreateCatalogoItem,
  type UpdateCatalogoItem,
  updateCatalogoItemSchema,
} from '@nexo-centro/schemas';
import { ZodValidationPipe } from '../common/zod-validation.pipe';
import { CurrentHospital } from '../common/current-hospital.decorator';
import { HospitalScopeGuard } from '../common/hospital-scope.guard';
import { JwtAuthGuard } from '../auth/jwt.guard';
import { TiposDeAbordagemService } from './tipos-de-abordagem.service';

@Controller('tipos-de-abordagem')
@UseGuards(JwtAuthGuard, HospitalScopeGuard)
export class TiposDeAbordagemController {
  constructor(
    private readonly tiposDeAbordagemService: TiposDeAbordagemService,
  ) {}

  @Get()
  list(@CurrentHospital() hospitalId: string) {
    return this.tiposDeAbordagemService.list(hospitalId);
  }

  @Get(':id')
  findOne(
    @CurrentHospital() hospitalId: string,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.tiposDeAbordagemService.findOne(hospitalId, id);
  }

  @Post()
  create(
    @CurrentHospital() hospitalId: string,
    @Body(new ZodValidationPipe(createCatalogoItemSchema))
    body: CreateCatalogoItem,
  ) {
    return this.tiposDeAbordagemService.create(hospitalId, body);
  }

  @Patch(':id')
  update(
    @CurrentHospital() hospitalId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @Body(new ZodValidationPipe(updateCatalogoItemSchema))
    body: UpdateCatalogoItem,
  ) {
    return this.tiposDeAbordagemService.update(hospitalId, id, body);
  }

  @Delete(':id')
  remove(
    @CurrentHospital() hospitalId: string,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.tiposDeAbordagemService.remove(hospitalId, id);
  }
}
