import { Suspense } from "react";
import { Loader2 } from "lucide-react";

function WalletLoading() {
  return (
    <div className="min-h-screen bg-background flex items-center justify-center">
      <Loader2 className="w-8 h-8 text-lime animate-spin" />
    </div>
  );
}

export default function WalletLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <Suspense fallback={<WalletLoading />}>{children}</Suspense>;
}
