import { Module } from '@nestjs/common';
import { JwtModule } from '../auth/jwt.module';
import { FormacoesController } from './formacoes.controller';
import { FormacoesService } from './formacoes.service';

@Module({
  imports: [JwtModule],
  controllers: [FormacoesController],
  providers: [FormacoesService],
})
export class FormacoesModule {}
