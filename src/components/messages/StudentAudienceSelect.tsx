'use client'

import { useState } from 'react'

interface ClassOption {
  id: string
  label: string
}

interface MessagingStudent {
  id: string
  name: string
  classId: string
}

/**
 * Class → Pupil cascade for the "specific pupil" message audience. Pick a class,
 * then a pupil in that class; the chosen pupil's id is submitted as `studentId`
 * (the send action targets that pupil's linked parents/guardians). The class
 * select is a client-side filter only — it isn't submitted (the audience is
 * 'student', so the action reads studentId, not classId).
 */
export function StudentAudienceSelect({
  classes,
  students,
}: {
  classes: ClassOption[]
  students: MessagingStudent[]
}) {
  const [classId, setClassId] = useState('')
  const [studentId, setStudentId] = useState('')

  const classStudents = students.filter((s) => s.classId === classId)
  const selectClass =
    'w-full rounded-xl border border-border bg-surface-raised px-3 py-2 text-sm text-text-primary focus:border-primary/50 focus:outline-none focus:ring-2 focus:ring-primary/20'
  const labelClass = 'mb-1.5 block text-xs font-semibold uppercase tracking-widest text-text-muted'

  return (
    <div className="space-y-4">
      <div>
        <label htmlFor="pupilClass" className={labelClass}>
          Class
        </label>
        {classes.length === 0 ? (
          <p className="rounded-md border border-border bg-surface px-3 py-2 text-sm text-text-muted">
            No classes available.
          </p>
        ) : (
          <select
            id="pupilClass"
            value={classId}
            onChange={(e) => {
              setClassId(e.target.value)
              setStudentId('')
            }}
            className={selectClass}
          >
            <option value="">Select a class…</option>
            {classes.map((c) => (
              <option key={c.id} value={c.id}>
                {c.label}
              </option>
            ))}
          </select>
        )}
      </div>

      {classId && (
        <div>
          <label htmlFor="studentId" className={labelClass}>
            Pupil
          </label>
          {classStudents.length === 0 ? (
            <p className="rounded-md border border-border bg-surface px-3 py-2 text-sm text-text-muted">
              No pupils in this class.
            </p>
          ) : (
            <select
              id="studentId"
              name="studentId"
              required
              value={studentId}
              onChange={(e) => setStudentId(e.target.value)}
              className={selectClass}
            >
              <option value="">Select a pupil…</option>
              {classStudents.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
          )}
        </div>
      )}

      {studentId && (
        <p className="text-xs text-text-muted">
          Only this pupil&apos;s linked parents/guardians will be contacted.
        </p>
      )}
    </div>
  )
}
