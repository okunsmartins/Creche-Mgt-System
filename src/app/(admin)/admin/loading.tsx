export default function AdminPageLoading() {
  return (
    <div className="animate-pulse" aria-label="Loading" role="status">
      {/* Page heading */}
      <div className="mb-6 flex items-center justify-between">
        <div>
          <div className="mb-2 h-7 w-44 rounded-md bg-surface" />
          <div className="h-4 w-64 rounded bg-surface" />
        </div>
        <div className="h-9 w-28 rounded-md bg-surface" />
      </div>

      {/* Table */}
      <div className="overflow-hidden rounded-lg border border-border">
        {/* Header row */}
        <div className="border-b border-border bg-surface px-4 py-3">
          <div className="flex gap-8">
            <div className="h-3 w-16 rounded bg-surface-raised" />
            <div className="hidden h-3 w-24 rounded bg-surface-raised sm:block" />
            <div className="hidden h-3 w-16 rounded bg-surface-raised md:block" />
            <div className="hidden h-3 w-14 rounded bg-surface-raised md:block" />
          </div>
        </div>

        {/* Data rows */}
        <div className="divide-y divide-border">
          {Array.from({ length: 6 }, (_, i) => (
            <div key={i} className="flex items-center gap-4 px-4 py-3">
              <div className="h-8 w-8 shrink-0 rounded-full bg-surface" />
              <div className="flex-1 space-y-1.5">
                <div
                  className="h-3.5 rounded bg-surface"
                  style={{ width: `${120 + (i % 3) * 32}px` }}
                />
                <div
                  className="h-3 rounded bg-surface"
                  style={{ width: `${160 + (i % 4) * 24}px` }}
                />
              </div>
              <div className="hidden h-5 w-14 rounded-full bg-surface sm:block" />
              <div className="hidden h-5 w-20 rounded-full bg-surface md:block" />
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
