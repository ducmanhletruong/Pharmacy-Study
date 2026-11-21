'use client'
import Link from 'next/link'
import Image from 'next/image'
import { useState, useEffect, useCallback, useRef } from 'react'
import {
  attemptSchema,
  resultSchema,
  feedbackSchema,
  type Attempt,
  type Result,
  type Feedback,
  type BlueprintSpec,
} from '@pharmacy/api-contract'
import { RichText } from './rich-text'
type Blueprint = { id: string; name: string; spec: BlueprintSpec }
type Progress = {
  topic_id: string
  title: string
  total: number
  correct: number
  wrong: number
  unanswered: number
  accuracy: number | null
}
async function request(
  path: string,
  method = 'GET',
  data?: unknown,
  key?: string,
) {
  const response = await fetch('/api/v1' + path, {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...(key ? { 'Idempotency-Key': key } : {}),
    },
    ...(data ? { body: JSON.stringify(data) } : {}),
  })
  const value = await response.json()
  if (!response.ok)
    throw new Error(value.error?.message ?? 'Không thể xử lý yêu cầu')
  return value
}
export function LearningWorkbench() {
  const [subjects, setSubjects] = useState<{ code: string; name: string }[]>(
      [],
    ),
    [subject, setSubject] = useState('synthetic')
  const [blueprints, setBlueprints] = useState<Blueprint[]>([]),
    [blueprint, setBlueprint] = useState('')
  const [stats, setStats] = useState<Progress[]>([]),
    [source, setSource] = useState<'wrong' | 'flagged'>('wrong'),
    [count, setCount] = useState(1)
  const [attempt, setAttempt] = useState<Attempt | null>(null),
    [summary, setSummary] = useState<Result | null>(null),
    [position, setPosition] = useState(0),
    [answer, setAnswer] = useState('')
  const [feedback, setFeedback] = useState<Feedback | null>(null),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(''),
    [remaining, setRemaining] = useState<number | null>(null)
  const version = useRef(0),
    offset = useRef(0),
    autoSubmitted = useRef(false),
    pending = useRef<{ input: string; key: string } | null>(null)
  const invalidate = useCallback(() => {
    version.current++
  }, [])
  const install = useCallback((saved: Attempt) => {
    setAttempt(saved)
    setPosition(0)
    setAnswer('')
    setFeedback(null)
    setSummary(null)
    autoSubmitted.current = false
    offset.current = saved.server_time
      ? Date.parse(saved.server_time) - Date.now()
      : 0
    history.replaceState(null, '', '?attempt=' + saved.id)
  }, [])
  useEffect(() => {
    let active = true
    request('/subjects')
      .then((d) => {
        if (active) setSubjects(d.items)
      })
      .catch((e) => {
        if (active) setError(e.message)
      })
    const id = new URLSearchParams(location.search).get('attempt')
    if (id)
      request('/attempts/' + encodeURIComponent(id))
        .then(async (d) => {
          if (!active) return
          const saved = attemptSchema.parse(d)
          install(saved)
          if (saved.status !== 'in_progress') {
            const result = await request(
              '/attempts/' + saved.id + '/submit',
              'POST',
            )
            if (active) setSummary(resultSchema.parse(result))
          }
        })
        .catch((e) => {
          if (active) setError(e.message)
        })
    return () => {
      active = false
      invalidate()
    }
  }, [install, invalidate])
  useEffect(() => {
    let active = true
    Promise.all([
      request('/blueprints?limit=100&subject=' + encodeURIComponent(subject)),
      request('/me/progress?limit=100&subject=' + encodeURIComponent(subject)),
    ])
      .then(([b, p]) => {
        if (active) {
          setBlueprints(b.items)
          setBlueprint(b.items[0]?.id ?? '')
          setStats(p.items)
        }
      })
      .catch((e) => {
        if (active) setError(e.message)
      })
    return () => {
      active = false
    }
  }, [subject])
  const finish = useCallback(async () => {
    if (!attempt) return
    const v = version.current
    setBusy(true)
    setError('')
    try {
      const result = resultSchema.parse(
        await request('/attempts/' + attempt.id + '/submit', 'POST'),
      )
      if (v === version.current) setSummary(result)
    } catch (e) {
      if (v === version.current) setError((e as Error).message)
    } finally {
      if (v === version.current) setBusy(false)
    }
  }, [attempt])
  useEffect(() => {
    if (!attempt?.deadline_at || summary) return
    const deadline = Date.parse(attempt.deadline_at)
    function tick() {
      const left = Math.max(
        0,
        Math.ceil((deadline - Date.now() - offset.current) / 1000),
      )
      setRemaining(left)
      if (left === 0 && !autoSubmitted.current) {
        autoSubmitted.current = true
        void finish()
      }
    }
    tick()
    const timer = setInterval(tick, 1000)
    return () => clearInterval(timer)
  }, [attempt, summary, finish])
  async function start(mode: 'mock' | 'review') {
    setBusy(true)
    setError('')
    const v = ++version.current
    const input =
      mode === 'mock'
        ? { subject, mode, blueprint_id: blueprint }
        : { subject, source, count }
    const encoded = JSON.stringify(input)
    if (pending.current?.input !== encoded)
      pending.current = { input: encoded, key: crypto.randomUUID() }
    try {
      const saved = attemptSchema.parse(
        await request(
          mode === 'mock' ? '/attempts' : '/me/review-queue/attempts',
          'POST',
          input,
          pending.current.key,
        ),
      )
      if (v === version.current) {
        install(saved)
        pending.current = null
      }
    } catch (e) {
      if (v === version.current) setError((e as Error).message)
    } finally {
      if (v === version.current) setBusy(false)
    }
  }
  async function save(flagOnly = false) {
    const item = attempt?.items[position]
    if (!attempt || !item) return
    setBusy(true)
    setError('')
    const v = version.current
    try {
      const value = await request(
        `/attempts/${attempt.id}/items/${item.position}`,
        'PUT',
        flagOnly
          ? { flagged: !item.flagged }
          : { answer: answer || item.answer },
      )
      if (v !== version.current) return
      if (value.result) {
        setSummary(resultSchema.parse(value.result))
        return
      }
      if (!flagOnly && attempt.mode !== 'mock')
        setFeedback(feedbackSchema.parse(value))
      const fresh = attemptSchema.parse(
        await request('/attempts/' + attempt.id),
      )
      if (v === version.current) setAttempt(fresh)
    } catch (e) {
      if (v === version.current) setError((e as Error).message)
    } finally {
      if (v === version.current) setBusy(false)
    }
  }
  async function reset() {
    version.current++
    setAttempt(null)
    setSummary(null)
    setFeedback(null)
    setRemaining(null)
    setError('')
    history.replaceState(null, '', '/study')
    try {
      setStats(
        (
          await request(
            '/me/progress?limit=100&subject=' + encodeURIComponent(subject),
          )
        ).items,
      )
    } catch (e) {
      setError((e as Error).message)
    }
  }
  const item = attempt?.items[position]
  return (
    <main className="workspace">
      <section className="panel">
        <Link href="/">← Về trang luyện tập</Link>
        <h1>Thi thử và tiến độ của bạn</h1>
        <Link href="/written">Thi tự luận theo đề gốc →</Link>
        <p>
          Chỉ dùng câu hỏi đã duyệt. Điểm được tính trên những câu đã lưu; thống
          kê ghi mỗi lần làm bài theo các chủ đề đã gắn.
        </p>
      </section>
      {error && (
        <p role="alert" className="error">
          {error}
        </p>
      )}
      {summary ? (
        <section className="panel">
          <h2>Kết quả bài làm</h2>
          {summary.outcome === 'expired' && (
            <p>Đã hết giờ — chấm các đáp án đã lưu trước hạn.</p>
          )}
          <p className="score">{summary.score.toFixed(1)}/10</p>
          <p>
            {summary.correct}/{summary.total} câu đúng; {summary.unanswered} câu
            chưa trả lời.
          </p>
          <ul>
            {summary.by_topic.map((t) => (
              <li key={t.topic_id}>
                {t.title}: {t.correct}/{t.total}
              </li>
            ))}
          </ul>
          {summary.feedback?.map((row) => (
            <section key={row.position}>
              <h3>
                Câu {row.position}: đáp án {row.feedback.correct_answer}
              </h3>
              <RichText text={row.feedback.explanation} />
              <ul>
                {row.feedback.sources.map((s) => (
                  <li key={s.locator}>
                    {s.title} — {s.locator}
                  </li>
                ))}
              </ul>
            </section>
          ))}
          <button onClick={() => void reset()}>Về thi thử và tiến độ</button>
        </section>
      ) : attempt && item ? (
        <section className="panel">
          <h2>{attempt.mode === 'mock' ? 'Bài thi thử' : 'Ôn tập'}</h2>
          {attempt.mode === 'mock' && (
            <p role="timer" aria-label="Thời gian còn lại">
              Thời gian còn lại:{' '}
              {remaining === null
                ? 'Đang đồng bộ…'
                : `${Math.floor(remaining / 60)}:${String(remaining % 60).padStart(2, '0')}`}
            </p>
          )}
          <nav aria-label="Các câu hỏi">
            {attempt.items.map((q, index) => (
              <button
                key={q.position}
                disabled={busy}
                aria-current={position === index ? 'step' : undefined}
                onClick={() => {
                  setPosition(index)
                  setAnswer('')
                  setFeedback(null)
                }}
              >
                {q.position}
                {q.answer ? ' ✓' : ''}
                {q.flagged ? ' ★' : ''}
              </button>
            ))}
          </nav>
          <h3>Câu {item.position}</h3>
          <RichText text={item.stem} />
          {item.assets.map((a) => (
            <Image
              key={a.id}
              unoptimized
              src={a.url}
              alt={a.alt_text}
              width={600}
              height={400}
              style={{ maxWidth: '100%', height: 'auto' }}
            />
          ))}
          <fieldset
            disabled={busy || (attempt.mode !== 'mock' && item.answer !== null)}
          >
            <legend>Chọn đáp án cho câu {item.position}</legend>
            {item.choices.map((c) => (
              <label className="choice" key={c.label}>
                <input
                  type="radio"
                  name={'answer-' + item.position}
                  value={c.label}
                  checked={(answer || item.answer) === c.label}
                  onChange={() => setAnswer(c.label)}
                />
                <span>
                  {c.label}. <RichText text={c.text} />
                </span>
              </label>
            ))}
          </fieldset>
          <button
            disabled={busy || !(answer || item.answer)}
            className="primary"
            onClick={() => void save()}
          >
            {attempt.mode === 'mock' ? 'Lưu đáp án' : 'Gửi đáp án ôn tập'}
          </button>
          <button disabled={busy} onClick={() => void save(true)}>
            {item.flagged ? 'Bỏ đánh dấu' : 'Đánh dấu ôn lại'}
          </button>
          {attempt.mode === 'mock' && (
            <p>Đáp án đúng, lời giải và nguồn chỉ xuất hiện sau khi nộp bài.</p>
          )}
          {feedback && (
            <section role="status">
              <h3>Đáp án: {feedback.correct_answer}</h3>
              <RichText text={feedback.explanation} />
              <ul>
                {feedback.sources.map((s) => (
                  <li key={s.locator}>
                    {s.title} — {s.locator}
                  </li>
                ))}
              </ul>
            </section>
          )}
          <button disabled={busy} onClick={() => void finish()}>
            Nộp bài
          </button>
        </section>
      ) : (
        <>
          <section className="panel">
            <label>
              Môn học thống kê
              <select
                disabled={busy}
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
              >
                {subjects.map((s) => (
                  <option key={s.code} value={s.code}>
                    {s.name}
                  </option>
                ))}
              </select>
            </label>
            <h2>Bắt đầu thi thử</h2>
            <label>
              Cấu hình thi
              <select
                value={blueprint}
                disabled={busy}
                onChange={(e) => setBlueprint(e.target.value)}
              >
                {blueprints.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.name} —{' '}
                    {b.spec.slots.reduce((sum, s) => sum + s.count, 0)} câu /{' '}
                    {b.spec.duration_seconds / 60} phút
                  </option>
                ))}
              </select>
            </label>
            {!blueprints.length && <p>Chưa có cấu hình thi đang áp dụng.</p>}
            <button
              className="primary"
              disabled={busy || !blueprint}
              onClick={() => void start('mock')}
            >
              Bắt đầu thi thử
            </button>
          </section>
          <section className="panel">
            <h2>Tiến độ theo chủ đề</h2>
            <p>
              Một câu có nhiều chủ đề được tính ở từng chủ đề; tổng giữa các chủ
              đề có thể vượt tổng số câu.
            </p>
            {stats.length ? (
              <table>
                <thead>
                  <tr>
                    <th>Chủ đề</th>
                    <th>Đúng</th>
                    <th>Sai</th>
                    <th>Chưa trả lời</th>
                    <th>Tổng</th>
                    <th>Tỉ lệ đúng</th>
                  </tr>
                </thead>
                <tbody>
                  {stats.map((t) => (
                    <tr key={t.topic_id}>
                      <th>{t.title}</th>
                      <td>{t.correct}</td>
                      <td>{t.wrong}</td>
                      <td>{t.unanswered}</td>
                      <td>{t.total}</td>
                      <td>{t.accuracy}%</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <p>Chưa có bài đã nộp cho môn này.</p>
            )}
          </section>
          <section className="panel">
            <h2>Ôn lại câu sai và đã đánh dấu</h2>
            <p>
              Chọn theo lần làm gần nhất của từng câu đã nộp; dùng revision hiện
              hành còn được duyệt.
            </p>
            <label>
              Nguồn ôn tập
              <select
                disabled={busy}
                value={source}
                onChange={(e) =>
                  setSource(e.target.value as 'wrong' | 'flagged')
                }
              >
                <option value="wrong">Câu sai hoặc chưa trả lời</option>
                <option value="flagged">Câu đã đánh dấu</option>
              </select>
            </label>
            <label>
              Số câu ôn tập
              <input
                type="number"
                min={1}
                max={10}
                value={count}
                disabled={busy}
                onChange={(e) => setCount(Number(e.target.value))}
              />
            </label>
            <button disabled={busy} onClick={() => void start('review')}>
              Bắt đầu ôn lại
            </button>
          </section>
        </>
      )}
    </main>
  )
}
