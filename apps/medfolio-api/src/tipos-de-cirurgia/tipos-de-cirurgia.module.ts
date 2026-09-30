import { Module } from '@nestjs/common';
import { JwtModule } from '../auth/jwt.module';
import { TiposDeCirurgiaController } from './tipos-de-cirurgia.controller';
import { TiposDeCirurgiaService } from './tipos-de-cirurgia.service';

@Module({
  imports: [JwtModule],
  controllers: [TiposDeCirurgiaController],
  providers: [TiposDeCirurgiaService],
})
export class TiposDeCirurgiaModule {}
