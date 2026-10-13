import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { UsageBillEntity } from './entities/usage-bill.entity';
import { BillingService } from './billing.service';
import { AuthModule } from '../auth/auth.module';
import { BillingController } from './billing.controller';

@Module({
  imports: [TypeOrmModule.forFeature([UsageBillEntity]), AuthModule],
  controllers: [BillingController],
  providers: [BillingService],
  exports: [BillingService]
})
export class BillingModule {}

