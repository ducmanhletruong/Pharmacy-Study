'use client'

import { useEffect, useRef, useState, type FormEvent } from 'react'

type Props = { questionId: string; revisionId: string }
export function QuestionReport(props: Props) {
  return (
    <QuestionReportForm
      key={`${props.questionId}:${props.revisionId}`}
      {...props}
    />
  )
}
function QuestionReportForm({ questionId, revisionId }: Props) {
  const [open, setOpen] = useState(false)
  const [reason, setReason] = useState('wrong_answer')
  const [note, setNote] = useState('')
  const [busy, setBusy] = useState(false)
  const [sent, setSent] = useState(false)
  const [error, setError] = useState('')
  const active = useRef(true)
  useEffect(() => {
    active.current = true
    return () => {
      active.current = false
    }
  }, [])
  async function submit(event: FormEvent) {
    event.preventDefault()
    if (busy || sent) return
    const id = questionId
    setBusy(true)
    setError('')
    try {
      const response = await fetch(`/api/v1/questions/${id}/reports`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          reason,
          ...(note.trim() ? { note: note.trim() } : {}),
          revision_id: revisionId,
        }),
      })
      const value = await response.json()
      if (!response.ok)
        throw new Error(
          value.error?.message ?? 'Chưa thể gửi báo lỗi. Vui lòng thử lại.',
        )
      if (active.current) {
        setSent(true)
        setOpen(false)
      }
    } catch (failure) {
      if (active.current) setError((failure as Error).message)
    } finally {
      if (active.current) setBusy(false)
    }
  }
  return (
    <section className="question-report" aria-label="Báo lỗi câu hỏi">
      {sent ? (
        <p role="status">
          Đã nhận báo lỗi. Câu hỏi sẽ được kiểm tra lại trước khi đưa vào bài
          mới.
        </p>
      ) : (
        <>
          <button
            type="button"
            className="secondary"
            aria-expanded={open}
            onClick={() => setOpen(!open)}
            disabled={busy}
          >
            Báo lỗi câu hỏi
          </button>
          {open && (
            <form onSubmit={submit}>
              <label>
                Loại vấn đề
                <select
                  value={reason}
                  disabled={busy}
                  onChange={(event) => setReason(event.target.value)}
                >
                  <option value="wrong_answer">Đáp án chưa đúng</option>
                  <option value="ambiguous">Câu hỏi chưa rõ</option>
                  <option value="typo">Lỗi chính tả</option>
                  <option value="bad_image">Hình ảnh có vấn đề</option>
                  <option value="other">Vấn đề khác</option>
                </select>
              </label>
              <label>
                Mô tả vấn đề
                <textarea
                  value={note}
                  maxLength={2000}
                  disabled={busy}
                  onChange={(event) => setNote(event.target.value)}
                />
              </label>
              {error && (
                <p role="alert" className="error">
                  {error}
                </p>
              )}
              <button className="secondary" disabled={busy}>
                {busy ? 'Đang gửi…' : 'Gửi báo lỗi'}
              </button>
            </form>
          )}
        </>
      )}
    </section>
  )
}
