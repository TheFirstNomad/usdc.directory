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

const PARTNER_COLS = "id, name, description, website, logo_url, logo_emoji, categories, region, use_cases, featured, created_at, usdc_score, networks, boosted_until, verified";

export async function fetchPartners(): Promise<Partner[]> {
  const { data, error } = await supabase
    .from("partners_public" as any)
    .select(PARTNER_COLS)
    .order("created_at", { ascending: false })
    .range(0, 2999);

  if (error) {
    console.error("Error fetching partners:", error);
    return [];
  }
  return (data as unknown as Partner[]) || [];
}

export async function fetchFeaturedPartners(): Promise<Partner[]> {
  const { data, error } = await supabase
    .from("partners_public" as any)
    .select(PARTNER_COLS)
    .eq("featured", true)
    .order("created_at", { ascending: false })
    .range(0, 2999);

  if (error) {
    console.error("Error fetching featured partners:", error);
    return [];
  }
  return (data as unknown as Partner[]) || [];
}


// Updated category list per usdc.directory spec
export const CATEGORIES = [
  "AI & Agentic Platforms",
  "Bridge Apps",
  "Bridge SDKs",
  "DeFi Apps",
  "Digital Wallets",
  "Due Diligence & Advisory",
  "Ecommerce",
  "Exchanges",
  "Fintechs",
  "Gaming",
  "Infrastructure Providers",
  "Market Makers",
  "Marketplaces",
  "Neobanks",
  "OTC Desks",
  "Payments",
  "PR & Communications",
  "Remittances",
  "Security",
];

export const CATEGORY_EMOJIS: Record<string, string> = {
  "AI & Agentic Platforms": "🤖",
  "Bridge Apps": "🌉",
  "Bridge SDKs": "🔗",
  "DeFi Apps": "🏦",
  "Digital Wallets": "👛",
  "Due Diligence & Advisory": "🔍",
  "Ecommerce": "🛒",
  "Exchanges": "💱",
  "Fintechs": "💳",
  "Gaming": "🎮",
  "Infrastructure Providers": "⚙️",
  "Market Makers": "📊",
  "Marketplaces": "🏪",
  "Neobanks": "🏛️",
  "OTC Desks": "💼",
  "Payments": "💸",
  "PR & Communications": "📢",
  "Remittances": "💵",
  "Security": "🔒",
};

export const REGIONS = [
  "Global",
  "Africa",
  "Europe",
  "Asia",
  "North America",
  "South America",
  "Other",
];

export const REGION_FLAGS: Record<string, string> = {
  Global: "🌍",
  Africa: "🌍",
  Europe: "🇪🇺",
  Asia: "🌏",
  "North America": "🇺🇸",
  "South America": "🌎",
  Other: "📍",
};
