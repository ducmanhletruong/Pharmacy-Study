'use client'
import Link from 'next/link'
import Image from 'next/image'
import { useState, useEffect, useCallback, useRef } from 'react'
import {
  attemptSchema,
  resultSchema,
  type Attempt,
  type Result,
  type AttemptAnswer,
  type BlueprintSpec,
} from '@pharmacy/api-contract'
import { RichText } from './rich-text'
import { VisualAnswer } from './visual-answer'
import { AnswerSaveStatus, useAnswerSaves } from './answer-saves'
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
type SubjectData = {
  subject: string
  blueprints: Blueprint[]
  blueprint: string
  stats: Progress[]
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
  const [subjectData, setSubjectData] = useState<SubjectData | null>(null)
  const [refresh, setRefresh] = useState(0)
  const selected = subjectData?.subject === subject ? subjectData : null
  const blueprints = selected?.blueprints ?? []
  const blueprint = selected?.blueprint ?? ''
  const stats = selected?.stats ?? []
  const [source, setSource] = useState<'wrong' | 'flagged'>('wrong'),
    [count, setCount] = useState(1)
  const [attempt, setAttempt] = useState<Attempt | null>(null),
    [summary, setSummary] = useState<Result | null>(null),
    [position, setPosition] = useState(0)
  const saves = useAnswerSaves()
  const { flush } = saves
  const [busy, setBusy] = useState(false),
    [error, setError] = useState(''),
    [remaining, setRemaining] = useState<number | null>(null)
  const version = useRef(0),
    offset = useRef(0),
    autoSubmitted = useRef(false),
    finishing = useRef(false),
    pending = useRef<{ input: string; key: string } | null>(null)
  const invalidate = useCallback(() => {
    version.current++
  }, [])
  const install = useCallback((saved: Attempt) => {
    setSubject(saved.subject)
    setAttempt(saved)
    setPosition(0)
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
        if (active) {
          setSubjects(d.items)
          setSubject((current) =>
            d.items.some((s: { code: string }) => s.code === current)
              ? current
              : (d.items[0]?.code ?? current),
          )
        }
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
    if (!subjects.length) return
    let active = true
    Promise.all([
      request('/blueprints?limit=100&subject=' + encodeURIComponent(subject)),
      request('/me/progress?limit=100&subject=' + encodeURIComponent(subject)),
    ])
      .then(([b, p]) => {
        if (active) {
          setSubjectData({
            subject,
            blueprints: b.items,
            blueprint: b.items[0]?.id ?? '',
            stats: p.items,
          })
        }
      })
      .catch((e) => {
        if (active) setError(e.message)
      })
    return () => {
      active = false
    }
  }, [subject, subjects.length, refresh])
  const finish = useCallback(
    async (expired = false) => {
      if (!attempt || finishing.current) return
      finishing.current = true
      const v = version.current
      setBusy(true)
      setError('')
      try {
        const failed = await flush(attempt.id)
        if (failed.length && !expired) {
          setPosition(
            attempt.items.findIndex((row) => row.position === failed[0]),
          )
          setError('Chưa lưu được đáp án ở câu ' + failed.join(', ') + '.')
          return
        }
        if (failed.length)
          setError(
            'Câu ' + failed.join(', ') + ' chưa được lưu trước khi hết giờ.',
          )
        const result = resultSchema.parse(
          await request('/attempts/' + attempt.id + '/submit', 'POST'),
        )
        if (v === version.current) setSummary(result)
      } catch (e) {
        if (v === version.current) setError((e as Error).message)
      } finally {
        finishing.current = false
        if (v === version.current) setBusy(false)
      }
    },
    [attempt, flush],
  )
  useEffect(() => {
    if (!attempt?.deadline_at || summary) return
    const deadline = Date.parse(attempt.deadline_at)
    function tick() {
      const left = Math.max(
        0,
        Math.ceil((deadline - Date.now() - offset.current) / 1000),
      )
      setRemaining(left)
      if (left === 0 && !autoSubmitted.current && !finishing.current) {
        autoSubmitted.current = true
        void finish(true)
      }
    }
    tick()
    const timer = setInterval(tick, 1000)
    return () => clearInterval(timer)
  }, [attempt, summary, finish])
  async function start(mode: 'mock' | 'review') {
    if (!subjects.length || busy || (mode === 'mock' && !blueprint)) return
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
  function selectAnswer(answer: AttemptAnswer | '') {
    const item = attempt?.items[position]
    if (!attempt || !item || busy) return
    const v = version.current
    saves.select(attempt.id, item.position, answer, async (chosen) => {
      const response = await request(
        `/attempts/${attempt.id}/items/${item.position}`,
        'PUT',
        {
          answer: chosen,
          defer_feedback: true,
        },
      )
      if (response.result && v === version.current) {
        setSummary(resultSchema.parse(response.result))
        setError('Đã hết giờ trước khi lưu đáp án câu ' + item.position + '.')
      }
      if (response.saved !== true) throw new Error('Chưa lưu được đáp án.')
      setAttempt((current) =>
        current?.id === attempt.id
          ? {
              ...current,
              items: current.items.map((row) =>
                row.position === item.position
                  ? { ...row, answer: chosen }
                  : row,
              ),
            }
          : current,
      )
    })
  }
  async function flag() {
    const item = attempt?.items[position]
    if (!attempt || !item) return
    setBusy(true)
    setError('')
    const v = version.current
    try {
      const value = await request(
        `/attempts/${attempt.id}/items/${item.position}`,
        'PUT',
        { flagged: !item.flagged },
      )
      if (v !== version.current) return
      if (value.result) {
        setSummary(resultSchema.parse(value.result))
        return
      }
      setAttempt((current) =>
        current?.id === attempt.id
          ? {
              ...current,
              items: current.items.map((row) =>
                row.position === item.position
                  ? { ...row, flagged: !item.flagged }
                  : row,
              ),
            }
          : current,
      )
    } catch (e) {
      if (v === version.current) setError((e as Error).message)
    } finally {
      if (v === version.current) setBusy(false)
    }
  }
  function reset() {
    version.current++
    setAttempt(null)
    setSummary(null)
    setRemaining(null)
    setError('')
    history.replaceState(null, '', '/study')
    setSubjectData(null)
    setRefresh((current) => current + 1)
  }
  const item = attempt?.items[position]
  const save =
    attempt && item ? saves.entry(attempt.id, item.position) : undefined
  const answer = save ? save.answer : (item?.answer ?? '')
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
                onClick={() => setPosition(index)}
              >
                {q.position}
                {(saves.entry(attempt.id, q.position)?.status ??
                  (q.answer ? 'saved' : '')) === 'saved'
                  ? ' ✓'
                  : ''}
                {q.flagged ? ' ★' : ''}
              </button>
            ))}
          </nav>
          <h3>Câu {item.position}</h3>
          <RichText text={item.stem} />
          {item.exercise ? (
            <VisualAnswer
              item={item}
              answer={answer}
              busy={busy}
              onAnswer={selectAnswer}
            />
          ) : (
            <>
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
              <fieldset disabled={busy}>
                <legend>Chọn đáp án cho câu {item.position}</legend>
                {item.choices.map((c) => (
                  <label className="choice" key={c.label}>
                    <input
                      type="radio"
                      name={'answer-' + item.position}
                      value={c.label}
                      checked={answer === c.label}
                      onChange={() => selectAnswer(c.label)}
                    />
                    <span>
                      {c.label}. <RichText text={c.text} />
                    </span>
                  </label>
                ))}
              </fieldset>
            </>
          )}
          <AnswerSaveStatus
            entry={save}
            saved={item.answer !== null}
            retry={() => saves.retry(attempt.id, item.position)}
          />
          <div className="question-actions">
            <button
              disabled={busy || position === 0}
              onClick={() => setPosition(position - 1)}
            >
              Câu trước
            </button>
            <button
              disabled={busy || position === attempt.items.length - 1}
              onClick={() => setPosition(position + 1)}
            >
              Câu tiếp theo
            </button>
          </div>
          <button disabled={busy} onClick={() => void flag()}>
            {item.flagged ? 'Bỏ đánh dấu' : 'Đánh dấu ôn lại'}
          </button>
          <p>Đáp án đúng, lời giải và nguồn xuất hiện sau khi nộp bài.</p>
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
                onChange={(e) => {
                  setSubjectData(null)
                  setError('')
                  setSubject(e.target.value)
                }}
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
                disabled={busy || !blueprint}
                onChange={(e) => {
                  const id = e.target.value
                  setSubjectData((current) =>
                    current?.subject === subject
                      ? { ...current, blueprint: id }
                      : current,
                  )
                }}
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
            {selected && !blueprints.length && (
              <p>Chưa có cấu hình thi đang áp dụng.</p>
            )}
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
            ) : selected ? (
              <p>Chưa có bài đã nộp hoặc hết giờ cho môn này.</p>
            ) : null}
          </section>
          <section className="panel">
            <h2>Ôn lại câu sai và đã đánh dấu</h2>
            <p>
              Ôn từ bài đã nộp, bài thi đã hết giờ hoặc câu đã đánh dấu khi
              luyện. Hệ thống dùng phiên bản hiện hành còn được duyệt.
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
            <button
              disabled={busy || !subjects.length}
              onClick={() => void start('review')}
            >
              Bắt đầu ôn lại
            </button>
          </section>
        </>
      )}
    </main>
  )
}
