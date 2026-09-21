import { Check, ChevronDown } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { CHAINS, type SupportedChainId } from "@/lib/swap/chains";

const CHAIN_ICONS: Record<SupportedChainId, { src: string; alt: string }> = {
  8453: { src: "/chains/base.jpg", alt: "Base" },
  5042: { src: "/chains/arc.jpg", alt: "Arc" },
};

const ChainDropdown = ({
  chainId,
  onChange,
}: {
  chainId: SupportedChainId;
  onChange: (id: SupportedChainId) => void;
}) => {
  // Guard against a stale/unsupported chain id (e.g. persisted from a retired network)
  const safeId: SupportedChainId = CHAINS[chainId] ? chainId : 5042;
  const current = CHAINS[safeId];
  const icon = CHAIN_ICONS[safeId];

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          aria-label={`Switch network. Current network: ${current.name}`}
          className="flex items-center gap-2 px-3 py-2 rounded-xl border border-border/60 bg-card hover:bg-muted transition-colors text-sm font-medium text-foreground focus:outline-none"
        >
          <img src={icon.src} alt={icon.alt} className="w-5 h-5 rounded-full object-cover" />
          <span className="hidden sm:inline">{current.shortName}</span>
          <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56 rounded-xl border border-border/60 bg-card p-1.5 shadow-xl shadow-black/20">
        {(Object.entries(CHAINS) as [string, (typeof CHAINS)[SupportedChainId]][]).map(
          ([id, chain]) => {
            const numId = Number(id) as SupportedChainId;
            const active = numId === chainId;
            const ci = CHAIN_ICONS[numId];
            return (
              <DropdownMenuItem
                key={id}
                onClick={() => onChange(numId)}
                className="flex items-center gap-3 px-3 py-2.5 rounded-lg cursor-pointer focus:bg-muted/60 data-[highlighted]:bg-muted/60"
              >
                <img src={ci.src} alt={ci.alt} className="w-7 h-7 rounded-full object-cover shrink-0" />
                <div className="flex flex-col flex-1 min-w-0">
                  <span className="text-sm font-semibold text-foreground">{chain.name}</span>
                  <span className="text-[11px] text-muted-foreground">
                    {numId === 8453 ? "Production · Low fees" : "Production · USDC gas"}
                  </span>
                </div>
                {active && (
                  <Check className="h-4 w-4 text-primary shrink-0" />
                )}
              </DropdownMenuItem>
            );
          }
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
};

export default ChainDropdown;
