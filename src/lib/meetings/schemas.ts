import { z } from 'zod'
import { SLOT_DURATIONS_MINS, parseTimeToMinutes } from './slots'

const isoDate = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, 'Enter a valid date')
  .refine((v) => !Number.isNaN(Date.parse(v)), 'Enter a valid date')

const timeHHMM = z.string().refine((v) => parseTimeToMinutes(v) !== null, 'Enter a valid time')

export const availabilityBlockSchema = z
  .object({
    slotDate: isoDate,
    startTime: timeHHMM,
    endTime: timeHHMM,
    durationMins: z.coerce
      .number()
      .refine(
        (v): v is (typeof SLOT_DURATIONS_MINS)[number] =>
          SLOT_DURATIONS_MINS.includes(v as (typeof SLOT_DURATIONS_MINS)[number]),
        'Choose a valid slot length',
      ),
    // Empty string = open to all the teacher's classes (stored as NULL).
    classId: z
      .string()
      .uuid('Choose a valid class')
      .optional()
      .or(z.literal('').transform(() => undefined)),
  })
  .refine(
    (d) => {
      const start = parseTimeToMinutes(d.startTime)
      const end = parseTimeToMinutes(d.endTime)
      return start !== null && end !== null && start < end
    },
    { message: 'The end time must be after the start time.', path: ['endTime'] },
  )

export type AvailabilityBlockValues = z.infer<typeof availabilityBlockSchema>

export type MeetingActionState = null | { error: string } | { success: true; created?: number }
