import { Module } from '@nestjs/common';
import { JwtModule } from '../auth/jwt.module';
import { FuncoesCirurgiaoController } from './funcoes-cirurgiao.controller';
import { FuncoesCirurgiaoService } from './funcoes-cirurgiao.service';

@Module({
  imports: [JwtModule],
  controllers: [FuncoesCirurgiaoController],
  providers: [FuncoesCirurgiaoService],
})
export class FuncoesCirurgiaoModule {}
