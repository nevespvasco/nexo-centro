import { Module } from '@nestjs/common';
import { JwtModule } from '../auth/jwt.module';
import { DiagnosticosController } from './diagnosticos.controller';
import { DiagnosticosService } from './diagnosticos.service';

@Module({
  imports: [JwtModule],
  controllers: [DiagnosticosController],
  providers: [DiagnosticosService],
})
export class DiagnosticosModule {}
