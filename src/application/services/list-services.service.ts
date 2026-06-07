import { Injectable } from '@nestjs/common';
import type { ApiKey } from '../../domain/schemas/api-key.schema';

export interface ServiceCapabilities {
  services: string[];
  scopes: string[];
  client_type: string;
  allowed_origins: string[];
  envs?: string[];
  read_policy?: {
    response_profile: string;
    allow_q: boolean;
    max_query_window: string;
    max_limit: number;
  };
}

@Injectable()
export class ListServicesService {
  getCapabilities(apiKey: ApiKey): ServiceCapabilities {
    const result: ServiceCapabilities = {
      services: apiKey.services,
      scopes: [...apiKey.scopes],
      client_type: apiKey.client_type,
      allowed_origins: apiKey.allowed_origins ?? [],
      ...(apiKey.envs !== undefined ? { envs: apiKey.envs } : {}),
    };

    if (apiKey.read_policy !== undefined) {
      result.read_policy = {
        response_profile: apiKey.read_policy.response_profile,
        allow_q: apiKey.read_policy.allow_q,
        max_query_window: apiKey.read_policy.max_query_window,
        max_limit: apiKey.read_policy.max_limit,
      };
    }

    return result;
  }
}
