import { Module } from '@nestjs/common';
import { JwtModule } from '../auth/jwt.module';
import { ProcedimentosController } from './procedimentos.controller';
import { ProcedimentosService } from './procedimentos.service';

@Module({
  imports: [JwtModule],
  controllers: [ProcedimentosController],
  providers: [ProcedimentosService],
})
export class ProcedimentosModule {}
