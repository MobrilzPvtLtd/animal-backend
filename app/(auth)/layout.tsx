"use client";

import { useAuth } from "@/providers/AuthProvider";
import { usePathname, useRouter } from "next/navigation";
import { useEffect } from "react";

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { session, loading } = useAuth();
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    if (!loading && session && pathname !== "/reset-password") {
      router.replace(`/dashboard`);
    }
  }, [session, loading, router, pathname]);

  return <div className="flex flex-col min-h-screen">{children}</div>;
}
