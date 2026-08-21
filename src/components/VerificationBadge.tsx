import type { VerificationStatus } from "../data/schema";
import { verificationMeta } from "./content";

interface VerificationBadgeProps {
  status: VerificationStatus;
  compact?: boolean;
}
export function VerificationBadge({ status, compact = false }: VerificationBadgeProps) {
  const meta = verificationMeta[status];
  return (
    <span
      className={`verification-badge tone-${meta.tone}${compact ? " is-compact" : ""}`}
      title={`Formal verification status: ${meta.label}`}
    >
      <span aria-hidden="true" className="status-dot" />
      {meta.label}
    </span>
  );
}
