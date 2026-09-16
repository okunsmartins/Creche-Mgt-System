'use client'

import { useActionState } from 'react'
import { Input } from '@/components/ui/Input'
import { Button } from '@/components/ui/Button'
import { Alert } from '@/components/ui/Alert'
import type { SchoolSettingsActionState } from '@/lib/schools/schemas'

export interface SchoolSettingsValues {
  name: string
  rollNumber: string
  email: string
  phone: string
  website: string
  addressLine1: string
  addressLine2: string
  city: string
  county: string
  eircode: string
}

interface SchoolSettingsFormProps {
  action: (
    prev: SchoolSettingsActionState,
    formData: FormData,
  ) => Promise<SchoolSettingsActionState>
  school: SchoolSettingsValues
}

export function SchoolSettingsForm({ action, school }: SchoolSettingsFormProps) {
  const [state, formAction, isPending] = useActionState<SchoolSettingsActionState, FormData>(
    action,
    null,
  )

  return (
    <form action={formAction} className="space-y-8">
      {state?.error && <Alert variant="error">{state.error}</Alert>}
      {state?.success && <Alert variant="success">{state.message}</Alert>}

      {/* Identity */}
      <section className="space-y-4">
        <div>
          <h2 className="text-sm font-semibold text-text-primary">School identity</h2>
          <p className="text-xs text-text-muted">
            Your school name appears on the portal, receipts, and as the sender name on emails.
          </p>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <Input
            label="School name"
            name="name"
            required
            defaultValue={school.name}
            error={state?.fieldErrors?.name}
            disabled={isPending}
            maxLength={200}
          />
          <Input
            label="Roll number"
            name="rollNumber"
            defaultValue={school.rollNumber}
            error={state?.fieldErrors?.rollNumber}
            disabled={isPending}
            placeholder="Dept. of Education roll number"
            maxLength={20}
          />
        </div>
      </section>

      {/* Contact */}
      <section className="space-y-4">
        <div>
          <h2 className="text-sm font-semibold text-text-primary">Contact details</h2>
          <p className="text-xs text-text-muted">
            Shown to parents on the public Contact and Privacy pages.
          </p>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <Input
            label="Email"
            name="email"
            type="email"
            defaultValue={school.email}
            error={state?.fieldErrors?.email}
            disabled={isPending}
            placeholder="office@yourschool.ie"
            maxLength={255}
          />
          <Input
            label="Phone"
            name="phone"
            type="tel"
            defaultValue={school.phone}
            error={state?.fieldErrors?.phone}
            disabled={isPending}
            placeholder="+353 1 234 5678"
            maxLength={30}
          />
        </div>
        <Input
          label="Website"
          name="website"
          defaultValue={school.website}
          error={state?.fieldErrors?.website}
          disabled={isPending}
          placeholder="www.yourschool.ie"
          maxLength={255}
        />
      </section>

      {/* Address */}
      <section className="space-y-4">
        <div>
          <h2 className="text-sm font-semibold text-text-primary">Address</h2>
          <p className="text-xs text-text-muted">
            Used as the data-controller address on the Privacy page.
          </p>
        </div>
        <Input
          label="Address line 1"
          name="addressLine1"
          defaultValue={school.addressLine1}
          error={state?.fieldErrors?.addressLine1}
          disabled={isPending}
          maxLength={200}
        />
        <Input
          label="Address line 2"
          name="addressLine2"
          defaultValue={school.addressLine2}
          error={state?.fieldErrors?.addressLine2}
          disabled={isPending}
          maxLength={200}
        />
        <div className="grid gap-4 sm:grid-cols-3">
          <Input
            label="City / Town"
            name="city"
            defaultValue={school.city}
            error={state?.fieldErrors?.city}
            disabled={isPending}
            maxLength={100}
          />
          <Input
            label="County"
            name="county"
            defaultValue={school.county}
            error={state?.fieldErrors?.county}
            disabled={isPending}
            maxLength={100}
          />
          <Input
            label="Eircode"
            name="eircode"
            defaultValue={school.eircode}
            error={state?.fieldErrors?.eircode}
            disabled={isPending}
            maxLength={20}
          />
        </div>
      </section>

      <div className="flex items-center gap-3 border-t border-border pt-6">
        <Button type="submit" loading={isPending}>
          Save changes
        </Button>
        {state?.success && (
          <span className="text-sm text-success" role="status">
            {state.message}
          </span>
        )}
      </div>
    </form>
  )
}
