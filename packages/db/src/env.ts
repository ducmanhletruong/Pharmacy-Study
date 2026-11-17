// CLI-only: never import the local .env loader from a web route.
export function loadLocalEnv() {
  try {
    process.loadEnvFile(new URL('../../../.env', import.meta.url))
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error
  }
}
