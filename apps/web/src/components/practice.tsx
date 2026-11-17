'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import {
  attemptSchema,
  feedbackSchema,
  resultSchema,
  subjectSchema,
  type Attempt,
  type Feedback,
  type Result,
} from '@pharmacy/api-contract'
import { RichText } from './rich-text'

type Subject = {
  id: string
  code: string
  name: string
  question_count: number
}
type Topic = { id: string; title: string; children: Topic[] }
async function request(
  path: string,
  method = 'GET',
  data?: unknown,
  key?: string,
) {
  const response = await fetch(`/api/v1${path}`, {
    method,
    headers: {
      ...(data ? { 'Content-Type': 'application/json' } : {}),
      ...(key ? { 'Idempotency-Key': key } : {}),
    },
    ...(data ? { body: JSON.stringify(data) } : {}),
  })
  const value = await response.json()
  if (!response.ok)
    throw new Error(
      value.error?.message ?? 'Không thể kết nối. Vui lòng thử lại.',
    )
  return value
}
function TopicOptions({
  items,
  depth = 0,
}: {
  items: Topic[]
  depth?: number
}) {
  return (
    <>
      {items.map((item) => (
        <optgroup key={item.id} label={`${'· '.repeat(depth)}${item.title}`}>
          <option value={item.id}>{item.title}</option>
          {item.children.map((child) => (
            <option key={child.id} value={child.id}>
              {'— '.repeat(depth + 1)}
              {child.title}
            </option>
          ))}
        </optgroup>
      ))}
    </>
  )
}
export function Practice() {
  const [subjects, setSubjects] = useState<Subject[]>([])
  const [selected, setSelected] = useState<Subject | null>(null)
  const [topics, setTopics] = useState<Topic[]>([])
  const [topic, setTopic] = useState('')
  const [count, setCount] = useState(10)
  const [attempt, setAttempt] = useState<Attempt | null>(null)
  const [position, setPosition] = useState(0)
  const [answer, setAnswer] = useState('')
  const [feedback, setFeedback] = useState<Record<number, Feedback>>({})
  const [result, setResult] = useState<Result | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)
  const [pendingKey, setPendingKey] = useState<{
    input: string
    key: string
  } | null>(null)
  useEffect(() => {
    let active = true
    Promise.all([
      request('/subjects'),
      (async () => {
        const id = new URLSearchParams(location.search).get('attempt')
        return id
          ? attemptSchema.parse(
              await request(`/attempts/${encodeURIComponent(id)}`),
            )
          : null
      })(),
    ])
      .then(([list, saved]) => {
        if (!active) return
        setSubjects(
          list.items.map((item: unknown) => subjectSchema.parse(item)),
        )
        if (saved) {
          setAttempt(saved)
          if (saved.status === 'submitted')
            request(`/attempts/${saved.id}/submit`, 'POST')
              .then((value) => {
                if (active) setResult(resultSchema.parse(value))
              })
              .catch((reason) => {
                if (active) setError(reason.message)
              })
        }
      })
      .catch((reason) => {
        if (active) setError(reason.message)
      })
      .finally(() => {
        if (active) setLoading(false)
      })
    return () => {
      active = false
    }
  }, [])
  async function choose(subject: Subject) {
    setBusy(true)
    setError('')
    setSelected(subject)
    setTopics([])
    setTopic('')
    try {
      const data = await request(
        `/subjects/${encodeURIComponent(subject.code)}/topics`,
      )
      setTopics(data.items)
    } catch (reason) {
      setError((reason as Error).message)
    } finally {
      setBusy(false)
    }
  }
  async function start() {
    if (!selected) return
    setBusy(true)
    setError('')
    const input = {
      subject: selected.code,
      mode: 'practice',
      count,
      ...(topic ? { topic_ids: [topic] } : {}),
    }
    const encoded = JSON.stringify(input)
    const key =
      pendingKey?.input === encoded ? pendingKey.key : crypto.randomUUID()
    setPendingKey({ input: encoded, key })
    try {
      const saved = attemptSchema.parse(
        await request('/attempts', 'POST', input, key),
      )
      setAttempt(saved)
      setPosition(0)
      setAnswer('')
      setFeedback({})
      setResult(null)
      setPendingKey(null)
      history.replaceState(null, '', `?attempt=${saved.id}`)
    } catch (reason) {
      setError((reason as Error).message)
    } finally {
      setBusy(false)
    }
  }
  async function submitAnswer() {
    const item = attempt?.items[position]
    const chosen = item?.answer ?? answer
    if (!attempt || !item || !chosen) return
    setBusy(true)
    setError('')
    try {
      const value = feedbackSchema.parse(
        await request(`/attempts/${attempt.id}/items/${item.position}`, 'PUT', {
          answer: chosen,
        }),
      )
      const saved = attemptSchema.parse(
        await request(`/attempts/${attempt.id}`),
      )
      setFeedback((previous) => ({ ...previous, [item.position]: value }))
      setAttempt(saved)
    } catch (reason) {
      setError((reason as Error).message)
    } finally {
      setBusy(false)
    }
  }
  async function finish() {
    if (!attempt) return
    setBusy(true)
    setError('')
    try {
      setResult(
        resultSchema.parse(
          await request(`/attempts/${attempt.id}/submit`, 'POST'),
        ),
      )
    } catch (reason) {
      setError((reason as Error).message)
    } finally {
      setBusy(false)
    }
  }
  function reset() {
    history.replaceState(null, '', location.pathname)
    setAttempt(null)
    setSelected(null)
    setFeedback({})
    setResult(null)
    setAnswer('')
    setError('')
    setPendingKey(null)
  }
  const item = attempt?.items[position]
  const currentFeedback = item ? feedback[item.position] : undefined
  const completed =
    attempt?.items.filter((item) => item.answer !== null).length ?? 0
  return (
    <>
      <header className="site-header">
        <Link
          className="brand"
          href="/"
          onClick={reset}
          aria-label="Pharmacy Study — trang chủ"
        >
          <span className="brand-symbol">P</span>Pharmacy<span>Study</span>
        </Link>
        <span className="local-badge">Không gian luyện tập</span>
      </header>
      <main className="workspace">
        <section className="intro">
          <p className="eyebrow">HỌC TỪNG CHÚT · HIỂU THÊM MỖI NGÀY</p>
          <h1>
            {attempt
              ? 'Tập trung vào từng câu hỏi.'
              : 'Luyện tập từng câu,\nhiểu rõ từng bước.'}
          </h1>
          <p>
            {attempt
              ? 'Đáp án và giải thích xuất hiện sau khi bạn trả lời.'
              : 'Chọn bộ câu hỏi, tự kiểm tra kiến thức và xem lại lời giải ngay trong buổi học.'}
          </p>
        </section>
        <p className="sample-note">
          Bộ luyện mẫu gồm dữ liệu tổng hợp tự viết, chưa phải ngân hàng đề thi
          Dược.
        </p>
        {error && (
          <div role="alert" className="error">
            {error}
            <button onClick={() => location.reload()}>Tải lại</button>
          </div>
        )}
        {loading ? (
          <p role="status">Đang tải bộ luyện tập…</p>
        ) : result ? (
          <section className="panel result" aria-labelledby="result-heading">
            <p className="eyebrow">BUỔI LUYỆN ĐÃ HOÀN TẤT</p>
            <h2 id="result-heading">Bạn đã hoàn thành bài luyện.</h2>
            <p className="score">
              {result.score.toFixed(1)}
              <span>/10</span>
            </p>
            <div className="stats">
              <p>
                <strong>
                  {result.correct}/{result.total}
                </strong>
                Câu đúng
              </p>
              <p>
                <strong>{result.unanswered}</strong>Chưa trả lời
              </p>
            </div>
            <h3>Kết quả theo chủ đề</h3>
            <ul className="topic-results">
              {result.by_topic.map((topic) => (
                <li key={topic.topic_id}>
                  <span>{topic.title}</span>
                  <strong>
                    {topic.correct}/{topic.total} câu đúng
                  </strong>
                </li>
              ))}
            </ul>
            <button className="primary" onClick={reset}>
              Luyện một bài mới
            </button>
          </section>
        ) : attempt && item ? (
          <div className="practice-layout">
            <aside className="panel navigator" aria-label="Tiến độ bài luyện">
              <p className="eyebrow">BÀI LUYỆN MẪU</p>
              <h2>
                {completed}/{attempt.items.length}
                <span> câu đã trả lời</span>
              </h2>
              <progress
                value={completed}
                max={attempt.items.length}
                aria-label="Số câu đã trả lời"
              />
              <div className="question-grid">
                {attempt.items.map((question, index) => (
                  <button
                    key={question.position}
                    aria-label={`Đến câu ${question.position}`}
                    aria-current={index === position ? 'step' : undefined}
                    className={`${index === position ? 'active' : ''} ${question.answer ? 'answered' : ''}`}
                    onClick={() => {
                      setPosition(index)
                      setAnswer('')
                      setError('')
                    }}
                    disabled={busy}
                  >
                    {question.position}
                  </button>
                ))}
              </div>
              <p className="muted">
                Bài làm được lưu tự động sau khi gửi đáp án. Bạn có thể tải lại
                trang để tiếp tục.
              </p>
            </aside>
            <section className="panel question">
              <p className="eyebrow">
                CÂU {item.position} / {attempt.items.length}
              </p>
              <h2>
                <RichText text={item.stem} />
              </h2>
              <fieldset disabled={busy || item.answer !== null}>
                <legend className="sr-only">Chọn một đáp án</legend>
                {item.choices.map((choice) => (
                  <label
                    key={choice.label}
                    className={`choice ${(item.answer ?? answer) === choice.label ? 'chosen' : ''}`}
                  >
                    <input
                      type="radio"
                      name={`question-${item.position}`}
                      value={choice.label}
                      checked={(item.answer ?? answer) === choice.label}
                      onChange={() => setAnswer(choice.label)}
                    />
                    <span className="choice-label">{choice.label}</span>
                    <span>
                      <RichText text={choice.text} />
                    </span>
                  </label>
                ))}
              </fieldset>
              {currentFeedback ? (
                <section
                  className={`feedback ${currentFeedback.is_correct ? 'correct' : 'incorrect'}`}
                  role="status"
                >
                  <h3>
                    {currentFeedback.is_correct
                      ? 'Chính xác!'
                      : 'Cùng xem lại nhé.'}{' '}
                    Đáp án: {currentFeedback.correct_answer}
                  </h3>
                  <p>
                    <RichText text={currentFeedback.explanation} />
                  </p>
                  <ul>
                    {currentFeedback.sources.map((source) => (
                      <li key={source.locator}>
                        {source.title} — {source.locator}
                      </li>
                    ))}
                  </ul>
                </section>
              ) : (
                item.answer && (
                  <p>
                    Đã lưu đáp án {item.answer}. Bấm bên dưới để xem lại giải
                    thích.
                  </p>
                )
              )}
              <div className="question-actions">
                <button
                  className="secondary"
                  disabled={busy || position === 0}
                  onClick={() => {
                    setPosition(position - 1)
                    setAnswer('')
                  }}
                >
                  Câu trước
                </button>
                {!currentFeedback ? (
                  <button
                    className="primary"
                    disabled={busy || !(item.answer ?? answer)}
                    onClick={submitAnswer}
                  >
                    {busy
                      ? 'Đang lưu…'
                      : item.answer
                        ? 'Xem giải thích'
                        : 'Gửi đáp án'}
                  </button>
                ) : position < attempt.items.length - 1 ? (
                  <button
                    className="primary"
                    disabled={busy}
                    onClick={() => {
                      setPosition(position + 1)
                      setAnswer('')
                    }}
                  >
                    Câu tiếp theo →
                  </button>
                ) : null}
              </div>
              <button className="finish" disabled={busy} onClick={finish}>
                {completed < attempt.items.length
                  ? `Kết thúc bài (${attempt.items.length - completed} câu chưa trả lời)`
                  : 'Xem kết quả bài luyện'}
              </button>
            </section>
          </div>
        ) : (
          <section className="selection" aria-labelledby="subjects-heading">
            <div className="section-heading">
              <h2 id="subjects-heading">Bắt đầu buổi luyện</h2>
              <span>01 bộ câu hỏi mẫu</span>
            </div>
            <div className="selection-grid">
              {subjects.map((subject) => (
                <button
                  key={subject.id}
                  className={`subject-card ${selected?.id === subject.id ? 'selected' : ''}`}
                  onClick={() => choose(subject)}
                  disabled={busy}
                >
                  <span className="subject-icon">∑</span>
                  <span className="tag">TỔNG HỢP</span>
                  <h3>{subject.name}</h3>
                  <p>Đọc dữ liệu · Tính toán cơ bản</p>
                  <div className="card-footer">
                    <span>{subject.question_count} câu trắc nghiệm</span>
                    <span aria-hidden="true">↗</span>
                  </div>
                </button>
              ))}
              <aside className="study-tip">
                <span className="tip-icon">✦</span>
                <h3>Một chút mỗi ngày.</h3>
                <p>
                  Thử trả lời trước khi xem giải thích. Mỗi câu hỏi là một cơ
                  hội để hiểu rõ hơn.
                </p>
              </aside>
            </div>
            {selected && (
              <div className="panel setup">
                <label>
                  Chủ đề
                  <select
                    value={topic}
                    onChange={(event) => setTopic(event.target.value)}
                    disabled={busy}
                  >
                    <option value="">Tất cả chủ đề</option>
                    <TopicOptions items={topics} />
                  </select>
                </label>
                <label>
                  Số câu
                  <select
                    value={count}
                    onChange={(event) => setCount(Number(event.target.value))}
                    disabled={busy}
                  >
                    <option value={10}>10 câu</option>
                    <option value={5}>5 câu</option>
                  </select>
                </label>
                <button className="primary" onClick={start} disabled={busy}>
                  {busy ? 'Đang chuẩn bị…' : 'Bắt đầu luyện →'}
                </button>
              </div>
            )}
            {!subjects.length && !error && (
              <p>Chưa có bộ câu hỏi nào. Vui lòng quay lại sau.</p>
            )}
          </section>
        )}
      </main>
      <footer className="site-footer">
        <span>Pharmacy Study</span>
        <span>Hiểu vững hôm nay, tự tin ngày mai.</span>
      </footer>
    </>
  )
}
