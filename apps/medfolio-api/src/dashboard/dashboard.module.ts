import { Module } from '@nestjs/common';
import { JwtModule } from '../auth/jwt.module';
import { DashboardController } from './dashboard.controller';
import { DashboardService } from './dashboard.service';

@Module({
  imports: [JwtModule],
  controllers: [DashboardController],
  providers: [DashboardService],
})
export class DashboardModule {}
