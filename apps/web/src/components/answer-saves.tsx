'use client'

import { useCallback, useRef, useState } from 'react'
import type { AttemptAnswer } from '@pharmacy/api-contract'

const SAVE_TIMEOUT_MS = 10_000

type Entry = {
  attemptId: string
  position: number
  answer: AttemptAnswer | ''
  status: 'saving' | 'saved' | 'error'
  send: (
    answer: AttemptAnswer,
    signal: AbortSignal,
    version: string | null | undefined,
  ) => Promise<{ saved: boolean; answer_version?: string | null }>
}

export function useAnswerSaves() {
  const entries = useRef(new Map<string, Entry>())
  const running = useRef(new Map<string, Promise<void>>())
  const timers = useRef(new Map<string, ReturnType<typeof setTimeout>>())
  const versions = useRef(new Map<string, string | null>())
  const [snapshot, setSnapshot] = useState(new Map<string, Entry>())
  const update = useCallback((key: string, entry: Entry) => {
    entries.current.set(key, entry)
    setSnapshot(new Map(entries.current))
  }, [])

  const run = useCallback(
    (key: string) => {
      clearTimeout(timers.current.get(key))
      timers.current.delete(key)
      const active = running.current.get(key)
      if (active) return active
      const task = (async () => {
        for (;;) {
          const entry = entries.current.get(key)
          if (!entry || entry.status !== 'saving' || !entry.answer) return
          let status: 'saved' | 'error' = 'saved'
          try {
            const result = await entry.send(
              entry.answer,
              AbortSignal.timeout(SAVE_TIMEOUT_MS),
              versions.current.get(key),
            )
            if (result.answer_version !== undefined)
              versions.current.set(key, result.answer_version)
            if (!result.saved) status = 'error'
          } catch {
            status = 'error'
          }
          if (entries.current.get(key) === entry)
            update(key, { ...entry, status })
        }
      })().finally(() => running.current.delete(key))
      running.current.set(key, task)
      return task
    },
    [update],
  )

  function select(
    attemptId: string,
    position: number,
    answer: AttemptAnswer | '',
    version: string | null | undefined,
    send: Entry['send'],
  ) {
    const key = attemptId + ':' + position
    if (!versions.current.has(key) && version !== undefined)
      versions.current.set(key, version)
    const valid =
      answer !== '' &&
      (typeof answer === 'string' ||
        answer.kind !== 'name' ||
        answer.text.trim())
    update(key, {
      attemptId,
      position,
      answer,
      send,
      status: valid ? 'saving' : 'error',
    })
    clearTimeout(timers.current.get(key))
    timers.current.delete(key)
    if (!valid) return
    if (typeof answer !== 'string' && answer.kind === 'name') {
      timers.current.set(
        key,
        setTimeout(() => void run(key), 350),
      )
    } else {
      void run(key)
    }
  }

  function retry(attemptId: string, position: number) {
    const key = attemptId + ':' + position
    const entry = entries.current.get(key)
    if (
      entry?.answer &&
      entry.status === 'error' &&
      (typeof entry.answer === 'string' ||
        entry.answer.kind !== 'name' ||
        entry.answer.text.trim())
    ) {
      update(key, { ...entry, status: 'saving' })
      void run(key)
    }
  }

  const flush = useCallback(
    async (attemptId: string) => {
      for (;;) {
        const current = [...entries.current].filter(
          ([, entry]) => entry.attemptId === attemptId,
        )
        const active = current.filter(
          ([key, entry]) =>
            entry.status === 'saving' || running.current.has(key),
        )
        if (!active.length)
          return current
            .filter(([, entry]) => entry.status === 'error')
            .map(([, entry]) => entry.position)
        await Promise.all(active.map(([key]) => run(key)))
      }
    },
    [run],
  )

  return {
    entry: (attemptId: string, position: number) =>
      snapshot.get(attemptId + ':' + position),
    select,
    retry,
    flush,
  }
}

export function AnswerSaveStatus({
  entry,
  saved,
  retry,
}: {
  entry?: Entry
  saved: boolean
  retry: () => void
}) {
  if (entry?.status === 'error') {
    const empty =
      !entry.answer ||
      (typeof entry.answer !== 'string' &&
        entry.answer.kind === 'name' &&
        !entry.answer.text.trim())
    return (
      <div role="alert">
        {empty ? 'Nhập tên hợp chất để lưu đáp án.' : 'Chưa lưu được đáp án.'}
        {!empty && (
          <button type="button" onClick={retry}>
            Thử lại
          </button>
        )}
      </div>
    )
  }
  return (
    <p role="status">
      {entry?.status === 'saving' ? 'Đang lưu…' : saved ? 'Đã làm' : 'Chưa làm'}
    </p>
  )
}
