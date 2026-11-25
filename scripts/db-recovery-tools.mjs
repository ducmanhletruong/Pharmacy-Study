import { execFile, spawn } from 'node:child_process'
import { createHash } from 'node:crypto'
import { createReadStream } from 'node:fs'
import { promisify } from 'node:util'

const exec = promisify(execFile)
const dockerArgs = [
  '--host',
  process.platform === 'win32'
    ? 'npipe:////./pipe/docker_engine'
    : 'unix:///var/run/docker.sock',
]

export async function runTool(executable, args, step, options = {}) {
  try {
    return (
      await exec(executable, args, { timeout: 20_000, ...options })
    ).stdout.trim()
  } catch {
    throw new Error(step)
  }
}

export function docker(args, step) {
  return runTool('docker', [...dockerArgs, ...args], step)
}

export async function streamDocker(
  args,
  step,
  { input, password, output } = {},
) {
  await new Promise((resolve, reject) => {
    const child = spawn('docker', [...dockerArgs, ...args], {
      stdio: [input?.fd ?? 'pipe', output?.fd ?? 'ignore', 'ignore'],
      timeout: 300_000,
    })
    child.once('error', () => reject(new Error(step)))
    child.once('close', (code) =>
      code === 0 ? resolve() : reject(new Error(step)),
    )
    child.stdin?.on('error', () => child.kill())
    child.stdin?.end(password === undefined ? undefined : password + '\n')
  })
}

export async function fileHash(path) {
  const hash = createHash('sha256')
  for await (const chunk of createReadStream(path)) hash.update(chunk)
  return hash.digest('hex')
}

export async function secureWindowsDirectory(path) {
  if (process.platform !== 'win32') return
  const identity = await runTool(
    'whoami.exe',
    ['/user', '/fo', 'csv', '/nh'],
    'Cannot identify the Windows account',
  )
  const sid = identity.match(/\bS-1-[\d-]+\b/)?.[0]
  if (!sid) throw new Error('Cannot identify the Windows account SID')
  await runTool(
    'icacls.exe',
    [path, '/inheritance:r', '/grant:r', `*${sid}:(OI)(CI)F`],
    'Cannot restrict backup directory permissions',
  )
}

const countTables = [
  'users',
  'subjects',
  'topics',
  'sources',
  'assets',
  'questions',
  'question_choices',
  'question_sources',
  'question_topics',
  'exam_blueprints',
]
const hashTables = [
  ['_migrations', 'name'],
  ['question_revisions', 'id'],
  ['attempts', 'id'],
  ['attempt_items', 'id'],
  [
    'written_papers',
    'id',
    `
    (to_jsonb(record) - 'exam_pdf' - 'reference_pdf') ||
    jsonb_build_object('exam_pdf', encode(sha256(exam_pdf), 'hex'),
      'reference_pdf', encode(sha256(reference_pdf), 'hex'))`,
  ],
  ['written_attempts', 'id'],
  ['written_answers', 'attempt_id, position'],
]

export const fingerprintSql = `SELECT jsonb_build_object(
  'counts', jsonb_build_object(
    ${countTables.map((table) => `'${table}', (SELECT count(*) FROM public.${table})`).join(',')},
    'approved_questions', (SELECT count(*) FROM public.questions WHERE status='approved')
  ),
  'contents', jsonb_build_object(
    ${hashTables
      .map(
        ([table, order, data = 'to_jsonb(record)']) =>
          `'${table}', (SELECT jsonb_build_object('count', count(*), 'sha256',
          encode(sha256(convert_to(coalesce(string_agg(
            encode(sha256(convert_to((${data})::text, 'UTF8')), 'hex'),
            '' ORDER BY ${order}), ''), 'UTF8')), 'hex')) FROM public.${table} record)`,
      )
      .join(',')}
  )
) AS fingerprint`
