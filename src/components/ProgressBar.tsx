interface Props {
  /** 0–100. */
  percent: number;
  label: string;
  className?: string;
}

/** Thin accent progress bar with a real progressbar role and value text (ui §6.10). */
export function ProgressBar({ percent, label, className = '' }: Props) {
  return (
    <div
      role="progressbar"
      aria-label={label}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={percent}
      aria-valuetext={`${percent}%`}
      className={`h-2 w-full overflow-hidden rounded-full bg-surface-2 ${className}`}
    >
      <div className="h-full rounded-full bg-accent" style={{ width: `${percent}%` }} />
    </div>
  );
}
