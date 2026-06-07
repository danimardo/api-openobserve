import { Module } from '@nestjs/common';
import { AppConfigModule } from '../config/config.module';
import { OpenObserveClient } from './openobserve-client';
import { O2IngestClient } from './ingest';
import { O2SearchClient } from './search';

@Module({
  imports: [AppConfigModule],
  providers: [OpenObserveClient, O2IngestClient, O2SearchClient],
  exports: [OpenObserveClient, O2IngestClient, O2SearchClient],
})
export class OpenObserveModule {}
