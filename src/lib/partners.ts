import { supabase } from "@/integrations/supabase/client";

export interface Partner {
  id: string;
  name: string;
  description: string;
  website: string | null;
  logo_url: string | null;
  logo_emoji: string;
  categories: string[];
  region: string;
  use_cases: string[];
  featured: boolean;
  created_at: string;
  usdc_score?: number;
  networks?: string[];
  boosted_until?: string | null;
  verified?: boolean;
}

export interface FetchResult<T> {
  data: T;
  error: string | null;
}

const PARTNER_COLS = "id, name, description, website, logo_url, logo_emoji, categories, region, use_cases, featured, created_at, usdc_score, networks, boosted_until, verified";

export async function fetchPartners(): Promise<FetchResult<Partner[]>> {
  const { data, error } = await supabase
    .from("partners_public" as any)
    .select(PARTNER_COLS)
    .order("created_at", { ascending: false })
    .range(0, 2999);

  if (error) {
    console.error("[usdc.directory] fetchPartners error:", error);
    return { data: [], error: error.message };
  }
  return { data: (data as unknown as Partner[]) || [], error: null };
}

export async function fetchFeaturedPartners(): Promise<FetchResult<Partner[]>> {
  const { data, error } = await supabase
    .from("partners_public" as any)
    .select(PARTNER_COLS)
    .eq("featured", true)
    .order("created_at", { ascending: false })
    .range(0, 2999);

  if (error) {
    console.error("[usdc.directory] fetchFeaturedPartners error:", error);
    return { data: [], error: error.message };
  }
  return { data: (data as unknown as Partner[]) || [], error: null };
}

// Updated category list per usdc.directory spec
export const CATEGORIES = [
  "AI & Agentic Platforms",
  "Bridge Apps",
  "Bridge SDKs",
  "DeFi Apps",
  "Digital Wallets",
  "Due Diligence & Advisory",
  "Exchange",
  "Financial Services",
  "Gaming",
  "Infrastructure & DevTools",
  "Lending & Credit",
  "Merchant / Retail",
  "On / Off Ramp",
  "Payments",
  "Payroll & Accounting",
  "Real Estate",
  "Remittances",
  "Staking & Yield",
  "Stablecoin Protocol",
  "Travel",
];

export const REGIONS = [
  "Global",
  "North America",
  "South America",
  "Europe",
  "Africa",
  "Asia",
  "Other",
];

export const NETWORKS = [
  "Arc",
  "Base",
  "Ethereum",
  "Arbitrum",
  "Optimism",
  "Polygon",
  "Avalanche",
  "BNB Chain",
  "Linea",
  "Solana",
  "Sui",
  "Near",
];

export const CATEGORY_EMOJIS: Record<string, string> = {
  "AI & Agentic Platforms": "🤖",
  "Bridge Apps": "🌉",
  "Bridge SDKs": "🔧",
  "DeFi Apps": "📈",
  "Digital Wallets": "👛",
  "Due Diligence & Advisory": "🔍",
  "Exchange": "🔄",
  "Financial Services": "🏦",
  "Gaming": "🎮",
  "Infrastructure & DevTools": "⚙️",
  "Lending & Credit": "💳",
  "Merchant / Retail": "🛍️",
  "On / Off Ramp": "🚀",
  "Payments": "💸",
  "Payroll & Accounting": "📊",
  "Real Estate": "🏠",
  "Remittances": "💱",
  "Staking & Yield": "🌱",
  "Stablecoin Protocol": "🪙",
  "Travel": "✈️",
};
