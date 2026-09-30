import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { JwtModule } from '../auth/jwt.module';
import { HospitalsModule } from '../hospitals/hospitals.module';
import { ProfileController } from './profile.controller';
import { ProfileService } from './profile.service';

@Module({
  imports: [ConfigModule, JwtModule, HospitalsModule],
  controllers: [ProfileController],
  providers: [ProfileService],
})
export class ProfileModule {}
