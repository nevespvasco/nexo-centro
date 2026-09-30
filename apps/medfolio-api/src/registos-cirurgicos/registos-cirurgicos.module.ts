import { Module } from '@nestjs/common';
import { JwtModule } from '../auth/jwt.module';
import { RegistosCirurgicosController } from './registos-cirurgicos.controller';
import { RegistosCirurgicosService } from './registos-cirurgicos.service';

@Module({
  imports: [JwtModule],
  controllers: [RegistosCirurgicosController],
  providers: [RegistosCirurgicosService],
})
export class RegistosCirurgicosModule {}
