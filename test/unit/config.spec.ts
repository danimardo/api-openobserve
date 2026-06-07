import { EnvSchema } from '../../src/infrastructure/config/env.schema';
import { loadApiKeys } from '../../src/infrastructure/config/api-keys';

const VALID_KEY = {
  id: 'test-key-001',
  secret_hash: 'a'.repeat(64),
  services: ['payments_api'],
  scopes: ['write', 'read'],
  client_type: 'backend',
};

const BASE_ENV = {
  O2_URL: 'http://localhost:5080',
  O2_ORG: 'default',
  O2_AUTH_USER: 'user',
  O2_AUTH_PASSWORD: 'pass',
};

describe('EnvSchema', () => {
  it('parses required fields and applies defaults', () => {
    const result = EnvSchema.safeParse(BASE_ENV);
    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.data.PORT).toBe(3000);
    expect(result.data.NODE_ENV).toBe('development');
    expect(result.data.RATE_LIMIT_RPS).toBe(100);
    expect(result.data.METRICS_ENABLED).toBe(true);
  });

  it('coerces numeric strings', () => {
    const result = EnvSchema.safeParse({ ...BASE_ENV, PORT: '8080' });
    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.data.PORT).toBe(8080);
  });

  it('parses ALLOWED_ENVS as array', () => {
    const result = EnvSchema.safeParse({
      ...BASE_ENV,
      ALLOWED_ENVS: 'production,staging',
    });
    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.data.ALLOWED_ENVS).toEqual(['production', 'staging']);
  });

  it('fails when O2_URL is missing', () => {
    const rest = { ...BASE_ENV };
    delete (rest as Partial<typeof BASE_ENV>).O2_URL;
    const result = EnvSchema.safeParse(rest);
    expect(result.success).toBe(false);
  });

  it('fails when O2_URL is not a valid URL', () => {
    const result = EnvSchema.safeParse({ ...BASE_ENV, O2_URL: 'not-a-url' });
    expect(result.success).toBe(false);
  });

  it('parses METRICS_ENABLED from string "true"', () => {
    const result = EnvSchema.safeParse({ ...BASE_ENV, METRICS_ENABLED: 'true' });
    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.data.METRICS_ENABLED).toBe(true);
  });

  it('parses METRICS_ENABLED from string "false"', () => {
    const result = EnvSchema.safeParse({ ...BASE_ENV, METRICS_ENABLED: 'false' });
    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.data.METRICS_ENABLED).toBe(false);
  });
});

describe('loadApiKeys', () => {
  it('loads a valid key from JSON string', () => {
    const map = loadApiKeys({
      API_KEYS_JSON: JSON.stringify([VALID_KEY]),
      API_KEYS_FILE: undefined,
      NODE_ENV: 'development',
    });
    expect(map.size).toBe(1);
    expect(map.has('test-key-001')).toBe(true);
  });

  it('throws when neither source is set', () => {
    expect(() =>
      loadApiKeys({ API_KEYS_JSON: undefined, API_KEYS_FILE: undefined, NODE_ENV: 'development' }),
    ).toThrow('Neither API_KEYS_JSON nor API_KEYS_FILE');
  });

  it('throws on invalid JSON', () => {
    expect(() =>
      loadApiKeys({ API_KEYS_JSON: 'not-json', API_KEYS_FILE: undefined, NODE_ENV: 'development' }),
    ).toThrow('not valid JSON');
  });

  it('throws when secret_hash is not a valid SHA-256 hex string', () => {
    const invalidKey = { ...VALID_KEY, secret_hash: 'tooshort' };
    expect(() =>
      loadApiKeys({
        API_KEYS_JSON: JSON.stringify([invalidKey]),
        API_KEYS_FILE: undefined,
        NODE_ENV: 'development',
      }),
    ).toThrow();
  });

  it('rejects services:["*"] in production (FR-023)', () => {
    const wildcardKey = { ...VALID_KEY, services: ['*'] };
    expect(() =>
      loadApiKeys({
        API_KEYS_JSON: JSON.stringify([wildcardKey]),
        API_KEYS_FILE: undefined,
        NODE_ENV: 'production',
      }),
    ).toThrow('not allowed in production');
  });

  it('allows services:["*"] in development', () => {
    const wildcardKey = { ...VALID_KEY, services: ['*'], scopes: ['read'] };
    expect(() =>
      loadApiKeys({
        API_KEYS_JSON: JSON.stringify([wildcardKey]),
        API_KEYS_FILE: undefined,
        NODE_ENV: 'development',
      }),
    ).not.toThrow();
  });

  it('rejects frontend key with log_gateway stream (FR-024)', () => {
    const frontendKey = {
      ...VALID_KEY,
      client_type: 'frontend',
      services: ['log_gateway'],
      scopes: ['read'],
    };
    expect(() =>
      loadApiKeys({
        API_KEYS_JSON: JSON.stringify([frontendKey]),
        API_KEYS_FILE: undefined,
        NODE_ENV: 'development',
      }),
    ).toThrow('reserved streams');
  });

  it('rejects duplicate key ids', () => {
    expect(() =>
      loadApiKeys({
        API_KEYS_JSON: JSON.stringify([VALID_KEY, VALID_KEY]),
        API_KEYS_FILE: undefined,
        NODE_ENV: 'development',
      }),
    ).toThrow('Duplicate key id');
  });
});
