import { randomBytes, createHash } from 'crypto';

function generateKeyId(): string {
  return `key-${randomBytes(8).toString('hex')}`;
}

function generateSecret(): string {
  return randomBytes(32).toString('hex');
}

function hashSecret(secret: string): string {
  return createHash('sha256').update(secret).digest('hex');
}

function main(): void {
  const keyId = generateKeyId();
  const secret = generateSecret();
  const secretHash = hashSecret(secret);
  const bearer = `${keyId}.${secret}`;

  process.stdout.write('=== Log Gateway API Key ===\n');
  process.stdout.write(`key_id:      ${keyId}\n`);
  process.stdout.write(`secret:      ${secret}\n`);
  process.stdout.write(`secret_hash: ${secretHash}\n`);
  process.stdout.write(`bearer:      ${bearer}\n`);
  process.stdout.write('\nAdd to API_KEYS_JSON:\n');
  process.stdout.write(
    JSON.stringify(
      {
        id: keyId,
        secret_hash: secretHash,
        services: ['your_service'],
        scopes: ['write'],
        client_type: 'backend',
        allowed_origins: [],
      },
      null,
      2,
    ) + '\n',
  );
}

main();
