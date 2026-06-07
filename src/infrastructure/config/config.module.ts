import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AppConfigService } from './app-config.service';

export const API_KEYS_MAP = 'API_KEYS_MAP';

@Module({
  imports: [
    ConfigModule.forRoot({
      ignoreEnvFile: process.env['NODE_ENV'] === 'production',
      envFilePath: '.env',
    }),
  ],
  providers: [AppConfigService],
  exports: [AppConfigService],
})
export class AppConfigModule {}
