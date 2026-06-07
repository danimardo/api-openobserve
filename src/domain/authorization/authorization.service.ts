import { Injectable } from '@nestjs/common';
import { type ApiKey } from '../schemas/api-key.schema';
import { DomainError } from '../errors/domain-errors';

@Injectable()
export class AuthorizationService {
  canWrite(apiKey: ApiKey, service: string): boolean {
    if (!apiKey.scopes.includes('write')) return false;
    if (apiKey.services[0] === '*') return false;
    return apiKey.services.includes(service);
  }

  canRead(apiKey: ApiKey, service: string): boolean {
    if (!apiKey.scopes.includes('read')) return false;
    const svc = apiKey.services[0];
    return svc === '*' || apiKey.services.includes(service);
  }

  assertWrite(apiKey: ApiKey, service: string): void {
    if (!this.canWrite(apiKey, service)) {
      throw new DomainError(
        'forbidden',
        `Key "${apiKey.id}" is not authorized to write to service "${service}"`,
      );
    }
  }

  assertRead(apiKey: ApiKey, service: string): void {
    if (!this.canRead(apiKey, service)) {
      throw new DomainError(
        'forbidden',
        `Key "${apiKey.id}" is not authorized to read from service "${service}"`,
      );
    }
  }

  isWildcard(apiKey: ApiKey): boolean {
    return apiKey.services[0] === '*';
  }

  isFrontend(apiKey: ApiKey): boolean {
    return apiKey.client_type === 'frontend';
  }
}
