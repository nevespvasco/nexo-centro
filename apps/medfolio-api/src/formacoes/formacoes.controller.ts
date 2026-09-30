import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Res,
  StreamableFile,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import {
  createFormacaoSchema,
  type CreateFormacao,
  type UpdateFormacao,
  updateFormacaoSchema,
} from '@nexo-centro/schemas';
import type { Response } from 'express';
import { createReadStream } from 'fs';
import { PortfolioBodyPipe } from '../common/portfolio-body.pipe';
import { CurrentUser } from '../auth/current-user.decorator';
import { JwtAuthGuard } from '../auth/jwt.guard';
import { FormacoesService } from './formacoes.service';

interface UploadedFile {
  originalname: string;
  mimetype: string;
  size: number;
  buffer: Buffer;
}

@Controller('formacoes')
@UseGuards(JwtAuthGuard)
export class FormacoesController {
  constructor(private readonly service: FormacoesService) {}

  @Get()
  list(@CurrentUser() userId: string) {
    return this.service.list(userId);
  }

  @Get('export')
  async export(@CurrentUser() userId: string, @Res() res: Response) {
    const { buildFormacoesWorkbook } = await import('./formacoes.export.js');
    const rows = await this.service.list(userId);
    const wb = buildFormacoesWorkbook(rows);
    res.setHeader(
      'Content-Type',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    );
    res.setHeader(
      'Content-Disposition',
      'attachment; filename="formacoes.xlsx"',
    );
    await wb.xlsx.write(res);
    res.end();
  }

  @Get(':id')
  findOne(
    @CurrentUser() userId: string,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.service.findOne(userId, id);
  }

  @Get(':id/download')
  async download(
    @CurrentUser() userId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @Res({ passthrough: true }) res: Response,
  ) {
    const { filePath, originalName } = await this.service.getFilePath(
      userId,
      id,
    );
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="${encodeURIComponent(originalName)}"`,
    );
    const stream = createReadStream(filePath);
    return new StreamableFile(stream);
  }

  @Post()
  @UseInterceptors(FileInterceptor('certificado', { limits: { fileSize: 10_485_760 } }))
  create(
    @CurrentUser() userId: string,
    @Body(new PortfolioBodyPipe(createFormacaoSchema)) body: CreateFormacao,
    @UploadedFile() file?: UploadedFile,
  ) {
    if (file && !file.buffer) {
      throw new BadRequestException('Ficheiro inválido.');
    }
    return this.service.create(userId, body, file);
  }

  @Patch(':id')
  @UseInterceptors(FileInterceptor('certificado', { limits: { fileSize: 10_485_760 } }))
  update(
    @CurrentUser() userId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @Body(new PortfolioBodyPipe(updateFormacaoSchema))
    body: UpdateFormacao & { removerCertificado?: boolean },
    @UploadedFile() file?: UploadedFile,
  ) {
    return this.service.update(userId, id, body, file);
  }

  @Delete(':id')
  remove(
    @CurrentUser() userId: string,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.service.remove(userId, id);
  }
}
