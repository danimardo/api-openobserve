import { Injectable } from '@nestjs/common';
import { EnvSchema, type AppEnv } from './env.schema';

@Injectable()
export class AppConfigService {
  readonly env: Readonly<AppEnv>;

  constructor() {
    const result = EnvSchema.safeParse(process.env);
    if (!result.success) {
      const formatted = result.error.issues
        .map((i) => `  ${i.path.join('.')}: ${i.message}`)
        .join('\n');
      throw new Error(`[CONFIG] Bootstrap failed — invalid environment:\n${formatted}`);
    }
    this.env = Object.freeze(result.data);
  }
}
