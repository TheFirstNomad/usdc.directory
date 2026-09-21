import { CHAINS, type SupportedChainId } from "@/lib/swap/chains";

const CHAIN_ICONS: Record<SupportedChainId, string> = {
  8453: "/chains/base.jpg",
  5042: "/chains/arc.jpg",
};

const ChainSelector = ({
  chainId,
  onChange,
}: {
  chainId: SupportedChainId;
  onChange: (id: SupportedChainId) => void;
}) => (
  <div className="flex items-center gap-1 p-1 rounded-2xl bg-muted/20 border border-border/40 backdrop-blur-sm">
    {(Object.entries(CHAINS) as [string, (typeof CHAINS)[SupportedChainId]][]).map(
      ([id, chain]) => {
        const numId = Number(id) as SupportedChainId;
        const active = numId === chainId;
        return (
          <button
            key={id}
            onClick={() => onChange(numId)}
            className={`flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold transition-all duration-200 ${
              active
                ? "bg-primary text-primary-foreground shadow-lg shadow-primary/25"
                : "text-muted-foreground hover:text-foreground hover:bg-muted/40"
            }`}
          >
            <img src={CHAIN_ICONS[numId]} alt={chain.shortName} className="w-5 h-5 rounded-full object-cover" />
            {chain.shortName}
          </button>
        );
      }
    )}
  </div>
);

export default ChainSelector;
