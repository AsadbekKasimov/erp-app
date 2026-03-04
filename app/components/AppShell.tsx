"use client";

import { Send } from "lucide-react";
import { Wallet, Warehouse } from "lucide-react";
import Link from "next/link";
import { useState, useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";

import {
  LayoutDashboard,
  Users,
  ShoppingCart,
  Package,
  PanelLeftClose,
  PanelLeftOpen,
  LogOut,
  UserCog,
} from "lucide-react";

type Role = "superadmin" | "admin" | "manager" | "warehouse";

const MENU_BY_ROLE: Record<Role, { href: string; icon: any; label: string }[]> = {
  superadmin: [
    { href: "/dashboard", icon: LayoutDashboard, label: "Dashboard" },
    { href: "/clients", icon: Users, label: "Clients" },
    { href: "/orders", icon: ShoppingCart, label: "Orders" },
    { href: "/products", icon: Package, label: "Products" },
    { href: "/warehouse", icon: Warehouse, label: "Warehouse" },
    { href: "/Cashbox", icon: Wallet, label: "Cashbox" },
    { href: "/users", icon: UserCog, label: "Users" },
    { href: "/telegram-chat", icon: Send, label: "Telegram Chat" },
  ],
  admin: [
    { href: "/dashboard", icon: LayoutDashboard, label: "Dashboard" },
    { href: "/clients", icon: Users, label: "Clients" },
    { href: "/orders", icon: ShoppingCart, label: "Orders" },
    { href: "/products", icon: Package, label: "Products" },
    { href: "/warehouse", icon: Warehouse, label: "Warehouse" },
    { href: "/telegram-chat", icon: Send, label: "Telegram Chat" },
  ],
  manager: [
    { href: "/dashboard", icon: LayoutDashboard, label: "Dashboard" },
    { href: "/clients", icon: Users, label: "Clients" },
    { href: "/orders", icon: ShoppingCart, label: "Orders" },
  ],
  warehouse: [
    { href: "/dashboard", icon: LayoutDashboard, label: "Dashboard" },
    { href: "/warehouse", icon: Warehouse, label: "Warehouse" },
    { href: "/orders", icon: ShoppingCart, label: "Orders" },
    { href: "/products", icon: Package, label: "Products" },
  ],
};

const ROLE_COLORS: Record<Role, string> = {
  superadmin: "#7C3AED",
  admin: "#2563EB",
  manager: "#059669",
  warehouse: "#D97706",
};

export default function AppShell({ children }: { children: React.ReactNode }) {
  const [collapsed, setCollapsed] = useState(false);
  const [profile, setProfile] = useState<{ email: string; role: Role } | null>(null);
  const pathname = usePathname();
  const router = useRouter();

  useEffect(() => {
    async function getProfile() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const { data } = await supabase
        .from("profiles")
        .select("email, role")
        .eq("id", user.id)
        .single();
      if (data) setProfile(data as { email: string; role: Role });
    }
    getProfile();
  }, []);

  async function handleLogout() {
    await supabase.auth.signOut();
    router.push("/login");
    router.refresh();
  }

  const role = profile?.role ?? "manager";
  const menu = MENU_BY_ROLE[role];

  return (
    <div style={{ display: "flex", height: "100vh", overflow: "hidden" }}>
      {/* SIDEBAR */}
      <aside
        style={{
          width: collapsed ? 70 : 220,
          background: "#0F172A",
          color: "#fff",
          display: "flex",
          flexDirection: "column",
          padding: "16px 10px",
          transition: "width .25s ease",
          overflow: "hidden",
        }}
      >
        <div
          style={{
            display: "flex",
            justifyContent: collapsed ? "center" : "space-between",
            alignItems: "center",
            marginBottom: 20,
          }}
        >
          {!collapsed && <b>ASAD ERP</b>}
          <button
            onClick={() => setCollapsed(!collapsed)}
            style={{ background: "transparent", border: "none", color: "#94A3B8", cursor: "pointer" }}
          >
            {collapsed ? <PanelLeftOpen size={18} /> : <PanelLeftClose size={18} />}
          </button>
        </div>

        <nav style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          {menu.map((item) => {
            const Icon = item.icon;
            const active = pathname === item.href || pathname.startsWith(item.href + "/");
            return (
              <Link
                key={item.href}
                href={item.href}
                style={{
                  height: 40,
                  color: active ? "#fff" : "#9CA3AF",
                  textDecoration: "none",
                  padding: "0 12px",
                  borderRadius: 10,
                  display: "flex",
                  alignItems: "center",
                  gap: 12,
                  background: active ? "rgba(99,102,241,0.15)" : "transparent",
                  overflow: "hidden",
                  whiteSpace: "nowrap",
                }}
              >
                <Icon size={20} style={{ flexShrink: 0 }} />
                {!collapsed && <span style={{ fontSize: 14 }}>{item.label}</span>}
              </Link>
            );
          })}
        </nav>
      </aside>

      {/* RIGHT */}
      <div style={{ flex: 1, display: "flex", flexDirection: "column" }}>
        <header
          style={{
            height: 56,
            background: "#fff",
            borderBottom: "1px solid #E5E7EB",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            padding: "0 24px",
          }}
        >
          <span style={{ fontWeight: 600 }}>Enterprise SaaS Panel</span>
          <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
            <div style={{ background: "#F3F4F6", padding: "6px 12px", borderRadius: 8, fontSize: 13 }}>
              👤 {profile?.email?.split("@")[0] ?? "..."}
            </div>
            {profile?.role && (
              <div style={{ background: ROLE_COLORS[role], color: "#fff", padding: "4px 10px", borderRadius: 20, fontSize: 12, fontWeight: 600, textTransform: "uppercase" }}>
                {profile.role}
              </div>
            )}
            <button
              onClick={handleLogout}
              style={{ background: "#EF4444", color: "#fff", border: "none", padding: "6px 12px", borderRadius: 8, cursor: "pointer", display: "flex", alignItems: "center", gap: 6 }}
            >
              <LogOut size={16} />
              Logout
            </button>
          </div>
        </header>

        <main style={{ flex: 1, overflowY: "auto" }}>{children}</main>
      </div>
    </div>
  );
}