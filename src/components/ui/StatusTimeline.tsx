'use client';

import { Icon } from './Icon';

export type StepState = 'done' | 'current' | 'pending' | 'failed';

export interface TimelineStep {
  label: string;
  description?: string;
  state: StepState;
}

/**
 * Vertical stepper for the onboarding waiting room.
 *
 * Styled with inline rules over the existing custom properties rather than new
 * global classes, the same way the register screen's password-rules block is
 * written. This is one screen's worth of layout; adding `.timeline*` selectors
 * to globals.css would put a new component vocabulary into the design system
 * for a single caller.
 */
export function StatusTimeline({ steps }: { steps: TimelineStep[] }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column' }}>
      {steps.map((step, i) => {
        const isLast = i === steps.length - 1;
        const color =
          step.state === 'done'
            ? 'var(--success)'
            : step.state === 'failed'
              ? 'var(--error)'
              : step.state === 'current'
                ? 'var(--primary)'
                : 'var(--outline)';

        return (
          <div key={step.label} style={{ display: 'flex', gap: 14 }}>
            {/* Marker column: dot plus the connector down to the next step. */}
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
              <span
                style={{
                  width: 26,
                  height: 26,
                  borderRadius: '50%',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0,
                  background:
                    step.state === 'pending' ? 'transparent' : color,
                  border:
                    step.state === 'pending'
                      ? '2px solid var(--outline-variant)'
                      : `2px solid ${color}`,
                  color: step.state === 'pending' ? 'var(--outline)' : '#fff',
                  transition: 'background 0.3s ease, border-color 0.3s ease',
                  // Reuse the existing `pulse` keyframes (globals.css), the
                  // same way .stepup__icon--scanning does — it's a scale plus
                  // an orange halo, sized for a marker like this one. Keeps a
                  // screen that sits here for a minute reading as "working"
                  // rather than "stuck".
                  animation:
                    step.state === 'current' ? 'pulse 1.6s ease-in-out infinite' : undefined,
                }}
              >
                {step.state === 'done' && <Icon name="check" size={16} />}
                {step.state === 'failed' && <Icon name="close" size={16} />}
                {step.state === 'current' && (
                  <span
                    style={{
                      width: 8,
                      height: 8,
                      borderRadius: '50%',
                      background: '#fff',
                    }}
                  />
                )}
              </span>

              {!isLast && (
                <span
                  style={{
                    width: 2,
                    flex: 1,
                    minHeight: 28,
                    background:
                      step.state === 'done' ? 'var(--success)' : 'var(--outline-variant)',
                    transition: 'background 0.3s ease',
                  }}
                />
              )}
            </div>

            <div style={{ paddingBottom: isLast ? 0 : 18, paddingTop: 2 }}>
              <p
                className="t-body-md fw-medium"
                style={{
                  color:
                    step.state === 'pending' ? 'var(--on-surface-variant)' : 'var(--on-surface)',
                }}
              >
                {step.label}
              </p>
              {step.description && (
                <p className="t-body-sm c-variant" style={{ marginTop: 2 }}>
                  {step.description}
                </p>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
