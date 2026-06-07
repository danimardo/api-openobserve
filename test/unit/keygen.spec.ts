import { randomBytes, createHash, timingSafeEqual } from 'crypto';

// Testeamos la lógica del keygen de forma unitaria sin ejecutar el script
function generateKeyId(): string {
  return `key-${randomBytes(8).toString('hex')}`;
}
function generateSecret(): string {
  return randomBytes(32).toString('hex');
}
function hashSecret(secret: string): string {
  return createHash('sha256').update(secret).digest('hex');
}

describe('Generador keygen (FR-026, CA15)', () => {
  it('generateKeyId produce un id que comienza con "key-"', () => {
    const id = generateKeyId();
    expect(id).toMatch(/^key-[0-9a-f]{16}$/);
  });

  it('generateSecret produce 64 caracteres hex', () => {
    const secret = generateSecret();
    expect(secret).toHaveLength(64);
    expect(/^[0-9a-f]{64}$/.test(secret)).toBe(true);
  });

  it('generateSecret produce valores únicos en cada llamada (entropía)', () => {
    const s1 = generateSecret();
    const s2 = generateSecret();
    expect(s1).not.toBe(s2);
  });

  it('hashSecret produce hash SHA-256 de 64 chars hex', () => {
    const hash = hashSecret('test-secret');
    expect(hash).toHaveLength(64);
    expect(/^[0-9a-f]{64}$/.test(hash)).toBe(true);
  });

  it('el token bearer tiene formato key_id.secret', () => {
    const id = generateKeyId();
    const secret = generateSecret();
    const bearer = `${id}.${secret}`;
    expect(bearer).toContain('.');
    const [parsedId, ...rest] = bearer.split('.');
    expect(parsedId).toBe(id);
    expect(rest.join('.')).toBe(secret);
  });

  it('el hash del secret coincide con el bearer verificado mediante timingSafeEqual', () => {
    const secret = generateSecret();
    const storedHash = hashSecret(secret);
    const incomingHash = hashSecret(secret);
    expect(timingSafeEqual(Buffer.from(storedHash, 'hex'), Buffer.from(incomingHash, 'hex'))).toBe(
      true,
    );
  });
});
