import { Link } from "react-router-dom";

interface BrandLogoProps {
  compact?: boolean;
  className?: string;
}

const BrandLogo = ({ compact = false, className = "" }: BrandLogoProps) => (
  <Link
    to="/"
    className={`inline-flex items-center gap-2.5 ${className}`}
    aria-label="USDC Directory home"
  >
    <img
      src="/Circle_USDC_Logo.svg"
      alt=""
      className={compact ? "h-8 w-8 shrink-0" : "h-9 w-9 shrink-0"}
    />
    <span className="flex items-baseline gap-1 whitespace-nowrap">
      <span className="text-xl font-extrabold text-primary">USDC</span>
      <span className="text-lg font-semibold text-foreground">Directory</span>
    </span>
  </Link>
);

export default BrandLogo;