import { randomUUID, timingSafeEqual } from 'node:crypto'
import type { NextAuthOptions } from 'next-auth'
import Google from 'next-auth/providers/google'
import Credentials from 'next-auth/providers/credentials'
import { uuid } from '@pharmacy/api-contract'
import {
  registerIdentity,
  createSession,
  sessionMember,
  revokeSession,
} from '@pharmacy/db/auth'
import { getPool } from '@pharmacy/db'
import { appendAudit } from '@pharmacy/db/audit'
import { readAuthConfig } from '../../config'
import { loginRole } from './membership'

export function authOptions(requestId: string = randomUUID()): NextAuthOptions {
  const config = readAuthConfig()
  const providers: NextAuthOptions['providers'] = []
  if (config.AUTH_MODE === 'oidc')
    providers.push(
      Google({
        clientId: config.GOOGLE_CLIENT_ID!,
        clientSecret: config.GOOGLE_CLIENT_SECRET!,
        checks: ['pkce', 'state'],
      }),
    )
  if (config.AUTH_MODE === 'test' && config.NODE_ENV !== 'production')
    providers.push(
      Credentials({
        id: 'test',
        name: 'Đăng nhập kiểm thử',
        credentials: {
          email: { label: 'Email kiểm thử', type: 'email' },
          password: { label: 'Mật khẩu kiểm thử', type: 'password' },
        },
        async authorize(credentials) {
          if (
            typeof credentials?.email !== 'string' ||
            typeof credentials?.password !== 'string'
          )
            return null
          const supplied = Buffer.from(credentials.password),
            expected = Buffer.from(config.AUTH_TEST_SECRET!)
          if (
            supplied.length !== expected.length ||
            !timingSafeEqual(supplied, expected)
          )
            return null
          const email = credentials.email.trim().toLowerCase()
          if (!loginRole(email)) return null
          return { id: email, email, name: 'Thành viên kiểm thử' }
        },
      }),
    )
  if (['oidc', 'test', 'guest'].includes(config.AUTH_MODE))
    providers.push(
      Credentials({
        id: 'guest',
        name: 'Tiếp tục ẩn danh',
        credentials: {},
        async authorize() {
          // Never accept a client-selected identity or role for a guest.
          const id = randomUUID()
          return { id, email: `${id}@guest.invalid`, name: 'Khách ẩn danh' }
        },
      }),
    )
  return {
    providers,
    secret: config.NEXTAUTH_SECRET,
    session: { strategy: 'jwt', maxAge: 8 * 60 * 60 },
    jwt: { maxAge: 8 * 60 * 60 },
    useSecureCookies:
      config.NODE_ENV === 'production' ||
      config.NEXTAUTH_URL?.startsWith('https://') === true,
    pages: { signIn: '/login', error: '/login' },
    debug: false,
    logger: {
      error(code) {
        console.error(
          JSON.stringify({
            event: 'auth.error',
            requestId,
            code: /^[A-Z_0-9]+$/.test(code) ? code : 'AUTH_ERROR',
          }),
        )
      },
      warn(code) {
        console.warn(
          JSON.stringify({
            event: 'auth.warning',
            requestId,
            code: /^[A-Z_0-9]+$/.test(code) ? code : 'AUTH_WARNING',
          }),
        )
      },
      debug() {},
    },
    callbacks: {
      async signIn({ user, account, profile }) {
        const email = user.email?.trim().toLowerCase()
        const provider = account?.provider
        const role =
          provider === 'guest' ? 'learner' : email ? loginRole(email) : null
        const verified =
          provider === 'google'
            ? config.AUTH_MODE === 'oidc' &&
              (profile as { email_verified?: boolean } | undefined)
                ?.email_verified === true
            : provider === 'guest'
              ? ['oidc', 'test', 'guest'].includes(config.AUTH_MODE) &&
                uuid.safeParse(user.id).success &&
                email === `${user.id}@guest.invalid` &&
                account?.providerAccountId === user.id
              : provider === 'test' &&
                config.AUTH_MODE === 'test' &&
                config.NODE_ENV !== 'production'
        if (
          !email ||
          !role ||
          !verified ||
          (provider !== 'google' &&
            provider !== 'test' &&
            provider !== 'guest') ||
          !account?.providerAccountId
        ) {
          await appendAudit(getPool(), {
            actorId: null,
            action: 'auth.denied',
            entityType: 'identity',
            details: { reason: 'invalid_or_unverified_identity' },
            requestId,
          })
          return false
        }
        let member
        try {
          member = await registerIdentity({
            provider,
            subject: account.providerAccountId,
            email,
            name: user.name ?? email.split('@')[0]!,
            role,
          })
        } catch {
          console.error(
            JSON.stringify({
              event: 'auth.identity_failed',
              requestId,
              code: 'IDENTITY_UNAVAILABLE',
            }),
          )
          return false
        }
        if (!member) return false
        user.id = member.id
        return true
      },
      async jwt({ token, user, account }) {
        if (user && account) {
          const sid = await createSession(user.id, account.provider, requestId)
          return { sub: user.id, sid }
        }
        return token
      },
      async session({ session, token }) {
        if (
          typeof token.sub !== 'string' ||
          typeof token.sid !== 'string' ||
          !uuid.safeParse(token.sub).success ||
          !uuid.safeParse(token.sid).success
        )
          return { ...session, user: undefined }
        const member = await sessionMember(token.sub, token.sid)
        const configuredRole = member ? loginRole(member.email) : null
        if (!member || !configuredRole) return { ...session, user: undefined }
        const role =
          member.role === 'admin' && configuredRole === 'admin'
            ? 'admin'
            : 'learner'
        return {
          ...session,
          user: { id: member.id, name: member.name, email: member.email, role },
        }
      },
      async redirect({ url, baseUrl }) {
        try {
          const candidate = new URL(url, baseUrl)
          return candidate.origin ===
            new URL(config.NEXTAUTH_URL ?? baseUrl).origin
            ? candidate.toString()
            : baseUrl
        } catch {
          return baseUrl
        }
      },
    },
    events: {
      async signOut({ token }) {
        if (
          typeof token?.sub === 'string' &&
          typeof token.sid === 'string' &&
          uuid.safeParse(token.sub).success &&
          uuid.safeParse(token.sid).success
        )
          await revokeSession(token.sub, token.sid, requestId)
      },
    },
  }
}
