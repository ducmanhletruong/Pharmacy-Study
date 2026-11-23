import { z } from 'zod'
import { readAuthConfig } from '../../config'
import type { Role } from '@pharmacy/core/authz'
export function loginRole(email: string): Role | null {
  const normalized = email.trim().toLowerCase()
  if (!z.email().safeParse(normalized).success) return null
  return readAuthConfig().admins.includes(normalized) ? 'admin' : 'learner'
}
