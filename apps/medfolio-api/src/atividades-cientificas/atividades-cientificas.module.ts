import { Module } from '@nestjs/common';
import { JwtModule } from '../auth/jwt.module';
import { AtividadesCientificasController } from './atividades-cientificas.controller';
import { AtividadesCientificasService } from './atividades-cientificas.service';

@Module({
  imports: [JwtModule],
  controllers: [AtividadesCientificasController],
  providers: [AtividadesCientificasService],
})
export class AtividadesCientificasModule {}
