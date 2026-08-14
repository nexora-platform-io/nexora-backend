import bcrypt from 'bcrypt';

const SALT_ROUNDS = 10;

export function hashValue(value: string) {
  return bcrypt.hash(value, SALT_ROUNDS);
}

export function compareHash(value: string, valueHash: string) {
  return bcrypt.compare(value, valueHash);
}
