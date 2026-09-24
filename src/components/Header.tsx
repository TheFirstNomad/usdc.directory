import { Menu, X, Wallet, Sun, Moon, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useState, useMemo, useEffect } from "react";
import { Link, useLocation } from "react-router-dom";
import { useAppKit, useAppKitAccount } from "@reown/appkit/react";
import { useTheme } from "@/components/ThemeProvider";
import { TREASURY_ADDRESS } from "@/lib/web3";
import { useChainContext } from "@/contexts/ChainContext";
import ChainDropdown from "@/components/ChainDropdown";
import CommandPalette from "@/components/CommandPalette";
import type { Partner } from "@/lib/partners";

interface HeaderProps {
  partners?: Partner[];
}

const baseNavLinks = [
  { label: "Directory", href: "/" },
  { label: "Swap", href: "/swap" },
  { label: "AI Agents", href: "/ai-agents" },
  { label: "Map", href: "/map" },
];

const Header = ({ partners = [] }: HeaderProps) => {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [cmdOpen, setCmdOpen] = useState(false);
  const location = useLocation();
  const { open } = useAppKit();
  const { address, isConnected } = useAppKitAccount();
  const { theme, toggleTheme } = useTheme();
  const { chainId, setChainId } = useChainContext();

  const isOwner = address?.toLowerCase() === TREASURY_ADDRESS.toLowerCase();
  const navLinks = useMemo(
    () =>
      isOwner
        ? [...baseNavLinks, { label: "Admin", href: "/admin/listings" }]
        : baseNavLinks,
    [isOwner]
  );

  const truncatedAddress = address
    ? `${address.slice(0, 6)}…${address.slice(-4)}`
    : "";

  const handleAuth = () => {
    open(isConnected ? { view: "Account" } : undefined);
  };

  // ⌘K / Ctrl+K global shortcut
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        setCmdOpen((v) => !v);
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);



  return (
    <>
      <header className="sticky top-0 z-50 backdrop-blur-xl bg-background/80 border-b border-border/40">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 flex items-center justify-between h-16">
        <Link to="/" className="flex items-center gap-2.5">
          <div className="flex items-baseline gap-1">
            <span className="font-extrabold text-xl tracking-tight bg-gradient-to-r from-primary to-[hsl(275,80%,55%)] bg-clip-text text-transparent">
              USDC
            </span>
            <span className="font-semibold text-lg tracking-tight text-foreground">
              Directory
            </span>
          </div>
        </Link>

        <nav className="hidden md:flex items-center gap-1">
          {navLinks.map((link) => (
            <Link
              key={link.href}
              to={link.href}
              className={`px-3 py-2 text-sm font-medium rounded-lg transition-colors ${
                location.pathname === link.href
                  ? "text-primary bg-primary/10"
                  : "text-muted-foreground hover:text-foreground hover:bg-muted"
              }`}
            >
              {link.label}
            </Link>
          ))}
        </nav>

        <div className="hidden md:flex items-center gap-2">
          {/* ⌘K search trigger */}
          <button
            onClick={() => setCmdOpen(true)}
            className="flex items-center gap-2 px-3 py-1.5 text-xs text-muted-foreground rounded-lg border border-border bg-card hover:bg-muted transition-colors"
            aria-label="Open search"
          >
            <Search className="h-3.5 w-3.5" />
            <span>Search</span>
            <kbd className="ml-1 font-mono text-[10px] bg-muted px-1.5 py-0.5 rounded hidden xl:inline">⌘K</kbd>
          </button>

          <ChainDropdown chainId={chainId} onChange={setChainId} />

          <button
            onClick={toggleTheme}
            className="p-2 rounded-xl border border-border bg-card hover:bg-muted transition-colors text-foreground"
            aria-label="Toggle theme"
          >
            {theme === "dark" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
          </button>

          <button
            onClick={handleAuth}
            className="flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-xl border border-border bg-card hover:bg-muted transition-colors"
          >
            <Wallet className="h-4 w-4" />
            <span>{isConnected ? truncatedAddress : "Connect"}</span>
          </button>

          <Link to="/submit">
            <Button
              size="sm"
              className="bg-gradient-to-r from-primary to-[hsl(275,80%,55%)] text-primary-foreground font-semibold shadow-lg hover:shadow-xl hover:scale-105 transition-all px-5 py-2.5 rounded-xl"
            >
              List Your Business
            </Button>
          </Link>
        </div>

        <div className="flex md:hidden items-center gap-1">
          <button
            className="p-2 text-foreground"
            onClick={() => setMobileOpen(!mobileOpen)}
            aria-label="Toggle menu"
          >
            {mobileOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
        </div>
      </div>

      {mobileOpen && (
        <div className="md:hidden border-t border-border/40 bg-background/95 backdrop-blur-xl px-4 py-4 space-y-1">
          {navLinks.map((link) => (
            <Link
              key={link.href}
              to={link.href}
              onClick={() => setMobileOpen(false)}
              className={`block px-3 py-2.5 text-sm font-medium rounded-lg ${
                location.pathname === link.href
                  ? "text-primary bg-primary/10"
                  : "text-muted-foreground"
              }`}
            >
              {link.label}
            </Link>
          ))}
          <div className="pt-3 space-y-2">
            <ChainDropdown chainId={chainId} onChange={setChainId} />
            <button
              onClick={toggleTheme}
              className="w-full flex items-center justify-center gap-2 px-4 py-2.5 text-sm font-medium rounded-xl border border-border bg-card"
            >
              {theme === "dark" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
              {theme === "dark" ? "Light Mode" : "Dark Mode"}
            </button>
            <button
              onClick={() => {
                handleAuth();
                setMobileOpen(false);
              }}
              className="w-full flex items-center justify-center gap-2 px-4 py-2.5 text-sm font-medium rounded-xl border border-border bg-card"
            >
              <Wallet className="h-4 w-4" />
              {isConnected ? truncatedAddress : "Connect"}
            </button>
            <Link to="/submit" onClick={() => setMobileOpen(false)} className="block">
              <Button size="sm" className="w-full bg-gradient-to-r from-primary to-[hsl(275,80%,55%)] text-primary-foreground font-semibold rounded-xl">
                List Your Business
              </Button>
            </Link>
          </div>
        </div>
      )}
      </header>
      <CommandPalette open={cmdOpen} onClose={() => setCmdOpen(false)} partners={partners} />
    </>
  );
};

export default Header;
