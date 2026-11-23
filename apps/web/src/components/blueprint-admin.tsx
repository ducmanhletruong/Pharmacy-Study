'use client'
import { useEffect, useState, type FormEvent } from 'react'
import {
  blueprintInputSchema,
  type BlueprintSpec,
} from '@pharmacy/api-contract'
type Blueprint = {
  id: string
  subject: string
  name: string
  status: 'draft' | 'active' | 'retired'
  version: number
  spec: BlueprintSpec
}
type Slot = BlueprintSpec['slots'][number]
type TopicNode = { id: string; title: string; children: TopicNode[] }
export function BlueprintAdmin() {
  const [items, setItems] = useState<Blueprint[]>([]),
    [subjects, setSubjects] = useState<{ code: string; name: string }[]>([])
  const [subject, setSubject] = useState('synthetic'),
    [name, setName] = useState('Đề tổng hợp minh họa'),
    [seconds, setSeconds] = useState(600)
  const [status, setStatus] = useState<Blueprint['status']>('draft'),
    [slots, setSlots] = useState<Slot[]>([{ count: 10 }])
  const [editing, setEditing] = useState<Blueprint | null>(null),
    [message, setMessage] = useState(''),
    [busy, setBusy] = useState(false)
  const [topics, setTopics] = useState<{ id: string; title: string }[]>([])
  async function request(
    path: string,
    method = 'GET',
    value?: unknown,
    key?: string,
  ) {
    const r = await fetch('/api/v1' + path, {
      method,
      headers: {
        'Content-Type': 'application/json',
        ...(key ? { 'Idempotency-Key': key } : {}),
      },
      ...(value ? { body: JSON.stringify(value) } : {}),
    })
    const data = await r.json()
    if (!r.ok) throw new Error(data.error?.message ?? 'Không thể lưu cấu hình')
    return data
  }
  useEffect(() => {
    let active = true
    Promise.all([request('/admin/blueprints?limit=100'), request('/subjects')])
      .then(([b, s]) => {
        if (active) {
          setItems(b.items)
          setSubjects(s.items)
        }
      })
      .catch((e) => {
        if (active) setMessage(e.message)
      })
    return () => {
      active = false
    }
  }, [])
  useEffect(() => {
    let active = true
    request('/subjects/' + encodeURIComponent(subject) + '/topics')
      .then((data) => {
        function flat(nodes: TopicNode[]): { id: string; title: string }[] {
          return nodes.flatMap((n) => [
            { id: n.id, title: n.title },
            ...flat(n.children),
          ])
        }
        if (active) setTopics(flat(data.items))
      })
      .catch((e) => {
        if (active) setMessage(e.message)
      })
    return () => {
      active = false
    }
  }, [subject])
  async function save(e: FormEvent) {
    e.preventDefault()
    setBusy(true)
    setMessage('')
    try {
      const input = blueprintInputSchema.parse({
        subject,
        name,
        status,
        spec: {
          duration_seconds: seconds,
          deadline_policy: 'expired_grade_saved',
          slots,
        },
        ...(editing ? { expected_version: editing.version } : {}),
      })
      await request(
        '/admin/blueprints' + (editing ? '/' + editing.id : ''),
        editing ? 'PATCH' : 'POST',
        input,
        crypto.randomUUID(),
      )
      setItems((await request('/admin/blueprints?limit=100')).items)
      setEditing(null)
      setMessage('Đã lưu cấu hình thi.')
    } catch (e) {
      setMessage(e instanceof Error ? e.message : 'Cấu hình chưa hợp lệ')
    } finally {
      setBusy(false)
    }
  }
  function edit(item: Blueprint) {
    setEditing(item)
    setSubject(item.subject)
    setName(item.name)
    setStatus(item.status)
    setSeconds(item.spec.duration_seconds)
    setSlots(item.spec.slots)
    setMessage('')
  }
  return (
    <section className="panel">
      <h2>Cấu hình đề thi thử</h2>
      <p>
        Ví dụ tổng hợp; chưa đại diện cấu trúc đề thật. Hết giờ: chấm các đáp án
        đã lưu và ghi hết hạn.
      </p>
      <ul>
        {items.map((item) => (
          <li key={item.id}>
            <button disabled={busy} onClick={() => edit(item)}>
              {item.name} — {item.status} — v{item.version}
            </button>
          </li>
        ))}
      </ul>
      <form onSubmit={save}>
        <fieldset disabled={busy}>
          <legend>{editing ? 'Sửa cấu hình' : 'Tạo cấu hình'}</legend>
          <label>
            Môn của cấu hình
            <select
              value={subject}
              disabled={Boolean(editing)}
              onChange={(e) => {
                setSubject(e.target.value)
                setSlots([{ count: 10 }])
              }}
            >
              {subjects.map((s) => (
                <option key={s.code} value={s.code}>
                  {s.name}
                </option>
              ))}
            </select>
          </label>
          <label>
            Tên cấu hình
            <input
              value={name}
              maxLength={120}
              required
              onChange={(e) => setName(e.target.value)}
            />
          </label>
          <label>
            Thời gian (giây)
            <input
              type="number"
              min={1}
              max={14400}
              value={seconds}
              required
              onChange={(e) => setSeconds(Number(e.target.value))}
            />
          </label>
          <label>
            Trạng thái cấu hình
            <select
              value={status}
              onChange={(e) => setStatus(e.target.value as Blueprint['status'])}
            >
              <option value="draft">Bản nháp</option>
              <option value="active">Đang áp dụng</option>
              <option value="retired">Ngừng áp dụng</option>
            </select>
          </label>
          {slots.map((slot, index) => (
            <fieldset key={index}>
              <legend>Nhóm câu {index + 1}</legend>
              <label>
                Chủ đề nhóm {index + 1}
                <select
                  value={slot.topic_id ?? ''}
                  onChange={(e) =>
                    setSlots(
                      slots.map((s, i) =>
                        i === index
                          ? { ...s, topic_id: e.target.value || undefined }
                          : s,
                      ),
                    )
                  }
                >
                  <option value="">Tất cả chủ đề</option>
                  {topics.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.title}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Độ khó nhóm {index + 1}
                <select
                  value={slot.difficulty ?? ''}
                  onChange={(e) =>
                    setSlots(
                      slots.map((s, i) =>
                        i === index
                          ? {
                              ...s,
                              difficulty: Number(e.target.value) || undefined,
                            }
                          : s,
                      ),
                    )
                  }
                >
                  <option value="">Mọi độ khó</option>
                  {[1, 2, 3].map((v) => (
                    <option key={v} value={v}>
                      {v}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Số câu nhóm {index + 1}
                <input
                  type="number"
                  min={1}
                  max={200}
                  value={slot.count}
                  onChange={(e) =>
                    setSlots(
                      slots.map((s, i) =>
                        i === index
                          ? { ...s, count: Number(e.target.value) }
                          : s,
                      ),
                    )
                  }
                />
              </label>
              <button
                type="button"
                disabled={slots.length === 1}
                onClick={() => setSlots(slots.filter((_, i) => i !== index))}
              >
                Bỏ nhóm {index + 1}
              </button>
            </fieldset>
          ))}
          <button
            type="button"
            disabled={slots.length >= 20}
            onClick={() => setSlots([...slots, { count: 1 }])}
          >
            Thêm nhóm câu
          </button>
          <button className="primary" type="submit">
            Lưu cấu hình thi
          </button>
          {editing && (
            <button
              type="button"
              onClick={() => {
                setEditing(null)
                setName('Cấu hình mới')
              }}
            >
              Tạo cấu hình khác
            </button>
          )}
        </fieldset>
      </form>
      {message && <p role="status">{message}</p>}
    </section>
  )
}
