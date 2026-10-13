import { Check, ChevronDown } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { CHAINS, type SupportedChainId } from "@/lib/swap/chains";

// Image icons for chains that have local assets
const CHAIN_IMG: Partial<Record<SupportedChainId, string>> = {
  5042: "/chains/arc.jpg",
  8453: "/chains/base.jpg",
};

// Emoji fallbacks for chains without local images
const CHAIN_EMOJI: Record<SupportedChainId, string> = {
  5042: "",   // uses img
  8453: "",   // uses img
  1:    "⟠",
  42161:"🔵",
  10:   "🔴",
  137:  "🟣",
  43114:"🔺",
  56:   "🟡",
  59144:"🟩",
};

// Arc gets a "Default" badge
const DEFAULT_CHAIN: SupportedChainId = 5042;

const ChainDropdown = ({
  chainId,
  onChange,
}: {
  chainId: SupportedChainId;
  onChange: (id: SupportedChainId) => void;
}) => {
  const safeId: SupportedChainId = CHAINS[chainId] ? chainId : DEFAULT_CHAIN;
  const current = CHAINS[safeId];
  const imgSrc = CHAIN_IMG[safeId];

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          aria-label={`Switch network. Current: ${current.name}`}
          className="flex items-center gap-2 px-3 py-2 rounded-xl border border-border/60 bg-card hover:bg-muted transition-colors text-sm font-medium text-foreground focus:outline-none"
        >
          {imgSrc ? (
            <img src={imgSrc} alt={current.shortName} className="w-5 h-5 rounded-full object-cover" />
          ) : (
            <span className="w-5 h-5 flex items-center justify-center text-base leading-none select-none">
              {CHAIN_EMOJI[safeId]}
            </span>
          )}
          <span className="hidden sm:inline">{current.shortName}</span>
          <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
        </button>
      </DropdownMenuTrigger>

      <DropdownMenuContent
        align="end"
        className="w-64 rounded-xl border border-border/60 bg-card p-1.5 shadow-xl shadow-black/20 max-h-[420px] overflow-y-auto"
      >
        {(Object.entries(CHAINS) as [string, (typeof CHAINS)[SupportedChainId]][]).map(
          ([id, chain]) => {
            const numId = Number(id) as SupportedChainId;
            const active = numId === safeId;
            const isDefault = numId === DEFAULT_CHAIN;
            const img = CHAIN_IMG[numId];

            return (
              <DropdownMenuItem
                key={id}
                onClick={() => onChange(numId)}
                className="flex items-center gap-3 px-3 py-2.5 rounded-lg cursor-pointer focus:bg-muted/60 data-[highlighted]:bg-muted/60"
              >
                {img ? (
                  <img src={img} alt={chain.shortName} className="w-7 h-7 rounded-full object-cover shrink-0" />
                ) : (
                  <span className="w-7 h-7 flex items-center justify-center text-xl leading-none select-none shrink-0">
                    {CHAIN_EMOJI[numId]}
                  </span>
                )}
                <div className="flex flex-col flex-1 min-w-0">
                  <div className="flex items-center gap-1.5">
                    <span className="text-sm font-semibold text-foreground truncate">
                      {chain.name}
                    </span>
                    {isDefault && (
                      <span className="text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded-full bg-primary/20 text-primary shrink-0">
                        Default
                      </span>
                    )}
                  </div>
                  <span className="text-[11px] text-muted-foreground truncate">
                    {chain.subtitle}
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
