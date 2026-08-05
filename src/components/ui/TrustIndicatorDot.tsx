import { Colors } from '@/constants/theme';

/**
 * Port of the Expo app's `TrustIndicatorDot`. In the native app this was
 * hardcoded to 95; here it is driven by the live risk assessment.
 */
export function TrustIndicatorDot({ score }: { score: number }) {
  let color: string = Colors.error;
  if (score > 80) color = Colors.successLight;
  else if (score >= 20) color = Colors.warning;

  return (
    <span
      className="trust-dot"
      style={{ backgroundColor: color }}
      title={`Session trust score: ${score}`}
    />
  );
}
