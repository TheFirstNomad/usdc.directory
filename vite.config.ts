import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { componentTagger } from "lovable-tagger";

// Public (safe-to-ship) backend address and publishable key. Used when the
// build environment has no .env, so published builds always reach the real DB.
const PROJECT_REF = "ddhytszijvfejnymrwgd";
const FALLBACK_URL = `https://${PROJECT_REF}.supabase.co`;
const FALLBACK_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRkaHl0c3ppanZmZWpueW1yd2dkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzM0MTEwNjAsImV4cCI6MjA4ODk4NzA2MH0.P6qgW1Zx75tJs4BxnE82sGoxdSOhsJMNANGSj9dfgtw";

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => {
  const env = { ...loadEnv(mode, process.cwd(), "VITE_"), ...process.env };
  const url = env.VITE_SUPABASE_URL || FALLBACK_URL;
  const key = env.VITE_SUPABASE_PUBLISHABLE_KEY || FALLBACK_KEY;
  if (!url.includes(PROJECT_REF)) {
    throw new Error(`[build] Backend URL must point at project ${PROJECT_REF}, got ${url}`);
  }

  return {
    server: {
      host: "::",
      port: 8080,
      hmr: {
        overlay: false,
      },
    },
    plugins: [react(), mode === "development" && componentTagger()].filter(Boolean),
    define: {
      global: "globalThis",
      "import.meta.env.VITE_SUPABASE_URL": JSON.stringify(url),
      "import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY": JSON.stringify(key),
      "import.meta.env.VITE_SUPABASE_PROJECT_ID": JSON.stringify(env.VITE_SUPABASE_PROJECT_ID || PROJECT_REF),
    },
    resolve: {
      alias: {
        "@": path.resolve(__dirname, "./src"),
      },
    },
  };
});
