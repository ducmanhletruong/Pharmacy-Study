'use client'

import Image from 'next/image'
import type { Attempt, AttemptAnswer } from '@pharmacy/api-contract'

type Item = Attempt['items'][number]

export function VisualAnswer({
  item,
  answer,
  busy,
  onAnswer,
}: {
  item: Item
  answer: AttemptAnswer | ''
  busy: boolean
  onAnswer: (value: AttemptAnswer | '') => void
}) {
  const exercise = item.exercise
  const asset = item.assets[0]
  if (!exercise || !asset) return null
  const disabled = busy
  const selected = answer
  const image = (
    <Image
      unoptimized
      src={asset.url}
      alt={asset.alt_text}
      width={600}
      height={400}
      style={{ display: 'block', maxWidth: '100%', height: 'auto' }}
    />
  )
  if (exercise.type === 'name_from_structure')
    return (
      <>
        {image}
        <label>
          Tên hợp chất
          <input
            type="text"
            maxLength={500}
            disabled={disabled}
            value={
              typeof selected !== 'string' && selected.kind === 'name'
                ? selected.text
                : ''
            }
            onChange={(event) =>
              onAnswer(
                event.target.value
                  ? { kind: 'name', text: event.target.value }
                  : '',
              )
            }
          />
        </label>
      </>
    )
  return (
    <fieldset disabled={disabled}>
      <legend>Chọn bộ phận</legend>
      {exercise.mode === 'click' ? (
        <>
          <p>Bấm vào hình hoặc chọn một bộ phận trong danh sách.</p>
          <button
            type="button"
            aria-label="Chọn điểm trên hình"
            style={{ padding: 0, background: 'transparent', border: 0 }}
            onClick={(event) => {
              if (!event.detail) {
                event.currentTarget.parentElement
                  ?.querySelector('select')
                  ?.focus()
                return
              }
              const rect = event.currentTarget
                .querySelector('img')
                ?.getBoundingClientRect()
              if (!rect?.width || !rect.height) return
              const x = (event.clientX - rect.left) / rect.width,
                y = (event.clientY - rect.top) / rect.height
              if (x >= 0 && x <= 1 && y >= 0 && y <= 1)
                onAnswer({ kind: 'point', point: [x, y] })
            }}
          >
            {image}
          </button>
          {typeof selected !== 'string' && selected.kind === 'point' && (
            <p role="status">Đã chọn một điểm trên hình.</p>
          )}
        </>
      ) : (
        image
      )}
      <label>
        Bộ phận trên hình
        <select
          value={
            typeof selected !== 'string' && selected.kind === 'region'
              ? selected.id
              : ''
          }
          onChange={(event) =>
            onAnswer(
              event.target.value
                ? { kind: 'region', id: event.target.value }
                : '',
            )
          }
        >
          <option value="">Chọn bộ phận</option>
          {exercise.regions.map((region) => (
            <option key={region.id} value={region.id}>
              {region.label}
            </option>
          ))}
        </select>
      </label>
    </fieldset>
  )
}
