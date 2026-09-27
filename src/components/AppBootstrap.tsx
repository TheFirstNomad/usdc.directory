import { useEffect, useState, type ComponentType } from "react";
import StartupRecovery from "@/components/StartupRecovery";

type AppModule = { default: ComponentType };

interface AppBootstrapProps {
  loadApp?: () => Promise<AppModule>;
}

const defaultLoadApp = () => import("../App.tsx");

const AppBootstrap = ({ loadApp = defaultLoadApp }: AppBootstrapProps) => {
  const [LoadedApp, setLoadedApp] = useState<ComponentType | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let active = true;

    loadApp()
      .then(({ default: App }) => {
        if (active) setLoadedApp(() => App);
      })
      .catch((error: unknown) => {
        console.error(error);
        if (active) setFailed(true);
      });

    return () => {
      active = false;
    };
  }, [loadApp]);

  if (failed) return <StartupRecovery />;
  if (!LoadedApp) {
    return (
      <main className="min-h-screen bg-background flex items-center justify-center" aria-label="Loading USDC Directory">
        <div className="h-8 w-8 rounded-full border-2 border-primary/30 border-t-primary animate-spin" />
      </main>
    );
  }

  return <LoadedApp />;
};

export default AppBootstrap;