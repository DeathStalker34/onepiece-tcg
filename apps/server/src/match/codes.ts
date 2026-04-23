const ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // no 0/O/1/I
const LENGTH = 6;
const MAX_ATTEMPTS = 50;

function randomCode(): string {
  let out = '';
  for (let i = 0; i < LENGTH; i += 1) {
    out += ALPHABET[Math.floor(Math.random() * ALPHABET.length)];
  }
  return out;
}

export function generateMatchCode(exists: (code: string) => boolean): string {
  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt += 1) {
    const code = randomCode();
    if (!exists(code)) return code;
  }
  throw new Error('match code collision — no free code found');
}
