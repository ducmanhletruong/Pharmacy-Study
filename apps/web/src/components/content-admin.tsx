'use client'

import { useCallback, useEffect, useRef, useState, type FormEvent } from 'react'

type Status =
  'draft' | 'verified' | 'approved' | 'under_review' | 'hidden' | 'retired'
type Choice = {
  label: 'A' | 'B' | 'C' | 'D'
  text: string
  is_correct: boolean
}
type Source = {
  id: string
  title: string
  locator: string
  license: string
  review_status: 'pending' | 'approved' | 'rejected'
}
type Report = {
  id: string
  question_id?: string
  reason: string
  note?: string | null
  status: string
}
type Question = {
  id: string
  subject: string
  status: Status
  version: number
  stem: string
}
type Topic = { id: string; code: string; title: string; children: Topic[] }
type Detail = Omit<Question, 'stem'> & {
  revision: {
    id: string
    stem: string
    explanation: string
    difficulty: 1 | 2 | 3
    choices: Choice[]
    topic_codes: string[]
    sources: Source[]
    accepted_answers?: string[]
    assets: { id: string; url: string; alt_text: string; mime: string }[]
  }
  history: { id: string; rev_no?: number; stem?: string; created_at?: string }[]
  reports: Report[]
}
type ImportResult = {
  import_id: string
  status: string
  counts: { created: number; duplicates: number }
  report: { near_duplicates?: unknown[] }
}
const statusLabels: Record<Status, string> = {
  draft: 'Bản nháp',
  verified: 'Đã xác minh',
  approved: 'Đã duyệt',
  under_review: 'Cần xem lại',
  hidden: 'Đã ẩn',
  retired: 'Ngừng sử dụng',
}
const transitions: Record<Status, Status[]> = {
  draft: ['verified'],
  verified: ['approved'],
  approved: ['under_review', 'hidden', 'retired'],
  under_review: ['approved', 'hidden'],
  hidden: ['approved', 'retired'],
  retired: [],
}
const reasonLabels: Record<string, string> = {
  wrong_answer: 'Đáp án chưa đúng',
  ambiguous: 'Câu hỏi chưa rõ',
  typo: 'Lỗi chính tả',
  bad_image: 'Hình ảnh có vấn đề',
  other: 'Vấn đề khác',
}
const reportLabels: Record<string, string> = {
  open: 'Chưa xử lý',
  accepted: 'Đã xác nhận lỗi',
  rejected: 'Không xác nhận lỗi',
  resolved: 'Đã khắc phục',
}
const reviewLabels = {
  pending: 'Chờ duyệt',
  approved: 'Đã duyệt',
  rejected: 'Từ chối',
}
async function api<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`/api/v1${path}`, init)
  const value = await response.json()
  if (!response.ok)
    throw new Error(
      value.error?.message ?? 'Không thể xử lý yêu cầu. Vui lòng thử lại.',
    )
  return value
}
const patch = (value: unknown): RequestInit => ({
  method: 'PATCH',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify(value),
})
function flattenTopics(
  items: Topic[],
  depth = 0,
): { id: string; code: string; title: string }[] {
  return items.flatMap((item) => [
    {
      id: item.id,
      code: item.code,
      title: `${'— '.repeat(depth)}${item.title}`,
    },
    ...flattenTopics(item.children, depth + 1),
  ])
}

export function ContentAdmin() {
  const [questions, setQuestions] = useState<Question[]>([])
  const [subjects, setSubjects] = useState<{ code: string; name: string }[]>([])
  const [topics, setTopics] = useState<Topic[]>([])
  const [sources, setSources] = useState<Source[]>([])
  const [reports, setReports] = useState<Report[]>([])
  const [detail, setDetail] = useState<Detail | null>(null)
  const [filters, setFilters] = useState({
    subject: '',
    topic: '',
    status: '',
    type: 'mcq',
  })
  const [cursor, setCursor] = useState<string | null>(null)
  const [busy, setBusy] = useState(true)
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')
  const [upload, setUpload] = useState<File | null>(null)
  const [imported, setImported] = useState<ImportResult | null>(null)
  const mounted = useRef(true)
  useEffect(
    () => () => {
      mounted.current = false
    },
    [],
  )
  const loadQuestions = useCallback(
    async (after?: string) => {
      const query = new URLSearchParams({ limit: '30' })
      for (const [key, value] of Object.entries(filters))
        if (value) query.set(key, value)
      if (after) query.set('cursor', after)
      const value = await api<{
        items: Question[]
        next_cursor: string | null
      }>(`/admin/questions?${query}`)
      if (mounted.current) {
        setQuestions((previous) =>
          after ? [...previous, ...value.items] : value.items,
        )
        setCursor(value.next_cursor)
      }
    },
    [filters],
  )
  const loadShared = useCallback(async () => {
    const outcomes = await Promise.allSettled([
      api<{ items: Source[] }>('/admin/sources').then((value) => {
        if (mounted.current) setSources(value.items)
      }),
      api<{ items: Report[] }>('/admin/reports?status=open').then((value) => {
        if (mounted.current) setReports(value.items)
      }),
      api<{ items: { code: string; name: string }[] }>('/subjects').then(
        (value) => {
          if (mounted.current) setSubjects(value.items)
        },
      ),
    ])
    const failed = outcomes.find((outcome) => outcome.status === 'rejected')
    if (failed?.status === 'rejected') throw failed.reason
  }, [])
  const initialLoad = useRef(loadQuestions)
  useEffect(() => {
    mounted.current = true
    Promise.allSettled([initialLoad.current(), loadShared()]).then(
      (outcomes) => {
        const failed = outcomes.find((outcome) => outcome.status === 'rejected')
        if (mounted.current && failed?.status === 'rejected')
          setError((failed.reason as Error).message)
        if (mounted.current) setBusy(false)
      },
    )
  }, [loadShared])
  async function run(action: () => Promise<void>) {
    if (busy) return
    setBusy(true)
    setError('')
    setMessage('')
    try {
      await action()
    } catch (reason) {
      if (mounted.current) setError((reason as Error).message)
    } finally {
      if (mounted.current) setBusy(false)
    }
  }
  async function openQuestion(id: string) {
    await run(async () => {
      const value = await api<Detail>(`/admin/questions/${id}`)
      if (mounted.current) setDetail(value)
    })
  }
  async function changeSubject(subject: string) {
    setFilters({ ...filters, subject, topic: '' })
    setTopics([])
    if (subject)
      await run(async () => {
        const value = await api<{ items: Topic[] }>(
          `/subjects/${encodeURIComponent(subject)}/topics`,
        )
        if (mounted.current) setTopics(value.items)
      })
  }
  async function updateQuestion(value: {
    status?: Status
    revision?: unknown
  }) {
    if (!detail) return
    await run(async () => {
      const saved = await api<Detail>(
        `/admin/questions/${detail.id}`,
        patch({ expected_version: detail.version, ...value }),
      )
      if (mounted.current) {
        setDetail(saved)
        setMessage(
          value.revision
            ? 'Đã lưu bản sửa. Câu hỏi trở về bản nháp để duyệt lại.'
            : 'Đã cập nhật trạng thái câu hỏi.',
        )
      }
      await loadQuestions()
    })
  }
  async function importFile(event: FormEvent) {
    event.preventDefault()
    if (!upload) return
    await run(async () => {
      const data = new FormData()
      data.set('bundle', upload)
      const result = await api<ImportResult>('/admin/imports', {
        method: 'POST',
        body: data,
      })
      if (mounted.current) {
        setImported(result)
        setMessage(
          result.status === 'already_imported'
            ? 'Tệp này đã được nhập trước đó.'
            : 'Đã nhập câu hỏi ở trạng thái bản nháp.',
        )
      }
      await Promise.all([loadQuestions(), loadShared()])
    })
  }
  async function reviewSource(
    source: Source,
    review_status: Source['review_status'],
  ) {
    await run(async () => {
      await api('/admin/sources', patch({ id: source.id, review_status }))
      await Promise.all([loadQuestions(), loadShared()])
      if (detail) {
        const value = await api<Detail>(`/admin/questions/${detail.id}`)
        if (mounted.current) setDetail(value)
      }
      if (mounted.current) setMessage('Đã cập nhật đánh giá nguồn tài liệu.')
    })
  }
  async function resolveReport(report: Report, status: string, note: string) {
    await run(async () => {
      await api(
        `/admin/reports/${report.id}`,
        patch({ status, ...(note.trim() ? { note: note.trim() } : {}) }),
      )
      await loadShared()
      if (detail) {
        const value = await api<Detail>(`/admin/questions/${detail.id}`)
        if (mounted.current) setDetail(value)
      }
      if (mounted.current)
        setMessage(
          'Đã lưu kết quả xử lý báo lỗi. Hãy kiểm tra câu hỏi trước khi cho sử dụng lại.',
        )
    })
  }
  return (
    <div className="content-admin" aria-busy={busy}>
      {error && (
        <div className="error" role="alert">
          {error}
          <button
            disabled={busy}
            onClick={() =>
              void run(async () => {
                await Promise.all([loadQuestions(), loadShared()])
                if (detail)
                  setDetail(await api<Detail>(`/admin/questions/${detail.id}`))
              })
            }
          >
            Tải lại dữ liệu
          </button>
        </div>
      )}
      {message && (
        <p className="admin-message" role="status">
          {message}
        </p>
      )}
      <section className="panel" aria-labelledby="import-heading">
        <h2 id="import-heading">Nhập bộ câu hỏi</h2>
        <p>
          Chọn tệp bộ câu hỏi đã chuẩn bị. Nội dung mới cần được kiểm tra và
          duyệt trước khi học viên sử dụng.
        </p>
        <form onSubmit={importFile} className="admin-controls">
          <label>
            Tệp bộ câu hỏi
            <input
              type="file"
              accept=".json,application/json"
              disabled={busy}
              required
              onChange={(event) => setUpload(event.target.files?.[0] ?? null)}
            />
          </label>
          <button className="primary" disabled={busy || !upload}>
            Nhập bộ câu hỏi
          </button>
        </form>
        {imported && (
          <p role="status">
            Đã tạo {imported.counts.created} câu; trùng nội dung:{' '}
            {imported.counts.duplicates} câu.{' '}
            {(imported.report.near_duplicates?.length ?? 0) > 0 &&
              `${imported.report.near_duplicates!.length} câu có nội dung gần giống cần kiểm tra.`}
          </p>
        )}
      </section>
      <section className="panel" aria-labelledby="questions-heading">
        <h2 id="questions-heading">Ngân hàng câu hỏi</h2>
        <form
          className="admin-controls"
          onSubmit={(event) => {
            event.preventDefault()
            void run(async () => {
              await loadQuestions()
            })
          }}
        >
          <label>
            Môn học
            <select
              value={filters.subject}
              disabled={busy}
              onChange={(event) => void changeSubject(event.target.value)}
            >
              <option value="">Tất cả môn</option>
              {subjects.map((subject) => (
                <option key={subject.code} value={subject.code}>
                  {subject.name}
                </option>
              ))}
            </select>
          </label>
          <label>
            Chủ đề lọc
            <select
              value={filters.topic}
              disabled={busy || !filters.subject}
              onChange={(event) =>
                setFilters({ ...filters, topic: event.target.value })
              }
            >
              <option value="">Tất cả chủ đề</option>
              {flattenTopics(topics).map((topic) => (
                <option key={topic.id} value={topic.id}>
                  {topic.title}
                </option>
              ))}
            </select>
          </label>
          <label>
            Trạng thái lọc
            <select
              value={filters.status}
              disabled={busy}
              onChange={(event) =>
                setFilters({ ...filters, status: event.target.value })
              }
            >
              <option value="">Tất cả trạng thái</option>
              {Object.entries(statusLabels).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </label>
          <label>
            Loại câu
            <select
              value={filters.type}
              disabled={busy}
              onChange={(event) =>
                setFilters({ ...filters, type: event.target.value })
              }
            >
              <option value="mcq">Trắc nghiệm</option>
            </select>
          </label>
          <button className="secondary" disabled={busy}>
            Lọc câu hỏi
          </button>
        </form>
        <ul className="admin-question-list">
          {questions.map((question) => (
            <li key={question.id}>
              <button
                disabled={busy}
                onClick={() => void openQuestion(question.id)}
              >
                {question.stem}
              </button>
              <span>{statusLabels[question.status]}</span>
            </li>
          ))}
        </ul>
        {!questions.length && <p>Không có câu hỏi phù hợp với bộ lọc.</p>}
        {cursor && (
          <button
            className="secondary"
            disabled={busy}
            onClick={() =>
              void run(async () => {
                await loadQuestions(cursor)
              })
            }
          >
            Xem thêm câu hỏi
          </button>
        )}
      </section>
      {detail && (
        <QuestionEditor
          key={`${detail.id}:${detail.version}`}
          detail={detail}
          busy={busy}
          onSave={updateQuestion}
        />
      )}
      <section className="panel" aria-labelledby="sources-heading">
        <h2 id="sources-heading">Duyệt nguồn tài liệu</h2>
        <p>
          Đối chiếu nguồn, vị trí trích dẫn và quyền sử dụng trước khi duyệt câu
          hỏi.
        </p>
        <ul className="admin-source-list">
          {sources.map((source) => (
            <li key={source.id}>
              <h3>{source.title}</h3>
              <p>{source.locator}</p>
              <p>Quyền sử dụng: {source.license}</p>
              <p>{reviewLabels[source.review_status]}</p>
              <div className="admin-actions">
                <button
                  disabled={busy || source.review_status === 'approved'}
                  onClick={() => void reviewSource(source, 'approved')}
                >
                  Duyệt nguồn {source.title}
                </button>
                <button
                  disabled={busy || source.review_status === 'rejected'}
                  onClick={() => void reviewSource(source, 'rejected')}
                >
                  Từ chối nguồn {source.title}
                </button>
              </div>
            </li>
          ))}
        </ul>
        {!sources.length && <p>Chưa có nguồn tài liệu.</p>}
      </section>
      <section className="panel" aria-labelledby="reports-heading">
        <h2 id="reports-heading">Báo lỗi cần xử lý</h2>
        {reports.map((report) => (
          <ReportResolution
            key={report.id}
            report={report}
            busy={busy}
            onResolve={resolveReport}
            onOpen={openQuestion}
          />
        ))}
        {!reports.length && <p>Không còn báo lỗi đang chờ.</p>}
      </section>
    </div>
  )
}

function QuestionEditor({
  detail,
  busy,
  onSave,
}: {
  detail: Detail
  busy: boolean
  onSave: (value: { status?: Status; revision?: unknown }) => Promise<void>
}) {
  const [stem, setStem] = useState(detail.revision.stem)
  const [explanation, setExplanation] = useState(detail.revision.explanation)
  const [difficulty, setDifficulty] = useState(detail.revision.difficulty)
  const [choices, setChoices] = useState(detail.revision.choices)
  const [status, setStatus] = useState<Status | ''>('')
  async function edit(event: FormEvent) {
    event.preventDefault()
    await onSave({
      revision: {
        stem,
        explanation,
        difficulty,
        choices,
        topic_codes: detail.revision.topic_codes,
        sources: detail.revision.sources.map((source) => ({
          source_id: source.id,
          locator: source.locator,
        })),
        asset_ids: detail.revision.assets.map((asset) => asset.id),
        accepted_answers: detail.revision.accepted_answers ?? [],
      },
    })
  }
  return (
    <section className="panel admin-detail" aria-labelledby="detail-heading">
      <h2 id="detail-heading">Chi tiết câu hỏi</h2>
      <p>
        Trạng thái: <strong>{statusLabels[detail.status]}</strong> · Phiên bản{' '}
        {detail.version}
      </p>
      <form onSubmit={edit}>
        <fieldset disabled={busy}>
          <label>
            Nội dung câu hỏi
            <textarea
              required
              maxLength={20000}
              value={stem}
              onChange={(event) => setStem(event.target.value)}
            />
          </label>
          <label>
            Mức độ
            <select
              value={difficulty}
              onChange={(event) =>
                setDifficulty(Number(event.target.value) as 1 | 2 | 3)
              }
            >
              <option value={1}>Cơ bản</option>
              <option value={2}>Vận dụng</option>
              <option value={3}>Nâng cao</option>
            </select>
          </label>
          <fieldset>
            <legend>Các lựa chọn và đáp án đúng</legend>
            {choices.map((choice) => (
              <div className="admin-choice-edit" key={choice.label}>
                <label>
                  Lựa chọn {choice.label}
                  <input
                    required
                    maxLength={4000}
                    value={choice.text}
                    onChange={(event) =>
                      setChoices(
                        choices.map((item) =>
                          item.label === choice.label
                            ? { ...item, text: event.target.value }
                            : item,
                        ),
                      )
                    }
                  />
                </label>
                <label>
                  <input
                    type="radio"
                    name="correct-choice"
                    checked={choice.is_correct}
                    onChange={() =>
                      setChoices(
                        choices.map((item) => ({
                          ...item,
                          is_correct: item.label === choice.label,
                        })),
                      )
                    }
                  />
                  Đáp án đúng {choice.label}
                </label>
              </div>
            ))}
          </fieldset>
          <label>
            Giải thích
            <textarea
              required
              maxLength={20000}
              value={explanation}
              onChange={(event) => setExplanation(event.target.value)}
            />
          </label>
          <p>
            Lưu bản sửa sẽ tạo phiên bản mới và đưa câu hỏi về bản nháp để duyệt
            lại.
          </p>
          <button className="primary">Lưu bản sửa</button>
        </fieldset>
      </form>
      <form
        className="admin-controls"
        onSubmit={(event) => {
          event.preventDefault()
          if (status) void onSave({ status })
        }}
      >
        <label>
          Trạng thái tiếp theo
          <select
            value={status}
            disabled={busy || !transitions[detail.status].length}
            onChange={(event) => setStatus(event.target.value as Status)}
            required
          >
            <option value="">Chọn trạng thái</option>
            {transitions[detail.status].map((value) => (
              <option key={value} value={value}>
                {statusLabels[value]}
              </option>
            ))}
          </select>
        </label>
        <button className="secondary" disabled={busy || !status}>
          Cập nhật trạng thái
        </button>
      </form>
      <h3>Nguồn của câu hỏi</h3>
      <ul>
        {detail.revision.sources.map((source) => (
          <li key={`${source.id}:${source.locator}`}>
            {source.title} — {source.locator} (
            {reviewLabels[source.review_status]})
          </li>
        ))}
      </ul>
      {detail.revision.assets.map((asset) => (
        <figure key={asset.id}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={asset.url} alt={asset.alt_text} loading="lazy" />
          <figcaption>{asset.alt_text}</figcaption>
        </figure>
      ))}
      <h3>Lịch sử chỉnh sửa</h3>
      <ol>
        {detail.history.map((revision, index) => (
          <li key={revision.id}>
            Bản {revision.rev_no ?? index + 1}
            {revision.stem ? ` — ${revision.stem}` : ''}
          </li>
        ))}
      </ol>
      <h3>Báo lỗi của câu hỏi</h3>
      <ul>
        {detail.reports.map((report) => (
          <li key={report.id}>
            {reasonLabels[report.reason] ?? report.reason}:{' '}
            {report.note || 'Không có ghi chú'} ·{' '}
            {reportLabels[report.status] ?? report.status}
          </li>
        ))}
      </ul>
    </section>
  )
}
function ReportResolution({
  report,
  busy,
  onResolve,
  onOpen,
}: {
  report: Report
  busy: boolean
  onOpen: (id: string) => Promise<void>
  onResolve: (report: Report, status: string, note: string) => Promise<void>
}) {
  const [note, setNote] = useState('')
  const [status, setStatus] = useState('resolved')
  return (
    <form
      className="admin-report"
      onSubmit={(event) => {
        event.preventDefault()
        void onResolve(report, status, note)
      }}
    >
      <p>
        <strong>{reasonLabels[report.reason] ?? report.reason}</strong>:{' '}
        {report.note || 'Không có ghi chú'}
      </p>
      {report.question_id && (
        <button
          type="button"
          className="secondary"
          disabled={busy}
          onClick={() => void onOpen(report.question_id!)}
        >
          Xem câu hỏi được báo lỗi
        </button>
      )}
      <label>
        Kết quả xử lý
        <select
          value={status}
          disabled={busy}
          onChange={(event) => setStatus(event.target.value)}
        >
          <option value="accepted">Xác nhận lỗi</option>
          <option value="rejected">Không xác nhận lỗi</option>
          <option value="resolved">Đã khắc phục</option>
        </select>
      </label>
      <label>
        Ghi chú xử lý
        <textarea
          value={note}
          maxLength={4000}
          disabled={busy}
          onChange={(event) => setNote(event.target.value)}
        />
      </label>
      <button className="secondary" disabled={busy}>
        Lưu xử lý báo lỗi
      </button>
    </form>
  )
}
