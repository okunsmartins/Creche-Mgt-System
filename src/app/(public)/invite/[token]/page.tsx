import type { Metadata } from 'next'
import Link from 'next/link'
import { createSupabaseAdminClient, createSupabaseServerClient } from '@/lib/supabase/server'
import { InviteForms } from '@/components/parent-invites/InviteForms'
import { InviteAuthedButton } from '@/components/parent-invites/InviteAuthedButton'
import { TeddyShell } from '@/components/auth/TeddyShell'

export const metadata: Metadata = { title: 'Your invite' }

function InvalidInvite() {
  return (
    <TeddyShell>
      <div className="card text-center">
        <h1 className="mb-3 font-display text-2xl font-bold text-text-primary">
          Invite not available
        </h1>
        <p className="mb-6 text-text-secondary">
          This invite link is invalid, has already been used, or has expired. Please ask your crèche
          for a new one.
        </p>
        <Link href="/login" className="font-extrabold text-[#6d3fd1] hover:underline">
          Go to sign in
        </Link>
      </div>
    </TeddyShell>
  )
}

export default async function ParentInvitePage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params
  if (!/^[0-9a-f]{64}$/.test(token)) return <InvalidInvite />

  const db = createSupabaseAdminClient()
  const { data: invData } = await db
    .from('parent_invites')
    .select('id, school_id, student_id, email, used_at, expires_at')
    .eq('token', token)
    .maybeSingle()
  const invite = invData as {
    id: string
    school_id: string
    student_id: string
    email: string | null
    used_at: string | null
    expires_at: string
  } | null

  if (!invite || invite.used_at || new Date(invite.expires_at) <= new Date()) {
    return <InvalidInvite />
  }

  const [{ data: schoolRow }, { data: childRow }] = await Promise.all([
    db.from('schools').select('name').eq('id', invite.school_id).maybeSingle(),
    db
      .from('students')
      .select('first_name, last_name')
      .eq('id', invite.student_id)
      .eq('school_id', invite.school_id)
      .maybeSingle(),
  ])
  const schoolName = (schoolRow as { name: string } | null)?.name ?? 'your crèche'
  const child = childRow as { first_name: string; last_name: string } | null
  const childName = child ? `${child.first_name} ${child.last_name}` : 'your child'

  // Already signed in? Offer a one-click link instead of a new account.
  const supabase = await createSupabaseServerClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  return (
    <TeddyShell
      footer={
        <>This link is personal to {childName}&rsquo;s family — please don&rsquo;t share it.</>
      }
    >
      <div className="card">
        <h1 className="text-center font-display text-3xl font-bold text-text-primary">
          Welcome to {schoolName}
        </h1>
        <p className="mb-6 mt-1 text-center text-sm font-semibold text-text-secondary">
          You&rsquo;ve been invited to the parent portal for <strong>{childName}</strong>. Set up
          your account below to see daily records, fees, messages and more.
        </p>
        {user ? (
          <div className="space-y-4">
            <p className="text-sm text-text-secondary">
              You&rsquo;re signed in. Link <strong>{childName}</strong> to your account to continue.
            </p>
            <InviteAuthedButton token={token} childName={child?.first_name ?? 'your child'} />
          </div>
        ) : (
          <InviteForms token={token} email={invite.email ?? undefined} />
        )}
      </div>
    </TeddyShell>
  )
}
