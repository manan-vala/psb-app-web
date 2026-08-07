/**
 * Shared logic for the onboarding approval queue: how a core-banking record is
 * masked before an analyst sees it, and how their typed values are checked.
 *
 * Kept out of the route handlers because verify and decision both need the
 * comparison, and they must agree — a decision endpoint that scored the fields
 * even slightly differently from the form the analyst was looking at would
 * approve things the UI said were mismatched.
 */

export interface CoreRecord {
  accountNumber: string;
  fullName: string;
  mobile: string;
  branch: string;
  ifsc: string;
  dateOfBirth: string | null;
  isActive: boolean;
}

export interface SubmittedDetails {
  accountNumber: string;
  fullName: string;
  mobile: string;
}

export interface TypedDetails {
  accountNumber?: string;
  fullName?: string;
  mobile?: string;
  branch?: string;
}

export type FieldName = 'accountNumber' | 'fullName' | 'mobile' | 'branch';

export interface MatchResult {
  /** Whether a core-banking record exists for the submitted account number. */
  coreRecordExists: boolean;
  /** False for a closed/frozen passbook — blocks approval even on a full match. */
  accountActive: boolean;
  /** Per-field outcome, in the order the form renders them. */
  fields: Record<FieldName, boolean>;
  /** True only when every check above passes. The Approve button's gate. */
  allMatch: boolean;
  checkedAt: string;
}

/* ── normalisation ─────────────────────────────────────────────────────── */

/** Case, spacing and punctuation are not what's being verified here. */
function normaliseName(value: string): string {
  return value
    .toLowerCase()
    .replace(/[.,'-]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

/** Digits only, so "+91 98250 12345" and "9825012345" compare equal. */
function normaliseMobile(value: string): string {
  return value.replace(/\D/g, '').slice(-10);
}

/** Branch names vary in dash and spacing style between systems. */
function normaliseBranch(value: string): string {
  return value
    .toLowerCase()
    .replace(/[–—-]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/* ── masking ───────────────────────────────────────────────────────────── */

/**
 * "Ramesh Kumar Patel" → "R***** K**** P****"
 *
 * Enough for an analyst to confirm they're looking at the right customer,
 * not enough to copy into the form. If the masked record were readable the
 * four-eyes check would be theatre — the whole premise is that the analyst is
 * reading a physical passbook, and the screen must not be able to stand in
 * for it.
 */
export function maskName(value: string): string {
  return value
    .split(/\s+/)
    .filter(Boolean)
    .map((word) => word[0] + '*'.repeat(Math.max(1, word.length - 1)))
    .join(' ');
}

/** "9825012345" → "98******45" */
export function maskMobile(value: string): string {
  const digits = normaliseMobile(value);
  if (digits.length < 4) return '*'.repeat(digits.length);
  return `${digits.slice(0, 2)}${'*'.repeat(digits.length - 4)}${digits.slice(-2)}`;
}

/** "Ahmedabad - Navrangpura" → "A******** - N**********" */
export function maskBranch(value: string): string {
  return value
    .split(/(\s+|-)/)
    .map((part) =>
      /^\s+$/.test(part) || part === '-'
        ? part
        : part.length > 1
          ? part[0] + '*'.repeat(part.length - 1)
          : part
    )
    .join('');
}

/**
 * The analyst-facing view of a core record.
 *
 * `accountNumber` is deliberately NOT masked: the record was looked up by that
 * number, so showing it reveals nothing the analyst didn't already have from
 * the customer's own submission.
 */
export function maskCoreRecord(record: CoreRecord) {
  return {
    accountNumber: record.accountNumber,
    fullName: maskName(record.fullName),
    mobile: maskMobile(record.mobile),
    branch: maskBranch(record.branch),
    ifsc: record.ifsc,
    isActive: record.isActive,
  };
}

/* ── verification ──────────────────────────────────────────────────────── */

/**
 * Checks the analyst's typed values twice, per DEMO-IMPLEMENTATION-PLAN.md §3:
 *
 *   1. against the core-banking record — does this passbook actually exist,
 *      and does it say what the analyst is reading off the physical book?
 *   2. against what the customer submitted — does their claim match it?
 *
 * Both have to pass. Checking only the first would let a customer's typo
 * through; checking only the second would let the analyst rubber-stamp a
 * fabricated account that core banking has never heard of.
 *
 * `branch` is compared against the core record alone, because the customer is
 * never asked for it — it exists precisely as something only the passbook can
 * supply.
 */
export function verifyFields(
  typed: TypedDetails,
  core: CoreRecord | null,
  submitted: SubmittedDetails
): MatchResult {
  const fields: Record<FieldName, boolean> = {
    accountNumber: false,
    fullName: false,
    mobile: false,
    branch: false,
  };

  if (core) {
    const typedAccount = (typed.accountNumber ?? '').replace(/\D/g, '');
    fields.accountNumber =
      typedAccount === core.accountNumber && typedAccount === submitted.accountNumber;

    const typedName = normaliseName(typed.fullName ?? '');
    fields.fullName =
      typedName.length > 0 &&
      typedName === normaliseName(core.fullName) &&
      typedName === normaliseName(submitted.fullName);

    const typedMobile = normaliseMobile(typed.mobile ?? '');
    fields.mobile =
      typedMobile.length === 10 &&
      typedMobile === normaliseMobile(core.mobile) &&
      typedMobile === normaliseMobile(submitted.mobile);

    const typedBranch = normaliseBranch(typed.branch ?? '');
    fields.branch = typedBranch.length > 0 && typedBranch === normaliseBranch(core.branch);
  }

  const coreRecordExists = !!core;
  const accountActive = !!core?.isActive;
  const allMatch =
    coreRecordExists && accountActive && Object.values(fields).every(Boolean);

  return {
    coreRecordExists,
    accountActive,
    fields,
    allMatch,
    checkedAt: new Date().toISOString(),
  };
}
