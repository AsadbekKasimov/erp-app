"use client";

import Link from "next/link";
import { useState } from "react";
import {
  LayoutDashboard,
  Users,
  Package,
  ShoppingCart,
  BarChart3,
  FileText,
  Wallet,
  User,
  Star,
  MessageCircle,
  Power
} from "lucide-react";

const menu = [
  { name: "Dashboard",  icon: LayoutDashboard, href: "/dashboard" },
  { name: "Клиенты",    icon: Users,           href: "/clients" },
  { name: "Заказы",     icon: ShoppingCart,    href: "/orders" },
  { name: "Товары",     icon: Package,         href: "/products" },
  { name: "Касса",      icon: Wallet,          href: "/cashbox" },
  { name: "Аналитика",  icon: BarChart3,       href: "#" },
  { name: "Отчёты",     icon: FileText,        href: "#" },
  { name: "Профиль",    icon: User,            href: "#" },
  { name: "Отзывы",     icon: Star,            href: "#" },
  { name: "Чаты",       icon: MessageCircle,   href: "#" },
  { name: "Сервисы",    icon: Power,           href: "#" },
];

export default function Sidebar() {
  const [collapsed, setCollapsed] = useState(false);

  return (
    <div
      style={{
        width: collapsed ? "70px" : "240px",
        background: "#111827",
        color: "#fff",
        height: "100vh",
        transition: "0.2s",
        display: "flex",
        flexDirection: "column",
      }}
    >
      {/* HEADER */}
      <div
        style={{
          padding: "18px",
          display: "flex",
          justifyContent: collapsed ? "center" : "space-between",
          alignItems: "center",
        }}
      >
        {!collapsed && <div style={{ fontWeight: 700 }}>ASAD ERP</div>}

        <button
          onClick={() => setCollapsed(!collapsed)}
          style={{
            background: "transparent",
            border: "none",
            color: "#9CA3AF",
            cursor: "pointer",
          }}
        >
          ☰
        </button>
      </div>

      {/* MENU */}
      <div style={{ display: "flex", flexDirection: "column", gap: "6px", padding: "10px" }}>
        {menu.map((item) => {
          const Icon = item.icon;

          return (
            <Link key={item.name} href={item.href} style={{ textDecoration: "none" }}>
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "12px",
                  padding: "10px",
                  borderRadius: "10px",
                  color: "#E5E7EB",
                  transition: "0.15s",
                }}
                onMouseEnter={(e) =>
                  ((e.currentTarget as HTMLDivElement).style.background = "#1F2937")
                }
                onMouseLeave={(e) =>
                  ((e.currentTarget as HTMLDivElement).style.background = "transparent")
                }
              >
                <Icon size={20} />

                {!collapsed && <span style={{ fontSize: "14px" }}>{item.name}</span>}
              </div>
            </Link>
          );
        })}
      </div>
    </div>
  );
}