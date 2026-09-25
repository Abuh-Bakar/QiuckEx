/**
 * Exports Module
 * 
 * Provides endpoints for requesting data exports.
 */

import { Module } from '@nestjs/common';
import { ExportsController } from './exports.controller';
import { JobQueueModule } from '../job-queue/job-queue.module';
import { ApiKeysModule } from '../api-keys/api-keys.module';
import { ExportsService } from './exports.service';

@Module({
  imports: [JobQueueModule, ApiKeysModule],
  controllers: [ExportsController],
  providers: [ExportsService],
})
export class ExportsModule {}
