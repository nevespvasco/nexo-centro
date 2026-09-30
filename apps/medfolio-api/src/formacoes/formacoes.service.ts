import {
  BadRequestException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { formacoes, type Database } from '@nexo-centro/db';
import type { CreateFormacao, UpdateFormacao } from '@nexo-centro/schemas';
import { and, desc, eq } from 'drizzle-orm';
import * as fs from 'fs/promises';
import * as path from 'path';
import { DRIZZLE } from '../database/drizzle.constants';
import type { EnvironmentVariables } from '../config/env.validation';

interface UploadedFile {
  originalname: string;
  mimetype: string;
  size: number;
  buffer: Buffer;
}

const ALLOWED_MIME_TYPES = [
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-powerpoint',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  'image/jpeg',
  'image/png',
];

const MAX_FILE_SIZE = 10_485_760; // 10 MB

/** Portfólio pessoal — scope por `userId`, cross-hospital (ver AtividadesCientificasService). */
@Injectable()
export class FormacoesService {
  constructor(
    @Inject(DRIZZLE) private readonly db: Database,
    private readonly config: ConfigService<EnvironmentVariables>,
  ) {}

  async list(userId: string) {
    return this.db
      .select()
      .from(formacoes)
      .where(eq(formacoes.userId, userId))
      .orderBy(desc(formacoes.dataInicio));
  }

  async findOne(userId: string, id: string) {
    const [row] = await this.db
      .select()
      .from(formacoes)
      .where(and(eq(formacoes.id, id), eq(formacoes.userId, userId)))
      .limit(1);
    if (!row) {
      throw new NotFoundException('Formação não encontrada.');
    }
    return row;
  }

  async create(userId: string, payload: CreateFormacao, file?: UploadedFile) {
    if (file) this.validateFile(file);

    const [created] = await this.db
      .insert(formacoes)
      .values({ ...this.toColumns(payload), userId })
      .returning();

    if (file) {
      const filePath = await this.saveFile(
        'formacao',
        userId,
        created.id,
        file,
      );
      const [updated] = await this.db
        .update(formacoes)
        .set({
          certificadoPath: filePath,
          certificadoOriginalName: file.originalname,
          certificadoSize: file.size,
        })
        .where(eq(formacoes.id, created.id))
        .returning();
      return updated;
    }

    return created;
  }

  async update(
    userId: string,
    id: string,
    payload: UpdateFormacao & { removerCertificado?: boolean },
    file?: UploadedFile,
  ) {
    if (file) this.validateFile(file);

    const existing = await this.findOne(userId, id);

    const [updated] = await this.db
      .update(formacoes)
      .set(this.toColumns(payload))
      .where(and(eq(formacoes.id, id), eq(formacoes.userId, userId)))
      .returning();

    if (file) {
      if (existing.certificadoPath) {
        await this.deleteFile(existing.certificadoPath);
      }
      const filePath = await this.saveFile('formacao', userId, id, file);
      const [withFile] = await this.db
        .update(formacoes)
        .set({
          certificadoPath: filePath,
          certificadoOriginalName: file.originalname,
          certificadoSize: file.size,
        })
        .where(eq(formacoes.id, id))
        .returning();
      return withFile;
    }

    if (payload.removerCertificado && existing.certificadoPath) {
      await this.deleteFile(existing.certificadoPath);
      const [cleared] = await this.db
        .update(formacoes)
        .set({
          certificadoPath: null,
          certificadoOriginalName: null,
          certificadoSize: null,
        })
        .where(eq(formacoes.id, id))
        .returning();
      return cleared;
    }

    return updated;
  }

  async remove(userId: string, id: string): Promise<void> {
    const existing = await this.findOne(userId, id);
    if (existing.certificadoPath) {
      await this.deleteFile(existing.certificadoPath);
    }
    await this.db
      .delete(formacoes)
      .where(and(eq(formacoes.id, id), eq(formacoes.userId, userId)));
  }

  async getFilePath(
    userId: string,
    id: string,
  ): Promise<{ filePath: string; originalName: string }> {
    const row = await this.findOne(userId, id);
    if (!row.certificadoPath) {
      throw new NotFoundException('Certificado não encontrado.');
    }
    const storageDir =
      this.config.get('STORAGE_DIR', { infer: true }) ?? './storage';
    const absPath = path.resolve(storageDir, row.certificadoPath);
    try {
      await fs.access(absPath);
    } catch {
      throw new NotFoundException('Certificado não encontrado no disco.');
    }
    return {
      filePath: absPath,
      originalName: row.certificadoOriginalName ?? path.basename(absPath),
    };
  }

  /** `creditos` é decimal na BD — o Drizzle espera string na escrita. */
  private toColumns<T extends UpdateFormacao>(payload: T) {
    const { creditos, removerCertificado: _removerCertificado, ...rest } = payload;
    return {
      ...rest,
      ...(creditos !== undefined
        ? { creditos: creditos === null ? null : creditos.toString() }
        : {}),
    };
  }

  private validateFile(file: UploadedFile): void {
    if (!ALLOWED_MIME_TYPES.includes(file.mimetype)) {
      throw new BadRequestException(
        'Tipo de ficheiro não permitido. Use PDF, Word, PowerPoint, JPEG ou PNG.',
      );
    }
    if (file.size > MAX_FILE_SIZE) {
      throw new BadRequestException('O ficheiro não pode exceder 10 MB.');
    }
  }

  private async saveFile(
    type: string,
    userId: string,
    id: string,
    file: UploadedFile,
  ): Promise<string> {
    const storageDir =
      this.config.get('STORAGE_DIR', { infer: true }) ?? './storage';
    const dir = path.join(storageDir, `${type}s`, userId, id);
    await fs.mkdir(dir, { recursive: true });
    const ext = path.extname(file.originalname) || '';
    const filename = `file${ext}`;
    const absPath = path.join(dir, filename);
    await fs.writeFile(absPath, file.buffer);
    return path.join(`${type}s`, userId, id, filename);
  }

  private async deleteFile(relativePath: string): Promise<void> {
    const storageDir =
      this.config.get('STORAGE_DIR', { infer: true }) ?? './storage';
    const absPath = path.resolve(storageDir, relativePath);
    try {
      await fs.unlink(absPath);
    } catch {
      // Silently ignore — file may already be gone.
    }
  }
}
