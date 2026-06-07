import { createHash, timingSafeEqual } from 'crypto';

describe('Hashing SHA-256 y timingSafeEqual (FR-025, CA15)', () => {
  it('sha256 produce un hash de 64 caracteres hex', () => {
    const hash = createHash('sha256').update('mysecret').digest('hex');
    expect(hash).toHaveLength(64);
    expect(/^[0-9a-f]{64}$/.test(hash)).toBe(true);
  });

  it('el mismo secreto produce el mismo hash (determinista)', () => {
    const secret = 'consistent-secret-value';
    const h1 = createHash('sha256').update(secret).digest('hex');
    const h2 = createHash('sha256').update(secret).digest('hex');
    expect(h1).toBe(h2);
  });

  it('secretos distintos producen hashes distintos', () => {
    const h1 = createHash('sha256').update('secret-a').digest('hex');
    const h2 = createHash('sha256').update('secret-b').digest('hex');
    expect(h1).not.toBe(h2);
  });

  it('timingSafeEqual devuelve true para buffers iguales', () => {
    const secret = 'my-test-secret';
    const hash = createHash('sha256').update(secret).digest('hex');
    const buf1 = Buffer.from(hash, 'hex');
    const buf2 = Buffer.from(hash, 'hex');
    expect(timingSafeEqual(buf1, buf2)).toBe(true);
  });

  it('timingSafeEqual devuelve false para buffers distintos', () => {
    const h1 = createHash('sha256').update('secret-a').digest('hex');
    const h2 = createHash('sha256').update('secret-b').digest('hex');
    const buf1 = Buffer.from(h1, 'hex');
    const buf2 = Buffer.from(h2, 'hex');
    expect(timingSafeEqual(buf1, buf2)).toBe(false);
  });

  it('el token compuesto key_id.secret permite separar por primer punto', () => {
    const keyId = 'key-abc123';
    const secret = 'my.secret.with.dots';
    const token = `${keyId}.${secret}`;
    const dotIndex = token.indexOf('.');
    expect(token.slice(0, dotIndex)).toBe(keyId);
    expect(token.slice(dotIndex + 1)).toBe(secret);
  });
});
