import { Module } from '@nestjs/common';
import { AdminAuthController } from './admin-auth.controller';
import { AdminAuthService } from './admin-auth.service';
import { AdminUsersController } from './admin-users.controller';
import { AdminUsersService } from './admin-users.service';
import { AdminDashboardController } from './admin-dashboard.controller';
import { AdminDashboardService } from './admin-dashboard.service';
import { AdminHospitalsController } from './admin-hospitals.controller';
import { AdminHospitalsService } from './admin-hospitals.service';
import { JwtModule } from '../auth/jwt.module';
import { AdminGuard } from './admin.guard';

@Module({
  imports: [JwtModule],
  controllers: [
    AdminAuthController,
    AdminUsersController,
    AdminDashboardController,
    AdminHospitalsController,
  ],
  providers: [
    AdminAuthService,
    AdminUsersService,
    AdminDashboardService,
    AdminHospitalsService,
    AdminGuard,
  ],
})
export class AdminModule {}
