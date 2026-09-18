import fs from 'node:fs';
import process from 'node:process';

const envFile = process.argv[2] ?? '.env';

if (!fs.existsSync(envFile)) {
  console.error(`[env] Missing file: ${envFile}`);
  process.exit(1);
}

const fileEnv = Object.fromEntries(
  fs
    .readFileSync(envFile, 'utf8')
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line && !line.startsWith('#'))
    .map((line) => {
      const index = line.indexOf('=');
      if (index < 0) return [line, ''];
      return [line.slice(0, index), line.slice(index + 1)];
    }),
);

Object.assign(process.env, fileEnv);

const required = ['DATABASE_URL', 'JWT_SECRET', 'COOKIE_SECRET'];
const placeholderPatterns = [/^replace-with/i, /USER:PASSWORD@HOST/i, /your-app-domain/i];
const isPlaceholder = (value = '') => placeholderPatterns.some((pattern) => pattern.test(value));
const missing = required.filter((key) => !process.env[key] || isPlaceholder(process.env[key]));
const tooShort = ['JWT_SECRET', 'COOKIE_SECRET'].filter((key) => (process.env[key]?.length ?? 0) < 32);

const mustBeUrl = ['DATABASE_URL', 'PUBLIC_BASE_URL'];
const badUrls = mustBeUrl.filter((key) => {
  const value = process.env[key];
  if (!value || isPlaceholder(value)) return false;
  try {
    new URL(value);
    return false;
  } catch {
    return true;
  }
});

const numeric = [
  'PORT',
  'SESSION_MAX_AGE_SECONDS',
  'MAX_ATTACHMENT_STANDARD_MB',
  'MAX_ATTACHMENT_LARGE_MB',
];
const badNumbers = numeric.filter((key) => {
  const value = process.env[key];
  return value != null && (!Number.isFinite(Number(value)) || Number(value) <= 0);
});

const railwayLike = envFile.includes('railway');
const localProductionDb = (() => {
  if (!railwayLike) return false;
  const value = process.env.DATABASE_URL;
  if (!value || isPlaceholder(value)) return false;
  try {
    return ['localhost', '127.0.0.1', '::1'].includes(new URL(value).hostname);
  } catch {
    return false;
  }
})();

if (missing.length || tooShort.length || badUrls.length || badNumbers.length || localProductionDb) {
  if (missing.length) console.error(`[env] Missing/placeholder: ${missing.join(', ')}`);
  if (tooShort.length) console.error(`[env] Too short: ${tooShort.join(', ')}`);
  if (badUrls.length) console.error(`[env] Invalid URL: ${badUrls.join(', ')}`);
  if (badNumbers.length) console.error(`[env] Invalid number: ${badNumbers.join(', ')}`);
  if (localProductionDb) console.error('[env] Railway DATABASE_URL must not point to localhost.');
  process.exit(1);
}

console.log(`[env] ${envFile} valid`);
