import { useState } from "react";
import { useSearchParams } from "react-router-dom";
import SEO from "@/components/SEO";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import ArcPaymentPanel from "@/components/ArcPaymentPanel";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { CATEGORIES, CATEGORY_EMOJIS, REGIONS, REGION_FLAGS } from "@/lib/partners";
import { CheckCircle2, ArrowRight, ArrowLeft, Upload, Eye } from "lucide-react";
import { useAppKitAccount } from "@reown/appkit/react";

const STEPS = [
  { title: "Business Info", description: "Tell us about your business" },
  { title: "Location & Wallet", description: "Connect your wallet to continue" },
  { title: "Preview", description: "Review your listing" },
  { title: "Choose Your Plan", description: "Standard or Featured listing" },
  { title: "Pay & List", description: "Pay securely on any chain" },
];

const PRESENCE_TYPES = ["Online Only", "Physical Locations", "Both"];

const Submit = () => {
  const { toast } = useToast();
  const [searchParams] = useSearchParams();
  const { address, isConnected } = useAppKitAccount();
  const [step, setStep] = useState(0);
  const [submitted, setSubmitted] = useState(searchParams.get("success") === "true");
  const [orderId, setOrderId] = useState(searchParams.get("order") || "");
  const [tier, setTier] = useState<"standard" | "featured">("standard");
  const [logoUrl, setLogoUrl] = useState<string | null>(null);
  const [uploadingLogo, setUploadingLogo] = useState(false);
  const [form, setForm] = useState({
    company_name: "",
    contact_email: "",
    website: "",
    description: "",
    categories: [] as string[],
    region: "",
    presence_type: "Online Only",
    city: "",
    country: "",
    logo_file: null as File | null,
  });

  const toggleCategory = (cat: string) =>
    setForm((f) => ({
      ...f,
      categories: f.categories.includes(cat)
        ? f.categories.filter((c) => c !== cat)
        : [...f.categories, cat],
    }));

  const validateStep = (): boolean => {
    if (step === 0) {
      if (!form.company_name || !form.description) {
        toast({ title: "Please fill in Business Name and Description", variant: "destructive" });
        return false;
      }
      if (form.categories.length === 0) {
        toast({ title: "Please select at least one category", variant: "destructive" });
        return false;
      }
    }
    return true;
  };

  const uploadLogo = async () => {
    if (!form.logo_file) return null;
    setUploadingLogo(true);
    try {
      const projectId = import.meta.env.VITE_SUPABASE_PROJECT_ID;
      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || `https://${projectId}.supabase.co`;
      const fd = new FormData();
      fd.append("file", form.logo_file);
      // Use connected wallet if available, otherwise use a generic identifier.
      // The wallet is only used for the storage filename — not for auth.
      fd.append("wallet_address", address || "");
      const res = await fetch(`${supabaseUrl}/functions/v1/upload-logo`, { method: "POST", body: fd });
      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.error || "Upload failed");
      }
      const data = await res.json();
      setLogoUrl(data.url);
      return data.url;
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Logo upload failed";
      toast({ title: "Logo upload failed", description: msg, variant: "destructive" });
      return null;
    } finally { setUploadingLogo(false); }
  };

  const nextStep = async () => {
    if (!validateStep()) return;
    // Step 1 (Location & Wallet): require wallet connect before proceeding.
    if (step === 1 && !isConnected) {
      toast({ title: "Please connect your wallet to continue", description: "A connected wallet is required to upload a logo and pay for your listing.", variant: "destructive" });
      return;
    }
    // Upload logo when moving from step 1 → 2 (wallet is now guaranteed connected).
    if (step === 1 && form.logo_file && !logoUrl) {
      await uploadLogo();
    }
    if (step < STEPS.length - 1) setStep(step + 1);
  };

  const prevStep = () => { if (step > 0) setStep(step - 1); };

  const handlePaymentSuccess = (txHash: string) => {
    setOrderId(txHash);
    setSubmitted(true);
  };

  const listingFee = tier === "featured" ? "28" : "3";

  const submissionData = {
    company_name: form.company_name,
    contact_email: form.contact_email,
    website: form.website,
    description: form.description,
    categories: form.categories,
    region: form.region,
    logo_url: logoUrl,
    tier,
  };

  if (submitted) {
    return (
      <div className="min-h-screen flex flex-col bg-background">
        <SEO title="Listed Successfully" description="Your business is now in USDC Directory." path="/submit" />
        <Header />
        <main className="flex-1 flex items-center justify-center px-6 py-20">
          <div className="max-w-md text-center">
            <div className="w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-6 bg-success/10">
              <CheckCircle2 className="h-10 w-10 text-success" />
            </div>
            <h1 className="text-2xl font-bold text-foreground mb-3">🎉 Listed Successfully!</h1>
            <p className="text-muted-foreground mb-4">
              Your payment was verified on-chain and your listing is now live in the global USDC Directory.
              {tier === "featured" && " Your listing is featured in the homepage carousel for 30 days."}
            </p>
            {orderId && (
              <p className="text-xs text-muted-foreground font-mono break-all mb-6">Tx: {orderId}</p>
            )}
            <a href="/" className="text-primary text-sm font-medium hover:underline">← Back to Directory</a>
          </div>
        </main>
        <Footer />
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <SEO
        title="List Your Business: 3 USDC, Any Chain"
        description="Self-list on USDC Directory for 3 USDC. Pay on Arc, Base, Ethereum, Arbitrum, Optimism, Polygon, BNB, Linea, Solana, Sui, or Near."
        path="/submit"
      />
      <Header />

      <section className="bg-gradient-to-b from-primary/5 to-background py-14 px-6">
        <div className="max-w-3xl mx-auto text-center">
          <h1 className="text-3xl md:text-4xl font-extrabold text-foreground mb-3">List Your Business</h1>
          <p className="text-muted-foreground text-base max-w-xl mx-auto">
            <span className="font-semibold text-foreground">3 USDC, any chain.</span> Pay on Arc, Base, Ethereum, Arbitrum, Optimism, Polygon, BNB, or Linea, plus Solana, Sui, and Near. Listings publish instantly after on-chain verification.
          </p>
        </div>
      </section>

      <main className="flex-1 max-w-xl mx-auto w-full px-6 py-10">
        <div className="flex items-center justify-between mb-8">
          {STEPS.map((s, i) => (
            <div key={i} className="flex items-center">
              <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold transition-colors ${
                i <= step ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"
              }`}>
                {i < step ? "✓" : i + 1}
              </div>
              {i < STEPS.length - 1 && (
                <div className={`h-0.5 w-6 sm:w-12 mx-1 transition-colors ${i < step ? "bg-primary" : "bg-border"}`} />
              )}
            </div>
          ))}
        </div>

        <div className="mb-6">
          <h2 className="text-lg font-bold text-foreground">{STEPS[step].title}</h2>
          <p className="text-sm text-muted-foreground">{STEPS[step].description}</p>
        </div>

        <div>
          {step === 0 && (
            <div className="space-y-4">
              <div>
                <label htmlFor="submit-company-name" className="block text-sm font-medium text-foreground mb-1.5">Business Name *</label>
                <Input id="submit-company-name" value={form.company_name} onChange={(e) => setForm({ ...form, company_name: e.target.value })} placeholder="Your company name" maxLength={100} />
              </div>
              <div>
                <label htmlFor="submit-contact-email" className="block text-sm font-medium text-foreground mb-1.5">Contact Email</label>
                <Input id="submit-contact-email" type="email" value={form.contact_email} onChange={(e) => setForm({ ...form, contact_email: e.target.value })} placeholder="you@company.com (optional)" maxLength={255} />
              </div>
              <div>
                <label htmlFor="submit-website" className="block text-sm font-medium text-foreground mb-1.5">Website</label>
                <Input
                  id="submit-website"
                  type="url"
                  value={form.website}
                  onChange={(e) => setForm({ ...form, website: e.target.value })}
                  onBlur={(e) => {
                    const v = e.target.value.trim();
                    if (v && !v.startsWith("http://") && !v.startsWith("https://")) {
                      setForm((f) => ({ ...f, website: "https://" + v }));
                    }
                  }}
                  placeholder="yourcompany.com or https://yourcompany.com (optional)"
                  maxLength={255}
                />
              </div>
              <div>
                <label htmlFor="submit-description" className="block text-sm font-medium text-foreground mb-1.5">Description *</label>
                <Textarea id="submit-description" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} placeholder="Briefly describe what your business does…" rows={3} maxLength={1000} />
              </div>
              <div>
                <label className="block text-sm font-medium text-foreground mb-1.5">Logo (PNG, JPG, SVG, WebP)</label>
                <div className="flex items-center gap-3">
                  <label className="flex items-center gap-2 px-4 py-2.5 rounded-xl border border-border bg-card cursor-pointer hover:bg-muted transition-colors text-sm text-muted-foreground">
                    <Upload className="h-4 w-4" />
                    {form.logo_file ? form.logo_file.name : "Upload logo"}
                    <input type="file" accept="image/png,image/jpeg,image/svg+xml,image/webp" className="hidden" onChange={(e) => {
                      const file = e.target.files?.[0];
                      const allowedTypes = ["image/png", "image/jpeg", "image/svg+xml", "image/webp"];
                      if (file && allowedTypes.includes(file.type)) {
                        setForm({ ...form, logo_file: file });
                        setLogoUrl(null);
                      } else {
                        toast({ title: "Please upload a PNG, JPG, SVG, or WebP image", variant: "destructive" });
                      }
                    }} />
                  </label>
                  {uploadingLogo && <span className="text-xs text-muted-foreground">Uploading…</span>}
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-foreground mb-2">Categories *</label>
                <div className="flex flex-wrap gap-2">
                  {CATEGORIES.map((cat) => (
                    <button key={cat} type="button" onClick={() => toggleCategory(cat)} className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-colors ${
                      form.categories.includes(cat) ? "bg-primary text-primary-foreground border-primary" : "border-border text-muted-foreground hover:border-primary/50"
                    }`}>
                      {CATEGORY_EMOJIS[cat] || "📦"} {cat}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}

          {step === 1 && (
            <div className="space-y-4">
              {/* Wallet connect gate — required before logo upload and payment */}
              <div className={`rounded-xl border p-4 flex items-center justify-between gap-4 ${isConnected ? "border-green-500/40 bg-green-500/5" : "border-yellow-500/40 bg-yellow-500/5"}`}>
                <div>
                  <p className={`text-sm font-semibold ${isConnected ? "text-green-600 dark:text-green-400" : "text-yellow-700 dark:text-yellow-400"}`}>
                    {isConnected ? `✅ Wallet connected` : "⚠️ Connect your wallet to continue"}
                  </p>
                  {isConnected && address && (
                    <p className="text-xs text-muted-foreground font-mono mt-0.5 truncate max-w-xs">{address}</p>
                  )}
                  {!isConnected && (
                    <p className="text-xs text-muted-foreground mt-0.5">Required to upload your logo and pay for your listing.</p>
                  )}
                </div>
                {!isConnected && (
                  <w3m-button size="sm" />
                )}
              </div>
              <div>
                <label className="block text-sm font-medium text-foreground mb-2">Business Presence</label>
                <div className="flex flex-wrap gap-2">
                  {PRESENCE_TYPES.map((pt) => (
                    <button key={pt} type="button" onClick={() => setForm({ ...form, presence_type: pt })} className={`px-4 py-2 rounded-xl border text-sm font-medium transition-colors ${
                      form.presence_type === pt ? "bg-primary/10 border-primary text-primary" : "border-border text-muted-foreground hover:border-primary/40"
                    }`}>{pt}</button>
                  ))}
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-foreground mb-2">Region *</label>
                <div className="flex flex-wrap gap-2">
                  {REGIONS.map((r) => (
                    <button key={r} type="button" onClick={() => setForm({ ...form, region: r })} className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-colors ${
                      form.region === r ? "bg-primary text-primary-foreground border-primary" : "border-border text-muted-foreground hover:border-primary/50"
                    }`}>{REGION_FLAGS[r] || "📍"} {r}</button>
                  ))}
                </div>
              </div>
              {form.presence_type !== "Online Only" && (
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label htmlFor="submit-country" className="block text-sm font-medium text-foreground mb-1.5">Country</label>
                    <Input id="submit-country" value={form.country} onChange={(e) => setForm({ ...form, country: e.target.value })} placeholder="e.g. United States" maxLength={100} />
                  </div>
                  <div>
                    <label htmlFor="submit-city" className="block text-sm font-medium text-foreground mb-1.5">City</label>
                    <Input id="submit-city" value={form.city} onChange={(e) => setForm({ ...form, city: e.target.value })} placeholder="e.g. New York" maxLength={100} />
                  </div>
                </div>
              )}
            </div>
          )}

          {step === 2 && (
            <div className="space-y-6">
              <div className="bg-card border border-border rounded-2xl p-6">
                <div className="flex items-center gap-4 mb-4">
                  <div className="w-16 h-16 rounded-xl bg-primary/10 flex items-center justify-center text-3xl">
                    {logoUrl ? <img src={logoUrl} alt="" className="w-14 h-14 rounded-lg object-cover" /> : "🏢"}
                  </div>
                  <div>
                    <h3 className="text-xl font-bold text-foreground">{form.company_name}</h3>
                    <a href={form.website} target="_blank" rel="noopener noreferrer" className="text-sm text-primary hover:underline">{form.website}</a>
                  </div>
                </div>
                <p className="text-muted-foreground text-sm mb-4">{form.description}</p>
                <div className="flex flex-wrap gap-2 mb-3">
                  {form.categories.map((cat) => (
                    <span key={cat} className="text-xs bg-primary/10 text-primary px-2.5 py-1 rounded-full font-medium">
                      {CATEGORY_EMOJIS[cat] || "📦"} {cat}
                    </span>
                  ))}
                </div>
                {form.region && (
                  <p className="text-xs text-muted-foreground">📍 {REGION_FLAGS[form.region] || "📍"} {form.region}</p>
                )}
              </div>
              <div className="bg-primary/5 border border-primary/20 rounded-xl p-4 text-center">
                <Eye className="h-5 w-5 text-primary mx-auto mb-2" />
                <p className="text-sm text-muted-foreground">This is how your listing will appear. Continue to pay 3 USDC.</p>
              </div>
            </div>
          )}

          {step === 3 && (
            <div className="space-y-4">
              <p className="text-sm text-muted-foreground">Choose how you want to list your business. You can upgrade to Featured at any time from My Listings.</p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {/* Standard */}
                <button
                  type="button"
                  onClick={() => setTier("standard")}
                  className={`rounded-2xl border-2 p-5 text-left transition-all ${tier === "standard" ? "border-primary bg-primary/5" : "border-border bg-card hover:border-primary/40"}`}
                >
                  <div className="flex items-center justify-between mb-3">
                    <span className="font-bold text-foreground text-base">Standard</span>
                    <span className="text-2xl font-extrabold text-foreground">3 <span className="text-sm font-medium text-muted-foreground">USDC</span></span>
                  </div>
                  <ul className="space-y-1.5 text-xs text-muted-foreground">
                    <li>✅ Appears in the directory immediately</li>
                    <li>✅ Searchable by category, region, network</li>
                    <li>✅ Discoverable to AI agents via API</li>
                    <li>✅ Any chain, any wallet</li>
                  </ul>
                  {tier === "standard" && <p className="mt-3 text-xs font-semibold text-primary">Selected</p>}
                </button>

                {/* Featured */}
                <button
                  type="button"
                  onClick={() => setTier("featured")}
                  className={`rounded-2xl border-2 p-5 text-left transition-all relative ${tier === "featured" ? "border-yellow-500 bg-yellow-500/5" : "border-border bg-card hover:border-yellow-500/40"}`}
                >
                  <div className="absolute -top-2.5 left-4">
                    <span className="bg-yellow-500 text-black text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider">Most Visible</span>
                  </div>
                  <div className="flex items-center justify-between mb-3">
                    <span className="font-bold text-foreground text-base">Featured</span>
                    <span className="text-2xl font-extrabold text-foreground">28 <span className="text-sm font-medium text-muted-foreground">USDC</span></span>
                  </div>
                  <ul className="space-y-1.5 text-xs text-muted-foreground">
                    <li>⭐ Everything in Standard</li>
                    <li>⭐ Homepage carousel placement</li>
                    <li>⭐ Featured badge on your card</li>
                    <li>⭐ 30 days guaranteed visibility</li>
                  </ul>
                  {tier === "featured" && <p className="mt-3 text-xs font-semibold text-yellow-600 dark:text-yellow-400">Selected</p>}
                </button>
              </div>
            </div>
          )}

          {step === 4 && (
            <div className="space-y-6">
              <div className={`rounded-xl border p-4 flex items-center justify-between ${tier === "featured" ? "border-yellow-500/40 bg-yellow-500/5" : "border-primary/20 bg-primary/5"}`}>
                <div>
                  <p className="text-sm font-semibold text-foreground">{tier === "featured" ? "⭐ Featured Listing" : "Standard Listing"}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">{tier === "featured" ? "Homepage carousel for 30 days" : "Directory listing, searchable immediately"}</p>
                </div>
                <span className="text-xl font-extrabold text-foreground">{listingFee} <span className="text-sm font-medium text-muted-foreground">USDC</span></span>
              </div>
              <div className="bg-card border border-border rounded-xl p-6">
                <ArcPaymentPanel type="listing" submissionData={submissionData} onSuccess={handlePaymentSuccess} />
              </div>
            </div>
          )}
        </div>

        <div className="flex items-center justify-between mt-8">
          <Button variant="outline" onClick={prevStep} disabled={step === 0}>
            <ArrowLeft className="h-4 w-4 mr-1" /> Back
          </Button>
          {step < STEPS.length - 1 && (
            <Button onClick={nextStep} disabled={uploadingLogo} className="bg-primary text-primary-foreground hover:bg-primary/90">
              {uploadingLogo ? "Uploading…" : "Next"} <ArrowRight className="h-4 w-4 ml-1" />
            </Button>
          )}
        </div>
      </main>

      <Footer />
    </div>
  );
};

export default Submit;
