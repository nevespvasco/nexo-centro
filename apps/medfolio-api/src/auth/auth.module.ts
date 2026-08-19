import { Module } from '@nestjs/common';
import { HospitalsModule } from '../hospitals/hospitals.module';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { JwtModule } from './jwt.module';
import { TwoFactorService } from './two-factor.service';

@Module({
  imports: [JwtModule, HospitalsModule],
  controllers: [AuthController],
  providers: [AuthService, TwoFactorService],
})
export class AuthModule {}
