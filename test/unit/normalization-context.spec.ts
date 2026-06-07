import { normalizeContext } from '../../src/domain/normalization/normalize-context';

describe('normalizeContext — aplanado, redacción y truncado (FR-012, FR-013, FR-014)', () => {
  it('devuelve el contexto plano tal cual si no hay anidamiento', () => {
    const { context } = normalizeContext({ level: 'info', msg: 'ok' }, 3, 100, 50);
    expect(context).toEqual({ level: 'info', msg: 'ok' });
  });

  it('aplana un objeto anidado con notación de puntos', () => {
    const { context } = normalizeContext({ db: { host: 'localhost', port: 5432 } }, 3, 100, 50);
    expect(context['db.host']).toBe('localhost');
    expect(context['db.port']).toBe(5432);
    expect(context['db']).toBeUndefined();
  });

  it('aplana hasta CONTEXT_MAX_DEPTH y marca truncated al superar el límite', () => {
    const deep = { a: { b: { c: { d: 'deep' } } } };
    const { context, truncated } = normalizeContext(deep, 2, 100, 50);
    expect(truncated).toBe(true);
    // La clave a.b existe pero el valor a.b.c no fue aplanado
    expect(context['a.b']).toBe('[truncated]');
    expect(context['a.b.c']).toBeUndefined();
  });

  it('no marca truncated si la profundidad es suficiente', () => {
    const { truncated } = normalizeContext({ a: { b: 'val' } }, 3, 100, 50);
    expect(truncated).toBe(false);
  });

  it('redacta campos sensibles por nombre (FR-014)', () => {
    const { context, redactedCount } = normalizeContext(
      { user: 'alice', password: 'secret123', email: 'alice@example.com' },
      3,
      100,
      50,
    );
    expect(context['password']).toBe('***redacted***');
    expect(context['email']).toBe('***redacted***');
    expect(context['user']).toBe('alice');
    expect(redactedCount).toBe(2);
  });

  it('redacta campos sensibles en objetos anidados con clave compuesta', () => {
    const { context, redactedCount } = normalizeContext(
      { user: { token: 'abc', name: 'bob' } },
      3,
      100,
      50,
    );
    expect(context['user.token']).toBe('***redacted***');
    expect(context['user.name']).toBe('bob');
    expect(redactedCount).toBe(1);
  });

  it('trunca valores de string que superan maxValueChars y marca truncated', () => {
    const long = 'x'.repeat(200);
    const { context, truncated } = normalizeContext({ msg: long }, 3, 100, 50);
    expect((context['msg'] as string).endsWith('…')).toBe(true);
    expect((context['msg'] as string).length).toBeLessThan(200);
    expect(truncated).toBe(true);
  });

  it('elimina valores no serializables (undefined, NaN, Infinity)', () => {
    const { context } = normalizeContext(
      { a: undefined, b: Number.NaN, c: Infinity, d: 'keep' } as Record<string, unknown>,
      3,
      100,
      50,
    );
    expect(context['a']).toBeUndefined();
    expect(context['b']).toBeUndefined();
    expect(context['c']).toBeUndefined();
    expect(context['d']).toBe('keep');
  });

  it('trunca al límite MAX_FIELDS y marca truncated (FR-013)', () => {
    const large: Record<string, unknown> = {};
    for (let i = 0; i < 10; i++) large[`k${i}`] = i;
    const { context, truncated } = normalizeContext(large, 3, 100, 5);
    expect(Object.keys(context).length).toBe(5);
    expect(truncated).toBe(true);
  });

  it('no marca truncated si no se supera MAX_FIELDS', () => {
    const { truncated } = normalizeContext({ a: 1, b: 2 }, 3, 100, 50);
    expect(truncated).toBe(false);
  });

  it('maneja arrays como valores hoja sin aplanar', () => {
    const { context } = normalizeContext({ tags: ['a', 'b', 'c'] }, 3, 100, 50);
    expect(context['tags']).toEqual(['a', 'b', 'c']);
  });

  it('redacción es insensible a mayúsculas/minúsculas', () => {
    const { redactedCount } = normalizeContext({ Password: 'secret' }, 3, 100, 50);
    expect(redactedCount).toBe(1);
  });
});
