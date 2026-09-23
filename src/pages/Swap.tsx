import { useState, useCallback, useMemo } from "react";
import {
  ArrowDownUp, ChevronDown, ChevronUp, Wallet, Info,
  ExternalLink, Loader2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import SEO from "@/components/SEO";
import { useAppKit, useAppKitAccount, useAppKitProvider } from "@reown/appkit/react";
import { useBalance, useReadContract, useChainId, useSwitchChain } from "wagmi";
import { formatUnits } from "viem";

import ChainSelector from "@/components/swap/ChainSelector";
import TokenSearchModal from "@/components/swap/TokenSearchModal";
import SlippagePopover from "@/components/swap/SlippagePopover";
import SuccessModal from "@/components/swap/SuccessModal";
import CalldataDebugPanel from "@/components/swap/CalldataDebugPanel";
import QuoteTimer from "@/components/swap/QuoteTimer";
import { TOKENS_BY_CHAIN, POPULAR_PAIRS, getRouteDisplay, type TokenInfo } from "@/lib/swap/tokens";
import { CHAINS, type SupportedChainId } from "@/lib/swap/chains";
import { ERC20_ABI } from "@/lib/swap/contracts";
import { useQuote } from "@/lib/swap/useQuote";
import { useSwap } from "@/lib/swap/useSwap";
import { useChainContext } from "@/contexts/ChainContext";

/* rough fiat prices for display */
const FIAT_PRICES: Record<string, number> = {
  ETH: 3450, WETH: 3450, USDC: 1, DAI: 1, USDbC: 1,
  cbBTC: 96500, AERO: 0.75, DEGEN: 0.008, EURC: 1.08,
};
const fiat = (symbol: string, amount: number) => {
  const p = FIAT_PRICES[symbol];
  if (!p || !amount) return null;
  return (p * amount).toLocaleString(undefined, { style: "currency", currency: "USD", maximumFractionDigits: 2 });
};

const Swap = () => {
  const { open: openWallet } = useAppKit();
  const { address, isConnected } = useAppKitAccount();
  const { walletProvider } = useAppKitProvider("eip155");
  const walletChainId = useChainId();
  const { switchChain } = useSwitchChain();

  const { chainId: globalChainId, setChainId: setGlobalChainId } = useChainContext();

  const [selectedChainId, setSelectedChainId] = useState<SupportedChainId>(globalChainId);
  const tokens = TOKENS_BY_CHAIN[selectedChainId] ?? [];
  const [payToken, setPayToken] = useState<TokenInfo>(tokens[0]);
  const [receiveToken, setReceiveToken] = useState<TokenInfo>(tokens[1] ?? tokens[0]);
  const [payAmount, setPayAmount] = useState("");
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [slippage, setSlippage] = useState(0.5);
  const [tokenModalOpen, setTokenModalOpen] = useState<"pay" | "receive" | null>(null);
  const [showSuccess, setShowSuccess] = useState(false);

  const chainConfig = CHAINS[selectedChainId];
  const popularPairs = POPULAR_PAIRS[selectedChainId] ?? [];
  const isArc = selectedChainId === 5042;
  // Skip wrong-chain check on Arc — Circle SDK handles chain context
  const wrongChain = isConnected && !isArc && walletChainId !== selectedChainId;

  /* ── chain switch ── */
  const handleChainChange = useCallback((id: SupportedChainId) => {
    setSelectedChainId(id);
    setGlobalChainId(id);
    const t = TOKENS_BY_CHAIN[id] ?? [];
    setPayToken(t[0]);
    setReceiveToken(t[1] ?? t[0]);
    setPayAmount("");
  }, [setGlobalChainId]);

  /* ── balances ── */
  const { data: nativeBalance } = useBalance({
    address: address as `0x${string}` | undefined,
    chainId: selectedChainId,
    query: { enabled: isConnected && !!address },
  });

  const { data: payErc20Bal } = useReadContract({
    address: payToken.address === "native" ? undefined : (payToken.address as `0x${string}`),
    abi: ERC20_ABI,
    functionName: "balanceOf",
    args: address ? [address as `0x${string}`] : undefined,
    chainId: selectedChainId,
    query: { enabled: isConnected && !!address && payToken.address !== "native" },
  });

  const { data: recErc20Bal } = useReadContract({
    address: receiveToken.address === "native" ? undefined : (receiveToken.address as `0x${string}`),
    abi: ERC20_ABI,
    functionName: "balanceOf",
    args: address ? [address as `0x${string}`] : undefined,
    chainId: selectedChainId,
    query: { enabled: isConnected && !!address && receiveToken.address !== "native" },
  });

  const payBalance =
    payToken.address === "native"
      ? nativeBalance ? formatUnits(nativeBalance.value, nativeBalance.decimals) : null
      : payErc20Bal != null ? formatUnits(payErc20Bal as bigint, payToken.decimals) : null;

  const receiveBalance =
    receiveToken.address === "native"
      ? nativeBalance ? formatUnits(nativeBalance.value, nativeBalance.decimals) : null
      : recErc20Bal != null ? formatUnits(recErc20Bal as bigint, receiveToken.decimals) : null;

  /* ── quote ── */
  const { amountOut, isLoading: quoteLoading, error: quoteError, poolFee, isEstimate } = useQuote({
    tokenIn: payToken,
    tokenOut: receiveToken,
    amountIn: payAmount,
    chainId: selectedChainId,
    enabled: true,
  });

  const receiveAmount = amountOut ? formatUnits(amountOut, receiveToken.decimals) : "";
  const receiveAmountNum = parseFloat(receiveAmount) || 0;
  const payAmountNum = parseFloat(payAmount) || 0;

  const amountOutMin =
    amountOut ? (amountOut * BigInt(Math.floor((1 - slippage / 100) * 10000))) / 10000n : null;
  const minReceived = amountOutMin ? formatUnits(amountOutMin, receiveToken.decimals) : "";

  const priceRate =
    receiveAmountNum > 0 && payAmountNum > 0 ? receiveAmountNum / payAmountNum : null;

  /* price impact estimation */
  const priceImpact = useMemo(() => {
    if (!payAmountNum || !receiveAmountNum) return null;
    const payFiat = (FIAT_PRICES[payToken.symbol] ?? 0) * payAmountNum;
    const recFiat = (FIAT_PRICES[receiveToken.symbol] ?? 0) * receiveAmountNum;
    if (!payFiat || !recFiat) return null;
    return ((payFiat - recFiat) / payFiat) * 100;
  }, [payAmountNum, receiveAmountNum, payToken.symbol, receiveToken.symbol]);

  const impactColor =
    priceImpact === null ? "text-muted-foreground"
      : priceImpact < 0.3 ? "text-green-400"
      : priceImpact < 1 ? "text-yellow-400"
      : "text-red-400";

  const routeDisplay = useMemo(
    () => getRouteDisplay(payToken, receiveToken, selectedChainId),
    [payToken, receiveToken, selectedChainId]
  );

  /* ── swap execution ── */
  const { swapState, txHash, errorMessage, needsApproval, approve, swap, reset, lastCalldata, calldataHistory } = useSwap({
    tokenIn: payToken,
    tokenOut: receiveToken,
    amountIn: payAmount,
    amountOutMin,
    chainId: selectedChainId,
    userAddress: address as `0x${string}` | undefined,
    slippage,
    walletProvider,
  });

  /* watch for success — open modal */
  const handleSwap = useCallback(async () => {
    try {
      await swap();
      setShowSuccess(true);
    } catch {
      setShowSuccess(false);
    }
  }, [swap]);

  /* ── handlers ── */
  const handleReverse = useCallback(() => {
    setPayToken(receiveToken);
    setReceiveToken(payToken);
    setPayAmount(receiveAmount || "");
  }, [payToken, receiveToken, receiveAmount]);

  const handleMax = () => { if (payBalance) setPayAmount(payBalance); };

  const handlePairClick = (from: string, to: string) => {
    const f = tokens.find((t) => t.symbol === from);
    const r = tokens.find((t) => t.symbol === to);
    if (f) setPayToken(f);
    if (r) setReceiveToken(r);
    setPayAmount("");
  };

  const handleTokenSelect = (token: TokenInfo) => {
    if (tokenModalOpen === "pay") {
      if (token.symbol === receiveToken.symbol) setReceiveToken(payToken);
      setPayToken(token);
    } else {
      if (token.symbol === payToken.symbol) setPayToken(receiveToken);
      setReceiveToken(token);
    }
  };

  const insufficientBalance = payBalance !== null && payAmountNum > 0 && payAmountNum > parseFloat(payBalance);
  const swapDisabled = payAmountNum <= 0 || !amountOut || wrongChain || insufficientBalance;

  /* ── render ── */
  return (
    <>
      <SEO
        title={`Swap Tokens on ${chainConfig.name}`}
        description={`Swap tokens on ${chainConfig.name} with low fees and minimal slippage.`}
        path="/swap"
      />
      <div className="min-h-screen flex flex-col bg-background">
        <Header />

        <main className="flex-1 flex flex-col items-center justify-center px-4 py-8 sm:py-12">
          {/* Chain selector */}
          <div className="mb-6 flex items-center gap-4">
            <ChainSelector chainId={selectedChainId} onChange={handleChainChange} />
          </div>

          {/* Arc Mainnet info banner */}
          {isArc && (
            <div className="w-full max-w-[460px] mb-4 animate-fade-in">
              <div className="rounded-xl border border-primary/20 bg-primary/5 p-3 flex items-start gap-2">
                <Info className="h-4 w-4 text-primary mt-0.5 shrink-0" />
                <p className="text-xs text-muted-foreground">
                  Swaps on Arc Mainnet are routed through Circle App Kit — USDC pays the gas.
                </p>
              </div>
            </div>
          )}

          {/* ── Swap UI (both chains) ── */}
              {/* Popular pairs */}
              {popularPairs.length > 0 && (
                <div className="flex flex-wrap gap-2 mb-5 justify-center">
                  <span className="text-xs text-muted-foreground/60 self-center mr-1">Popular:</span>
                  {popularPairs.map((p) => (
                    <button
                      key={`${p.from}-${p.to}`}
                      onClick={() => handlePairClick(p.from, p.to)}
                      className={`px-3.5 py-1.5 rounded-full text-xs font-medium border transition-all duration-200 ${
                        payToken.symbol === p.from && receiveToken.symbol === p.to
                          ? "border-primary bg-primary/15 text-primary shadow-sm shadow-primary/10"
                          : "border-border/50 bg-card/60 text-muted-foreground hover:border-primary/40 hover:text-foreground hover:bg-card"
                      }`}
                    >
                      {p.from}/{p.to}
                    </button>
                  ))}
                </div>
              )}

              {/* Wrong-chain prompt */}
              {wrongChain && (
                <div className="w-full max-w-[460px] mb-4 animate-fade-in">
                  <Button
                    onClick={() => switchChain({ chainId: selectedChainId })}
                    variant="outline"
                    className="w-full border-yellow-500/30 text-yellow-400 hover:bg-yellow-500/10"
                  >
                    Switch wallet to {chainConfig.name}
                  </Button>
                </div>
              )}

              {/* ─── Swap Card ─── */}
              <div className="w-full max-w-[460px] rounded-2xl border border-border/60 bg-card/95 backdrop-blur-sm p-5 shadow-xl shadow-black/10 animate-scale-in">
                {/* Header */}
                <div className="flex items-center justify-between mb-5">
                  <h1 className="text-lg font-bold text-foreground">Swap Tokens on {chainConfig.shortName}</h1>
                  <div className="flex items-center gap-1">
                    <QuoteTimer active={!!amountOut && payAmountNum > 0} />
                    <SlippagePopover value={slippage} onChange={setSlippage} />
                    {isConnected && (
                      <button
                        onClick={() => openWallet({ view: "Account" })}
                        className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors ml-1 px-2 py-1.5 rounded-lg hover:bg-muted/40"
                      >
                        <Wallet className="h-3.5 w-3.5" />
                        {address ? `${address.slice(0, 6)}…${address.slice(-4)}` : ""}
                      </button>
                    )}
                  </div>
                </div>

                {/* You Pay */}
                <div className="rounded-xl bg-muted/20 border border-border/40 p-4 mb-1 transition-colors focus-within:border-primary/30">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-medium text-muted-foreground">You Pay</span>
                    {isConnected && payBalance !== null && (
                      <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                        <Wallet className="h-3 w-3" />
                        <span>{parseFloat(payBalance).toFixed(4)}</span>
                        <button
                          onClick={handleMax}
                          className="ml-1 px-2 py-0.5 rounded-md bg-primary/10 text-primary text-[11px] font-bold hover:bg-primary/20 transition-colors"
                        >
                          MAX
                        </button>
                      </div>
                    )}
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="flex-1 min-w-0">
                      <input
                        type="text"
                        inputMode="decimal"
                        placeholder="0"
                        aria-label={`Amount of ${payToken.symbol} to pay`}
                        value={payAmount}
                        onChange={(e) => {
                          const v = e.target.value.replace(/[^0-9.]/g, "");
                          if (v.split(".").length <= 2) setPayAmount(v);
                          if (swapState !== "idle") reset();
                          if (showSuccess) setShowSuccess(false);
                        }}
                        className="w-full bg-transparent text-2xl sm:text-3xl font-semibold text-foreground outline-none placeholder:text-muted-foreground/30 min-w-0"
                      />
                      {payAmountNum > 0 && (
                        <p className="text-xs text-muted-foreground mt-1">
                          {fiat(payToken.symbol, payAmountNum) ?? ""}
                        </p>
                      )}
                    </div>
                    <button
                      onClick={() => setTokenModalOpen("pay")}
                      className="flex items-center gap-2 px-3 py-2.5 rounded-xl bg-muted/40 hover:bg-muted/60 border border-border/30 transition-all hover:border-border/60 shrink-0"
                    >
                      <img src={payToken.logoUrl} alt={payToken.symbol} className="w-6 h-6 rounded-full" />
                      <span className="font-semibold text-foreground">{payToken.symbol}</span>
                      <ChevronDown className="h-4 w-4 text-muted-foreground" />
                    </button>
                  </div>
                  {insufficientBalance && (
                    <p className="text-xs text-red-400 mt-1.5">Insufficient {payToken.symbol} balance</p>
                  )}
                </div>

                {/* Reverse */}
                <div className="flex justify-center -my-3.5 relative z-10">
                  <button
                    onClick={handleReverse}
                    className="w-10 h-10 rounded-xl bg-card border-2 border-border/60 flex items-center justify-center hover:bg-muted hover:border-primary/40 transition-all hover:scale-110 hover:rotate-180 duration-300 shadow-sm"
                  >
                    <ArrowDownUp className="h-4 w-4 text-muted-foreground" />
                  </button>
                </div>

                {/* You Receive */}
                <div className="rounded-xl bg-muted/20 border border-border/40 p-4 mt-1 transition-colors">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-medium text-muted-foreground">You Receive</span>
                    {isConnected && receiveBalance !== null && (
                      <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                        <Wallet className="h-3 w-3" />
                        <span>{parseFloat(receiveBalance).toFixed(4)}</span>
                      </div>
                    )}
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="flex-1 min-w-0">
                      {quoteLoading ? (
                        <div className="flex items-center gap-2">
                          <div className="h-7 w-32 rounded-lg bg-muted/40 animate-pulse" />
                        </div>
                      ) : (
                        <>
                          <p className="text-2xl sm:text-3xl font-semibold text-foreground">
                            {receiveAmountNum > 0
                              ? parseFloat(receiveAmount).toLocaleString(undefined, {
                                  minimumFractionDigits: 2,
                                  maximumFractionDigits: 6,
                                })
                              : "0"}
                          </p>
                          <div className="flex items-center gap-2 mt-1">
                            {receiveAmountNum > 0 && (
                              <span className="text-xs text-muted-foreground">
                                {fiat(receiveToken.symbol, receiveAmountNum) ?? ""}
                              </span>
                            )}
                            {priceImpact !== null && receiveAmountNum > 0 && (
                              <span className={`text-xs font-medium ${impactColor}`}>
                                ({priceImpact > 0 ? "-" : "+"}{Math.abs(priceImpact).toFixed(2)}%)
                              </span>
                            )}
                          </div>
                        </>
                      )}
                    </div>
                    <button
                      onClick={() => setTokenModalOpen("receive")}
                      className="flex items-center gap-2 px-3 py-2.5 rounded-xl bg-muted/40 hover:bg-muted/60 border border-border/30 transition-all hover:border-border/60 shrink-0"
                    >
                      <img src={receiveToken.logoUrl} alt={receiveToken.symbol} className="w-6 h-6 rounded-full" />
                      <span className="font-semibold text-foreground">{receiveToken.symbol}</span>
                      <ChevronDown className="h-4 w-4 text-muted-foreground" />
                    </button>
                  </div>
                  {quoteError && payAmountNum > 0 && (
                    <p className="text-xs text-red-400 mt-1.5">No liquidity found for this pair</p>
                  )}
                  {isEstimate && receiveAmountNum > 0 && (
                    <p className="text-xs text-yellow-400/70 mt-1.5">Estimated rate · Executed via Circle App Kit</p>
                  )}
                </div>

                {/* ── Action buttons ── */}
                <div className="mt-5 space-y-2">
                  {swapState === "error" && (
                    <p className="text-sm text-destructive text-center animate-fade-in">{errorMessage || "Swap failed"}</p>
                  )}

                  {!isConnected ? (
                    <Button
                      onClick={() => openWallet()}
                      className="w-full h-13 text-base font-semibold rounded-xl bg-gradient-to-r from-primary to-[hsl(275,80%,55%)] text-primary-foreground hover:opacity-90 transition-all duration-200 hover:shadow-lg hover:shadow-primary/20"
                    >
                      <Wallet className="h-5 w-5 mr-2" />
                      Connect Wallet
                    </Button>
                  ) : wrongChain ? (
                    <Button
                      onClick={() => switchChain({ chainId: selectedChainId })}
                      className="w-full h-13 text-base font-semibold rounded-xl bg-yellow-500/80 text-black hover:bg-yellow-500 transition-all"
                    >
                      Switch to {chainConfig.shortName}
                    </Button>
                  ) : needsApproval ? (
                    <Button
                      onClick={approve}
                      disabled={swapState === "approving"}
                      className="w-full h-13 text-base font-semibold rounded-xl bg-gradient-to-r from-primary to-[hsl(275,80%,55%)] text-primary-foreground hover:opacity-90 transition-all duration-200"
                    >
                      {swapState === "approving" ? (
                        <><Loader2 className="h-5 w-5 mr-2 animate-spin" /> Approving {payToken.symbol}…</>
                      ) : (
                        `Approve ${payToken.symbol}`
                      )}
                    </Button>
                  ) : (
                    <Button
                      onClick={handleSwap}
                      disabled={swapDisabled || swapState === "swapping"}
                      className="w-full h-13 text-base font-semibold rounded-xl bg-gradient-to-r from-primary to-[hsl(275,80%,55%)] text-primary-foreground hover:opacity-90 transition-all duration-200 hover:shadow-lg hover:shadow-primary/20 disabled:opacity-40 disabled:shadow-none"
                    >
                      {swapState === "swapping" ? (
                        <><Loader2 className="h-5 w-5 mr-2 animate-spin" /> Swapping…</>
                      ) : insufficientBalance ? (
                        `Insufficient ${payToken.symbol}`
                      ) : payAmountNum <= 0 ? (
                        "Enter Amount"
                      ) : !amountOut ? (
                        "Fetching Quote…"
                      ) : (
                        "Swap"
                      )}
                    </Button>
                  )}
                </div>

                <p className="text-center text-[11px] text-muted-foreground/60 mt-3">
                  {chainConfig.shortName} · Zero platform fees · {chainConfig.dexName}
                </p>

                {/* Collapsible details */}
                {receiveAmountNum > 0 && (
                  <div className="mt-3 border-t border-border/30 pt-3">
                    <button
                      onClick={() => setDetailsOpen(!detailsOpen)}
                      className="w-full flex items-center justify-between text-xs text-muted-foreground hover:text-foreground transition-colors"
                    >
                      <span className="flex items-center gap-1.5">
                        <Info className="h-3 w-3" />
                        1 {payToken.symbol} ≈{" "}
                        {priceRate
                          ? priceRate.toLocaleString(undefined, { maximumFractionDigits: 8, minimumSignificantDigits: 2 })
                          : "—"}{" "}
                        {receiveToken.symbol}
                      </span>
                      {detailsOpen ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
                    </button>
                    {detailsOpen && (
                      <div className="mt-2.5 space-y-2 text-xs text-muted-foreground animate-fade-in">
                        <div className="flex justify-between">
                          <span>Slippage Tolerance</span>
                          <span className="text-foreground">{slippage}%</span>
                        </div>
                        <div className="flex justify-between">
                          <span>Minimum Received</span>
                          <span className="text-foreground">
                            {parseFloat(minReceived).toLocaleString(undefined, { maximumFractionDigits: 6 })}{" "}
                            {receiveToken.symbol}
                          </span>
                        </div>
                        {priceImpact !== null && (
                          <div className="flex justify-between">
                            <span>Price Impact</span>
                            <span className={impactColor}>
                              {priceImpact > 0 ? "-" : "+"}{Math.abs(priceImpact).toFixed(2)}%
                            </span>
                          </div>
                        )}
                        {!isArc && (
                          <div className="flex justify-between">
                            <span>DEX Fee (Uniswap)</span>
                            <span className="text-foreground">{poolFee / 10000}%</span>
                          </div>
                        )}
                        <div className="flex justify-between">
                          <span>Route</span>
                          <span className="text-foreground font-mono text-[11px]">{routeDisplay}</span>
                        </div>
                        <div className="flex justify-between">
                          <span>Deadline</span>
                          <span className="text-foreground">20 minutes</span>
                        </div>
                        <div className="flex justify-between">
                          <span>Network</span>
                          <span className="text-foreground">{chainConfig.name}</span>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
              {/* ERC-8021 calldata debug panel (Base mainnet only) */}
              {!isArc && <CalldataDebugPanel data={lastCalldata} history={calldataHistory} />}
        </main>

        <Footer />
      </div>

      {/* Token search modal */}
      <TokenSearchModal
        open={tokenModalOpen !== null}
        onClose={() => setTokenModalOpen(null)}
        onSelect={handleTokenSelect}
        excludeSymbol={tokenModalOpen === "pay" ? receiveToken.symbol : payToken.symbol}
        chainId={selectedChainId}
      />

      {/* Success modal */}
      <SuccessModal
        open={showSuccess && swapState === "success" && !!txHash}
        txHash={txHash ?? ""}
        explorerUrl={chainConfig.explorer}
        explorerName={chainConfig.shortName === "Base" ? "BaseScan" : "ArcScan"}
        paySymbol={payToken.symbol}
        payAmount={payAmount}
        receiveSymbol={receiveToken.symbol}
        receiveAmount={receiveAmountNum > 0 ? parseFloat(receiveAmount).toFixed(4) : ""}
        onClose={() => { setShowSuccess(false); reset(); setPayAmount(""); }}
      />
    </>
  );
};

export default Swap;
