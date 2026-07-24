/** Typed environment access. Fails fast if a required secret is missing. */

function required(key: string): string {
  const v = process.env[key];
  if (!v) throw new Error(`Missing required env var: ${key}`);
  return v;
}

function optional(key: string, fallback: string): string {
  return process.env[key] ?? fallback;
}

export const env = {
  get databaseUrl(): string {
    return required('DATABASE_URL');
  },
  get jwtSecret(): string {
    return optional('JWT_SECRET', 'dev_only_change_me');
  },
  get jwtExpiresIn(): string {
    return optional('JWT_EXPIRES_IN', '15m');
  },
  get otpTtlSeconds(): number {
    return Number(optional('OTP_TTL_SECONDS', '100'));
  },
  get otpMaxAttempts(): number {
    return Number(optional('OTP_MAX_ATTEMPTS', '3'));
  },
  get loginMaxAttempts(): number {
    return Number(optional('LOGIN_MAX_ATTEMPTS', '5'));
  },
  smtp: {
    get host(): string {
      return optional('SMTP_HOST', 'smtp.zoho.in');
    },
    get port(): number {
      return Number(optional('SMTP_PORT', '465'));
    },
    get secure(): boolean {
      return optional('SMTP_SECURE', 'true') === 'true';
    },
    get user(): string {
      return optional('EMAIL_USER', '');
    },
    get pass(): string {
      return optional('EMAIL_PASS', '');
    },
    get to(): string {
      return optional('EMAIL_USER_TO', '');
    },
  },
  // Sentinel Fusion AI — the ML scoring service (Phase 2). When `enabled`, the
  // HttpScorer replaces the HeuristicScorer behind the SCORER token; on any model
  // error/timeout it fails open to the heuristic so the money path never hangs.
  sentinel: {
    get enabled(): boolean {
      return optional('SENTINEL_ENABLED', 'false') === 'true';
    },
    get url(): string {
      // Backend runs in Docker: host.docker.internal reaches the model on the host.
      return optional('SENTINEL_URL', 'http://host.docker.internal:8000');
    },
    get apiKey(): string {
      return optional('SENTINEL_API_KEY', 'sentinel-demo-key-2026');
    },
    get timeoutMs(): number {
      return Number(optional('SENTINEL_TIMEOUT_MS', '800'));
    },
  },
};
