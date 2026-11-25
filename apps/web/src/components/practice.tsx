'use client'

import { useEffect, useState, useRef, useCallback } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { QuestionReport } from './question-report'
import { getCsrfToken } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import {
  attemptSchema,
  resultSchema,
  subjectSchema,
  type Attempt,
  type Result,
} from '@pharmacy/api-contract'
import { RichText } from './rich-text'
import { VisualAnswer } from './visual-answer'
import { AnswerSaveStatus, useAnswerSaves } from './answer-saves'
import {
  questionTypeSchema,
  type AttemptAnswer,
  type QuestionType,
} from '@pharmacy/api-contract'

type Subject = {
  id: string
  code: string
  name: string
  question_count: number
}
type Topic = { id: string; title: string; children: Topic[] }
const SUBJECT_META: Record<
  string,
  { icon: string; tag: string; summary: string }
> = {
  vsks1: {
    icon: 'μ',
    tag: 'VSKS1 · 08/12',
    summary: 'Vi khuẩn · Miễn dịch · Virus · Vi nấm',
  },
  ktct: {
    icon: '⚖',
    tag: 'KTCT · 17/12',
    summary: 'Hàng hóa · Giá trị thặng dư · Hội nhập kinh tế',
  },
  hpt1: {
    icon: '⚗',
    tag: 'HPT1 · 21/12',
    summary: 'Cân bằng dung dịch · Chuẩn độ · Bài tính K79',
  },
  hhc2: {
    icon: '⬡',
    tag: 'HHC2 · 25/12',
    summary: 'Danh pháp IUPAC · Dị vòng · Phân tử sinh học',
  },
  gpsl: {
    icon: '♥',
    tag: 'GPSL · 30/12',
    summary: 'Giải phẫu · Sinh lý hệ cơ quan · Hotspot 2D',
  },
}
const VISUAL_TYPE_SUBJECT: Record<string, string> = {
  name_from_structure: 'hhc2',
  image_hotspot: 'gpsl',
}
function typeAvailable(code: string, type: string) {
  if (type === 'mcq' || !SUBJECT_META[code]) return true
  return VISUAL_TYPE_SUBJECT[type] === code
}
async function request(
  path: string,
  method = 'GET',
  data?: unknown,
  key?: string,
  signal?: AbortSignal,
) {
  const response = await fetch(`/api/v1${path}`, {
    method,
    signal,
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
function flattenTopics(
  items: Topic[],
  depth = 0,
): { topic: Topic; depth: number }[] {
  return items.flatMap((topic) => [
    { topic, depth },
    ...flattenTopics(topic.children, depth + 1),
  ])
}
function TopicOptions({ items }: { items: Topic[] }) {
  return flattenTopics(items).map(({ topic, depth }) => (
    <option key={topic.id} value={topic.id}>
      {'— '.repeat(depth)}
      {topic.title}
    </option>
  ))
}
export function Practice({
  member,
  canSignOut,
}: {
  member: { name: string; role: 'admin' | 'learner' }
  canSignOut: boolean
}) {
  const generation = useRef(0)
  const setupRef = useRef<HTMLDivElement>(null)
  const invalidate = useCallback(() => {
    generation.current++
  }, [])
  const router = useRouter()
  const [subjects, setSubjects] = useState<Subject[]>([])
  const [selected, setSelected] = useState<Subject | null>(null)
  useEffect(() => {
    if (selected)
      setupRef.current?.scrollIntoView({ block: 'nearest', behavior: 'smooth' })
  }, [selected])
  const [topics, setTopics] = useState<Topic[]>([])
  const [topic, setTopic] = useState('')
  const [count, setCount] = useState(10)
  const [questionType, setQuestionType] = useState<QuestionType>('mcq')
  const [attempt, setAttempt] = useState<Attempt | null>(null)
  const [position, setPosition] = useState(0)
  const saves = useAnswerSaves()
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
    const version = generation.current
    // Loading the catalog must not depend on successful attempt recovery.
    request('/subjects')
      .then((list) => {
        if (active)
          setSubjects(
            list.items.map((item: unknown) => subjectSchema.parse(item)),
          )
      })
      .catch((reason) => {
        if (active) setError(reason.message)
      })
      .finally(() => {
        if (active) setLoading(false)
      })
    const id = new URLSearchParams(location.search).get('attempt')
    if (id)
      void (async () => {
        try {
          const saved = attemptSchema.parse(
            await request(`/attempts/${encodeURIComponent(id)}`),
          )
          if (!active || generation.current !== version) return
          setAttempt(saved)
          const firstOpen = saved.items.findIndex((it) => it.answer === null)
          setPosition(firstOpen === -1 ? 0 : firstOpen)
          if (saved.status === 'submitted') {
            const result = resultSchema.parse(
              await request(`/attempts/${saved.id}/submit`, 'POST'),
            )
            if (active && generation.current === version) setResult(result)
          }
        } catch (reason) {
          if (active && generation.current === version)
            setError((reason as Error).message)
        }
      })()
    return () => {
      active = false
      invalidate()
    }
  }, [invalidate])
  async function choose(subject: Subject) {
    const version = ++generation.current
    setBusy(true)
    setError('')
    setSelected(subject)
    setQuestionType('mcq')
    setCount(Math.max(1, Math.min(10, subject.question_count)))
    setTopics([])
    setTopic('')
    try {
      const data = await request(
        `/subjects/${encodeURIComponent(subject.code)}/topics`,
      )
      if (generation.current !== version) return
      setTopics(data.items)
    } catch (reason) {
      if (generation.current === version) setError((reason as Error).message)
    } finally {
      if (generation.current === version) setBusy(false)
    }
  }
  async function start() {
    if (!selected) return
    const version = ++generation.current
    setBusy(true)
    setError('')
    const input = {
      subject: selected.code,
      mode: 'practice',
      type: questionType,
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
      if (generation.current !== version) return
      setAttempt(saved)
      setPosition(0)
      setResult(null)
      setPendingKey(null)
      history.replaceState(null, '', `?attempt=${saved.id}`)
    } catch (reason) {
      if (generation.current === version) {
        const message = (reason as Error).message
        setError(
          message.startsWith('Chưa đủ câu hỏi')
            ? `Chủ đề hoặc loại câu đã chọn chưa đủ ${count} câu. Hãy giảm số câu, chọn “Tất cả chủ đề” hoặc đổi loại câu.`
            : message,
        )
      }
    } finally {
      if (generation.current === version) setBusy(false)
    }
  }
  function selectAnswer(answer: AttemptAnswer | '') {
    const item = attempt?.items[position]
    if (!attempt || !item || busy) return
    saves.select(
      attempt.id,
      item.position,
      answer,
      item.answer_version,
      async (chosen, signal, version) => {
        const response = await request(
          `/attempts/${attempt.id}/items/${item.position}`,
          'PUT',
          {
            answer: chosen,
            defer_feedback: true,
            expected_answer_version: version,
          },
          undefined,
          signal,
        )
        if (response.saved !== true) return response
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
        return response
      },
    )
  }
  async function finish() {
    if (!attempt) return
    const version = generation.current
    setBusy(true)
    setError('')
    try {
      const failed = await saves.flush(attempt.id)
      if (failed.length) {
        setPosition(
          attempt.items.findIndex((row) => row.position === failed[0]),
        )
        setError('Chưa lưu được đáp án ở câu ' + failed.join(', ') + '.')
        return
      }
      const summary = resultSchema.parse(
        await request(`/attempts/${attempt.id}/submit`, 'POST'),
      )
      if (generation.current !== version) return
      setResult(summary)
    } catch (reason) {
      if (generation.current === version) setError((reason as Error).message)
    } finally {
      if (generation.current === version) setBusy(false)
    }
  }
  async function logout() {
    const version = ++generation.current
    setBusy(true)
    setError('')
    try {
      const csrfToken = await getCsrfToken()
      if (!csrfToken) throw new Error('Không thể đăng xuất. Vui lòng thử lại.')
      const response = await fetch('/api/auth/signout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          csrfToken,
          callbackUrl: '/login',
          json: 'true',
        }),
      })
      if (!response.ok)
        throw new Error('Chưa thể thu hồi phiên. Vui lòng thử đăng xuất lại.')
      const payload = await response.json()
      const target = new URL(payload.url ?? '', location.origin)
      if (
        target.origin !== location.origin ||
        target.pathname !== '/login' ||
        target.search ||
        target.hash
      )
        throw new Error('Không thể đăng xuất. Vui lòng thử lại.')
      if (generation.current !== version) return
      router.replace('/login')
      router.refresh()
    } catch (reason) {
      if (generation.current === version) setError((reason as Error).message)
    } finally {
      if (generation.current === version) setBusy(false)
    }
  }
  function reset() {
    generation.current++
    setBusy(false)
    history.replaceState(null, '', location.pathname)
    setAttempt(null)
    setSelected(null)
    setResult(null)
    setError('')
    setPendingKey(null)
  }
  const item = attempt?.items[position]
  const save =
    attempt && item ? saves.entry(attempt.id, item.position) : undefined
  const answer = save ? save.answer : (item?.answer ?? '')
  const completed =
    attempt?.items.filter((item) => {
      const entry = saves.entry(attempt.id, item.position)
      return entry ? entry.status === 'saved' : item.answer !== null
    }).length ?? 0
  const hasCurriculumBanks = subjects.some((item) => item.code !== 'synthetic')
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
        <div className="account">
          <Link href="/study">Thi thử · Thống kê · Ôn tập</Link>
          <Link href="/written">Đề tự luận</Link>
          <span title={member.name}>{member.name}</span>
          {member.role === 'admin' && <Link href="/admin">Quản trị</Link>}
          {canSignOut ? (
            <button disabled={busy} onClick={() => void logout()}>
              Đăng xuất
            </button>
          ) : (
            <span className="local-badge">Bộ luyện mẫu</span>
          )}
        </div>
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
              : 'Chọn học phần, rèn trắc nghiệm, bài tính, danh pháp cấu trúc hoặc chỉ bộ phận giải phẫu với lời giải chi tiết.'}
          </p>
        </section>
        {!hasCurriculumBanks && (
          <p className="sample-note">
            Bộ luyện mẫu gồm dữ liệu tổng hợp tự viết, chưa phải ngân hàng đề
            thi Dược.
          </p>
        )}
        {error && (
          <div role="alert" className="error">
            {error}
            <button onClick={reset}>Về bộ luyện</button>
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
            {result.feedback?.map(({ position, feedback }) => (
              <section key={position} className="feedback">
                <h3>
                  Câu {position} · Đáp án: {feedback.correct_answer}
                </h3>
                <RichText text={feedback.explanation} />
                <ul>
                  {feedback.sources.map((source) => (
                    <li key={source.locator}>
                      {source.title} — {source.locator}
                    </li>
                  ))}
                </ul>
              </section>
            ))}
            <button className="primary" onClick={reset}>
              Luyện một bài mới
            </button>
          </section>
        ) : attempt && item ? (
          <div className="practice-layout">
            <aside className="panel navigator" aria-label="Tiến độ bài luyện">
              <p className="eyebrow">
                {selected?.code === 'synthetic'
                  ? 'BÀI LUYỆN MẪU'
                  : 'TIẾN ĐỘ BÀI LUYỆN'}
              </p>
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
                    className={`${index === position ? 'active' : ''} ${(saves.entry(attempt.id, question.position)?.status ?? (question.answer ? 'saved' : '')) === 'saved' ? 'answered' : ''}`}
                    onClick={() => {
                      setPosition(index)
                      setError('')
                    }}
                    disabled={busy}
                  >
                    {question.position}
                  </button>
                ))}
              </div>
              <p className="muted">
                Đáp án tự lưu khi bạn chọn. Bạn có thể tải lại trang để tiếp
                tục.
              </p>
            </aside>
            <section className="panel question">
              <p className="eyebrow">
                CÂU {item.position} / {attempt.items.length}
              </p>
              <h2>
                <RichText text={item.stem} />
              </h2>
              {!item.exercise &&
                (item.assets ?? []).map((asset) => (
                  <Image
                    key={asset.id}
                    unoptimized
                    src={asset.url}
                    alt={asset.alt_text}
                    width={600}
                    height={400}
                    style={{
                      maxWidth: '100%',
                      height: 'auto',
                      objectFit: 'contain',
                    }}
                  />
                ))}
              <button
                className="secondary"
                disabled={busy}
                onClick={async () => {
                  setBusy(true)
                  setError('')
                  try {
                    await request(
                      `/attempts/${attempt.id}/items/${item.position}`,
                      'PUT',
                      { flagged: !item.flagged },
                    )
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
                  } catch (reason) {
                    setError((reason as Error).message)
                  } finally {
                    setBusy(false)
                  }
                }}
              >
                {item.flagged ? 'Bỏ đánh dấu' : 'Đánh dấu ôn lại'}
              </button>
              <QuestionReport
                questionId={item.question_id}
                revisionId={item.revision_id}
              />
              {item.exercise ? (
                <VisualAnswer
                  item={item}
                  answer={answer}
                  busy={busy}
                  onAnswer={selectAnswer}
                />
              ) : (
                <fieldset disabled={busy}>
                  <legend className="sr-only">Chọn một đáp án</legend>
                  {item.choices.map((choice) => (
                    <label
                      key={choice.label}
                      className={`choice ${answer === choice.label ? 'chosen' : ''}`}
                    >
                      <input
                        type="radio"
                        name={`question-${item.position}`}
                        value={choice.label}
                        checked={answer === choice.label}
                        onChange={() => selectAnswer(choice.label)}
                      />
                      <span className="choice-label">{choice.label}</span>
                      <span>
                        <RichText text={choice.text} />
                      </span>
                    </label>
                  ))}
                </fieldset>
              )}
              <AnswerSaveStatus
                entry={save}
                saved={item.answer !== null}
                retry={() => saves.retry(attempt.id, item.position)}
              />
              <div className="question-actions">
                <button
                  className="secondary"
                  disabled={busy || position === 0}
                  onClick={() => setPosition(position - 1)}
                >
                  Câu trước
                </button>
                <button
                  className="primary"
                  disabled={busy || position === attempt.items.length - 1}
                  onClick={() => setPosition(position + 1)}
                >
                  Câu tiếp theo
                </button>
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
              <span>
                {hasCurriculumBanks
                  ? `${String(subjects.length).padStart(2, '0')} học phần ôn thi`
                  : '01 bộ câu hỏi mẫu'}
              </span>
            </div>
            <div className="selection-grid">
              {subjects.map((subject) => {
                const meta = SUBJECT_META[subject.code] ?? {
                  icon: '∑',
                  tag: 'TỔNG HỢP',
                  summary: 'Đọc dữ liệu · Tính toán cơ bản',
                }
                return (
                  <button
                    key={subject.id}
                    className={`subject-card ${selected?.id === subject.id ? 'selected' : ''}`}
                    onClick={() => choose(subject)}
                    disabled={busy}
                  >
                    <span className="subject-icon">{meta.icon}</span>
                    <span className="tag">{meta.tag}</span>
                    <h3>{subject.name}</h3>
                    <p>{meta.summary}</p>
                    <div className="card-footer">
                      <span>{subject.question_count} câu đã duyệt</span>
                      <span aria-hidden="true">↗</span>
                    </div>
                  </button>
                )
              })}
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
              <div className="panel setup" ref={setupRef}>
                <label>
                  Loại câu
                  <select
                    value={questionType}
                    disabled={busy}
                    onChange={(event) => {
                      const type = questionTypeSchema.parse(event.target.value)
                      setQuestionType(type)
                      setError('')
                      if (type !== 'mcq') setCount(1)
                    }}
                  >
                    <option value="mcq">Trắc nghiệm</option>
                    {typeAvailable(selected.code, 'name_from_structure') && (
                      <option value="name_from_structure">
                        Danh pháp từ hình
                      </option>
                    )}
                    {typeAvailable(selected.code, 'image_hotspot') && (
                      <option value="image_hotspot">
                        Chỉ bộ phận trên hình
                      </option>
                    )}
                  </select>
                </label>
                <label>
                  Chủ đề
                  <select
                    value={topic}
                    onChange={(event) => {
                      setTopic(event.target.value)
                      setError('')
                    }}
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
                    onChange={(event) => {
                      setCount(Number(event.target.value))
                      setError('')
                    }}
                    disabled={busy}
                  >
                    {Array.from({ length: 10 }, (_, index) => index + 1).map(
                      (value) => (
                        <option key={value} value={value}>
                          {value} câu
                        </option>
                      ),
                    )}
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
