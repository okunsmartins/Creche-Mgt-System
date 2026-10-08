'use client'

import { useState, useTransition } from 'react'
import { Alert } from '@/components/ui/Alert'
import { Button } from '@/components/ui/Button'
import { upsertLateCollectionSettingsAction } from '@/lib/late-collection/actions'

export interface LateFeeSettingsFormProps {
  initial: {
    cutoffTime: string // 'HH:MM'
    graceMinutes: number
    flatFeeEuros: string
    perBlockFeeEuros: string
    blockMinutes: number
    isActive: boolean
  }
}

function eurosToCents(v: string): number {
  const n = Math.round(Number(v) * 100)
  return Number.isFinite(n) && n >= 0 ? n : 0
}

export function LateFeeSettingsForm({ initial }: LateFeeSettingsFormProps) {
  const [pending, startTransition] = useTransition()
  const [msg, setMsg] = useState<{ kind: 'ok' | 'err'; text: string } | null>(null)

  function onSubmit(formData: FormData) {
    setMsg(null)
    startTransition(async () => {
      const res = await upsertLateCollectionSettingsAction({
        cutoffTime: String(formData.get('cutoffTime') ?? ''),
        graceMinutes: Number(formData.get('graceMinutes') ?? 0),
        flatFeeCents: eurosToCents(String(formData.get('flatFeeEuros') ?? '0')),
        perBlockFeeCents: eurosToCents(String(formData.get('perBlockFeeEuros') ?? '0')),
        blockMinutes: Number(formData.get('blockMinutes') ?? 15),
        isActive: formData.get('isActive') === 'on',
      })
      setMsg(res.ok ? { kind: 'ok', text: 'Policy saved.' } : { kind: 'err', text: res.error })
    })
  }

  const inputCls =
    'w-full rounded-md border border-border bg-surface px-3 py-2 text-sm text-text-primary focus:outline-none focus:ring-2 focus:ring-primary'

  return (
    <form action={onSubmit} className="space-y-4">
      {msg && <Alert variant={msg.kind === 'ok' ? 'success' : 'error'}>{msg.text}</Alert>}

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label htmlFor="cutoffTime" className="mb-1 block text-sm font-medium text-text-primary">
            Collection cutoff time
          </label>
          <input
            id="cutoffTime"
            name="cutoffTime"
            type="time"
            defaultValue={initial.cutoffTime}
            required
            className={inputCls}
          />
          <p className="mt-1 text-xs text-text-muted">Collection after this time counts as late.</p>
        </div>
        <div>
          <label
            htmlFor="graceMinutes"
            className="mb-1 block text-sm font-medium text-text-primary"
          >
            Grace period (minutes)
          </label>
          <input
            id="graceMinutes"
            name="graceMinutes"
            type="number"
            min={0}
            step={1}
            defaultValue={initial.graceMinutes}
            className={inputCls}
          />
        </div>
        <div>
          <label
            htmlFor="flatFeeEuros"
            className="mb-1 block text-sm font-medium text-text-primary"
          >
            Flat fee (€)
          </label>
          <input
            id="flatFeeEuros"
            name="flatFeeEuros"
            type="number"
            min={0}
            step="0.01"
            defaultValue={initial.flatFeeEuros}
            className={inputCls}
          />
          <p className="mt-1 text-xs text-text-muted">Charged once a collection is late.</p>
        </div>
        <div>
          <label
            htmlFor="perBlockFeeEuros"
            className="mb-1 block text-sm font-medium text-text-primary"
          >
            Per-block fee (€)
          </label>
          <input
            id="perBlockFeeEuros"
            name="perBlockFeeEuros"
            type="number"
            min={0}
            step="0.01"
            defaultValue={initial.perBlockFeeEuros}
            className={inputCls}
          />
        </div>
        <div>
          <label
            htmlFor="blockMinutes"
            className="mb-1 block text-sm font-medium text-text-primary"
          >
            Block size (minutes)
          </label>
          <input
            id="blockMinutes"
            name="blockMinutes"
            type="number"
            min={1}
            step={1}
            defaultValue={initial.blockMinutes}
            className={inputCls}
          />
          <p className="mt-1 text-xs text-text-muted">
            The per-block fee applies for each block (rounded up) past the grace period.
          </p>
        </div>
        <div className="flex items-center gap-3 pt-7">
          <input
            id="isActive"
            name="isActive"
            type="checkbox"
            defaultChecked={initial.isActive}
            className="h-4 w-4 rounded border-border text-primary focus:ring-primary"
          />
          <label htmlFor="isActive" className="text-sm text-text-primary">
            Late fees active
          </label>
        </div>
      </div>

      <Button type="submit" loading={pending}>
        Save policy
      </Button>
    </form>
  )
}
