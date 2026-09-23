import { useEffect, useState, useMemo } from "react";
import { motion } from "framer-motion";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import SEO from "@/components/SEO";

import { fetchPartners, type Partner, CATEGORIES, REGIONS } from "@/lib/partners";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from "recharts";
import { TrendingUp, Globe, Users, DollarSign } from "lucide-react";

const COLORS = [
  "hsl(210, 79%, 46%)", "hsl(275, 100%, 25%)", "hsl(162, 100%, 41%)",
  "hsl(45, 93%, 47%)", "hsl(0, 84%, 60%)", "hsl(200, 80%, 50%)",
  "hsl(280, 60%, 50%)", "hsl(120, 60%, 40%)", "hsl(30, 80%, 55%)",
];

const circleStats = [
  { icon: DollarSign, value: "$78B+", label: "USDC in Circulation", color: "text-primary" },
  { icon: TrendingUp, value: "$69T+", label: "All-Time On-Chain Volume", color: "text-[hsl(var(--success))]" },
  { icon: Globe, value: "30+", label: "Supported Blockchains", color: "text-primary" },
  { icon: Users, value: "300+", label: "Circle Alliance Partners", color: "text-[hsl(275,100%,40%)]" },
];

const Insights = () => {
  const [partners, setPartners] = useState<Partner[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchPartners().then((data) => {
      setPartners(data);
      setLoading(false);
    });
  }, []);

  const categoryData = useMemo(() => {
    const counts: Record<string, number> = {};
    partners.forEach((p) => p.categories.forEach((c) => { counts[c] = (counts[c] || 0) + 1; }));
    return CATEGORIES.map((c) => ({ name: c, count: counts[c] || 0 })).filter((d) => d.count > 0).sort((a, b) => b.count - a.count);
  }, [partners]);

  const regionData = useMemo(() => {
    const counts: Record<string, number> = {};
    partners.forEach((p) => { counts[p.region] = (counts[p.region] || 0) + 1; });
    return REGIONS.map((r) => ({ name: r, value: counts[r] || 0 })).filter((d) => d.value > 0);
  }, [partners]);

  const featuredCount = useMemo(() => partners.filter((p) => p.featured).length, [partners]);

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <SEO
        title="USDC Ecosystem Insights"
        description="Explore the USDC ecosystem: merchant distribution, category breakdown, regional coverage, and Circle Alliance statistics."
        path="/insights"
      />
      
      <Header />

      <section className="relative overflow-hidden py-16 px-6">
        <div className="absolute inset-0 bg-gradient-to-br from-primary/[0.06] via-background to-[hsl(275,100%,25%)]/[0.03]" />
        <div className="relative z-10 max-w-4xl mx-auto text-center">
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
            <h1 className="text-3xl sm:text-4xl md:text-5xl font-extrabold text-foreground mb-4 tracking-tight">
              USDC Ecosystem{" "}
              <span className="bg-gradient-to-r from-primary to-[hsl(275,100%,25%)] bg-clip-text text-transparent">
                Insights
              </span>
            </h1>
            <p className="text-muted-foreground text-lg max-w-xl mx-auto">
              Real-time analytics on USDC merchant adoption and Circle's growing ecosystem.
            </p>
          </motion.div>
        </div>
      </section>

      <main className="flex-1 max-w-5xl mx-auto w-full px-6 py-8">
        {/* Circle global stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-12">
          {circleStats.map((s) => (
            <div key={s.label} className="bg-card border border-border rounded-xl p-5 text-center">
              <s.icon className={`h-5 w-5 mx-auto mb-2 ${s.color}`} />
              <div className="text-2xl font-extrabold text-foreground">{s.value}</div>
              <div className="text-xs text-muted-foreground mt-1">{s.label}</div>
            </div>
          ))}
        </div>

        {/* Directory stats */}
        <div className="grid grid-cols-3 gap-4 mb-12">
          <div className="bg-card border border-border rounded-xl p-5 text-center">
            <div className="text-3xl font-extrabold text-primary">{partners.length}</div>
            <div className="text-sm text-muted-foreground">Total Merchants</div>
          </div>
          <div className="bg-card border border-border rounded-xl p-5 text-center">
            <div className="text-3xl font-extrabold text-[hsl(275,100%,40%)]">{featuredCount}</div>
            <div className="text-sm text-muted-foreground">Featured Partners</div>
          </div>
          <div className="bg-card border border-border rounded-xl p-5 text-center">
            <div className="text-3xl font-extrabold text-[hsl(var(--success))]">{categoryData.length}</div>
            <div className="text-sm text-muted-foreground">Active Categories</div>
          </div>
        </div>

        {!loading && (
          <div className="grid md:grid-cols-2 gap-8 mb-12">
            {/* Category bar chart */}
            <div className="bg-card border border-border rounded-xl p-6">
              <h2 className="font-bold text-foreground mb-4">Merchants by Category</h2>
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={categoryData} layout="vertical" margin={{ left: 0, right: 20 }}>
                  <XAxis type="number" tick={{ fontSize: 12 }} />
                  <YAxis type="category" dataKey="name" tick={{ fontSize: 11 }} width={100} />
                  <Tooltip />
                  <Bar dataKey="count" fill="hsl(210, 79%, 46%)" radius={[0, 6, 6, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>

            {/* Region pie chart */}
            <div className="bg-card border border-border rounded-xl p-6">
              <h2 className="font-bold text-foreground mb-4">Distribution by Region</h2>
              <ResponsiveContainer width="100%" height={300}>
                <PieChart>
                  <Pie data={regionData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={100} label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}>
                    {regionData.map((_, i) => (
                      <Cell key={i} fill={COLORS[i % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </div>
        )}

      </main>

      <Footer />
    </div>
  );
};

export default Insights;
