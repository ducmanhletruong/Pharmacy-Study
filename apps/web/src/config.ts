export function assertAuthMode(
  env: Record<string, string | undefined> = process.env,
) {
  if (env.AUTH_MODE && !['dev', 'disabled'].includes(env.AUTH_MODE))
    throw new Error('Unsupported AUTH_MODE')
  if (env.AUTH_MODE === 'dev' && env.NODE_ENV === 'production')
    throw new Error('AUTH_MODE=dev is forbidden in production')
}
