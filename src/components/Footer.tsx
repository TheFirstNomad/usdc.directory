const XIcon = () => (
  <svg viewBox="0 0 24 24" aria-hidden="true" fill="currentColor" className="h-3.5 w-3.5">
    <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
  </svg>
);

const ExternalArrow = () => (
  <svg viewBox="0 0 12 12" fill="none" className="h-2.5 w-2.5 opacity-50 inline-block" aria-hidden="true">
    <path d="M2 10L10 2M10 2H4M10 2v6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

const Footer = () => (
  <footer className="border-t border-border/60 bg-background py-14 px-6">
    <div className="max-w-7xl mx-auto">

      <div className="flex flex-col lg:flex-row items-start justify-between gap-12">

        {/* Brand */}
        <div className="max-w-[220px] flex-shrink-0">
          <div className="flex items-baseline gap-1 mb-3">
            <span className="font-extrabold text-xl tracking-tight bg-gradient-to-r from-primary to-[hsl(275,80%,55%)] bg-clip-text text-transparent">
              USDC
            </span>
            <span className="font-semibold text-xl tracking-tight text-foreground">Directory</span>
          </div>
          <p className="text-xs text-muted-foreground leading-relaxed mb-5">
            The global directory for merchants, B2B services, and AI agents accepting USDC.
          </p>
          <a
            href="https://x.com/usdcdirectory"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg border border-border bg-card hover:bg-muted transition-colors text-xs text-muted-foreground hover:text-foreground"
            aria-label="Follow @usdcdirectory on X"
          >
            <XIcon />
            <span>@usdcdirectory</span>
          </a>
        </div>

        {/* Link columns */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-8 flex-1">

          <div>
            <h4 className="font-semibold text-foreground mb-4 text-[11px] uppercase tracking-widest">Directory</h4>
            <ul className="space-y-2.5 text-xs text-muted-foreground">
              <li><a href="/" className="hover:text-foreground transition-colors">Browse All</a></li>
              <li><a href="/map" className="hover:text-foreground transition-colors">World Map</a></li>
              <li><a href="/insights" className="hover:text-foreground transition-colors">Insights</a></li>
              <li><a href="/my-listings" className="hover:text-foreground transition-colors">My Listings</a></li>
            </ul>
          </div>

          <div>
            <h4 className="font-semibold text-foreground mb-4 text-[11px] uppercase tracking-widest">Get Listed</h4>
            <ul className="space-y-2.5 text-xs text-muted-foreground">
              <li><a href="/submit" className="hover:text-foreground transition-colors">List Your Business</a></li>
              <li><a href="/submit/ai-agent" className="hover:text-foreground transition-colors">List AI Agent</a></li>
              <li><a href="/api-docs" className="hover:text-foreground transition-colors">API Docs</a></li>
              <li><a href="/swap" className="hover:text-foreground transition-colors">Swap USDC</a></li>
            </ul>
          </div>

          <div>
            <h4 className="font-semibold text-foreground mb-4 text-[11px] uppercase tracking-widest">Learn</h4>
            <ul className="space-y-2.5 text-xs text-muted-foreground">
              <li><a href="/about" className="hover:text-foreground transition-colors">About USDC</a></li>
              <li><a href="/ai-agents" className="hover:text-foreground transition-colors">AI Agents</a></li>
              <li>
                <a href="https://developers.circle.com" target="_blank" rel="noopener noreferrer"
                  className="hover:text-foreground transition-colors inline-flex items-center gap-1">
                  Circle Docs <ExternalArrow />
                </a>
              </li>
              <li>
                <a href="https://www.circle.com/" target="_blank" rel="noopener noreferrer"
                  className="hover:text-foreground transition-colors inline-flex items-center gap-1">
                  Circle.com <ExternalArrow />
                </a>
              </li>
            </ul>
          </div>

          <div>
            <h4 className="font-semibold text-foreground mb-4 text-[11px] uppercase tracking-widest">Contact</h4>
            <ul className="space-y-2.5 text-xs text-muted-foreground">
              <li>
                <a href="mailto:hello@usdc.directory" className="hover:text-foreground transition-colors">
                  hello@usdc.directory
                </a>
              </li>
              <li>
                <a href="https://x.com/usdcdirectory" target="_blank" rel="noopener noreferrer"
                  className="hover:text-foreground transition-colors">
                  DM us on X
                </a>
              </li>
              <li>
                <a href="/submit" className="hover:text-foreground transition-colors">
                  Submit a Listing
                </a>
              </li>
            </ul>
          </div>

        </div>
      </div>

      {/* Bottom bar */}
      <div className="mt-12 pt-6 border-t border-border/60 flex flex-col sm:flex-row items-center justify-between gap-3">
        <p className="text-xs text-muted-foreground">
          © {new Date().getFullYear()} USDC Directory. All rights reserved.
        </p>
        <div className="flex items-center gap-4 text-xs text-muted-foreground">
          <div className="flex items-center gap-1.5">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse flex-shrink-0" />
            <span>All systems operational</span>
          </div>
          <span className="text-border select-none">|</span>
          <a href="https://www.circle.com/legal/privacy-policy" target="_blank" rel="noopener noreferrer"
            className="hover:text-foreground transition-colors">Privacy</a>
          <a href="https://www.circle.com/legal/terms-of-service" target="_blank" rel="noopener noreferrer"
            className="hover:text-foreground transition-colors">Terms</a>
        </div>
      </div>

    </div>
  </footer>
);

export default Footer;
