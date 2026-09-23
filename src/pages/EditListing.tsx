import { useState, useEffect } from "react";
import { useParams, Link } from "react-router-dom";
import SEO from "@/components/SEO";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import ArcPaymentPanel from "@/components/ArcPaymentPanel";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { CATEGORIES, CATEGORY_EMOJIS, REGIONS, REGION_FLAGS } from "@/lib/partners";
import type { Partner } from "@/lib/partners";
import { CheckCircle2, ArrowLeft, Pencil, Wallet } from "lucide-react";

import { useAppKitAccount } from "@reown/appkit/react";
import { useAppKit } from "@reown/appkit/react";

const EditListing = () => {
  const { id } = useParams<{ id: string }>();
  const { toast } = useToast();
  const { address, isConnected } = useAppKitAccount();
  const { open } = useAppKit();
  const [partner, setPartner] = useState<Partner | null>(null);
  const [loading, setLoading] = useState(true);
  const [showPayment, setShowPayment] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [orderId, setOrderId] = useState("");

  const [form, setForm] = useState({
    description: "",
    website: "",
    categories: [] as string[],
    region: "Global",
  });

  const [notOwner, setNotOwner] = useState(false);

  useEffect(() => {
    if (!id) return;
    supabase
      .from("partners_public" as any)
      .select("id, name, description, website, logo_url, logo_emoji, categories, region, use_cases, featured, created_at, usdc_score, networks")
      .eq("id", id)
      .single()
      .then(({ data, error }) => {
        if (!error && data) {
          const p = data as unknown as Partner;
          setPartner(p);
          setForm({
            description: p.description,
            website: p.website || "",
            categories: p.categories || [],
            region: p.region || "Global",
          });
        }
        setLoading(false);
      });
  }, [id]);

  // Verify ownership when wallet connects
  useEffect(() => {
    if (!id || !isConnected || !address) {
      setNotOwner(false);
      return;
    }
    supabase
      .rpc("is_listing_owner", { _listing_id: id, _wallet_address: address.toLowerCase() })
      .then(({ data }) => {
        setNotOwner(data === false);
      });
  }, [id, isConnected, address]);

  const toggleCategory = (cat: string) =>
    setForm((f) => ({
      ...f,
      categories: f.categories.includes(cat)
        ? f.categories.filter((c) => c !== cat)
        : [...f.categories, cat],
    }));

  const validate = (): boolean => {
    if (!form.description || !form.website) {
      toast({ title: "Please fill in all required fields", variant: "destructive" });
      return false;
    }
    if (form.categories.length === 0) {
      toast({ title: "Please select at least one category", variant: "destructive" });
      return false;
    }
    return true;
  };

  const handlePaymentSuccess = (txHash: string) => {
    setOrderId(txHash);
    setShowPayment(false);
    setSubmitted(true);
  };

  const submissionData = {
    company_name: partner?.name || "",
    partner_id: id,
    website: form.website,
    description: form.description,
    categories: form.categories,
    region: form.region,
  };

  if (loading) {
    return (
      <div className="min-h-screen flex flex-col bg-background">
        <Header />
        <main className="flex-1 max-w-xl mx-auto w-full px-6 py-12">
          <Skeleton className="h-8 w-48 mb-6" />
          <Skeleton className="h-64 w-full rounded-2xl" />
        </main>
        <Footer />
      </div>
    );
  }

  if (notOwner) {
    return (
      <div className="min-h-screen flex flex-col bg-background">
        <Header />
        <main className="flex-1 flex items-center justify-center">
          <div className="text-center">
            <h1 className="text-2xl font-bold text-foreground mb-2">Unauthorized</h1>
            <p className="text-muted-foreground mb-4">You can only edit listings you created. Connect the wallet used to submit this listing.</p>
            <Link to="/"><Button variant="outline"><ArrowLeft className="h-4 w-4 mr-2" /> Back to Directory</Button></Link>
          </div>
        </main>
        <Footer />
      </div>
    );
  }

  if (!partner) {
    return (
      <div className="min-h-screen flex flex-col bg-background">
        <Header />
        <main className="flex-1 flex items-center justify-center">
          <div className="text-center">
            <h1 className="text-2xl font-bold text-foreground mb-2">Listing Not Found</h1>
            <p className="text-muted-foreground mb-4">This listing doesn't exist or has been removed.</p>
            <Link to="/"><Button variant="outline"><ArrowLeft className="h-4 w-4 mr-2" /> Back to Directory</Button></Link>
          </div>
        </main>
        <Footer />
      </div>
    );
  }

  if (submitted) {
    return (
      <div className="min-h-screen flex flex-col bg-background">
        <SEO title="Update Submitted" description="Your listing update has been submitted." path={`/edit/${id}`} />
        <Header />
        <main className="flex-1 flex items-center justify-center px-6 py-20">
          <div className="max-w-md text-center">
            <div className="w-20 h-20 rounded-full bg-success/10 flex items-center justify-center mx-auto mb-6">
              <CheckCircle2 className="h-10 w-10 text-success" />
            </div>
            <h1 className="text-2xl font-bold text-foreground mb-3">✅ Update Submitted!</h1>
            <p className="text-muted-foreground mb-4">
              Your update for <span className="font-semibold text-foreground">{partner.name}</span> will be applied once payment is confirmed (1-5 minutes).
            </p>
            {orderId && <p className="text-xs text-muted-foreground font-mono break-all mb-6">Order: {orderId}</p>}
            <Link to={`/merchant/${id}`} className="text-primary text-sm font-medium hover:underline">← Back to Listing</Link>
          </div>
        </main>
        <Footer />
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <SEO title={`Edit ${partner.name} (1 USDC)`} description={`Update your listing for ${partner.name} on USDC Directory.`} path={`/edit/${id}`} />
      <Header />

      <section className="bg-gradient-to-b from-primary/5 to-background py-14 px-6">
        <div className="max-w-3xl mx-auto text-center">
          <h1 className="text-3xl md:text-4xl font-extrabold text-foreground mb-3">
            <Pencil className="inline h-7 w-7 mr-2 -mt-1" /> Edit: {partner.name}
          </h1>
          <p className="text-muted-foreground text-base max-w-xl mx-auto">
            Update your listing details. <span className="font-semibold text-foreground">1 USDC</span> update fee applies.
          </p>
        </div>
      </section>

      <main className="flex-1 max-w-xl mx-auto w-full px-6 py-10">
        <div className="space-y-5">
          <div>
            <label htmlFor="edit-business-name" className="block text-sm font-medium text-foreground mb-1.5">Business Name</label>
            <Input id="edit-business-name" value={partner.name} disabled className="opacity-60" />
            <p className="text-xs text-muted-foreground mt-1">Name cannot be changed.</p>
          </div>
          <div>
            <label htmlFor="edit-website" className="block text-sm font-medium text-foreground mb-1.5">Website *</label>
            <Input id="edit-website" type="url" value={form.website} onChange={(e) => setForm({ ...form, website: e.target.value })} placeholder="https://yourcompany.com" maxLength={255} />
          </div>
          <div>
            <label htmlFor="edit-description" className="block text-sm font-medium text-foreground mb-1.5">Description *</label>
            <Textarea id="edit-description" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} placeholder="Describe what your business does…" rows={4} maxLength={1000} />
          </div>
          <div>
            <label className="block text-sm font-medium text-foreground mb-2">Categories *</label>
            <div className="flex flex-wrap gap-2">
              {CATEGORIES.map((cat) => (
                <button key={cat} type="button" onClick={() => toggleCategory(cat)} className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-colors ${
                  form.categories.includes(cat) ? "bg-primary text-primary-foreground border-primary" : "border-border text-muted-foreground hover:border-primary/50"
                }`}>{CATEGORY_EMOJIS[cat] || "📦"} {cat}</button>
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
        </div>

        <div className="mt-10 bg-primary/5 border border-primary/20 rounded-xl p-6">
          <ArcPaymentPanel
            type="update"
            submissionData={submissionData}
            onSuccess={handlePaymentSuccess}
          />
        </div>
      </main>

      <Footer />
    </div>
  );
};

export default EditListing;
