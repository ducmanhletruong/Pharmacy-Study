'use client'
import Link from 'next/link'
import { useState, useEffect, useCallback, useRef, type FormEvent } from 'react'
import type { WrittenAttempt, WrittenSection } from '@pharmacy/api-contract'
type Paper = {
  id: string
  name: string
  subject: string
  duration_seconds: number
  sections: WrittenSection[]
}
async function request(
  path: string,
  method = 'GET',
  data?: unknown,
  key?: string,
) {
  const r = await fetch('/api/v1/me' + path, {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...(key ? { 'Idempotency-Key': key } : {}),
    },
    ...(data ? { body: JSON.stringify(data) } : {}),
  })
  const value = await r.json()
  if (!r.ok)
    throw new Error(value.error?.message ?? 'Không thể xử lý bài tự luận')
  return value
}
async function base64(file: File) {
  const bytes = new Uint8Array(await file.arrayBuffer())
  let text = ''
  for (let start = 0; start < bytes.length; start += 8192)
    text += String.fromCharCode(...bytes.subarray(start, start + 8192))
  return btoa(text)
}
export function WrittenWorkbench() {
  const [papers, setPapers] = useState<Paper[]>([]),
    [paper, setPaper] = useState(''),
    [attempt, setAttempt] = useState<WrittenAttempt | null>(null)
  const [historyItems, setHistoryItems] = useState<
    { id: string; name: string; status: string; score: number | null }[]
  >([])
  const [answers, setAnswers] = useState<string[]>([]),
    [points, setPoints] = useState<number[]>([]),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(''),
    [message, setMessage] = useState(''),
    [remaining, setRemaining] = useState<number | null>(null)
  const [name, setName] = useState('Đề tự luận riêng'),
    [subject, setSubject] = useState('hpt1'),
    [duration, setDuration] = useState(5400),
    [weights, setWeights] = useState('2.5;2.5;2.5;2.5')
  const [examFile, setExamFile] = useState<File | null>(null),
    [referenceFile, setReferenceFile] = useState<File | null>(null)
  const offset = useRef(0),
    autoSubmitted = useRef(false),
    pending = useRef<{ paper: string; key: string } | null>(null)
  const install = useCallback((a: WrittenAttempt) => {
    setAttempt(a)
    setAnswers(a.answers.map((answer) => answer.text))
    setPoints(a.answers.map((answer) => answer.points ?? 0))
    offset.current = Date.parse(a.server_time) - Date.now()
    history.replaceState(null, '', '?id=' + a.id)
  }, [])
  useEffect(() => {
    let active = true
    request('/written-papers?limit=100')
      .then((d) => {
        if (active) {
          setPapers(d.items)
          setPaper(d.items[0]?.id ?? '')
        }
      })
      .catch((e) => {
        if (active) setError(e.message)
      })
    request('/written-attempts?limit=100')
      .then((data) => {
        if (active) setHistoryItems(data.items)
      })
      .catch((e) => {
        if (active) setError(e.message)
      })
    const id = new URLSearchParams(location.search).get('id')
    if (id)
      request('/written-attempts/' + encodeURIComponent(id))
        .then((a) => {
          if (active) install(a)
        })
        .catch((e) => {
          if (active) setError(e.message)
        })
    return () => {
      active = false
    }
  }, [install])
  const finish = useCallback(async () => {
    if (!attempt) return
    setBusy(true)
    setError('')
    try {
      install(
        await request('/written-attempts/' + attempt.id + '/submit', 'POST'),
      )
      setMessage('Bài đã kết thúc; bạn có thể tự đối chiếu và nhập điểm.')
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setBusy(false)
    }
  }, [attempt, install])
  useEffect(() => {
    if (!attempt || attempt.status !== 'in_progress') return
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
  }, [attempt, finish])
  async function start() {
    if (!paper) return
    setBusy(true)
    setError('')
    if (pending.current?.paper !== paper)
      pending.current = { paper, key: crypto.randomUUID() }
    try {
      install(
        await request(
          '/written-attempts',
          'POST',
          { paper_id: paper },
          pending.current.key,
        ),
      )
      autoSubmitted.current = false
      pending.current = null
      setMessage('')
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setBusy(false)
    }
  }
  async function save(index: number) {
    if (!attempt) return
    setBusy(true)
    setError('')
    try {
      const a = await request('/written-attempts/' + attempt.id, 'PUT', {
        position: index + 1,
        text: answers[index] ?? '',
      })
      setAttempt(a)
      if (a.status !== 'in_progress') install(a)
      setMessage(
        a.status === 'in_progress'
          ? `Đã lưu câu ${index + 1}.`
          : 'Đã hết giờ; chỉ giữ nội dung đã lưu trước hạn.',
      )
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setBusy(false)
    }
  }
  async function grade() {
    if (!attempt) return
    setBusy(true)
    setError('')
    try {
      install(
        await request('/written-attempts/' + attempt.id + '/grade', 'POST', {
          points,
        }),
      )
      setMessage(
        'Đã lưu điểm tự chấm. Đây không phải điểm chấm tự động hoặc điểm được giảng viên xác nhận.',
      )
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setBusy(false)
    }
  }
  async function upload(event: FormEvent) {
    event.preventDefault()
    if (!examFile) {
      setError('Chọn PDF đề riêng trước.')
      return
    }
    if (examFile.size + (referenceFile?.size ?? 0) > 3 * 1024 * 1024) {
      setError('Tổng PDF tối đa3MiB cho một lần nhập.')
      return
    }
    setBusy(true)
    setError('')
    try {
      const sections = weights.split(';').map((value, index) => ({
        title: 'Câu ' + (index + 1),
        max_points: Number(value.trim().replace(',', '.')),
      }))
      const value = await request('/written-papers', 'POST', {
        name,
        subject,
        duration_seconds: duration,
        sections,
        exam_pdf_base64: await base64(examFile),
        ...(referenceFile
          ? { reference_pdf_base64: await base64(referenceFile) }
          : {}),
      })
      setPapers((await request('/written-papers?limit=100')).items)
      setPaper(value.id)
      setMessage('Đã thêm đề riêng. Chỉ tài khoản của bạn truy cập được.')
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setBusy(false)
    }
  }
  return (
    <main className="workspace">
      <section className="panel">
        <Link href="/study">← Thi thử và thống kê</Link>
        <h1>Thi tự luận theo đề gốc</h1>
        <p>
          Đề PDF và bài viết được lưu riêng cho tài khoản của bạn. Tự đối chiếu
          hoặc chấm tay; không dùng AI chấm tự luận.
        </p>
      </section>
      {error && (
        <p role="alert" className="error">
          {error}
        </p>
      )}
      {message && <p role="status">{message}</p>}
      {attempt ? (
        <section className="panel">
          <h2>{attempt.name}</h2>
          <p>
            <a
              href={'/api/v1/me/written-papers/' + attempt.paper_id + '/pdf'}
              target="_blank"
              rel="noreferrer"
            >
              Mở/tải PDF đề gốc riêng
            </a>
          </p>
          {attempt.status === 'in_progress' ? (
            <>
              <p role="timer" aria-label="Thời gian tự luận còn lại">
                Còn lại:{' '}
                {remaining === null
                  ? 'Đang đồng bộ…'
                  : `${Math.floor(remaining / 60)}:${String(remaining % 60).padStart(2, '0')}`}
              </p>
              <p>
                Bấm lưu từng câu. Khi nộp hoặc hết giờ, chỉ nội dung đã được
                server lưu mới được giữ.
              </p>
            </>
          ) : (
            <>
              <p>
                {attempt.status === 'expired' ? 'Đã hết giờ' : 'Đã nộp bài'}.
                Điểm:{' '}
                {attempt.score === null
                  ? 'Chưa chấm'
                  : attempt.score.toFixed(2) + '/10 — tự chấm'}
              </p>
              {attempt.reference_available && (
                <a
                  href={
                    '/api/v1/me/written-papers/' +
                    attempt.paper_id +
                    '/pdf?reference_for=' +
                    attempt.id
                  }
                  target="_blank"
                  rel="noreferrer"
                >
                  Mở/tải tài liệu gốc đầy đủ để tự đối chiếu
                </a>
              )}
              <p>
                Đối chiếu tài liệu/đáp án bạn có rồi nhập điểm từng câu. Điểm
                này mang nhãn tự chấm, không cộng vào tỉ lệ đúng MCQ.
              </p>
            </>
          )}
          {attempt.sections.map((section, index) => (
            <section key={index}>
              <h3>
                {section.title} — {section.max_points} điểm
              </h3>
              <label htmlFor={`written-answer-${index}`}>
                Bài viết {section.title}
              </label>
              <textarea
                id={`written-answer-${index}`}
                rows={8}
                maxLength={20000}
                value={answers[index] ?? ''}
                disabled={busy}
                readOnly={attempt.status !== 'in_progress'}
                onChange={(e) =>
                  setAnswers(
                    answers.map((text, i) =>
                      i === index ? e.target.value : text,
                    ),
                  )
                }
              />
              {attempt.status === 'in_progress' ? (
                <button disabled={busy} onClick={() => void save(index)}>
                  Lưu {section.title}
                </button>
              ) : (
                <label>
                  Điểm tự chấm {section.title}
                  <input
                    type="number"
                    step="0.01"
                    min={0}
                    max={section.max_points}
                    value={points[index] ?? 0}
                    disabled={busy}
                    onChange={(e) =>
                      setPoints(
                        points.map((p, i) =>
                          i === index ? Number(e.target.value) : p,
                        ),
                      )
                    }
                  />
                </label>
              )}
            </section>
          ))}
          {attempt.status === 'in_progress' ? (
            <button
              className="primary"
              disabled={busy}
              onClick={() => void finish()}
            >
              Nộp bài tự luận
            </button>
          ) : (
            <>
              <button
                className="primary"
                disabled={busy}
                onClick={() => void grade()}
              >
                Lưu điểm tự chấm
              </button>
              <button
                disabled={busy}
                onClick={() => {
                  setAttempt(null)
                  setMessage('')
                  history.replaceState(null, '', '/written')
                }}
              >
                Chọn đề tự luận khác
              </button>
            </>
          )}
        </section>
      ) : (
        <>
          <section className="panel">
            <h2>Bài tự luận đã lưu</h2>
            <ul>
              {historyItems.map((row) => (
                <li key={row.id}>
                  <button
                    disabled={busy}
                    onClick={async () => {
                      setBusy(true)
                      setError('')
                      autoSubmitted.current = false
                      try {
                        install(await request('/written-attempts/' + row.id))
                      } catch (e) {
                        setError((e as Error).message)
                      } finally {
                        setBusy(false)
                      }
                    }}
                  >
                    {row.name} — {row.status}
                    {row.score !== null ? ` — ${row.score}/10 (tự chấm)` : ''}
                  </button>
                </li>
              ))}
            </ul>
            <h2>Đề riêng của bạn</h2>
            <label>
              Đề tự luận
              <select
                value={paper}
                onChange={(e) => setPaper(e.target.value)}
                disabled={busy}
              >
                {papers.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name} — {p.sections.length} câu /{' '}
                    {p.duration_seconds / 60} phút
                  </option>
                ))}
              </select>
            </label>
            {!papers.length && (
              <p>Chưa có đề riêng. Bạn có thể nhập PDF bên dưới.</p>
            )}
            <button
              className="primary"
              disabled={busy || !paper}
              onClick={() => void start()}
            >
              Bắt đầu thi tự luận
            </button>
          </section>
          <section className="panel">
            <h2>Nhập đề tự luận riêng</h2>
            <p>
              Chọn PDF chỉ có phần đề; tài liệu đáp án nhập riêng nếu có. Tổng
              tệp tối đa3MiB. Điểm các câu cách nhau bằng dấu chấm phẩy,
              tổng10điểm.
            </p>
            <form onSubmit={upload}>
              <fieldset disabled={busy}>
                <legend>Cấu hình đề riêng</legend>
                <label>
                  Tên đề tự luận
                  <input
                    value={name}
                    maxLength={160}
                    onChange={(e) => setName(e.target.value)}
                    required
                  />
                </label>
                <label>
                  Môn của đề tự luận
                  <select
                    value={subject}
                    onChange={(e) => {
                      setSubject(e.target.value)
                      if (e.target.value === 'hpt1') {
                        setDuration(5400)
                        setWeights('2.5;2.5;2.5;2.5')
                      } else {
                        setDuration(3600)
                        setWeights(
                          e.target.value === 'hhc2'
                            ? '2;2;1;4;1'
                            : '2;2;2.25;1.5;2.25',
                        )
                      }
                    }}
                  >
                    <option value="hpt1">Hóa phân tích 1</option>
                    <option value="hhc2">Hóa hữu cơ 2</option>
                    <option value="vsks1">Vi sinh – Ký sinh trùng 1</option>
                  </select>
                </label>
                <label>
                  Thời gian tự luận (giây)
                  <input
                    type="number"
                    min={1}
                    max={14400}
                    value={duration}
                    onChange={(e) => setDuration(Number(e.target.value))}
                  />
                </label>
                <label>
                  Điểm từng câu
                  <input
                    value={weights}
                    onChange={(e) => setWeights(e.target.value)}
                    required
                  />
                </label>
                <label>
                  PDF đề riêng
                  <input
                    type="file"
                    accept="application/pdf,.pdf"
                    onChange={(e) => setExamFile(e.target.files?.[0] ?? null)}
                    required
                  />
                </label>
                <label>
                  PDF tài liệu đối chiếu (tùy chọn)
                  <input
                    type="file"
                    accept="application/pdf,.pdf"
                    onChange={(e) =>
                      setReferenceFile(e.target.files?.[0] ?? null)
                    }
                  />
                </label>
                <button type="submit">Lưu đề tự luận riêng</button>
              </fieldset>
            </form>
          </section>
        </>
      )}
    </main>
  )
}
