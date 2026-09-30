import {
  BadRequestException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { atividadesCientificas, type Database } from '@nexo-centro/db';
import type {
  CreateAtividadeCientifica,
  UpdateAtividadeCientifica,
} from '@nexo-centro/schemas';
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

/**
 * Atividade científica é parte do portfólio pessoal: os dados pertencem ao
 * utilizador, não ao hospital — por isso o scope é `userId` e não `hospitalId`.
 */
@Injectable()
export class AtividadesCientificasService {
  constructor(
    @Inject(DRIZZLE) private readonly db: Database,
    private readonly config: ConfigService<EnvironmentVariables>,
  ) {}

  async list(userId: string) {
    return this.db
      .select()
      .from(atividadesCientificas)
      .where(eq(atividadesCientificas.userId, userId))
      .orderBy(desc(atividadesCientificas.data));
  }

  async findOne(userId: string, id: string) {
    const [row] = await this.db
      .select()
      .from(atividadesCientificas)
      .where(
        and(
          eq(atividadesCientificas.id, id),
          eq(atividadesCientificas.userId, userId),
        ),
      )
      .limit(1);
    if (!row) {
      throw new NotFoundException('Atividade científica não encontrada.');
    }
    return row;
  }

  async create(
    userId: string,
    payload: CreateAtividadeCientifica,
    file?: UploadedFile,
  ) {
    if (file) this.validateFile(file);

    const [created] = await this.db
      .insert(atividadesCientificas)
      .values({ ...this.toColumns(payload), userId })
      .returning();

    if (file) {
      const filePath = await this.saveFile(
        'atividade',
        userId,
        created.id,
        file,
      );
      const [updated] = await this.db
        .update(atividadesCientificas)
        .set({
          ficheiroPath: filePath,
          ficheiroOriginalName: file.originalname,
          ficheiroSize: file.size,
        })
        .where(eq(atividadesCientificas.id, created.id))
        .returning();
      return updated;
    }

    return created;
  }

  async update(
    userId: string,
    id: string,
    payload: UpdateAtividadeCientifica & { removerFicheiro?: boolean },
    file?: UploadedFile,
  ) {
    if (file) this.validateFile(file);

    const existing = await this.findOne(userId, id);

    const [updated] = await this.db
      .update(atividadesCientificas)
      .set(this.toColumns(payload))
      .where(
        and(
          eq(atividadesCientificas.id, id),
          eq(atividadesCientificas.userId, userId),
        ),
      )
      .returning();

    if (file) {
      if (existing.ficheiroPath) {
        await this.deleteFile(existing.ficheiroPath);
      }
      const filePath = await this.saveFile('atividade', userId, id, file);
      const [withFile] = await this.db
        .update(atividadesCientificas)
        .set({
          ficheiroPath: filePath,
          ficheiroOriginalName: file.originalname,
          ficheiroSize: file.size,
        })
        .where(eq(atividadesCientificas.id, id))
        .returning();
      return withFile;
    }

    if (payload.removerFicheiro && existing.ficheiroPath) {
      await this.deleteFile(existing.ficheiroPath);
      const [cleared] = await this.db
        .update(atividadesCientificas)
        .set({
          ficheiroPath: null,
          ficheiroOriginalName: null,
          ficheiroSize: null,
        })
        .where(eq(atividadesCientificas.id, id))
        .returning();
      return cleared;
    }

    return updated;
  }

  async remove(userId: string, id: string): Promise<void> {
    const existing = await this.findOne(userId, id);
    if (existing.ficheiroPath) {
      await this.deleteFile(existing.ficheiroPath);
    }
    await this.db
      .delete(atividadesCientificas)
      .where(
        and(
          eq(atividadesCientificas.id, id),
          eq(atividadesCientificas.userId, userId),
        ),
      );
  }

  async getFilePath(
    userId: string,
    id: string,
  ): Promise<{ filePath: string; originalName: string }> {
    const row = await this.findOne(userId, id);
    if (!row.ficheiroPath) {
      throw new NotFoundException('Ficheiro não encontrado.');
    }
    const storageDir =
      this.config.get('STORAGE_DIR', { infer: true }) ?? './storage';
    const absPath = path.resolve(storageDir, row.ficheiroPath);
    try {
      await fs.access(absPath);
    } catch {
      throw new NotFoundException('Ficheiro não encontrado no disco.');
    }
    return {
      filePath: absPath,
      originalName: row.ficheiroOriginalName ?? path.basename(absPath),
    };
  }

  /** `fatorImpacto` é decimal na BD — o Drizzle espera string na escrita. */
  private toColumns<T extends UpdateAtividadeCientifica>(payload: T) {
    const { fatorImpacto, removerFicheiro: _removerFicheiro, ...rest } = payload;
    return {
      ...rest,
      ...(fatorImpacto !== undefined
        ? {
            fatorImpacto:
              fatorImpacto === null ? null : fatorImpacto.toString(),
          }
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
    // Store relative path so the storage root can be relocated.
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
