"use client";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import ClientShell from "../_components/ClientShell";
import { useLang } from "../_components/useLang";

function formatUZS(n: number) { return new Intl.NumberFormat("uz-UZ").format(n) + " UZS"; }

export default function ClientOrdersPage() {
  const { t } = useLang();
  const [orders, setOrders] = useState<any[]>([]);
  const [expandedOrder, setExpandedOrder] = useState<string | null>(null);
  const [orderItems, setOrderItems] = useState<Record<string, any[]>>({});
  const [loading, setLoading] = useState(true);
  const [filterStatus, setFilterStatus] = useState("");

  const ORDER_STATUS: Record<string, { label: string; bg: string; color: string }> = {
    new:         { label: t.statusNew,        bg: "#EEF2FF", color: "#4338CA" },
    in_progress: { label: t.statusInProgress, bg: "#FFF7ED", color: "#C2410C" },
    ready:       { label: t.statusReady,      bg: "#ECFDF5", color: "#065F46" },
    completed:   { label: t.statusCompleted,  bg: "#F3F4F6", color: "#374151" },
    cancelled:   { label: t.statusCancelled,  bg: "#FEF2F2", color: "#B91C1C" },
  };

  const ITEM_STATUS: Record<string, { label: string; color: string }> = {
    new:        { label: t.statusNew,        color: "#4338CA" },
    confirmed:  { label: t.statusConfirmed,  color: "#15803D" },
    production: { label: t.statusProduction, color: "#C2410C" },
    ready:      { label: t.statusReady,      color: "#065F46" },
    shipped:    { label: t.statusShipped,    color: "#374151" },
  };

  const STATUS_ORDER = ["new","confirmed","production","ready","shipped"];

  useEffect(() => {
    const session = localStorage.getItem("client_session");
    if (!session) return;
    loadOrders(JSON.parse(session).id);
  }, []);

  async function loadOrders(clientId: string) {
    const { data } = await supabase.from("orders").select("*").eq("client_id", clientId).order("created_at", { ascending: false });
    setOrders(data || []);
    setLoading(false);
  }

  async function loadItems(orderId: string) {
    if (orderItems[orderId]) return;
    const { data: items } = await supabase.from("order_items").select("*").eq("order_id", orderId);
    const { data: prods } = await supabase.from("products").select("id, name, product_code");
    const prodMap: Record<string, any> = {};
    (prods || []).forEach((p: any) => { prodMap[p.id] = p; });
    const joined = (items || []).map((i: any) => ({ ...i, products: prodMap[i.product_id] || null }));
    setOrderItems(prev => ({ ...prev, [orderId]: joined }));
  }

  function toggle(orderId: string) {
    if (expandedOrder === orderId) { setExpandedOrder(null); return; }
    setExpandedOrder(orderId);
    loadItems(orderId);
  }

  function OrderProgress({ items }: { items: any[] }) {
    if (!items || items.length === 0) return null;
    const maxIdx = Math.max(...items.map(i => STATUS_ORDER.indexOf(i.status)));
    const pct = Math.round(((maxIdx + 1) / STATUS_ORDER.length) * 100);
    const color = pct === 100 ? "#059669" : "#4F46E5";
    return (
      <div style={{ marginTop: 14, padding: "12px 16px", background: "#F9FAFB", borderRadius: 10 }}>
        <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11, color: "#6B7280", marginBottom: 6 }}>
          <span>{t.orderProgress}</span><span style={{ fontWeight: 700, color }}>{pct}%</span>
        </div>
        <div style={{ height: 8, background: "#E5E7EB", borderRadius: 999, overflow: "hidden" }}>
          <div style={{ height: "100%", width: `${pct}%`, background: color, borderRadius: 999, transition: "width 0.4s ease" }} />
        </div>
        <div style={{ display: "flex", justifyContent: "space-between", marginTop: 10 }}>
          {STATUS_ORDER.map((s, i) => {
            const done = i <= maxIdx;
            const ist = ITEM_STATUS[s];
            return (
              <div key={s} style={{ textAlign: "center", flex: 1 }}>
                <div style={{ width: 12, height: 12, borderRadius: "50%", background: done ? color : "#E5E7EB", margin: "0 auto 4px", border: `2px solid ${done ? color : "#D1D5DB"}`, transition: "0.3s" }} />
                <div style={{ fontSize: 9, color: done ? color : "#9CA3AF", fontWeight: done ? 600 : 400, lineHeight: 1.2 }}>{ist?.label}</div>
              </div>
            );
          })}
        </div>
      </div>
    );
  }

  const filtered = filterStatus ? orders.filter(o => o.status === filterStatus) : orders;

  return (
    <ClientShell>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 24 }}>
        <h1 style={{ fontSize: 22, fontWeight: 700, color: "#111827", margin: 0 }}>{t.myOrders}</h1>
        <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)}
          style={{ padding: "8px 12px", border: "1px solid #E5E7EB", borderRadius: 8, fontSize: 13, color: "#374151" }}>
          <option value="">{t.allStatuses}</option>
          {Object.entries(ORDER_STATUS).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
        </select>
      </div>

      {loading ? <div style={{ color: "#9CA3AF", padding: 20 }}>{t.loading}</div>
      : filtered.length === 0 ? (
        <div style={{ background: "#fff", border: "1px solid #E5E7EB", borderRadius: 14, padding: 48, textAlign: "center", color: "#9CA3AF" }}>{t.noOrders}</div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {filtered.map(order => {
            const st = ORDER_STATUS[order.status] || ORDER_STATUS.new;
            const items = orderItems[order.id];
            const isExpanded = expandedOrder === order.id;
            return (
              <div key={order.id} style={{ background: "#fff", border: "1px solid #E5E7EB", borderRadius: 14, overflow: "hidden", transition: "box-shadow 0.2s" }}
                onMouseEnter={e => (e.currentTarget as HTMLDivElement).style.boxShadow = "0 4px 12px rgba(0,0,0,0.08)"}
                onMouseLeave={e => (e.currentTarget as HTMLDivElement).style.boxShadow = "none"}>
                <div style={{ padding: "18px 20px", cursor: "pointer" }} onClick={() => toggle(order.id)}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                    <div style={{ flex: 1 }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 6, flexWrap: "wrap" }}>
                        <span style={{ fontFamily: "monospace", fontWeight: 700, fontSize: 14, color: "#4338CA", background: "#EEF2FF", padding: "2px 10px", borderRadius: 6 }}>
                          {order.order_number || order.id.slice(0, 8)}
                        </span>
                        <span style={{ padding: "3px 12px", borderRadius: 20, fontSize: 11, fontWeight: 600, background: st.bg, color: st.color }}>{st.label}</span>
                      </div>
                      <div style={{ fontSize: 12, color: "#6B7280", display: "flex", gap: 14, flexWrap: "wrap" }}>
                        <span>📅 {new Date(order.date || order.created_at).toLocaleDateString("ru-RU")}</span>
                        {order.notes && <span>📝 {order.notes}</span>}
                      </div>
                      {isExpanded && items && items.length > 0 && <OrderProgress items={items} />}
                    </div>
                    <div style={{ display: "flex", alignItems: "center", gap: 12, marginLeft: 16 }}>
                      {order.total_uzs > 0 && (
                        <div style={{ textAlign: "right" }}>
                          <div style={{ fontWeight: 700, fontSize: 15, color: "#111827" }}>{formatUZS(Number(order.total_uzs))}</div>
                        </div>
                      )}
                      <span style={{ fontSize: 18, color: "#9CA3AF" }}>{isExpanded ? "▲" : "▼"}</span>
                    </div>
                  </div>
                </div>

                {isExpanded && (
                  <div style={{ borderTop: "1px solid #F3F4F6" }}>
                    {!items ? (
                      <div style={{ padding: 20, color: "#9CA3AF", fontSize: 13 }}>{t.loading}</div>
                    ) : items.length === 0 ? (
                      <div style={{ padding: 20, color: "#9CA3AF", fontSize: 13 }}>{t.noData}</div>
                    ) : (
                      <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
                        <thead><tr style={{ background: "#F9FAFB" }}>
                          <th style={th}>{t.code}</th>
                          <th style={th}>{t.product}</th>
                          <th style={th}>{t.qty}</th>
                          <th style={th}>{t.price}</th>
                          <th style={th}>{t.total}</th>
                          <th style={th}>{t.orderStatus}</th>
                          <th style={th}>{t.deadline}</th>
                        </tr></thead>
                        <tbody>
                          {items.map((item: any) => {
                            const ist = ITEM_STATUS[item.status] || ITEM_STATUS.new;
                            const isOverdue = item.due_date && new Date(item.due_date) < new Date() && item.status !== "shipped";
                            return (
                              <tr key={item.id} style={{ borderTop: "1px solid #F3F4F6" }}>
                                <td style={td}><span style={{ fontFamily: "monospace", fontSize: 11, background: "#F3F4F6", padding: "2px 6px", borderRadius: 4 }}>{item.products?.product_code || "-"}</span></td>
                                <td style={{ ...td, fontWeight: 600 }}>{item.products?.name || "-"}</td>
                                <td style={td}>{item.quantity}</td>
                                <td style={td}>{formatUZS(item.price_uzs)}</td>
                                <td style={{ ...td, fontWeight: 700, color: "#065F46" }}>{formatUZS(item.total_uzs)}</td>
                                <td style={td}><span style={{ fontSize: 12, fontWeight: 600, color: ist.color }}>{ist.label}</span></td>
                                <td style={td}>
                                  {item.due_date ? (
                                    <span style={{ color: isOverdue ? "#B91C1C" : "#374151", fontWeight: isOverdue ? 700 : 400 }}>
                                      {isOverdue ? "⚠️ " : ""}{new Date(item.due_date).toLocaleDateString("ru-RU")}
                                    </span>
                                  ) : "—"}
                                </td>
                              </tr>
                            );
                          })}
                          <tr style={{ background: "#F9FAFB", borderTop: "2px solid #E5E7EB" }}>
                            <td colSpan={4} style={{ ...td, fontWeight: 700 }}>{t.orderTotal2}</td>
                            <td style={{ ...td, fontWeight: 700, color: "#065F46" }}>{formatUZS(items.reduce((s: number, i: any) => s + Number(i.total_uzs || 0), 0))}</td>
                            <td colSpan={2} />
                          </tr>
                        </tbody>
                      </table>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </ClientShell>
  );
}

const th: React.CSSProperties = { padding: "10px 16px", textAlign: "left", fontSize: 12, fontWeight: 600, color: "#6B7280" };
const td: React.CSSProperties = { padding: "11px 16px", color: "#111827" };