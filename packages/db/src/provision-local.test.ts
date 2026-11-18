import { mkdtemp, readFile, rm, stat } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { pathToFileURL } from 'node:url'
import { expect, test } from 'vitest'
import { provisionLocal, writePrivate } from './provision-local'

test('partial env write preserves credentials for retry without rotating existing roles', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'provision-recovery-')),
    root = pathToFileURL(dir + '/')
  const roles = new Map<string, string>()
  let pending = new Map(roles),
    creates = 0
  let failGrant = true
  const connect = (connectionString: string) => ({
    async query(sql: string, args: string[] = []) {
      const name = new URL(connectionString).username
      if (name !== 'bootstrap') {
        if (
          roles.get(name) !==
          decodeURIComponent(new URL(connectionString).password)
        )
          throw new Error('synthetic auth failure')
        return { rows: [{}] }
      }
      if (sql === 'BEGIN') {
        pending = new Map(roles)
        return { rows: [] }
      }
      if (sql === 'COMMIT') {
        for (const [k, v] of pending) roles.set(k, v)
        return { rows: [] }
      }
      if (sql === 'ROLLBACK') return { rows: [] }
      if (sql.includes('FROM pg_roles'))
        return { rows: pending.has(args[0]!) ? [{ rolcanlogin: true }] : [] }
      if (sql.startsWith('GRANT') && failGrant) {
        failGrant = false
        throw new Error('synthetic DDL failure')
      }
      if (sql.includes('SELECT format'))
        return { rows: [{ sql: `CREATE_FAKE:${JSON.stringify(args)}` }] }
      if (sql.startsWith('CREATE_FAKE:')) {
        const [role, password] = JSON.parse(sql.slice(12))
        pending.set(role, password)
        creates++
        return { rows: [] }
      }
      if (sql.includes('pg_has_role')) return { rows: [{ member: false }] }
      return { rows: [] }
    },
    async end() {},
  })
  const input = {
    bootstrap: 'postgresql://bootstrap:synthetic-bootstrap@localhost/test',
    root,
    connect: connect as NonNullable<
      Parameters<typeof provisionLocal>[0]['connect']
    >,
  }
  try {
    await expect(provisionLocal(input)).rejects.toThrow('synthetic DDL failure')
    expect(roles.size).toBe(0)
    let writes = 0
    await expect(
      provisionLocal({
        ...input,
        writeEnv: async (path, text) => {
          if (++writes === 2) throw new Error('synthetic IO failure')
          await writePrivate(path, text)
        },
      }),
    ).rejects.toThrow('synthetic IO')
    expect(creates).toBe(3)
    const journal = JSON.parse(
      await readFile(new URL('.env.provision.json', root), 'utf8'),
    )
    expect(journal.urls).toHaveLength(2)
    const savedPasswords = [...roles.values()]
    await provisionLocal(input)
    expect(creates).toBe(3)
    expect([...roles.values()]).toEqual(savedPasswords)
    await expect(
      readFile(new URL('.env.provision.json', root)),
    ).rejects.toMatchObject({ code: 'ENOENT' })
    expect(await readFile(new URL('.env.db', root), 'utf8')).toContain(
      'MIGRATION_DATABASE_URL=',
    )
    if (process.platform !== 'win32')
      expect((await stat(new URL('.env', root))).mode & 0o777).toBe(0o600)
  } finally {
    await rm(dir, { recursive: true, force: true })
  }
})
