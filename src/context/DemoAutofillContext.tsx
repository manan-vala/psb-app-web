'use client';

import { createContext, useContext, useMemo, useState, type ReactNode } from 'react';

export interface DemoApplicant {
  variant: 'valid' | 'wrong-surname';
  fullName: string;
  mobile: string;
  accountNumber: string;
  password: string;
  /** The name core banking holds — differs from `fullName` on wrong-surname. */
  passbookName: string;
  branch: string;
  accountsRemaining: number;
}

interface DemoAutofillValue {
  /** Set when a demo applicant is waiting to be written into a form. */
  applicant: DemoApplicant | null;
  publish: (applicant: DemoApplicant) => void;
  /** Called by the form once it has taken the values. */
  consume: () => void;
}

const DemoAutofillContext = createContext<DemoAutofillValue>({
  applicant: null,
  publish: () => {},
  consume: () => {},
});

/**
 * Carries a generated demo applicant from the button to the form.
 *
 * These two live in different subtrees: the demo panel renders beside the
 * phone mockup in `PhoneFrame`, while the register form renders inside the
 * phone's viewport as a route child. They have no parent-child relationship to
 * pass props through, so the shared state sits above both, in `AppShell`.
 *
 * Publish/consume rather than a plain value, so that pressing the same button
 * twice re-fills the form. If the applicant simply stayed in state, the second
 * press would set an identical object and the form's effect would have nothing
 * new to react to.
 */
export function DemoAutofillProvider({ children }: { children: ReactNode }) {
  const [applicant, setApplicant] = useState<DemoApplicant | null>(null);

  const value = useMemo(
    () => ({
      applicant,
      publish: (next: DemoApplicant) => setApplicant(next),
      consume: () => setApplicant(null),
    }),
    [applicant]
  );

  return (
    <DemoAutofillContext.Provider value={value}>{children}</DemoAutofillContext.Provider>
  );
}

export function useDemoAutofill(): DemoAutofillValue {
  return useContext(DemoAutofillContext);
}
