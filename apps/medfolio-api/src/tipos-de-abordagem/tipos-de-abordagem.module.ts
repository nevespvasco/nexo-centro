import { Module } from '@nestjs/common';
import { JwtModule } from '../auth/jwt.module';
import { TiposDeAbordagemController } from './tipos-de-abordagem.controller';
import { TiposDeAbordagemService } from './tipos-de-abordagem.service';

@Module({
  imports: [JwtModule],
  controllers: [TiposDeAbordagemController],
  providers: [TiposDeAbordagemService],
})
export class TiposDeAbordagemModule {}
