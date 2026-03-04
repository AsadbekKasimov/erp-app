// app/client/layout.tsx
"use client";
import { useEffect, useState } from "react";
import { useRouter, usePathname } from "next/navigation";

export default function ClientLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const [checked, setChecked] = useState(false);

  const publicRoutes = ["/client/login"];

  useEffect(() => {
    const isPublic = publicRoutes.some(route => pathname.startsWith(route));
    
    if (isPublic) {
      setChecked(true);
      return;
    }

    const session = localStorage.getItem("client_session");
    if (!session) {
      router.push("/client/login");
    } else {
      setChecked(true);
    }
  }, [pathname]);

  if (!checked) {
    return (
      <div style={{
        minHeight: "100vh",
        background: "linear-gradient(135deg, #1e1b4b 0%, #312e81 50%, #4338ca 100%)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center"
      }}>
        <div style={{
          width: 40, height: 40,
          border: "3px solid rgba(255,255,255,0.2)",
          borderTop: "3px solid #fff",
          borderRadius: "50%",
          animation: "spin 0.8s linear infinite"
        }} />
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    );
  }

  return <>{children}</>;
}