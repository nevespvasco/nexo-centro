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
import { FuncoesCirurgiaoService } from './funcoes-cirurgiao.service';

@Controller('funcoes-cirurgiao')
@UseGuards(JwtAuthGuard, HospitalScopeGuard)
export class FuncoesCirurgiaoController {
  constructor(
    private readonly funcoesCirurgiaoService: FuncoesCirurgiaoService,
  ) {}

  @Get()
  list(@CurrentHospital() hospitalId: string) {
    return this.funcoesCirurgiaoService.list(hospitalId);
  }

  @Get(':id')
  findOne(
    @CurrentHospital() hospitalId: string,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.funcoesCirurgiaoService.findOne(hospitalId, id);
  }

  @Post()
  create(
    @CurrentHospital() hospitalId: string,
    @Body(new ZodValidationPipe(createCatalogoItemSchema))
    body: CreateCatalogoItem,
  ) {
    return this.funcoesCirurgiaoService.create(hospitalId, body);
  }

  @Patch(':id')
  update(
    @CurrentHospital() hospitalId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @Body(new ZodValidationPipe(updateCatalogoItemSchema))
    body: UpdateCatalogoItem,
  ) {
    return this.funcoesCirurgiaoService.update(hospitalId, id, body);
  }

  @Delete(':id')
  remove(
    @CurrentHospital() hospitalId: string,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.funcoesCirurgiaoService.remove(hospitalId, id);
  }
}
