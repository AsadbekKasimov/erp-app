"use client";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import ClientShell from "../_components/ClientShell";
import { useLang } from "../_components/useLang";
import Link from "next/link";

function formatUZS(n: number) { return new Intl.NumberFormat("uz-UZ").format(n) + " UZS"; }
function formatUSD(n: number) { return "$" + new Intl.NumberFormat("en-US", { minimumFractionDigits: 2 }).format(n); }

const ORDER_STATUS_KEYS = ["new","in_progress","ready","completed","cancelled"] as const;

export default function ClientDashboard() {
  const { t } = useLang();
  const [client, setClient] = useState<any>(null);
  const [stats, setStats] = useState({ orders: 0, activeOrders: 0, balanceUZS: 0, balanceUSD: 0 });
  const [recentOrders, setRecentOrders] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const session = localStorage.getItem("client_session");
    if (!session) return;
    const c = JSON.parse(session);
    setClient(c);
    loadData(c.id);
  }, []);

  async function loadData(clientId: string) {
    const [{ data: orders }, { data: txData }] = await Promise.all([
      supabase.from("orders").select("*").eq("client_id", clientId).order("created_at", { ascending: false }),
      supabase.from("client_transactions").select("*").eq("client_id", clientId),
    ]);

    const allOrders = orders || [];
    const activeOrders = allOrders.filter(o => !["completed", "cancelled"].includes(o.status));
    setRecentOrders(allOrders.slice(0, 5));

    const txs = txData || [];
    const balUZS = txs.reduce((s, t) => t.type === "payment" ? s + Number(t.amount_uzs || 0) : t.type === "shipment" ? s - Number(t.amount_uzs || 0) : s, 0);
    const balUSD = txs.reduce((s, t) => t.type === "payment" ? s + Number(t.amount_usd || 0) : t.type === "shipment" ? s - Number(t.amount_usd || 0) : s, 0);
    setStats({ orders: allOrders.length, activeOrders: activeOrders.length, balanceUZS: balUZS, balanceUSD: balUSD });
    setLoading(false);
  }

  const ORDER_STATUS: Record<string, { label: string; bg: string; color: string }> = {
    new:         { label: t.statusNew,       bg: "#EEF2FF", color: "#4338CA" },
    in_progress: { label: t.statusInProgress,bg: "#FFF7ED", color: "#C2410C" },
    ready:       { label: t.statusReady,     bg: "#ECFDF5", color: "#065F46" },
    completed:   { label: t.statusCompleted, bg: "#F3F4F6", color: "#374151" },
    cancelled:   { label: t.statusCancelled, bg: "#FEF2F2", color: "#B91C1C" },
  };

  return (
    <ClientShell>
      <h1 style={{ fontSize: 22, fontWeight: 700, color: "#111827", marginBottom: 6 }}>
        {t.welcome}, {client?.name} 👋
      </h1>
      <p style={{ fontSize: 13, color: "#6B7280", marginBottom: 28 }}>#{client?.code}</p>

      {/* STATS */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 16, marginBottom: 24 }}>
        {[
          { label: t.totalOrders,  value: stats.orders,       icon: "📦", color: "#4338CA", bg: "#EEF2FF" },
          { label: t.activeOrders, value: stats.activeOrders, icon: "🔄", color: "#C2410C", bg: "#FFF7ED" },
          { label: t.balanceUZS,   value: formatUZS(stats.balanceUZS), icon: "💵", color: stats.balanceUZS >= 0 ? "#065F46" : "#B91C1C", bg: stats.balanceUZS >= 0 ? "#ECFDF5" : "#FEF2F2" },
          { label: t.balanceUSD,   value: formatUSD(stats.balanceUSD), icon: "💲", color: stats.balanceUSD >= 0 ? "#065F46" : "#B91C1C", bg: stats.balanceUSD >= 0 ? "#ECFDF5" : "#FEF2F2" },
        ].map(card => (
          <div key={card.label} style={{ background: "#fff", border: "1px solid #E5E7EB", borderRadius: 14, padding: "18px 20px" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 10 }}>
              <div style={{ width: 38, height: 38, borderRadius: 10, background: card.bg, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18 }}>{card.icon}</div>
              <span style={{ fontSize: 12, color: "#6B7280" }}>{card.label}</span>
            </div>
            <div style={{ fontSize: 20, fontWeight: 700, color: card.color }}>{card.value}</div>
          </div>
        ))}
      </div>

      {/* QUICK ACTIONS */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginBottom: 24 }}>
        <Link href="/client/new-order" style={{ textDecoration: "none" }}>
          <div style={{ background: "linear-gradient(135deg, #4F46E5, #7C3AED)", borderRadius: 14, padding: "22px 24px", color: "#fff", cursor: "pointer", transition: "transform 0.15s" }}
            onMouseEnter={e => (e.currentTarget as HTMLDivElement).style.transform = "translateY(-2px)"}
            onMouseLeave={e => (e.currentTarget as HTMLDivElement).style.transform = "translateY(0)"}>
            <div style={{ fontSize: 32, marginBottom: 10 }}>➕</div>
            <div style={{ fontSize: 16, fontWeight: 700 }}>{t.createOrder}</div>
            <div style={{ fontSize: 13, opacity: 0.8, marginTop: 4 }}>{t.createOrderDesc}</div>
          </div>
        </Link>
        <Link href="/client/act" style={{ textDecoration: "none" }}>
          <div style={{ background: "linear-gradient(135deg, #059669, #047857)", borderRadius: 14, padding: "22px 24px", color: "#fff", cursor: "pointer", transition: "transform 0.15s" }}
            onMouseEnter={e => (e.currentTarget as HTMLDivElement).style.transform = "translateY(-2px)"}
            onMouseLeave={e => (e.currentTarget as HTMLDivElement).style.transform = "translateY(0)"}>
            <div style={{ fontSize: 32, marginBottom: 10 }}>📄</div>
            <div style={{ fontSize: 16, fontWeight: 700 }}>{t.downloadAct}</div>
            <div style={{ fontSize: 13, opacity: 0.8, marginTop: 4 }}>{t.downloadActDesc}</div>
          </div>
        </Link>
      </div>

      {/* RECENT ORDERS */}
      <div style={{ background: "#fff", border: "1px solid #E5E7EB", borderRadius: 14, overflow: "hidden" }}>
        <div style={{ padding: "16px 20px", borderBottom: "1px solid #F3F4F6", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <span style={{ fontWeight: 700, fontSize: 15 }}>{t.recentOrders}</span>
          <Link href="/client/orders" style={{ fontSize: 13, color: "#4F46E5", textDecoration: "none", fontWeight: 600 }}>{t.allOrders}</Link>
        </div>
        {loading ? <div style={{ padding: 24, color: "#9CA3AF", fontSize: 13 }}>{t.loading}</div>
        : recentOrders.length === 0 ? <div style={{ padding: 40, textAlign: "center", color: "#9CA3AF" }}>{t.noOrders}</div>
        : (
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
            <thead><tr style={{ background: "#F9FAFB" }}>
              <th style={th}>{t.orderNumber}</th>
              <th style={th}>{t.orderDate}</th>
              <th style={th}>{t.orderTotal}</th>
              <th style={th}>{t.orderStatus}</th>
            </tr></thead>
            <tbody>
              {recentOrders.map(o => {
                const st = ORDER_STATUS[o.status] || ORDER_STATUS.new;
                return (
                  <tr key={o.id} style={{ borderTop: "1px solid #F3F4F6" }}>
                    <td style={{ ...td, fontFamily: "monospace", fontWeight: 600, color: "#4338CA" }}>{o.order_number || o.id.slice(0, 8)}</td>
                    <td style={td}>{new Date(o.date || o.created_at).toLocaleDateString("ru-RU")}</td>
                    <td style={{ ...td, fontWeight: 600 }}>{o.total_uzs ? formatUZS(Number(o.total_uzs)) : "—"}</td>
                    <td style={td}><span style={{ padding: "3px 10px", borderRadius: 20, fontSize: 11, fontWeight: 600, background: st.bg, color: st.color }}>{st.label}</span></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    </ClientShell>
  );
}

const th: React.CSSProperties = { padding: "10px 16px", textAlign: "left", fontSize: 12, fontWeight: 600, color: "#6B7280" };
const td: React.CSSProperties = { padding: "12px 16px", color: "#111827" };