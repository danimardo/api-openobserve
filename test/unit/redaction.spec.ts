import { normalizeContext } from '../../src/domain/normalization/normalize-context';
import { SENSITIVE_FIELDS, REDACTED } from '../../src/domain/redaction/sensitive-fields';

describe('Redacción de campos sensibles/PII (FR-014, CA21)', () => {
  const ctx = (obj: Record<string, unknown>) => normalizeContext(obj, 5, 2000, 200);

  it('SENSITIVE_FIELDS incluye campos de la spec (FR-014)', () => {
    const required = [
      'password',
      'token',
      'authorization',
      'cookie',
      'set_cookie',
      'secret',
      'api_key',
      'credit_card',
      'iban',
      'email',
      'phone',
      'telephone',
      'dni',
      'nif',
      'full_name',
      'address',
    ];
    for (const field of required) {
      expect(SENSITIVE_FIELDS.has(field)).toBe(true);
    }
  });

  it('redacta password con valor exacto REDACTED', () => {
    const { context } = ctx({ password: 'hunter2' });
    expect(context['password']).toBe(REDACTED);
  });

  it('redacta token en contexto plano', () => {
    const { context } = ctx({ token: 'eyJhbGciOiJSUzI1NiJ9' });
    expect(context['token']).toBe(REDACTED);
  });

  it('redacta email (PII)', () => {
    const { context } = ctx({ email: 'user@example.com' });
    expect(context['email']).toBe(REDACTED);
  });

  it('redacta phone (PII)', () => {
    const { context } = ctx({ phone: '+34600000000' });
    expect(context['phone']).toBe(REDACTED);
  });

  it('redacta iban (PII)', () => {
    const { context } = ctx({ iban: 'ES9121000418450200051332' });
    expect(context['iban']).toBe(REDACTED);
  });

  it('redacta dni (PII)', () => {
    const { context } = ctx({ dni: '12345678Z' });
    expect(context['dni']).toBe(REDACTED);
  });

  it('redacta nif (PII)', () => {
    const { context } = ctx({ nif: 'B12345678' });
    expect(context['nif']).toBe(REDACTED);
  });

  it('redacta full_name (PII)', () => {
    const { context } = ctx({ full_name: 'John Doe' });
    expect(context['full_name']).toBe(REDACTED);
  });

  it('redacta credit_card', () => {
    const { context } = ctx({ credit_card: '4111111111111111' });
    expect(context['credit_card']).toBe(REDACTED);
  });

  it('no redacta campos no sensibles', () => {
    const { context } = ctx({ request_id: 'abc-123', level: 'info' });
    expect(context['request_id']).toBe('abc-123');
    expect(context['level']).toBe('info');
  });

  it('redacta campos sensibles anidados (clave compuesta)', () => {
    const { context, redactedCount } = ctx({ user: { email: 'x@y.com', name: 'Alice' } });
    expect(context['user.email']).toBe(REDACTED);
    expect(context['user.name']).toBe('Alice');
    expect(redactedCount).toBe(1);
  });

  it('redactedCount refleja el número total de campos redactados', () => {
    const { redactedCount } = ctx({ password: 'a', token: 'b', email: 'c@d.com', ok: 'x' });
    expect(redactedCount).toBe(3);
  });

  it('redacción es insensible a mayúsculas', () => {
    const { context } = ctx({ PASSWORD: 'abc', Email: 'a@b.com' });
    expect(context['PASSWORD']).toBe(REDACTED);
    expect(context['Email']).toBe(REDACTED);
  });
});
