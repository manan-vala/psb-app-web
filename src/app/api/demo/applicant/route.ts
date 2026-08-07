import { NextResponse } from 'next/server';
import { sql } from '@/lib/db';

export const runtime = 'nodejs';

/**
 * Generates a ready-to-register applicant for the demo, drawn from a real
 * unclaimed core-banking record.
 *
 * The values come from `bank_accounts` rather than being hardcoded in the
 * client, for one practical reason: the analyst on the other screen verifies
 * against that same table. Anything invented here that isn't in core banking
 * would fail verification for reasons that have nothing to do with the point
 * being demonstrated.
 *
 * Two variants:
 *
 *   valid          — details exactly as the passbook has them. Verification
 *                    passes, the analyst approves, the phone enters the app.
 *   wrong-surname  — every field correct except the last name. This is the
 *                    reject path: the analyst types what the passbook actually
 *                    says, so the name matches core banking but not what the
 *                    applicant claimed, and approval stays locked.
 *
 * Same-origin and unauthenticated — it's called by this app's own register
 * screen. It does reveal seeded core-banking names, which is fine because
 * they're fixtures, and is the accepted cost of a one-click demo.
 */

/**
 * Replacement surnames for the wrong-surname variant. Picked to be plainly
 * different from the real one rather than a subtle typo — on a projector, a
 * mismatch nobody can see isn't a demo.
 */
const DECOY_SURNAMES = [
  'Sharma',
  'Verma',
  'Reddy',
  'Bose',
  'Nayar',
  'Chopra',
  'Gill',
  'Dutta',
];

const DEMO_PASSWORD = 'Demo@1234';

/** Swaps the last word of a name for one that isn't already part of it. */
function withWrongSurname(fullName: string): string {
  const parts = fullName.trim().split(/\s+/);
  const realSurname = parts[parts.length - 1].toLowerCase();

  const candidates = DECOY_SURNAMES.filter((s) => s.toLowerCase() !== realSurname);
  const decoy = candidates[Math.floor(Math.random() * candidates.length)];

  return [...parts.slice(0, -1), decoy].join(' ');
}

export async function GET(req: Request) {
  const variant =
    new URL(req.url).searchParams.get('variant') === 'wrong-surname'
      ? 'wrong-surname'
      : 'valid';

  // An account is usable only if nothing has claimed either of the two columns
  // that are UNIQUE on `users`. Checking account_number alone isn't enough:
  // a previous run could have taken this record's mobile via a different
  // account, and registration would fail on users_mobile_key instead.
  const [record] = await sql`
    SELECT b.account_number, b.full_name, b.mobile, b.branch
    FROM bank_accounts b
    WHERE b.is_active
      AND NOT EXISTS (SELECT 1 FROM users u WHERE u.account_number = b.account_number)
      AND NOT EXISTS (SELECT 1 FROM users u WHERE u.mobile = b.mobile)
    ORDER BY random()
    LIMIT 1
  `;

  if (!record) {
    return NextResponse.json(
      {
        error:
          'Every demo account has been registered. Use "Reset demo data" on the dashboard to free them up.',
      },
      { status: 409 }
    );
  }

  const passbookName = record.full_name as string;

  const [{ remaining }] = await sql`
    SELECT count(*)::int AS remaining
    FROM bank_accounts b
    WHERE b.is_active
      AND NOT EXISTS (SELECT 1 FROM users u WHERE u.account_number = b.account_number)
      AND NOT EXISTS (SELECT 1 FROM users u WHERE u.mobile = b.mobile)
  `;

  return NextResponse.json({
    variant,
    fullName: variant === 'wrong-surname' ? withWrongSurname(passbookName) : passbookName,
    mobile: record.mobile as string,
    accountNumber: record.account_number as string,
    password: DEMO_PASSWORD,
    // What the analyst will see on the passbook. Returned so the register
    // screen can show *why* a wrong-surname applicant is going to be rejected.
    passbookName,
    branch: record.branch as string,
    // Counts this record, which is about to be consumed by registering it.
    accountsRemaining: remaining as number,
  });
}
