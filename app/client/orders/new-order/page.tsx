"use client";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import ClientShell from '../../_components/ClientShell'
import { useLang } from '../../_components/useLang'
import { useRouter } from "next/navigation";

function formatUZS(n: number) { return new Intl.NumberFormat("uz-UZ").format(n) + " UZS"; }
function formatUSD(n: number) { return "$" + new Intl.NumberFormat("en-US", { minimumFractionDigits: 2 }).format(n); }

function genOrderNumber(): string {
  const now = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  return `ORD${pad(now.getDate())}${pad(now.getMonth() + 1)}${now.getFullYear()}${pad(now.getHours())}${pad(now.getMinutes())}${pad(now.getSeconds())}`;
}

export default function ClientNewOrderPage() {
  const router = useRouter();
  const { t } = useLang();
  const [clientId, setClientId] = useState("");
  const [products, setProducts] = useState<any[]>([]);
  const [prices, setPrices] = useState<Record<string, { uzs: number; usd: number }>>({});
  const [items, setItems] = useState<Record<string, { qty: string; notes: string }>>({});
  const [orderDate, setOrderDate] = useState(new Date().toISOString().split("T")[0]);
  const [orderNotes, setOrderNotes] = useState("");
  const [freeText, setFreeText] = useState("");
  const [urgency, setUrgency] = useState("normal");
  const [mode, setMode] = useState<"catalog" | "free">("catalog");
  const [saving, setSaving] = useState(false);
  const [savingDraft, setSavingDraft] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);
  const [draftId, setDraftId] = useState<string | null>(null);
  const [draftSaved, setDraftSaved] = useState(false);

  const URGENCY = [
    { key: "normal",   label: t.urgencyNormal,   color: "#374151", bg: "#F9FAFB", border: "#E5E7EB" },
    { key: "urgent",   label: t.urgencyUrgent,   color: "#C2410C", bg: "#FFF7ED", border: "#FED7AA" },
    { key: "critical", label: t.urgencyCritical, color: "#B91C1C", bg: "#FEF2F2", border: "#FECACA" },
  ];

  useEffect(() => {
    const session = localStorage.getItem("client_session");
    if (!session) return;
    const c = JSON.parse(session);
    setClientId(c.id);
    loadData(c.id);

    // Check if editing a draft
    const params = new URLSearchParams(window.location.search);
    const editDraftId = params.get("draft");
    if (editDraftId) loadDraft(editDraftId, c.id);
  }, []);

  async function loadData(cid: string) {
    const [{ data: prods }, { data: priceData }] = await Promise.all([
      supabase.from("products").select("*").order("category"),
      supabase.from("client_prices").select("*").eq("client_id", cid),
    ]);
    const priceMap: Record<string, { uzs: number; usd: number }> = {};
    (priceData || []).forEach((p: any) => { priceMap[p.product_id] = { uzs: p.price_uzs, usd: p.price_usd }; });
    setPrices(priceMap);
    setProducts((prods || []).filter(p => priceMap[p.id]?.uzs > 0 || priceMap[p.id]?.usd > 0));
  }

  async function loadDraft(draftId: string, cid: string) {
    const { data: order } = await supabase.from("orders").select("*").eq("id", draftId).eq("client_id", cid).single();
    if (!order || order.status !== "draft") return;

    setDraftId(draftId);
    setOrderDate(order.date || new Date().toISOString().split("T")[0]);
    setOrderNotes(order.notes || "");
    setUrgency(order.urgency || "normal");

    const { data: orderItems } = await supabase.from("order_items").select("*").eq("order_id", draftId);
    if (orderItems) {
      const itemMap: Record<string, { qty: string; notes: string }> = {};
      orderItems.forEach((i: any) => {
        itemMap[i.product_id] = { qty: String(i.quantity), notes: i.notes || "" };
      });
      setItems(itemMap);
    }
  }

  const totalUZS = Object.entries(items).reduce((s, [pid, v]) => s + (prices[pid]?.uzs || 0) * (Number(v.qty) || 0), 0);
  const totalUSD = Object.entries(items).reduce((s, [pid, v]) => s + (prices[pid]?.usd || 0) * (Number(v.qty) || 0), 0);

  async function saveDraft() {
    setSavingDraft(true); setError("");

    if (mode === "catalog") {
      const activeItems = Object.entries(items).filter(([, v]) => Number(v.qty) > 0);
      const orderItems = activeItems.map(([pid, v]) => {
        const pr = prices[pid];
        const qty = Number(v.qty);
        return { product_id: pid, quantity: qty, price_uzs: pr.uzs, price_usd: pr.usd, total_uzs: pr.uzs * qty, total_usd: pr.usd * qty, urgency, status: "new", notes: v.notes || "" };
      });

      if (draftId) {
        // Update existing draft
        await supabase.from("orders").update({
          notes: orderNotes, total_uzs: totalUZS, total_usd: totalUSD,
          date: orderDate, urgency,
        }).eq("id", draftId);
        await supabase.from("order_items").delete().eq("order_id", draftId);
        if (orderItems.length > 0) {
          await supabase.from("order_items").insert(orderItems.map(i => ({ ...i, order_id: draftId })));
        }
      } else {
        // Create new draft
        const { data: order } = await supabase.from("orders").insert({
          client_id: clientId, status: "draft", notes: orderNotes,
          total_uzs: totalUZS, total_usd: totalUSD,
          order_number: genOrderNumber(), date: orderDate, urgency,
        }).select().single();

        if (order) {
          setDraftId(order.id);
          if (orderItems.length > 0) {
            await supabase.from("order_items").insert(orderItems.map(i => ({ ...i, order_id: order.id })));
          }
        }
      }
    } else {
      if (draftId) {
        await supabase.from("orders").update({
          notes: `[Свободный текст] ${freeText}`, date: orderDate,
        }).eq("id", draftId);
      } else {
        const { data: order } = await supabase.from("orders").insert({
          client_id: clientId, status: "draft",
          notes: `[Свободный текст] ${freeText}`,
          total_uzs: 0, total_usd: 0,
          order_number: genOrderNumber(), date: orderDate,
        }).select().single();
        if (order) setDraftId(order.id);
      }
    }

    setSavingDraft(false);
    setDraftSaved(true);
    setTimeout(() => setDraftSaved(false), 3000);
  }

  async function saveOrder() {
    setSaving(true); setError("");

    if (mode === "catalog") {
      const activeItems = Object.entries(items).filter(([, v]) => Number(v.qty) > 0);
      if (activeItems.length === 0) { setError(t.addAtLeastOne); setSaving(false); return; }

      const orderItems = activeItems.map(([pid, v]) => {
        const pr = prices[pid];
        const qty = Number(v.qty);
        return { product_id: pid, quantity: qty, price_uzs: pr.uzs, price_usd: pr.usd, total_uzs: pr.uzs * qty, total_usd: pr.usd * qty, urgency, status: "new", notes: v.notes || "" };
      });

      if (draftId) {
        // Submit existing draft
        await supabase.from("orders").update({
          status: "new", notes: orderNotes, total_uzs: totalUZS, total_usd: totalUSD, date: orderDate, urgency,
        }).eq("id", draftId);
        await supabase.from("order_items").delete().eq("order_id", draftId);
        await supabase.from("order_items").insert(orderItems.map(i => ({ ...i, order_id: draftId })));
      } else {
        const { data: order } = await supabase.from("orders").insert({
          client_id: clientId, status: "new", notes: orderNotes,
          total_uzs: totalUZS, total_usd: totalUSD,
          order_number: genOrderNumber(), date: orderDate, urgency,
        }).select().single();
        if (!order) { setError("Ошибка при создании заказа"); setSaving(false); return; }
        await supabase.from("order_items").insert(orderItems.map(i => ({ ...i, order_id: order.id })));
      }
    } else {
      if (!freeText.trim()) { setError(t.addAtLeastOne); setSaving(false); return; }
      if (draftId) {
        await supabase.from("orders").update({
          status: "new", notes: `[Свободный текст] ${freeText}`, date: orderDate,
        }).eq("id", draftId);
      } else {
        await supabase.from("orders").insert({
          client_id: clientId, status: "new",
          notes: `[Свободный текст] ${freeText}`,
          total_uzs: 0, total_usd: 0,
          order_number: genOrderNumber(), date: orderDate,
        });
      }
    }

    setSaving(false);
    setSuccess(true);
    setTimeout(() => router.push("/client/orders"), 2000);
  }

  const grouped = products.reduce((acc: any, p: any) => {
    const cat = p.category || "Прочие";
    if (!acc[cat]) acc[cat] = [];
    acc[cat].push(p);
    return acc;
  }, {});

  if (success) return (
    <ClientShell>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", minHeight: "60vh" }}>
        <div style={{ textAlign: "center" }}>
          <div style={{ fontSize: 72, marginBottom: 16 }}>✅</div>
          <h2 style={{ fontSize: 22, fontWeight: 700, color: "#065F46" }}>{t.orderCreated}</h2>
          <p style={{ color: "#6B7280", marginTop: 8 }}>{t.redirecting}</p>
        </div>
      </div>
    </ClientShell>
  );

  return (
    <ClientShell>
      <div style={{ maxWidth: 1200 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 24 }}>
          <div>
            <h1 style={{ fontSize: 22, fontWeight: 700, color: "#111827", margin: 0 }}>{t.newOrderTitle}</h1>
            {draftId && <span style={{ fontSize: 12, color: "#F59E0B", fontWeight: 600, marginTop: 4, display: "block" }}>📝 Черновик</span>}
          </div>
          {draftSaved && (
            <div style={{ background: "#ECFDF5", border: "1px solid #A7F3D0", borderRadius: 10, padding: "8px 16px", fontSize: 13, color: "#065F46", fontWeight: 600 }}>
              ✅ Черновик сохранён
            </div>
          )}
        </div>

        {/* MODE SWITCHER */}
        <div style={{ display: "flex", gap: 4, background: "#F3F4F6", borderRadius: 12, padding: 4, marginBottom: 24, width: "fit-content" }}>
          {[
            { key: "catalog", label: t.selectFromList, icon: "📋" },
            { key: "free",    label: t.writeFreely,    icon: "✏️" },
          ].map(m => (
            <button key={m.key} onClick={() => setMode(m.key as any)}
              style={{ padding: "10px 20px", borderRadius: 10, border: "none", background: mode === m.key ? "#fff" : "transparent", color: mode === m.key ? "#111827" : "#6B7280", fontSize: 13, fontWeight: mode === m.key ? 700 : 400, cursor: "pointer", boxShadow: mode === m.key ? "0 1px 4px rgba(0,0,0,0.1)" : "none", transition: "all 0.15s" }}>
              {m.icon} {m.label}
            </button>
          ))}
        </div>

        {/* TOP FIELDS */}
        <div style={{ background: "#fff", border: "1px solid #E5E7EB", borderRadius: 14, padding: 20, marginBottom: 20 }}>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginBottom: 16 }}>
            <div>
              <label style={lbl}>{t.orderDateLabel} *</label>
              <input type="date" value={orderDate} onChange={e => setOrderDate(e.target.value)} style={inp} />
            </div>
            <div>
              <label style={lbl}>{t.noteLabel}</label>
              <input value={orderNotes} onChange={e => setOrderNotes(e.target.value)} placeholder={t.optional} style={inp} />
            </div>
          </div>
          <div>
            <label style={lbl}>{t.urgency}</label>
            <div style={{ display: "flex", gap: 8 }}>
              {URGENCY.map(u => (
                <button key={u.key} onClick={() => setUrgency(u.key)}
                  style={{ padding: "8px 16px", borderRadius: 10, border: `2px solid ${urgency === u.key ? u.color : "#E5E7EB"}`, background: urgency === u.key ? u.bg : "#fff", color: urgency === u.key ? u.color : "#374151", fontSize: 13, fontWeight: 600, cursor: "pointer", transition: "all 0.15s" }}>
                  {u.label}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* CATALOG MODE */}
        {mode === "catalog" && (
          <>
            {products.length === 0 ? (
              <div style={{ background: "#FEF2F2", border: "1px solid #FECACA", borderRadius: 14, padding: 32, textAlign: "center", color: "#B91C1C" }}>{t.noProducts}</div>
            ) : Object.entries(grouped).map(([cat, prods]: any) => (
              <div key={cat} style={{ background: "#fff", border: "1px solid #E5E7EB", borderRadius: 14, overflow: "hidden", marginBottom: 14 }}>
                <div style={{ padding: "12px 20px", background: "linear-gradient(135deg, #F0F0FF, #F5F3FF)", borderBottom: "1px solid #E5E7EB", fontWeight: 700, fontSize: 13, color: "#4F46E5", display: "flex", alignItems: "center", gap: 8 }}>
                  🏭 {cat}
                </div>
                <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13, tableLayout: "fixed" }}>
                  <thead><tr style={{ background: "#FAFAFA" }}>
                    <th style={{ ...th, width: 120 }}>{t.code}</th>
                    <th style={th}>{t.product}</th>
                    <th style={{ ...th, width: 130 }}>{t.price}</th>
                    <th style={{ ...th, width: 130 }}>{t.qty}</th>
                    <th style={{ ...th, width: 150 }}>{t.noteLabel}</th>
                    <th style={{ ...th, width: 180 }}>{t.total}</th>
                  </tr></thead>
                  <tbody>
                    {prods.map((p: any) => {
                      const pr = prices[p.id];
                      const v = items[p.id] || { qty: "", notes: "" };
                      const qty = Number(v.qty || 0);
                      const active = qty > 0;
                      return (
                        <tr key={p.id} style={{ borderTop: "1px solid #F3F4F6", background: active ? "#F0FDF4" : "transparent", transition: "background 0.15s" }}>
                          <td style={td}><span style={{ fontFamily: "monospace", fontSize: 11, background: "#F3F4F6", padding: "2px 6px", borderRadius: 4 }}>{p.product_code || "-"}</span></td>
                          <td style={{ ...td, fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{p.name}</td>
                          <td style={td}>{formatUZS(pr.uzs)}</td>
                          <td style={td}>
                            <input type="number" min="0" max="99999" placeholder="0" value={v.qty}
                              onChange={e => {
                                const val = Math.min(99999, Math.max(0, Number(e.target.value)));
                                setItems({ ...items, [p.id]: { ...v, qty: String(val) } });
                                setError("");
                              }}
                              style={{ width: "100%", padding: "6px 8px", border: "1px solid #E5E7EB", borderRadius: 8, fontSize: 13, textAlign: "center", boxSizing: "border-box" }} />
                          </td>
                          <td style={td}>
                            <input type="text" placeholder="..." value={v.notes}
                              onChange={e => setItems({ ...items, [p.id]: { ...v, notes: e.target.value } })}
                              style={{ width: "100%", padding: "6px 8px", border: "1px solid #E5E7EB", borderRadius: 8, fontSize: 12, boxSizing: "border-box" }} />
                          </td>
                          <td style={{ ...td, fontWeight: 700, color: active ? "#065F46" : "#9CA3AF", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                            {active ? formatUZS(pr.uzs * qty) : "—"}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            ))}

            {(totalUZS > 0 || totalUSD > 0) && (
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14, marginBottom: 20 }}>
                <div style={{ background: "#ECFDF5", border: "1px solid #A7F3D0", borderRadius: 12, padding: "14px 18px" }}>
                  <div style={{ fontSize: 12, color: "#6B7280" }}>Итого (UZS)</div>
                  <div style={{ fontSize: 20, fontWeight: 700, color: "#065F46" }}>{formatUZS(totalUZS)}</div>
                </div>
                <div style={{ background: "#ECFDF5", border: "1px solid #A7F3D0", borderRadius: 12, padding: "14px 18px" }}>
                  <div style={{ fontSize: 12, color: "#6B7280" }}>Итого (USD)</div>
                  <div style={{ fontSize: 20, fontWeight: 700, color: "#065F46" }}>{formatUSD(totalUSD)}</div>
                </div>
              </div>
            )}
          </>
        )}

        {/* FREE TEXT MODE */}
        {mode === "free" && (
          <div style={{ background: "#fff", border: "1px solid #E5E7EB", borderRadius: 14, padding: 20, marginBottom: 20 }}>
            <label style={lbl}>{t.writeFreely}</label>
            <textarea value={freeText} onChange={e => { setFreeText(e.target.value); setError(""); }}
              placeholder={t.freeOrderPlaceholder} rows={8}
              style={{ width: "100%", boxSizing: "border-box", padding: "12px 14px", border: "1px solid #E5E7EB", borderRadius: 10, fontSize: 14, resize: "vertical", outline: "none", lineHeight: 1.6 }} />
            <div style={{ fontSize: 12, color: "#9CA3AF", marginTop: 6 }}>{freeText.length} символов</div>
          </div>
        )}

        {error && (
          <div style={{ background: "#FEF2F2", border: "1px solid #FECACA", borderRadius: 10, padding: "10px 16px", marginBottom: 16, color: "#B91C1C", fontSize: 13 }}>
            ⚠️ {error}
          </div>
        )}

        {/* BUTTONS */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 2fr", gap: 12 }}>
          <button onClick={saveDraft} disabled={savingDraft}
            style={{ padding: 14, background: "#fff", color: "#F59E0B", border: "2px solid #F59E0B", borderRadius: 12, fontSize: 15, fontWeight: 700, cursor: savingDraft ? "not-allowed" : "pointer" }}>
            {savingDraft ? "Сохранение..." : "📝 Сохранить черновик"}
          </button>
          <button onClick={saveOrder} disabled={saving || (mode === "catalog" && products.length === 0)}
            style={{ padding: 14, background: saving ? "#9CA3AF" : "linear-gradient(135deg, #4F46E5, #7C3AED)", color: "#fff", border: "none", borderRadius: 12, fontSize: 15, fontWeight: 700, cursor: saving ? "not-allowed" : "pointer", boxShadow: saving ? "none" : "0 4px 15px rgba(79,70,229,0.35)" }}>
            {saving ? t.saving : "✅ " + t.sendOrder}
          </button>
        </div>
      </div>
    </ClientShell>
  );
}

const lbl: React.CSSProperties = { fontSize: 13, fontWeight: 600, color: "#374151", display: "block", marginBottom: 6 };
const inp: React.CSSProperties = { width: "100%", boxSizing: "border-box", padding: "9px 12px", border: "1px solid #E5E7EB", borderRadius: 8, fontSize: 13, outline: "none" };
const th: React.CSSProperties = { padding: "10px 14px", textAlign: "left", fontSize: 12, fontWeight: 600, color: "#6B7280" };
const td: React.CSSProperties = { padding: "10px 14px", color: "#111827" };