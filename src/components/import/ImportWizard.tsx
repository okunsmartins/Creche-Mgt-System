'use client'

import Link from 'next/link'
import { useMemo, useState, useTransition } from 'react'
import { DATASET_FIELDS, DATASET_LABELS, type ImportDataset } from '@/lib/import/fields'
import { validateRows, type ColumnMapping } from '@/lib/import/validate'
import {
  parseImportAction,
  importChildrenAction,
  importStaffAction,
  type ImportChildrenResult,
} from '@/lib/import/actions'

type Step = 'upload' | 'map' | 'done'

const VIEW_LINK: Record<ImportDataset, { href: string; label: string }> = {
  child: { href: '/admin/students', label: 'View children' },
  staff: { href: '/admin/teachers', label: 'View staff' },
  parent: { href: '/admin/students', label: 'Done' },
}

export function ImportWizard() {
  const [step, setStep] = useState<Step>('upload')
  const [dataset, setDataset] = useState<ImportDataset>('child')
  const [headers, setHeaders] = useState<string[]>([])
  const [rows, setRows] = useState<string[][]>([])
  const [mapping, setMapping] = useState<ColumnMapping>({})
  const [error, setError] = useState<string | null>(null)
  const [summary, setSummary] = useState<ImportChildrenResult | null>(null)
  const [pending, startTransition] = useTransition()

  const fields = DATASET_FIELDS[dataset]
  const datasetLabel = DATASET_LABELS[dataset].toLowerCase()

  const validation = useMemo(
    () => (rows.length ? validateRows(rows, mapping, fields) : null),
    [rows, mapping, fields],
  )

  function onUpload(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setError(null)
    const form = new FormData(e.currentTarget)
    startTransition(async () => {
      const res = await parseImportAction(form, dataset)
      if (!res.ok) {
        setError(res.error)
        return
      }
      setHeaders(res.headers)
      setRows(res.rows)
      setMapping(res.autoMapping)
      setStep('map')
    })
  }

  function onImport() {
    setError(null)
    const action = dataset === 'staff' ? importStaffAction : importChildrenAction
    startTransition(async () => {
      const res = await action({ rows, mapping })
      if (!res.ok) {
        setError(res.error ?? 'Import failed.')
        return
      }
      setSummary(res)
      setStep('done')
    })
  }

  function downloadErrorReport() {
    const failed = summary?.rowErrors ?? []
    if (failed.length === 0) return
    const esc = (v: string) => (/[",\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v)
    const lines = [[...headers, 'Import errors'].map(esc).join(',')]
    for (const re of failed) {
      const orig = rows[re.rowNumber - 1] ?? []
      lines.push(
        [...headers.map((_, i) => esc(orig[i] ?? '')), esc(re.errors.join('; '))].join(','),
      )
    }
    const blob = new Blob([lines.join('\n')], { type: 'text/csv;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'import-errors.csv'
    a.click()
    URL.revokeObjectURL(url)
  }

  // ─── Step 1: upload ─────────────────────────────────────────────────────────
  if (step === 'upload') {
    return (
      <form onSubmit={onUpload} className="space-y-4">
        <fieldset>
          <legend className="text-sm font-medium text-text-secondary">
            What are you importing?
          </legend>
          <div className="mt-2 flex flex-wrap gap-2">
            {(['child', 'staff'] as ImportDataset[]).map((d) => (
              <label
                key={d}
                className={`cursor-pointer rounded-lg border px-4 py-2 text-sm font-medium ${
                  dataset === d
                    ? 'border-primary bg-primary/10 text-primary'
                    : 'border-border text-text-secondary hover:bg-surface-raised'
                }`}
              >
                <input
                  type="radio"
                  name="dataset"
                  value={d}
                  checked={dataset === d}
                  onChange={() => setDataset(d)}
                  className="sr-only"
                />
                {DATASET_LABELS[d]}
              </label>
            ))}
          </div>
        </fieldset>

        <p className="text-sm text-text-secondary">
          Upload your existing spreadsheet (.csv or .xlsx). You&apos;ll map your columns to the
          right fields on the next step — no need to rename anything first.
        </p>
        {dataset === 'child' && (
          <p className="text-sm text-text-muted">
            Starting from scratch?{' '}
            <a
              href="/creche-children-import-template.csv"
              download
              className="font-semibold text-primary hover:underline"
            >
              Download the template
            </a>
            .
          </p>
        )}
        <input
          type="file"
          name="file"
          accept=".csv,.xlsx"
          required
          className="block w-full rounded-lg border border-border bg-surface p-2 text-sm"
        />
        {error && <p className="text-sm text-error">{error}</p>}
        <button
          type="submit"
          disabled={pending}
          className="rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground hover:bg-primary-hover disabled:opacity-60"
        >
          {pending ? 'Reading…' : 'Upload & continue'}
        </button>
      </form>
    )
  }

  // ─── Step 3: done ───────────────────────────────────────────────────────────
  if (step === 'done' && summary) {
    const view = VIEW_LINK[dataset]
    return (
      <div className="space-y-4">
        <h3 className="text-lg font-bold text-text-primary">Import complete</h3>
        <div className="grid grid-cols-3 gap-3">
          <Stat label="Created" value={summary.created ?? 0} tone="success" />
          <Stat label="Skipped (duplicates)" value={summary.skipped ?? 0} tone="muted" />
          <Stat
            label="Failed"
            value={summary.failed ?? 0}
            tone={summary.failed ? 'error' : 'muted'}
          />
        </div>
        {summary.rowErrors && summary.rowErrors.length > 0 && (
          <div className="rounded-lg border border-error/30 bg-error-light p-3 text-sm">
            <div className="flex items-center justify-between gap-3">
              <p className="font-medium text-text-primary">Rows not imported:</p>
              <button
                onClick={downloadErrorReport}
                className="shrink-0 rounded-lg border border-border bg-surface px-3 py-1 text-xs font-semibold text-text-secondary hover:bg-surface-raised"
              >
                Download error report (CSV)
              </button>
            </div>
            <ul className="mt-1 space-y-0.5 text-text-secondary">
              {summary.rowErrors.slice(0, 20).map((re) => (
                <li key={re.rowNumber}>
                  Row {re.rowNumber}: {re.errors.join('; ')}
                </li>
              ))}
            </ul>
            {summary.rowErrors.length > 20 && (
              <p className="mt-1 text-xs text-text-muted">
                Showing 20 of {summary.rowErrors.length}. Download the full report above.
              </p>
            )}
          </div>
        )}
        <Link
          href={view.href}
          className="inline-block text-sm font-semibold text-primary hover:underline"
        >
          {view.label} →
        </Link>
      </div>
    )
  }

  // ─── Step 2: map + preview ──────────────────────────────────────────────────
  const canImport = validation !== null && validation.missingRequired.length === 0
  const mappedFields = fields.filter((f) => mapping[f.key] != null)

  return (
    <div className="space-y-5">
      <div>
        <h3 className="text-base font-semibold text-text-primary">
          Map your columns — {datasetLabel}
        </h3>
        <p className="text-sm text-text-muted">
          We matched what we could. Adjust any field, then review the preview below.
        </p>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        {fields.map((f) => (
          <label key={f.key} className="text-sm">
            <span className="text-text-secondary">
              {f.label}
              {f.required && <span className="text-error"> *</span>}
            </span>
            <select
              value={mapping[f.key] ?? ''}
              onChange={(e) =>
                setMapping((m) => ({
                  ...m,
                  [f.key]: e.target.value === '' ? null : Number(e.target.value),
                }))
              }
              className="mt-1 block w-full rounded-lg border border-border bg-surface p-2 text-sm"
            >
              <option value="">— Not in my file —</option>
              {headers.map((h, i) => (
                <option key={i} value={i}>
                  {h || `Column ${i + 1}`}
                </option>
              ))}
            </select>
          </label>
        ))}
      </div>

      {validation && (
        <div className="flex flex-wrap gap-3 text-sm">
          <span className="rounded-full bg-success-light px-3 py-1 text-success">
            {validation.validCount} valid
          </span>
          <span className="rounded-full bg-error-light px-3 py-1 text-error">
            {validation.errorRowCount} with errors
          </span>
          <span className="rounded-full bg-warning-light px-3 py-1 text-warning">
            {validation.warningRowCount} with warnings
          </span>
        </div>
      )}

      {validation && validation.missingRequired.length > 0 && (
        <p className="text-sm text-error">
          Map these required fields to continue:{' '}
          {validation.missingRequired
            .map((k) => fields.find((f) => f.key === k)?.label ?? k)
            .join(', ')}
        </p>
      )}

      <div className="overflow-x-auto rounded-lg border border-border">
        <table className="min-w-full text-left text-sm">
          <thead className="bg-surface-raised text-text-secondary">
            <tr>
              <th className="px-3 py-2">#</th>
              {mappedFields.map((f) => (
                <th key={f.key} className="px-3 py-2">
                  {f.label}
                </th>
              ))}
              <th className="px-3 py-2">Status</th>
            </tr>
          </thead>
          <tbody>
            {validation &&
              validation.rows.slice(0, 8).map((r, idx) => (
                <tr key={idx} className="border-t border-border">
                  <td className="px-3 py-2 text-text-muted">{r.rowNumber}</td>
                  {mappedFields.map((f) => (
                    <td key={f.key} className="px-3 py-2 text-text-primary">
                      {r.values[f.key] ?? '—'}
                    </td>
                  ))}
                  <td className="px-3 py-2">
                    {r.errors.length > 0 ? (
                      <span className="text-error" title={r.errors.join('; ')}>
                        ✕ error
                      </span>
                    ) : r.warnings.length > 0 ? (
                      <span className="text-warning" title={r.warnings.join('; ')}>
                        ! warning
                      </span>
                    ) : (
                      <span className="text-success">✓</span>
                    )}
                  </td>
                </tr>
              ))}
          </tbody>
        </table>
      </div>
      {validation && rows.length > 8 && (
        <p className="text-xs text-text-muted">Showing 8 of {rows.length} rows.</p>
      )}

      {error && <p className="text-sm text-error">{error}</p>}

      <div className="flex gap-3">
        <button
          onClick={() => setStep('upload')}
          className="rounded-lg border border-border px-4 py-2 text-sm font-medium text-text-secondary hover:bg-surface-raised"
        >
          ← Back
        </button>
        <button
          onClick={onImport}
          disabled={!canImport || pending}
          className="rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground hover:bg-primary-hover disabled:opacity-60"
        >
          {pending ? 'Importing…' : `Import ${validation?.validCount ?? 0} ${datasetLabel}`}
        </button>
      </div>
    </div>
  )
}

function Stat({
  label,
  value,
  tone,
}: {
  label: string
  value: number
  tone: 'success' | 'error' | 'muted'
}) {
  const color =
    tone === 'success' ? 'text-success' : tone === 'error' ? 'text-error' : 'text-text-secondary'
  return (
    <div className="rounded-lg border border-border bg-surface p-3 text-center">
      <div className={`text-2xl font-bold ${color}`}>{value}</div>
      <div className="text-xs text-text-muted">{label}</div>
    </div>
  )
}
