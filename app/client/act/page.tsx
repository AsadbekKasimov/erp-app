"use client";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import ClientShell from "../_components/ClientShell";
import { useLang } from "../_components/useLang";

function formatUZS(n: number) { return new Intl.NumberFormat("uz-UZ").format(n) + " UZS"; }
function formatUSD(n: number) { return "$" + new Intl.NumberFormat("en-US", { minimumFractionDigits: 2 }).format(n); }

export default function ClientActPage() {
  const { t, lang } = useLang();
  const [client, setClient] = useState<any>(null);
  const [transactions, setTransactions] = useState<any[]>([]);
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const session = localStorage.getItem("client_session");
    if (!session) return;
    const c = JSON.parse(session);
    setClient(c);
    loadAct(c.id);
  }, []);

  async function loadAct(clientId: string, from?: string, to?: string) {
    setLoading(true);
    let query = supabase.from("client_transactions").select("*").eq("client_id", clientId).order("created_at", { ascending: true });
    if (from) query = query.gte("created_at", from);
    if (to) query = query.lte("created_at", to + "T23:59:59");
    const { data } = await query;
    setTransactions(data || []);
    setLoading(false);
  }

  let runBalUZS = 0, runBalUSD = 0;
  const rows = transactions.map(tx => {
    const creditUZS = tx.type === "payment" ? Number(tx.amount_uzs || 0) : 0;
    const creditUSD = tx.type === "payment" ? Number(tx.amount_usd || 0) : 0;
    const debitUZS  = tx.type === "shipment" ? Number(tx.amount_uzs || 0) : 0;
    const debitUSD  = tx.type === "shipment" ? Number(tx.amount_usd || 0) : 0;
    runBalUZS += creditUZS - debitUZS;
    runBalUSD += creditUSD - debitUSD;
    return { ...tx, creditUZS, creditUSD, debitUZS, debitUSD, balUZS: runBalUZS, balUSD: runBalUSD };
  });

  const totalCreditUZS = rows.reduce((s, r) => s + r.creditUZS, 0);
  const totalDebitUZS  = rows.reduce((s, r) => s + r.debitUZS, 0);

  const typeLabel = (type: string) => {
    if (type === "payment")  return t.incoming;
    if (type === "shipment") return t.shipment;
    return t.returnType;
  };

  function downloadPDF() {
    const locale = lang === "uz" ? "uz-UZ" : "ru-RU";
    const rowsHtml = rows.map((r, i) => `
      <tr style="background:${i % 2 === 0 ? "#fff" : "#F9FAFB"}">
        <td>${new Date(r.created_at).toLocaleDateString(locale)}</td>
        <td>${typeLabel(r.type)}</td>
        <td>${r.description || "-"}</td>
        <td style="color:#065F46;font-weight:600">${r.creditUZS ? formatUZS(r.creditUZS) : "-"}</td>
        <td style="color:#065F46">${r.creditUSD ? formatUSD(r.creditUSD) : "-"}</td>
        <td style="color:#B91C1C;font-weight:600">${r.debitUZS ? formatUZS(r.debitUZS) : "-"}</td>
        <td style="color:#B91C1C">${r.debitUSD ? formatUSD(r.debitUSD) : "-"}</td>
        <td style="font-weight:700;color:${r.balUZS >= 0 ? "#065F46" : "#B91C1C"}">${formatUZS(r.balUZS)}</td>
      </tr>`).join("");

    const html = `<!DOCTYPE html><html><head><meta charset="utf-8">
    <title>${t.actTitle} - ${client?.name}</title>
    <style>
      body{font-family:Arial,sans-serif;padding:40px;font-size:12px;color:#111}
      h1{font-size:20px;font-weight:800;color:#1e1b4b;margin:0 0 4px}
      .sub{font-size:13px;color:#6B7280;margin-bottom:24px}
      .meta{display:flex;gap:40px;margin-bottom:20px;background:#F3F4F6;padding:12px 16px;border-radius:8px}
      .meta div{display:flex;flex-direction:column;gap:2px}
      .meta span{font-size:10px;color:#6B7280}
      .meta strong{font-size:13px;color:#111}
      table{width:100%;border-collapse:collapse}
      th{background:#1e1b4b;color:#fff;padding:9px 10px;text-align:left;font-size:11px}
      td{padding:7px 10px;border-bottom:1px solid #E5E7EB;font-size:11px}
      .summary{display:flex;gap:16px;margin-top:20px}
      .summary-card{flex:1;padding:14px;border-radius:8px;text-align:center}
      .footer{margin-top:40px;display:flex;justify-content:space-between}
      .sign-box{width:45%;border-top:1px solid #111;padding-top:8px;font-size:11px;color:#6B7280}
    </style></head><body>
    <h1>ASAD ERP</h1>
    <div class="sub">${t.actTitle}</div>
    <div class="meta">
      <div><span>${t.name || "Клиент"}</span><strong>${client?.name}</strong></div>
      <div><span>${t.period}</span><strong>${dateFrom || t.start} — ${dateTo || t.today}</strong></div>
      <div><span>${t.printDate}</span><strong>${new Date().toLocaleDateString(locale)}</strong></div>
    </div>
    <table><thead><tr>
      <th>${t.orderDate}</th><th>${t.type}</th><th>${t.description}</th>
      <th>${t.incomeUZS}</th><th>${t.incomeUSD}</th>
      <th>${t.expenseUZS}</th><th>${t.expenseUSD}</th>
      <th>${t.balanceUZS2}</th>
    </tr></thead><tbody>${rowsHtml}</tbody></table>
    <div class="summary">
      <div class="summary-card" style="background:#ECFDF5;border:1px solid #A7F3D0">
        <div style="font-size:10px;color:#6B7280">${t.income}</div>
        <div style="font-size:16px;font-weight:700;color:#065F46">${formatUZS(totalCreditUZS)}</div>
      </div>
      <div class="summary-card" style="background:#FEF2F2;border:1px solid #FECACA">
        <div style="font-size:10px;color:#6B7280">${t.expense}</div>
        <div style="font-size:16px;font-weight:700;color:#B91C1C">${formatUZS(totalDebitUZS)}</div>
      </div>
      <div class="summary-card" style="background:${runBalUZS >= 0 ? "#ECFDF5" : "#FEF2F2"};border:1px solid ${runBalUZS >= 0 ? "#A7F3D0" : "#FECACA"}">
        <div style="font-size:10px;color:#6B7280">${t.finalBalance}</div>
        <div style="font-size:16px;font-weight:700;color:${runBalUZS >= 0 ? "#065F46" : "#B91C1C"}">${formatUZS(runBalUZS)}</div>
        <div style="font-size:12px;color:${runBalUSD >= 0 ? "#065F46" : "#B91C1C"}">${formatUSD(runBalUSD)}</div>
      </div>
    </div>
    <div class="footer">
      <div class="sign-box">ASAD ERP __________________</div>
      <div class="sign-box">${client?.name} __________________</div>
    </div>
    </body></html>`;

    const win = window.open("", "_blank");
    if (win) { win.document.write(html); win.document.close(); setTimeout(() => win.print(), 500); }
  }

  return (
    <ClientShell>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 24 }}>
        <h1 style={{ fontSize: 22, fontWeight: 700, color: "#111827", margin: 0 }}>{t.actTitle}</h1>
        <button onClick={downloadPDF}
          style={{ background: "#059669", color: "#fff", border: "none", borderRadius: 10, padding: "10px 20px", fontSize: 13, fontWeight: 600, cursor: "pointer", boxShadow: "0 2px 8px rgba(5,150,105,0.3)" }}>
          {t.downloadPDF}
        </button>
      </div>

      {/* FILTERS */}
      <div style={{ display: "flex", gap: 10, marginBottom: 20, alignItems: "flex-end", flexWrap: "wrap" }}>
        <div><label style={lbl}>{t.from}</label><input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)} style={inp} /></div>
        <div><label style={lbl}>{t.to}</label><input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)} style={inp} /></div>
        <button onClick={() => client && loadAct(client.id, dateFrom, dateTo)}
          style={{ padding: "9px 18px", background: "#4F46E5", color: "#fff", border: "none", borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: "pointer" }}>
          {t.apply}
        </button>
        {(dateFrom || dateTo) && (
          <button onClick={() => { setDateFrom(""); setDateTo(""); client && loadAct(client.id); }}
            style={{ padding: "9px 14px", background: "#fff", color: "#6B7280", border: "1px solid #E5E7EB", borderRadius: 8, fontSize: 13, cursor: "pointer" }}>
            ✕
          </button>
        )}
      </div>

      {/* SUMMARY CARDS */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 14, marginBottom: 24 }}>
        <div style={{ background: "#ECFDF5", border: "1px solid #A7F3D0", borderRadius: 12, padding: "16px 18px" }}>
          <div style={{ fontSize: 12, color: "#6B7280", marginBottom: 4 }}>📥 {t.income} (UZS)</div>
          <div style={{ fontSize: 20, fontWeight: 700, color: "#065F46" }}>{formatUZS(totalCreditUZS)}</div>
        </div>
        <div style={{ background: "#FEF2F2", border: "1px solid #FECACA", borderRadius: 12, padding: "16px 18px" }}>
          <div style={{ fontSize: 12, color: "#6B7280", marginBottom: 4 }}>📤 {t.expense} (UZS)</div>
          <div style={{ fontSize: 20, fontWeight: 700, color: "#B91C1C" }}>{formatUZS(totalDebitUZS)}</div>
        </div>
        <div style={{ background: runBalUZS >= 0 ? "#ECFDF5" : "#FEF2F2", border: `1px solid ${runBalUZS >= 0 ? "#A7F3D0" : "#FECACA"}`, borderRadius: 12, padding: "16px 18px" }}>
          <div style={{ fontSize: 12, color: "#6B7280", marginBottom: 4 }}>⚖️ {t.finalBalance}</div>
          <div style={{ fontSize: 20, fontWeight: 700, color: runBalUZS >= 0 ? "#065F46" : "#B91C1C" }}>{formatUZS(runBalUZS)}</div>
          <div style={{ fontSize: 13, fontWeight: 600, color: runBalUSD >= 0 ? "#065F46" : "#B91C1C" }}>{formatUSD(runBalUSD)}</div>
        </div>
      </div>

      {/* TABLE */}
      {loading ? <div style={{ color: "#9CA3AF", padding: 20 }}>{t.loading}</div> : (
        <div style={{ background: "#fff", border: "1px solid #E5E7EB", borderRadius: 12, overflow: "hidden" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
            <thead><tr style={{ background: "#1e1b4b" }}>
              {[t.orderDate, t.type, t.description, t.incomeUZS, t.incomeUSD, t.expenseUZS, t.expenseUSD, t.balanceUZS2].map(h => (
                <th key={h} style={{ padding: "11px 14px", textAlign: "left", fontSize: 11, fontWeight: 600, color: "#C7D2FE" }}>{h}</th>
              ))}
            </tr></thead>
            <tbody>
              {rows.length === 0 ? (
                <tr><td colSpan={8} style={{ textAlign: "center", padding: 40, color: "#9CA3AF" }}>{t.noData}</td></tr>
              ) : rows.map((r, i) => (
                <tr key={i} style={{ borderBottom: "1px solid #F3F4F6", background: i % 2 === 0 ? "#fff" : "#FAFAFA" }}>
                  <td style={td}>{new Date(r.created_at).toLocaleDateString("ru-RU")}</td>
                  <td style={td}>
                    <span style={{ padding: "3px 10px", borderRadius: 20, fontSize: 11, fontWeight: 600, background: r.type === "payment" ? "#ECFDF5" : "#EEF2FF", color: r.type === "payment" ? "#065F46" : "#4338CA" }}>
                      {typeLabel(r.type)}
                    </span>
                  </td>
                  <td style={{ ...td, color: "#6B7280", maxWidth: 200 }}><span style={{ display: "block", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{r.description || "—"}</span></td>
                  <td style={{ ...td, color: "#065F46", fontWeight: r.creditUZS > 0 ? 700 : 400 }}>{r.creditUZS > 0 ? formatUZS(r.creditUZS) : "—"}</td>
                  <td style={{ ...td, color: "#065F46" }}>{r.creditUSD > 0 ? formatUSD(r.creditUSD) : "—"}</td>
                  <td style={{ ...td, color: "#B91C1C", fontWeight: r.debitUZS > 0 ? 700 : 400 }}>{r.debitUZS > 0 ? formatUZS(r.debitUZS) : "—"}</td>
                  <td style={{ ...td, color: "#B91C1C" }}>{r.debitUSD > 0 ? formatUSD(r.debitUSD) : "—"}</td>
                  <td style={{ ...td, fontWeight: 700, color: r.balUZS >= 0 ? "#065F46" : "#B91C1C" }}>{formatUZS(r.balUZS)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </ClientShell>
  );
}

const lbl: React.CSSProperties = { fontSize: 12, fontWeight: 600, color: "#374151", display: "block", marginBottom: 6 };
const inp: React.CSSProperties = { padding: "8px 12px", border: "1px solid #E5E7EB", borderRadius: 8, fontSize: 13 };
const td: React.CSSProperties = { padding: "10px 14px", color: "#111827" };