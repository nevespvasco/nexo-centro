import { Module } from '@nestjs/common';
import { JwtModule } from '../auth/jwt.module';
import { UtentesController } from './utentes.controller';
import { UtentesService } from './utentes.service';

@Module({
  imports: [JwtModule],
  controllers: [UtentesController],
  providers: [UtentesService],
})
export class UtentesModule {}
