const Footer = () => {
  return (
    <footer className="bg-card/50 border-t border-border py-12 px-6">
      <div className="max-w-7xl mx-auto">
        <div className="flex flex-col md:flex-row items-start justify-between gap-12">
          {/* Brand */}
          <div className="max-w-xs">
            <div className="flex items-center gap-2 mb-3">
              <span className="font-bold text-xl tracking-tighter bg-gradient-to-r from-primary to-[hsl(275,80%,55%)] bg-clip-text text-transparent">USDC</span>
              <span className="font-semibold text-xl tracking-tight text-foreground">Directory</span>
            </div>
            <p className="text-xs text-muted-foreground leading-relaxed mb-4">
              The #1 everyday directory for USDC worldwide — merchants, B2B services, and AI agents accepting the world's leading digital dollar.
            </p>
            <div className="flex items-center gap-2">
              <a
                href="https://x.com/usdcdirectory"
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center justify-center w-8 h-8 rounded-lg border border-border bg-card hover:bg-muted transition-colors"
                aria-label="X (Twitter)"
              >
                <svg viewBox="0 0 24 24" aria-hidden="true" className="h-3.5 w-3.5 fill-current">
                  <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
                </svg>
              </a>
              <a
                href="https://warpcast.com/usdcdirectory"
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center justify-center w-8 h-8 rounded-lg border border-border bg-card hover:bg-muted transition-colors text-xs font-bold text-muted-foreground"
                aria-label="Farcaster / Warpcast"
              >
                ⬡
              </a>
            </div>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-8 text-sm flex-1">
            <div>
              <h4 className="font-semibold text-foreground mb-3 text-xs uppercase tracking-wider">Directory</h4>
              <ul className="space-y-2 text-muted-foreground text-xs">
                <li><a href="/" className="hover:text-foreground transition-colors">Browse All</a></li>
                <li><a href="/map" className="hover:text-foreground transition-colors">World Map</a></li>
                <li><a href="/leaderboard" className="hover:text-foreground transition-colors">Leaderboard</a></li>
                <li><a href="/insights" className="hover:text-foreground transition-colors">Insights</a></li>
              </ul>
            </div>
            <div>
              <h4 className="font-semibold text-foreground mb-3 text-xs uppercase tracking-wider">For Builders</h4>
              <ul className="space-y-2 text-muted-foreground text-xs">
                <li><a href="/submit" className="hover:text-foreground transition-colors">List Your Business</a></li>
                <li><a href="/submit/ai-agent" className="hover:text-foreground transition-colors">List AI Agent</a></li>
                <li><a href="/api-docs" className="hover:text-foreground transition-colors">API Docs</a></li>
                <li><a href="/swap" className="hover:text-foreground transition-colors">Swap USDC</a></li>
              </ul>
            </div>
            <div>
              <h4 className="font-semibold text-foreground mb-3 text-xs uppercase tracking-wider">Learn</h4>
              <ul className="space-y-2 text-muted-foreground text-xs">
                <li><a href="/about" className="hover:text-foreground transition-colors">About USDC</a></li>
                <li><a href="/ai-agents" className="hover:text-foreground transition-colors">AI Agents</a></li>
                <li>
                  <a href="https://www.circle.com/" target="_blank" rel="noopener noreferrer" className="hover:text-foreground transition-colors">
                    Circle.com ↗
                  </a>
                </li>
              </ul>
            </div>
            <div>
              <h4 className="font-semibold text-foreground mb-3 text-xs uppercase tracking-wider">Contact</h4>
              <ul className="space-y-2 text-muted-foreground text-xs">
                <li>
                  <a href="mailto:hello@usdc.directory" className="hover:text-foreground transition-colors">
                    hello@usdc.directory
                  </a>
                </li>
                <li>
                  <a href="https://x.com/usdcdirectory" target="_blank" rel="noopener noreferrer" className="hover:text-foreground transition-colors">
                    @usdcdirectory
                  </a>
                </li>
              </ul>
            </div>
          </div>
        </div>

        <div className="mt-10 pt-6 border-t border-border flex flex-col sm:flex-row items-center justify-between gap-3">
          <p className="text-xs text-muted-foreground">© 2026 USDC Directory. All rights reserved.</p>
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
            <span>All systems operational</span>
          </div>
        </div>
      </div>
    </footer>
  );
};

export default Footer;
