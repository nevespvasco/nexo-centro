import {
  Body,
  Controller,
  Delete,
  Get,
  Inject,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import {
  catalogoAssociacaoSchema,
  createProcedimentoSchema,
  updateProcedimentoSchema,
  type CatalogoAssociacao,
  type CreateProcedimento,
  type UpdateProcedimento,
} from '@nexo-centro/schemas';
import { ZodValidationPipe } from '../common/zod-validation.pipe';
import { CurrentHospitals } from '../common/current-hospitals.decorator';
import { HospitalReadScopeGuard } from '../common/hospital-read-scope.guard';
import { CurrentUser } from '../auth/current-user.decorator';
import { JwtAuthGuard } from '../auth/jwt.guard';
import { SharedCatalogService } from '../common/catalog-shared.service';

export const PROCEDIMENTOS_CATALOG = Symbol('PROCEDIMENTOS_CATALOG');

@Controller('procedimentos')
@UseGuards(JwtAuthGuard)
export class ProcedimentosController {
  constructor(
    @Inject(PROCEDIMENTOS_CATALOG)
    private readonly catalog: SharedCatalogService,
  ) {}

  @Get()
  @UseGuards(HospitalReadScopeGuard)
  list(
    @CurrentHospitals() hospitalIds: string[],
    @CurrentUser() userId: string,
  ) {
    return this.catalog.list(hospitalIds, userId);
  }

  @Post()
  create(
    @CurrentUser() userId: string,
    @Body(new ZodValidationPipe(createProcedimentoSchema))
    body: CreateProcedimento,
  ) {
    return this.catalog.create(userId, body.hospitalId, body);
  }

  @Patch(':id')
  update(
    @CurrentUser() userId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @Body(new ZodValidationPipe(updateProcedimentoSchema))
    body: UpdateProcedimento,
  ) {
    return this.catalog.updateContent(userId, id, body);
  }

  @Delete(':id')
  remove(
    @CurrentUser() userId: string,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.catalog.remove(userId, id);
  }

  @Post(':id/hospitais')
  associate(
    @CurrentUser() userId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @Body(new ZodValidationPipe(catalogoAssociacaoSchema))
    body: CatalogoAssociacao,
  ) {
    return this.catalog.associate(userId, id, body.hospitalId);
  }

  @Delete(':id/hospitais/:hospitalId')
  disassociate(
    @CurrentUser() userId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @Param('hospitalId', ParseUUIDPipe) hospitalId: string,
  ) {
    return this.catalog.disassociate(userId, id, hospitalId);
  }
}
