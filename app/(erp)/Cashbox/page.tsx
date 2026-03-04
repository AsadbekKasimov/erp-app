"use client";

import { useEffect, useState, useMemo } from "react";
import { supabase } from "@/lib/supabase";
import {
  ArrowDownToLine, ArrowUpFromLine, RotateCcw,
  Banknote, DollarSign, Landmark, Search, X,
  Wallet, Plus, Trash2, AlertCircle,
} from "lucide-react";

function formatUZS(n: number) { return new Intl.NumberFormat("uz-UZ").format(n) + " UZS"; }
function formatUSD(n: number) { return "$" + new Intl.NumberFormat("en-US", { minimumFractionDigits: 2 }).format(n); }
function formatRS(n: number) { return "₽" + new Intl.NumberFormat("ru-RU").format(n); }

const PAYMENT_TYPES = [
  { key: "sum",    label: "Сум",      Icon: Banknote,  currency: "UZS" },
  { key: "usd",    label: "Доллар",   Icon: DollarSign, currency: "USD" },
  { key: "rs",     label: "Bank sum", Icon: Landmark,  currency: "RUB" },
  { key: "rs_usd", label: "Bank $",   Icon: Landmark,  currency: "USD" },
];

const TX_TYPES = [
  { key: "payment",  label: "Поступление", Icon: ArrowDownToLine, color: "#065F46", bg: "#ECFDF5", border: "#A7F3D0" },
  { key: "return",   label: "Возврат",     Icon: RotateCcw,       color: "#B45309", bg: "#FFFBEB", border: "#FDE68A" },
  { key: "expense",  label: "Расход",      Icon: ArrowUpFromLine, color: "#B91C1C", bg: "#FEF2F2", border: "#FECACA" },
];

function getTypeConfig(type: string) {
  return TX_TYPES.find(t => t.key === type) || TX_TYPES[0];
}

export default function CashboxPage() {
  const [clients, setClients] = useState<any[]>([]);
  const [transactions, setTransactions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const [filterType, setFilterType] = useState("");
  const [filterPaymentType, setFilterPaymentType] = useState("");
  const [filterClient, setFilterClient] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [searchText, setSearchText] = useState("");

  const [modalOpen, setModalOpen] = useState(false);
  const [form, setForm] = useState({
    client_id: "", type: "payment", payment_type: "sum",
    amount: "", date: new Date().toISOString().split("T")[0], description: "",
  });
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState("");

  useEffect(() => { loadAll(); }, []);

  async function loadAll() {
    setLoading(true);
    const [{ data: clientsData }, { data: txData }] = await Promise.all([
      supabase.from("clients").select("id, name").order("name"),
      supabase.from("client_transactions")
        .select("*").in("type", ["payment", "return", "expense"])
        .order("created_at", { ascending: false }),
    ]);
    const clientMap: Record<string, string> = {};
    (clientsData || []).forEach((c: any) => { clientMap[c.id] = c.name; });
    setClients(clientsData || []);
    setTransactions((txData || []).map((t: any) => ({ ...t, clientName: clientMap[t.client_id] || "—" })));
    setLoading(false);
  }

  async function saveTransaction() {
    if (!form.client_id) { setFormError("Выберите клиента"); return; }
    if (!form.amount || Number(form.amount) <= 0) { setFormError("Введите сумму"); return; }
    setFormError("");
    setSaving(true);
    const isUSD = form.payment_type === "usd" || form.payment_type === "rs_usd";
    const amount = Number(form.amount);
    await supabase.from("client_transactions").insert({
      client_id: form.client_id, type: form.type,
      payment_method: form.payment_type === "sum" ? "cash" : form.payment_type === "usd" ? "card" : "transfer",
      payment_type: form.payment_type,
      amount_uzs: isUSD ? 0 : amount,
      amount_usd: isUSD ? amount : 0,
      description: form.description || null,
      created_at: new Date(form.date).toISOString(),
    });
    setSaving(false);
    setModalOpen(false);
    setForm({ client_id: "", type: "payment", payment_type: "sum", amount: "", date: new Date().toISOString().split("T")[0], description: "" });
    loadAll();
  }

  async function deleteTransaction(id: string) {
    if (!confirm("Удалить операцию?")) return;
    await supabase.from("client_transactions").delete().eq("id", id);
    loadAll();
  }

  const filtered = useMemo(() => transactions.filter(t => {
    if (filterType && t.type !== filterType) return false;
    if (filterPaymentType && t.payment_type !== filterPaymentType) return false;
    if (filterClient && t.client_id !== filterClient) return false;
    if (dateFrom && t.created_at < dateFrom) return false;
    if (dateTo && t.created_at > dateTo + "T23:59:59") return false;
    if (searchText && !t.clientName.toLowerCase().includes(searchText.toLowerCase()) && !(t.description || "").toLowerCase().includes(searchText.toLowerCase())) return false;
    return true;
  }), [transactions, filterType, filterPaymentType, filterClient, dateFrom, dateTo, searchText]);

  const totals = useMemo(() => {
    const result: Record<string, { in: number; out: number; balance: number }> = {};
    PAYMENT_TYPES.forEach(pt => { result[pt.key] = { in: 0, out: 0, balance: 0 }; });
    transactions.forEach(t => {
      const pt = t.payment_type || "sum";
      if (!result[pt]) return;
      const isUSD = pt === "usd" || pt === "rs_usd";
      const amount = isUSD ? Number(t.amount_usd || 0) : Number(t.amount_uzs || 0);
      if (t.type === "payment") { result[pt].in += amount; result[pt].balance += amount; }
      else if (t.type === "return" || t.type === "expense") { result[pt].out += amount; result[pt].balance -= amount; }
    });
    return result;
  }, [transactions]);

  const selectedPT = PAYMENT_TYPES.find(p => p.key === form.payment_type)!;
  const hasFilters = filterType || filterPaymentType || filterClient || dateFrom || dateTo || searchText;

  const inp: React.CSSProperties = {
    padding: "8px 12px", border: "1px solid #E5E7EB", borderRadius: 8,
    fontSize: 13, color: "#374151", outline: "none", background: "#fff",
  };

  return (
    <div style={{ padding: 32 }}>

      {/* HEADER */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 24 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <div style={{ width: 40, height: 40, background: "#EEF2FF", borderRadius: 10, display: "flex", alignItems: "center", justifyContent: "center" }}>
            <Wallet size={20} color="#4F46E5" />
          </div>
          <div>
            <h1 style={{ fontSize: 22, fontWeight: 700, color: "#111827", margin: 0 }}>Касса</h1>
            <p style={{ fontSize: 12, color: "#9CA3AF", marginTop: 2 }}>Учёт поступлений, расходов и возвратов</p>
          </div>
        </div>
        <button onClick={() => setModalOpen(true)} style={{
          display: "flex", alignItems: "center", gap: 7,
          background: "#4F46E5", color: "#fff", border: "none",
          borderRadius: 8, padding: "9px 20px", fontSize: 13, fontWeight: 600, cursor: "pointer",
        }}>
          <Plus size={15} /> Новая операция
        </button>
      </div>

      {/* BALANCE CARDS */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 14, marginBottom: 28 }}>
        {PAYMENT_TYPES.map(pt => {
          const t = totals[pt.key];
          const isUSD = pt.key === "usd" || pt.key === "rs_usd";
          const fmt = (n: number) => pt.key === "rs" ? formatRS(n) : isUSD ? formatUSD(n) : formatUZS(n);
          const balColor = t.balance >= 0 ? "#065F46" : "#B91C1C";
          const balBg = t.balance >= 0 ? "#ECFDF5" : "#FEF2F2";
          return (
            <div key={pt.key} style={{ background: "#fff", border: "1px solid #E5E7EB", borderRadius: 12, padding: "18px 20px" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
                <div style={{ width: 32, height: 32, background: "#F3F4F6", borderRadius: 8, display: "flex", alignItems: "center", justifyContent: "center" }}>
                  <pt.Icon size={16} color="#6B7280" />
                </div>
                <span style={{ fontSize: 14, fontWeight: 700, color: "#111827" }}>{pt.label}</span>
              </div>
              <div style={{ background: balBg, borderRadius: 8, padding: "10px 14px", marginBottom: 10 }}>
                <div style={{ fontSize: 11, color: "#6B7280", marginBottom: 2 }}>Баланс</div>
                <div style={{ fontSize: 18, fontWeight: 700, color: balColor }}>{fmt(t.balance)}</div>
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6 }}>
                <div style={{ background: "#F0FDF4", borderRadius: 6, padding: "6px 10px" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 10, color: "#6B7280", marginBottom: 2 }}>
                    <ArrowDownToLine size={10} color="#6B7280" /> Приход
                  </div>
                  <div style={{ fontSize: 12, fontWeight: 600, color: "#065F46" }}>{fmt(t.in)}</div>
                </div>
                <div style={{ background: "#FEF2F2", borderRadius: 6, padding: "6px 10px" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 10, color: "#6B7280", marginBottom: 2 }}>
                    <ArrowUpFromLine size={10} color="#6B7280" /> Расход
                  </div>
                  <div style={{ fontSize: 12, fontWeight: 600, color: "#B91C1C" }}>{fmt(t.out)}</div>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* FILTERS */}
      <div style={{ display: "flex", gap: 10, marginBottom: 20, flexWrap: "wrap", alignItems: "center" }}>
        <div style={{ position: "relative" }}>
          <Search size={13} color="#9CA3AF" style={{ position: "absolute", left: 10, top: "50%", transform: "translateY(-50%)" }} />
          <input value={searchText} onChange={e => setSearchText(e.target.value)} placeholder="Поиск по клиенту..."
            style={{ ...inp, paddingLeft: 30, width: 180 }} />
        </div>
        <select value={filterClient} onChange={e => setFilterClient(e.target.value)} style={inp}>
          <option value="">Все клиенты</option>
          {clients.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
        <select value={filterType} onChange={e => setFilterType(e.target.value)} style={inp}>
          <option value="">Все типы</option>
          {TX_TYPES.map(t => <option key={t.key} value={t.key}>{t.label}</option>)}
        </select>
        <select value={filterPaymentType} onChange={e => setFilterPaymentType(e.target.value)} style={inp}>
          <option value="">Все кассы</option>
          {PAYMENT_TYPES.map(p => <option key={p.key} value={p.key}>{p.label}</option>)}
        </select>
        <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
          <input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)} style={inp} />
          <span style={{ color: "#9CA3AF", fontSize: 13 }}>—</span>
          <input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)} style={inp} />
        </div>
        {hasFilters && (
          <button onClick={() => { setFilterType(""); setFilterPaymentType(""); setFilterClient(""); setDateFrom(""); setDateTo(""); setSearchText(""); }}
            style={{ ...inp, cursor: "pointer", display: "flex", alignItems: "center", gap: 5, color: "#6B7280" }}>
            <X size={13} /> Сбросить
          </button>
        )}
      </div>

      {/* TABLE */}
      {loading ? (
        <div style={{ color: "#9CA3AF", padding: 40 }}>Загрузка...</div>
      ) : (
        <div style={{ background: "#fff", border: "1px solid #E5E7EB", borderRadius: 12, overflow: "hidden" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
            <thead>
              <tr style={{ background: "#F9FAFB", borderBottom: "1px solid #E5E7EB" }}>
                <th style={th}>Дата</th>
                <th style={th}>Клиент</th>
                <th style={th}>Тип</th>
                <th style={th}>Касса</th>
                <th style={th}>Сумма</th>
                <th style={th}>Примечание</th>
                <th style={th}></th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr><td colSpan={7} style={{ textAlign: "center", padding: 40, color: "#9CA3AF" }}>Нет операций</td></tr>
              ) : filtered.map(t => {
                const typeCfg = getTypeConfig(t.type);
                const pt = PAYMENT_TYPES.find(p => p.key === (t.payment_type || "sum"))!;
                const isUSD = t.payment_type === "usd" || t.payment_type === "rs_usd";
                const amount = isUSD ? Number(t.amount_usd || 0) : Number(t.amount_uzs || 0);
                const fmtAmt = t.payment_type === "rs" ? formatRS(amount) : isUSD ? formatUSD(amount) : formatUZS(amount);
                const TIcon = typeCfg.Icon;
                const PIcon = pt?.Icon;
                return (
                  <tr key={t.id} style={{ borderBottom: "1px solid #F3F4F6" }}
                    onMouseEnter={e => (e.currentTarget.style.background = "#FAFAFA")}
                    onMouseLeave={e => (e.currentTarget.style.background = "transparent")}>
                    <td style={td}>{new Date(t.created_at).toLocaleDateString("ru-RU")}</td>
                    <td style={{ ...td, fontWeight: 600 }}>{t.clientName}</td>
                    <td style={td}>
                      <span style={{ display: "inline-flex", alignItems: "center", gap: 5, padding: "3px 10px", borderRadius: 6, fontSize: 11, fontWeight: 600, background: typeCfg.bg, color: typeCfg.color, border: `1px solid ${typeCfg.border}` }}>
                        <TIcon size={11} /> {typeCfg.label}
                      </span>
                    </td>
                    <td style={td}>
                      <span style={{ display: "inline-flex", alignItems: "center", gap: 5, fontSize: 12, background: "#F3F4F6", padding: "3px 10px", borderRadius: 6, fontWeight: 500, color: "#374151" }}>
                        {PIcon && <PIcon size={12} color="#6B7280" />} {pt?.label}
                      </span>
                    </td>
                    <td style={{ ...td, fontWeight: 700, color: t.type === "payment" ? "#065F46" : "#B91C1C" }}>
                      {t.type !== "payment" && "−"}{fmtAmt}
                    </td>
                    <td style={{ ...td, color: "#6B7280" }}>{t.description || "—"}</td>
                    <td style={td}>
                      <button onClick={() => deleteTransaction(t.id)} style={{ display: "inline-flex", alignItems: "center", gap: 4, background: "#FEF2F2", border: "1px solid #FECACA", color: "#EF4444", borderRadius: 6, padding: "4px 10px", fontSize: 11, cursor: "pointer" }}>
                        <Trash2 size={11} /> Delete
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* MODAL */}
      {modalOpen && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.4)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 999, backdropFilter: "blur(3px)" }}>
          <div style={{ background: "#fff", borderRadius: 14, padding: 28, width: 480, boxShadow: "0 20px 50px rgba(0,0,0,0.18)" }}>

            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 20 }}>
              <h2 style={{ fontSize: 18, fontWeight: 700, margin: 0 }}>Новая операция</h2>
              <button onClick={() => { setModalOpen(false); setFormError(""); }} style={{ background: "#F3F4F6", border: "none", borderRadius: 7, width: 30, height: 30, display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", color: "#6B7280" }}>
                <X size={16} />
              </button>
            </div>

            {/* ТИП */}
            <div style={{ marginBottom: 18 }}>
              <label style={lbl}>Тип операции</label>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8 }}>
                {TX_TYPES.map(t => {
                  const Icon = t.Icon;
                  return (
                    <button key={t.key} onClick={() => setForm({ ...form, type: t.key })} style={{
                      padding: "10px 8px", borderRadius: 9, border: `1.5px solid ${form.type === t.key ? t.color : "#E5E7EB"}`,
                      background: form.type === t.key ? t.bg : "#fff",
                      fontSize: 13, fontWeight: 600, cursor: "pointer",
                      color: form.type === t.key ? t.color : "#374151",
                      display: "flex", flexDirection: "column", alignItems: "center", gap: 6,
                    }}>
                      <Icon size={18} />
                      {t.label}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* КАССА */}
            <div style={{ marginBottom: 18 }}>
              <label style={lbl}>Касса (валюта)</label>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr 1fr", gap: 8 }}>
                {PAYMENT_TYPES.map(p => {
                  const Icon = p.Icon;
                  return (
                    <button key={p.key} onClick={() => setForm({ ...form, payment_type: p.key })} style={{
                      padding: "10px 6px", borderRadius: 9, border: `1.5px solid ${form.payment_type === p.key ? "#4F46E5" : "#E5E7EB"}`,
                      background: form.payment_type === p.key ? "#EEF2FF" : "#fff",
                      fontSize: 12, fontWeight: 600, cursor: "pointer",
                      color: form.payment_type === p.key ? "#4338CA" : "#374151",
                      display: "flex", flexDirection: "column", alignItems: "center", gap: 6,
                    }}>
                      <Icon size={16} color={form.payment_type === p.key ? "#4338CA" : "#6B7280"} />
                      {p.label}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* КЛИЕНТ */}
            <div style={{ marginBottom: 14 }}>
              <label style={lbl}>Клиент *</label>
              <select value={form.client_id} onChange={e => setForm({ ...form, client_id: e.target.value })}
                style={{ width: "100%", padding: "9px 12px", border: "1px solid #E5E7EB", borderRadius: 8, fontSize: 13, color: "#374151", outline: "none" }}>
                <option value="">Выберите клиента...</option>
                {clients.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>

            {/* СУММА + ДАТА */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 14 }}>
              <div>
                <label style={lbl}>Сумма ({selectedPT.currency}) *</label>
                <input type="number" min="0" placeholder="0" value={form.amount} onChange={e => setForm({ ...form, amount: e.target.value })}
                  style={{ width: "100%", boxSizing: "border-box", padding: "9px 12px", border: "1px solid #E5E7EB", borderRadius: 8, fontSize: 13, outline: "none" }} />
              </div>
              <div>
                <label style={lbl}>Дата *</label>
                <input type="date" value={form.date} onChange={e => setForm({ ...form, date: e.target.value })}
                  style={{ width: "100%", boxSizing: "border-box", padding: "9px 12px", border: "1px solid #E5E7EB", borderRadius: 8, fontSize: 13, outline: "none" }} />
              </div>
            </div>

            {/* ПРИМЕЧАНИЕ */}
            <div style={{ marginBottom: 18 }}>
              <label style={lbl}>Примечание</label>
              <textarea value={form.description} onChange={e => setForm({ ...form, description: e.target.value })}
                placeholder="Необязательно..." rows={3}
                style={{ width: "100%", boxSizing: "border-box", padding: "9px 12px", border: "1px solid #E5E7EB", borderRadius: 8, fontSize: 13, resize: "none", outline: "none" }} />
            </div>

            {formError && (
              <div style={{ display: "flex", alignItems: "center", gap: 7, background: "#FEF2F2", border: "1px solid #FECACA", borderRadius: 8, padding: "8px 14px", marginBottom: 14, color: "#B91C1C", fontSize: 13 }}>
                <AlertCircle size={14} /> {formError}
              </div>
            )}

            <div style={{ display: "flex", gap: 10 }}>
              <button onClick={() => { setModalOpen(false); setFormError(""); }}
                style={{ flex: 1, padding: 11, borderRadius: 8, border: "1px solid #E5E7EB", background: "#fff", fontWeight: 600, fontSize: 13, cursor: "pointer", color: "#374151" }}>
                Отмена
              </button>
              <button onClick={saveTransaction} disabled={saving} style={{
                flex: 2, padding: 11, borderRadius: 8, border: "none",
                background: saving ? "#9CA3AF" : "#4F46E5",
                color: "#fff", fontWeight: 600, fontSize: 13, cursor: saving ? "not-allowed" : "pointer",
              }}>
                {saving ? "Сохранение..." : "Сохранить"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

const th: React.CSSProperties = { padding: "10px 16px", textAlign: "left", fontSize: 12, fontWeight: 600, color: "#6B7280" };
const td: React.CSSProperties = { padding: "10px 16px", color: "#111827" };
const lbl: React.CSSProperties = { fontSize: 12, fontWeight: 600, color: "#374151", display: "block", marginBottom: 6 };