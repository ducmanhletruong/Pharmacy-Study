import { z } from 'zod'

const schema = z.object({
  AUTH_MODE: z.enum(['dev', 'disabled', 'oidc', 'test']).default('disabled'),
  NODE_ENV: z.string().default('development'),
  PORT: z.coerce.number().int().min(1).max(65535).default(3000),
  DEV_HOST: z
    .enum(['127.0.0.1', '0.0.0.0', 'localhost', '::1'])
    .default('127.0.0.1'),
  MAX_BODY_BYTES: z.coerce.number().int().min(1).max(1048576).default(16384),
  NEXTAUTH_URL: z.string().optional(),
  APP_ORIGIN: z.string().optional(),
  NEXTAUTH_SECRET: z.string().optional(),
  GOOGLE_CLIENT_ID: z.string().optional(),
  GOOGLE_CLIENT_SECRET: z.string().optional(),
  AUTH_TEST_SECRET: z.string().optional(),
  ADMIN_EMAILS: z.string().default(''),
  INVITED_EMAILS: z.string().default(''),
  RATE_LIMIT_AUTH_GLOBAL: z.coerce
    .number()
    .int()
    .min(1)
    .max(100000)
    .default(1200),
  RATE_LIMIT_AUTH: z.coerce.number().int().min(1).max(10000).default(120),
  RATE_LIMIT_ATTEMPT_CREATE: z.coerce
    .number()
    .int()
    .min(1)
    .max(10000)
    .default(20),
  RATE_LIMIT_ITEM_WRITE: z.coerce.number().int().min(1).max(10000).default(120),
})
function emails(value: string) {
  const values = [
    ...new Set(
      value
        .split(',')
        .map((s) => s.trim().toLowerCase())
        .filter(Boolean),
    ),
  ]
  if (values.some((email) => !z.email().safeParse(email).success))
    throw new Error('Invalid invitation email configuration')
  return values
}
export function readAuthConfig(
  env: Record<string, string | undefined> = process.env,
) {
  if (
    env.NODE_ENV === 'production' &&
    (env.AUTH_MODE === 'dev' || env.AUTH_MODE === 'test')
  )
    throw new Error(`AUTH_MODE=${env.AUTH_MODE} is forbidden in production`)
  const parsed = schema.safeParse(env)
  if (!parsed.success)
    throw new Error(
      `Invalid authentication configuration: ${[...new Set(parsed.error.issues.map((issue) => issue.path.join('.')))].join(', ')}`,
    )
  const config = parsed.data
  if (config.NODE_ENV === 'production' && !config.APP_ORIGIN)
    throw new Error('APP_ORIGIN is required in production')
  let configuredOrigin: URL | undefined
  if (config.APP_ORIGIN) {
    try {
      configuredOrigin = new URL(config.APP_ORIGIN)
    } catch {
      throw new Error('Invalid APP_ORIGIN configuration')
    }
    if (
      !['http:', 'https:'].includes(configuredOrigin.protocol) ||
      configuredOrigin.pathname !== '/' ||
      configuredOrigin.username ||
      configuredOrigin.password ||
      configuredOrigin.search ||
      configuredOrigin.hash
    )
      throw new Error(
        'APP_ORIGIN must be an origin without credentials or path',
      )
  }
  const admins = emails(config.ADMIN_EMAILS),
    invited = emails(config.INVITED_EMAILS)
  if (config.AUTH_MODE === 'oidc' || config.AUTH_MODE === 'test') {
    if (
      !config.NEXTAUTH_SECRET ||
      config.NEXTAUTH_SECRET.length < 32 ||
      !config.NEXTAUTH_URL ||
      admins.length === 0
    )
      throw new Error(
        'Configure NEXTAUTH_SECRET, NEXTAUTH_URL and ADMIN_EMAILS privately',
      )
    let url: URL
    try {
      url = new URL(config.NEXTAUTH_URL)
    } catch {
      throw new Error('Invalid NEXTAUTH_URL')
    }
    if (
      !['http:', 'https:'].includes(url.protocol) ||
      url.pathname !== '/' ||
      url.username ||
      url.password ||
      url.search ||
      url.hash
    )
      throw new Error(
        'NEXTAUTH_URL must be an origin without credentials or path',
      )
    if (config.NODE_ENV === 'production' && url.protocol !== 'https:')
      throw new Error('Production authentication requires HTTPS')
    if (configuredOrigin && configuredOrigin.origin !== url.origin)
      throw new Error('APP_ORIGIN must match NEXTAUTH_URL')
    if (
      config.AUTH_MODE === 'oidc' &&
      (!config.GOOGLE_CLIENT_ID?.trim() || !config.GOOGLE_CLIENT_SECRET?.trim())
    )
      throw new Error('Configure Google OAuth client credentials privately')
    if (
      config.AUTH_MODE === 'test' &&
      (!config.AUTH_TEST_SECRET || config.AUTH_TEST_SECRET.length < 24)
    )
      throw new Error(
        'Test authentication requires an explicit test-only secret',
      )
  }
  return { ...config, admins, invited }
}
export function assertAuthMode(
  env: Record<string, string | undefined> = process.env,
) {
  readAuthConfig(env)
}
