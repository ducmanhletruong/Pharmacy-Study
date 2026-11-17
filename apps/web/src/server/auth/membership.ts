import { readAuthConfig } from '../../config'
import type { Role } from '@pharmacy/core/authz'
export function invitedRole(email: string): Role | null {
  const config = readAuthConfig()
  const normalized = email.trim().toLowerCase()
  if (config.admins.includes(normalized)) return 'admin'
  return config.invited.includes(normalized) ? 'learner' : null
}
