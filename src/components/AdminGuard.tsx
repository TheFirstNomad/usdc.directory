/**
 * AdminGuard — client-side route guard for /admin/* pages.
 *
 * Data is never exposed without a valid server-side admin signature
 * (verifyAdmin in _shared/admin-auth.ts). This guard provides a clean
 * UX redirect rather than showing an empty table shell to non-owners.
 *
 * Usage: wrap any /admin/* route element with <AdminGuard>.
 */

import { useEffect, useState } from "react";
import { Navigate } from "react-router-dom";
import { useAppKitAccount } from "@reown/appkit/react";
import { OWNER_WALLET } from "@/lib/adminAuth";

interface AdminGuardProps {
  children: React.ReactNode;
}

const AdminGuard = ({ children }: AdminGuardProps) => {
  const { address, isConnected } = useAppKitAccount();
  const [checked, setChecked] = useState(false);

  // Give the wallet provider a tick to hydrate before deciding.
  useEffect(() => {
    const t = setTimeout(() => setChecked(true), 300);
    return () => clearTimeout(t);
  }, []);

  if (!checked) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="h-8 w-8 rounded-full border-2 border-primary/30 border-t-primary animate-spin" />
      </div>
    );
  }

  const isAdmin =
    isConnected &&
    !!address &&
    address.toLowerCase() === OWNER_WALLET.toLowerCase();

  if (!isAdmin) {
    return <Navigate to="/" replace />;
  }

  return <>{children}</>;
};

export default AdminGuard;
