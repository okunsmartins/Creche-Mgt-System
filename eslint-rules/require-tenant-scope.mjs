/**
 * ESLint rule: require-tenant-scope
 *
 * The service-role client (`createSupabaseAdminClient()`) BYPASSES row-level
 * security, so a `.select`/`.update`/`.delete` on a tenant-scoped table with **no
 * row filter at all** hits every school's rows — the class of cross-tenant leak
 * fixed in the orders-list / dashboard-count bugs (and, for writes, worse).
 *
 * This rule flags an admin-client `.from('<tenant table>')` select/update/delete
 * whose chain contains **no filtering method** (`.eq`, `.in`, `.match`, `.or`,
 * `.filter`, …). `.insert`/`.upsert` are exempt (their payload carries
 * `school_id`). It deliberately does NOT try to judge whether a filter is the
 * *right* one — a query filtered by any verified key (`student_id`, `parent_id`,
 * an order id, …) passes. Judging filter correctness statically is infeasible and
 * produces false positives (that's what tenant-scoping code review is for). This
 * rule's job is narrow and high-signal: force an explicit decision whenever a
 * tenant table is read completely unfiltered.
 *
 * Conservative by construction:
 *  - only the admin client (tracked from `createSupabaseAdminClient()`), never the
 *    RLS-respecting server client;
 *  - only reads (`.select`) — inserts/updates/deletes are skipped;
 *  - `schools` is the tenant root (scoped by its own `id`), not a tenant table here.
 *
 * Escape hatch for an intentional cross-tenant scan (crons, platform jobs):
 *   // eslint-disable-next-line local/require-tenant-scope -- <why all-schools is correct>
 */

// Tenant-sensitive tables — reading any of them unfiltered spans schools.
// Includes both tables with their own `school_id` and those scoped via a parent
// (order_items, payments, refunds, *_eligibility, email_notifications). `schools`
// is excluded — it is the tenant root, scoped by its own `id`.
const TENANT_TABLES = new Set([
  'activities',
  'activity_class_eligibility',
  'activity_pupil_eligibility',
  'attendance_records',
  'attendance_sessions',
  'audit_logs',
  'classes',
  'email_notifications',
  'meeting_slots',
  'order_items',
  'orders',
  'parent_link_requests',
  'parent_message_recipients',
  'parent_messages',
  'permission_slips',
  'permission_slip_responses',
  'parent_student_links',
  'payment_links',
  'payments',
  'profiles',
  'programme_class_eligibility',
  'programmes',
  'refunds',
  'school_settings',
  'school_sms_balance',
  'sms_messages',
  'sms_notifications',
  'sms_topups',
  'student_assignments',
  'student_documents',
  'students',
  'subscriptions',
  'teachers',
  'time_off_requests',
  'user_roles',
])

// Payload-based ops carry `school_id` in the row values, so they need no filter
// (even with a trailing `.select` returning the just-written rows).
const PAYLOAD_OPS = new Set(['insert', 'upsert'])
// Ops that touch EXISTING rows and therefore need a filter, or they hit every
// school: reads AND mass writes (an unfiltered update/delete is worse than a read).
const ROW_OPS = new Set(['select', 'update', 'delete'])

// PostgREST row-filter methods. Any of these means the read is constrained; the
// rule only fires when NONE are present (a whole-table scan).
const FILTERS = new Set([
  'eq',
  'neq',
  'gt',
  'gte',
  'lt',
  'lte',
  'like',
  'ilike',
  'is',
  'in',
  'contains',
  'containedBy',
  'rangeGt',
  'rangeGte',
  'rangeLt',
  'rangeLte',
  'rangeAdjacent',
  'overlaps',
  'textSearch',
  'match',
  'not',
  'or',
  'filter',
])

/** Walk up from a `.from()` call to gather every `.method(...)` in the same chain. */
function chainMethods(fromCall) {
  const names = []
  const record = (call) => {
    if (call.callee?.type === 'MemberExpression' && call.callee.property?.type === 'Identifier') {
      names.push(call.callee.property.name)
    }
  }
  record(fromCall)
  let cur = fromCall
  while (
    cur.parent?.type === 'MemberExpression' &&
    cur.parent.object === cur &&
    cur.parent.parent?.type === 'CallExpression' &&
    cur.parent.parent.callee === cur.parent
  ) {
    cur = cur.parent.parent
    record(cur)
  }
  return names
}

/** @type {import('eslint').Rule.RuleModule} */
const rule = {
  meta: {
    type: 'problem',
    docs: {
      description:
        'Require a row filter on service-role select/update/delete of tenant-scoped tables.',
    },
    schema: [],
    messages: {
      unfiltered:
        "Service-role query on tenant table '{{table}}' has no row filter — it reads/writes every school's rows. Scope it (e.g. .eq('school_id', …) or another verified key), or disable with a justification for an intentional cross-tenant operation.",
    },
  },
  create(context) {
    const adminVars = new Set()

    const isAdminRoot = (obj) => {
      if (
        obj?.type === 'CallExpression' &&
        obj.callee?.type === 'Identifier' &&
        obj.callee.name === 'createSupabaseAdminClient'
      ) {
        return true
      }
      return obj?.type === 'Identifier' && adminVars.has(obj.name)
    }

    return {
      VariableDeclarator(node) {
        if (
          node.init?.type === 'CallExpression' &&
          node.init.callee?.type === 'Identifier' &&
          node.init.callee.name === 'createSupabaseAdminClient' &&
          node.id?.type === 'Identifier'
        ) {
          adminVars.add(node.id.name)
        }
      },

      CallExpression(node) {
        if (node.callee?.type !== 'MemberExpression') return
        if (node.callee.property?.type !== 'Identifier' || node.callee.property.name !== 'from') {
          return
        }
        const arg = node.arguments[0]
        if (arg?.type !== 'Literal' || typeof arg.value !== 'string') return
        const table = arg.value
        if (!TENANT_TABLES.has(table)) return
        if (!isAdminRoot(node.callee.object)) return

        const methods = chainMethods(node)
        if (methods.some((n) => PAYLOAD_OPS.has(n))) return // insert/upsert carry school_id
        if (!methods.some((n) => ROW_OPS.has(n))) return // must be a select/update/delete
        if (methods.some((n) => FILTERS.has(n))) return // has a row filter → fine

        context.report({ node, messageId: 'unfiltered', data: { table } })
      },
    }
  },
}

export default rule
