import { Module } from '@nestjs/common';
import { JwtModule } from '../auth/jwt.module';
import { CirurgiasPorAreaController } from './cirurgias-por-area.controller';
import { CirurgiasPorAreaService } from './cirurgias-por-area.service';

@Module({
  imports: [JwtModule],
  controllers: [CirurgiasPorAreaController],
  providers: [CirurgiasPorAreaService],
})
export class CirurgiasPorAreaModule {}
