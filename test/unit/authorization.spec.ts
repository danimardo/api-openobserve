import { AuthorizationService } from '../../src/domain/authorization/authorization.service';
import type { ApiKey } from '../../src/domain/schemas/api-key.schema';
import { DomainError } from '../../src/domain/errors/domain-errors';

function makeKey(overrides: Partial<ApiKey> = {}): ApiKey {
  return {
    id: 'test-key',
    secret_hash: 'a'.repeat(64),
    services: ['payments_api'],
    scopes: ['write', 'read'],
    client_type: 'backend',
    allowed_origins: [],
    ...overrides,
  };
}

describe('AuthorizationService (FR-021, FR-022, FR-023)', () => {
  const auth = new AuthorizationService();

  // --- canWrite ---
  describe('canWrite', () => {
    it('permite write con scope write y service autorizado', () => {
      expect(auth.canWrite(makeKey({ scopes: ['write'] }), 'payments_api')).toBe(true);
    });

    it('deniega write sin scope write', () => {
      expect(auth.canWrite(makeKey({ scopes: ['read'] }), 'payments_api')).toBe(false);
    });

    it('deniega write para services:["*"] (FR-023)', () => {
      expect(auth.canWrite(makeKey({ services: ['*'] }), 'any_service')).toBe(false);
    });

    it('deniega write a service no incluido en la key', () => {
      expect(auth.canWrite(makeKey({ services: ['web_shop'] }), 'payments_api')).toBe(false);
    });
  });

  // --- canRead ---
  describe('canRead', () => {
    it('permite read con scope read y service autorizado', () => {
      expect(auth.canRead(makeKey({ scopes: ['read'] }), 'payments_api')).toBe(true);
    });

    it('permite read a cualquier service con services:["*"] (FR-023)', () => {
      expect(auth.canRead(makeKey({ services: ['*'], scopes: ['read'] }), 'any_service')).toBe(
        true,
      );
    });

    it('deniega read sin scope read', () => {
      expect(auth.canRead(makeKey({ scopes: ['write'] }), 'payments_api')).toBe(false);
    });

    it('deniega read a service no autorizado', () => {
      expect(
        auth.canRead(makeKey({ services: ['web_shop'], scopes: ['read'] }), 'payments_api'),
      ).toBe(false);
    });
  });

  // --- assertWrite ---
  describe('assertWrite', () => {
    it('no lanza si puede escribir', () => {
      expect(() => auth.assertWrite(makeKey(), 'payments_api')).not.toThrow();
    });

    it('lanza DomainError forbidden si no puede escribir', () => {
      expect(() => auth.assertWrite(makeKey({ scopes: ['read'] }), 'payments_api')).toThrow(
        DomainError,
      );
    });

    it('el error lanzado tiene código forbidden', () => {
      try {
        auth.assertWrite(makeKey({ services: ['*'] }), 'payments_api');
      } catch (e) {
        expect(e).toBeInstanceOf(DomainError);
        expect((e as DomainError).code).toBe('forbidden');
      }
    });
  });

  // --- assertRead ---
  describe('assertRead', () => {
    it('no lanza si puede leer', () => {
      expect(() => auth.assertRead(makeKey({ scopes: ['read'] }), 'payments_api')).not.toThrow();
    });

    it('lanza DomainError forbidden si no puede leer', () => {
      expect(() => auth.assertRead(makeKey({ scopes: ['write'] }), 'payments_api')).toThrow(
        DomainError,
      );
    });
  });

  // --- isWildcard ---
  describe('isWildcard', () => {
    it('devuelve true para services:["*"]', () => {
      expect(auth.isWildcard(makeKey({ services: ['*'] }))).toBe(true);
    });

    it('devuelve false para services específicos', () => {
      expect(auth.isWildcard(makeKey({ services: ['payments_api'] }))).toBe(false);
    });
  });

  // --- isFrontend ---
  describe('isFrontend', () => {
    it('devuelve true para client_type frontend', () => {
      expect(auth.isFrontend(makeKey({ client_type: 'frontend' }))).toBe(true);
    });

    it('devuelve false para client_type backend', () => {
      expect(auth.isFrontend(makeKey({ client_type: 'backend' }))).toBe(false);
    });
  });
});
