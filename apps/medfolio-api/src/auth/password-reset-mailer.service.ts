import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import nodemailer, { type Transporter } from 'nodemailer';
import type { EnvironmentVariables } from '../config/env.validation';

@Injectable()
export class PasswordResetMailer {
  private readonly logger = new Logger(PasswordResetMailer.name);
  private readonly transporter: Transporter | null;

  constructor(private readonly config: ConfigService<EnvironmentVariables>) {
    const host = this.config.get<string>('SMTP_HOST');
    this.transporter = host
      ? nodemailer.createTransport({
          host,
          port: this.config.get<number>('SMTP_PORT', 587),
          secure: this.config.get<boolean>('SMTP_SECURE', false),
          auth: this.config.get<string>('SMTP_USER')
            ? {
                user: this.config.get<string>('SMTP_USER'),
                pass: this.config.get<string>('SMTP_PASSWORD'),
              }
            : undefined,
        })
      : null;
  }

  get configured(): boolean {
    return this.transporter !== null;
  }

  async send(email: string, resetLink: string): Promise<boolean> {
    if (!this.transporter) return false;
    try {
      await this.transporter.sendMail({
        from: this.config.getOrThrow<string>('SMTP_FROM'),
        to: email,
        subject: 'Repor palavra-passe do MedFolio',
        text:
          'Recebemos um pedido para repor a tua palavra-passe. ' +
          `Abre este link, válido durante uma hora: ${resetLink}\n\n` +
          'Se não fizeste este pedido, ignora esta mensagem.',
      });
      return true;
    } catch (error) {
      this.logger.error(
        'Falha ao entregar mensagem de recuperação de password.',
        error instanceof Error ? error.stack : undefined,
      );
      return false;
    }
  }
}
