/**
 * Verificación de build de imagen y arranque con healthcheck (CA17, US13).
 * Este test verifica la configuración de Dockerfile sin ejecutar Docker en CI.
 * Para un test de imagen completo, ejecutar el script documentado en deploy-check.sh.
 */
import { readFileSync, existsSync } from 'fs';
import { resolve } from 'path';

const ROOT = resolve(__dirname, '..', '..');

describe('Dockerfile — estructura y requisitos (CA17, FR-039)', () => {
  let dockerfile: string;

  beforeAll(() => {
    const path = resolve(ROOT, 'Dockerfile');
    if (!existsSync(path)) throw new Error('Dockerfile no encontrado en la raíz del proyecto');
    dockerfile = readFileSync(path, 'utf-8');
  });

  it('usa imagen base node:24.16.0-bookworm-slim en runtime', () => {
    expect(dockerfile).toMatch(/FROM node:24\.16\.0-bookworm-slim AS runtime/);
  });

  it('aplica multi-stage (builder + runtime)', () => {
    expect(dockerfile).toMatch(/FROM .+ AS builder/);
    expect(dockerfile).toMatch(/FROM .+ AS runtime/);
  });

  it('no ejecuta como root (USER appuser)', () => {
    expect(dockerfile).toMatch(/USER appuser/);
    expect(dockerfile).toMatch(/useradd/);
  });

  it('expone el puerto 3000', () => {
    expect(dockerfile).toMatch(/EXPOSE 3000/);
  });

  it('configura HEALTHCHECK apuntando a /api/v1/health/ready', () => {
    expect(dockerfile).toMatch(/HEALTHCHECK/);
    expect(dockerfile).toMatch(/health\/ready/);
  });

  it('usa --omit=dev para instalar solo deps de producción en runtime', () => {
    expect(dockerfile).toMatch(/--omit=dev/);
  });

  it('arranca con node dist/main (no devDeps)', () => {
    expect(dockerfile).toMatch(/CMD.*node.*dist\/main/);
  });
});

describe('.env.example — presente y sin secretos reales (FR-039)', () => {
  it('existe .env.example en la raíz', () => {
    expect(existsSync(resolve(ROOT, '.env.example'))).toBe(true);
  });

  it('.env.example no contiene secretos reales (no tokens de 32+ chars hex)', () => {
    const content = readFileSync(resolve(ROOT, '.env.example'), 'utf-8');
    // No debe haber un hash SHA-256 real (64 chars hex consecutivos)
    expect(content).not.toMatch(/[0-9a-f]{64}/);
  });
});

describe('Colección Postman — presente y válida (FR-039, D25)', () => {
  it('existe postman/log-gateway.postman_collection.json', () => {
    expect(existsSync(resolve(ROOT, 'postman', 'log-gateway.postman_collection.json'))).toBe(true);
  });

  it('usa schema 2.1.0 de Postman', () => {
    const raw = readFileSync(
      resolve(ROOT, 'postman', 'log-gateway.postman_collection.json'),
      'utf-8',
    );
    const collection = JSON.parse(raw) as { info?: { schema?: string } };
    expect(collection.info?.schema).toContain('v2.1.0');
  });

  it('incluye los endpoints principales', () => {
    const raw = readFileSync(
      resolve(ROOT, 'postman', 'log-gateway.postman_collection.json'),
      'utf-8',
    );
    expect(raw).toMatch(/health/);
    expect(raw).toMatch(/metrics/);
    expect(raw).toMatch(/services/);
    expect(raw).toMatch(/logs/);
  });
});

describe('README.md — presente y completo (FR-039)', () => {
  it('existe README.md en la raíz', () => {
    expect(existsSync(resolve(ROOT, 'README.md'))).toBe(true);
  });

  it('documenta variables de entorno obligatorias', () => {
    const content = readFileSync(resolve(ROOT, 'README.md'), 'utf-8');
    expect(content).toMatch(/O2_URL/);
    expect(content).toMatch(/O2_AUTH_PASSWORD/);
    expect(content).toMatch(/API_KEYS/);
  });

  it('incluye ejemplo de scrape_config para Prometheus', () => {
    const content = readFileSync(resolve(ROOT, 'README.md'), 'utf-8');
    expect(content).toMatch(/scrape_config/);
  });

  it('documenta pasos de despliegue en Coolify', () => {
    const content = readFileSync(resolve(ROOT, 'README.md'), 'utf-8');
    expect(content).toMatch(/Coolify/i);
  });
});
