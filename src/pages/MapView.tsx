import { useState, useEffect, useMemo } from "react";
import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import { MapPin, ExternalLink, BadgeCheck, ArrowLeft } from "lucide-react";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import SEO from "@/components/SEO";
import { Button } from "@/components/ui/button";
import { fetchPartners, type Partner } from "@/lib/partners";

// Region → approximate lat/lng for visual map placement
// Keys match REGIONS in lib/partners.ts exactly
const regionCoords: Record<string, { lat: number; lng: number }> = {
  Global: { lat: 20, lng: 0 },
  "North America": { lat: 40, lng: -100 },
  "South America": { lat: -15, lng: -60 },
  Europe: { lat: 50, lng: 10 },
  Africa: { lat: 5, lng: 20 },
  Asia: { lat: 25, lng: 105 },
  Other: { lat: -30, lng: 140 },
};

const regionFlags: Record<string, string> = {
  Global: "🌍",
  "North America": "🇺🇸",
  "South America": "🌎",
  Europe: "🇪🇺",
  Africa: "🌍",
  Asia: "🌏",
  Other: "📍",
};

const MapView = () => {
  const [partners, setPartners] = useState<Partner[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedRegion, setSelectedRegion] = useState<string | null>(null);

  useEffect(() => {
    fetchPartners().then((data) => {
      setPartners(data);
      setLoading(false);
    });
  }, []);

  const regionGroups = useMemo(() => {
    const groups: Record<string, Partner[]> = {};
    partners.forEach((p) => {
      const region = p.region || "Global";
      if (!groups[region]) groups[region] = [];
      groups[region].push(p);
    });
    return groups;
  }, [partners]);

  const selectedPartners = selectedRegion ? regionGroups[selectedRegion] || [] : [];

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <SEO
        title="World Map: USDC Merchants Worldwide"
        description="Explore USDC-accepting merchants across every region on our interactive world map."
        path="/map"
      />
      <Header />

      <section className="bg-gradient-to-b from-primary/5 to-background py-10 px-6">
        <div className="max-w-7xl mx-auto">
          <Link to="/" className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground mb-4 transition-colors">
            <ArrowLeft className="h-4 w-4" /> Back to Directory
          </Link>
          <h1 className="text-3xl md:text-4xl font-extrabold text-foreground mb-2">
            USDC Merchants Worldwide
          </h1>
          <p className="text-muted-foreground max-w-xl">
            {loading ? "Loading merchants…" : `${partners.length} merchants across ${Object.keys(regionGroups).length} regions. Click a region to explore.`}
          </p>
        </div>
      </section>

      <main className="flex-1 max-w-7xl mx-auto w-full px-4 sm:px-6 py-8">
        {/* Interactive Map Area */}
        <div className="relative bg-card border border-border rounded-2xl overflow-hidden mb-8" style={{ minHeight: 480 }}>
          {/* World map background */}
          <div className="absolute inset-0 opacity-10 dark:opacity-5">
            <img src="/assets/world-map-dots.png" alt="" className="w-full h-full object-cover" onError={(e) => { e.currentTarget.style.display = 'none'; }} />
          </div>

          {/* SVG simplified world map with clickable regions */}
          <svg viewBox="0 0 1000 500" className="w-full h-full relative z-10" style={{ minHeight: 480 }}>
            {/* Grid lines */}
            {[100, 200, 300, 400].map((y) => (
              <line key={`h${y}`} x1="0" y1={y} x2="1000" y2={y} stroke="currentColor" strokeOpacity="0.05" />
            ))}
            {[200, 400, 600, 800].map((x) => (
              <line key={`v${x}`} x1={x} y1="0" x2={x} y2="500" stroke="currentColor" strokeOpacity="0.05" />
            ))}

            {/* Region pins */}
            {Object.entries(regionCoords).map(([region, coords]) => {
              const count = regionGroups[region]?.length || 0;
              if (count === 0) return null;
              // Map lat/lng to SVG coords
              const x = ((coords.lng + 180) / 360) * 1000;
              const y = ((90 - coords.lat) / 180) * 500;
              const isSelected = selectedRegion === region;
              const radius = Math.min(12 + count * 0.8, 30);

              return (
                <g
                  key={region}
                  role="button"
                  tabIndex={0}
                  aria-label={`${region}: ${count} merchants. ${isSelected ? "Selected" : "Click to filter"}`}
                  onClick={() => setSelectedRegion(isSelected ? null : region)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      setSelectedRegion(isSelected ? null : region);
                    }
                  }}
                  className="cursor-pointer focus:outline-none focus-visible:[&>circle:nth-of-type(2)]:stroke-primary focus-visible:[&>circle:nth-of-type(2)]:stroke-2"
                >
                  {/* Pulse ring */}
                  <circle cx={x} cy={y} r={radius + 8} fill="hsl(var(--primary))" opacity={isSelected ? 0.15 : 0.08}>
                    <animate attributeName="r" values={`${radius + 4};${radius + 12};${radius + 4}`} dur="3s" repeatCount="indefinite" />
                    <animate attributeName="opacity" values="0.08;0.15;0.08" dur="3s" repeatCount="indefinite" />
                  </circle>
                  {/* Main circle */}
                  <circle
                    cx={x} cy={y} r={radius}
                    fill={isSelected ? "hsl(var(--primary))" : "hsl(var(--primary))"}
                    opacity={isSelected ? 1 : 0.7}
                    className="transition-all duration-300 hover:opacity-100"
                  />
                  {/* Count label */}
                  <text x={x} y={y + 1} textAnchor="middle" dominantBaseline="middle" fill="white" fontSize="11" fontWeight="bold">
                    {count}
                  </text>
                  {/* Region label */}
                  <text x={x} y={y + radius + 16} textAnchor="middle" fill="currentColor" fontSize="10" opacity={0.6} fontWeight="500">
                    {region}
                  </text>
                </g>
              );
            })}
          </svg>
        </div>

        {/* Region stats bar */}
        <div className="flex flex-wrap gap-2 mb-6">
          {Object.entries(regionGroups).map(([region, members]) => (
            <button
              key={region}
              onClick={() => setSelectedRegion(selectedRegion === region ? null : region)}
              className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-all ${
                selectedRegion === region
                  ? "bg-primary text-primary-foreground border-primary"
                  : "bg-card border-border text-muted-foreground hover:border-primary/40"
              }`}
            >
              {regionFlags[region] || "🌍"} {region} ({members.length})
            </button>
          ))}
        </div>

        {/* Selected region merchants */}
        {selectedRegion && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
          >
            <h2 className="text-lg font-bold text-foreground mb-4">
              {regionFlags[selectedRegion]} {selectedRegion}: {selectedPartners.length} Merchants
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {selectedPartners.map((p) => (
                <Link
                  key={p.id}
                  to={`/merchant/${p.id}`}
                  className="bg-card border border-border rounded-xl p-4 hover:border-primary/40 hover:shadow-md transition-all group"
                >
                  <div className="flex items-center gap-3">
                    <span className="text-2xl">{p.logo_emoji || "🏢"}</span>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5">
                        <h3 className="font-semibold text-sm text-foreground truncate">{p.name}</h3>
                        {p.featured && <BadgeCheck className="h-3.5 w-3.5 text-primary flex-shrink-0" />}
                      </div>
                      <p className="text-xs text-muted-foreground truncate">{p.description}</p>
                    </div>
                    <ExternalLink className="h-4 w-4 text-muted-foreground group-hover:text-primary transition-colors flex-shrink-0" />
                  </div>
                </Link>
              ))}
            </div>
          </motion.div>
        )}

        {!selectedRegion && !loading && (
          <div className="text-center py-12">
            <MapPin className="h-10 w-10 text-muted-foreground mx-auto mb-3" />
            <p className="text-foreground font-semibold mb-1">Click a region on the map</p>
            <p className="text-sm text-muted-foreground">Explore USDC merchants in each region of the world</p>
          </div>
        )}
      </main>

      <Footer />
    </div>
  );
};

export default MapView;
