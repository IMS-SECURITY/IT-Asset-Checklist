interface TvseBrandMarkProps {
  /** Large display for loading screens; compact for headers. */
  size?: "lg" | "sm";
  className?: string;
}

/**
 * Text-based TVSE brand mark matching the corporate attendance portal style.
 */
export function TvseBrandMark({ size = "lg", className = "" }: TvseBrandMarkProps) {
  return (
    <div className={`tvse-brand ${size === "sm" ? "tvse-brand-sm" : ""} ${className}`.trim()} aria-hidden="true">
      <span className="tvse-brand-title">TVSE</span>
      <span className="tvse-brand-subtitle">TVS ELECTRONICS</span>
    </div>
  );
}
