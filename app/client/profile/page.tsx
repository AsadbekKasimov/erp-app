"use client";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import ClientShell from "../_components/ClientShell";
import { useLang } from "../_components/useLang";

export default function ProfilePage() {
  const { t } = useLang();
  const [client, setClient] = useState<any>(null);
  const [clientData, setClientData] = useState<any>(null);
  const [pwForm, setPwForm] = useState({ current: "", newPw: "", confirm: "" });
  const [pwError, setPwError] = useState("");
  const [pwSuccess, setPwSuccess] = useState(false);
  const [savingPw, setSavingPw] = useState(false);
  const [showCurrent, setShowCurrent] = useState(false);
  const [showNew, setShowNew] = useState(false);

  useEffect(() => {
    const session = localStorage.getItem("client_session");
    if (!session) return;
    const c = JSON.parse(session);
    setClient(c);
    loadClient(c.id);
  }, []);

  async function loadClient(id: string) {
    const { data } = await supabase.from("clients").select("*").eq("id", id).single();
    setClientData(data);
  }

  async function changePassword() {
    if (!pwForm.current || !pwForm.newPw || !pwForm.confirm) { setPwError(t.fillAll); return; }
    if (pwForm.newPw !== pwForm.confirm) { setPwError(t.passwordMismatch); return; }
    setPwError(""); setSavingPw(true);

    const { data } = await supabase.from("clients").select("client_password").eq("id", client.id).single();
    if (data?.client_password !== pwForm.current) { setPwError(t.wrongPassword); setSavingPw(false); return; }

    await supabase.from("clients").update({ client_password: pwForm.newPw }).eq("id", client.id);
    setSavingPw(false);
    setPwSuccess(true);
    setPwForm({ current: "", newPw: "", confirm: "" });
    setTimeout(() => setPwSuccess(false), 3000);
  }

  const infoFields = [
    { icon: "🏢", label: t.name,          value: clientData?.name },
    { icon: "📱", label: t.phone,         value: clientData?.phone_number },
    { icon: "📧", label: t.email,         value: clientData?.email },
    { icon: "📍", label: t.address,       value: clientData?.address },
    { icon: "👤", label: t.contactPerson, value: clientData?.contact_person },
    { icon: "#",  label: t.clientCode,    value: clientData?.client_code, mono: true },
  ];

  return (
    <ClientShell>
      <h1 style={{ fontSize: 22, fontWeight: 700, color: "#111827", marginBottom: 24 }}>{t.profileTitle}</h1>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20 }}>
        {/* CONTACT INFO */}
        <div style={{ background: "#fff", border: "1px solid #E5E7EB", borderRadius: 14, padding: 24 }}>
          <h2 style={{ fontSize: 15, fontWeight: 700, marginBottom: 20, color: "#111827" }}>📋 {t.contactInfo}</h2>
          <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            {infoFields.map(f => f.value ? (
              <div key={f.label} style={{ display: "flex", gap: 12, alignItems: "flex-start" }}>
                <span style={{ fontSize: 18, width: 24, flexShrink: 0, marginTop: 1 }}>{f.icon}</span>
                <div>
                  <div style={{ fontSize: 11, color: "#9CA3AF", marginBottom: 2 }}>{f.label}</div>
                  <div style={{ fontSize: 14, fontWeight: 600, color: "#111827", fontFamily: (f as any).mono ? "monospace" : "inherit" }}>{f.value}</div>
                </div>
              </div>
            ) : null)}
          </div>
        </div>

        {/* CHANGE PASSWORD */}
        <div style={{ background: "#fff", border: "1px solid #E5E7EB", borderRadius: 14, padding: 24 }}>
          <h2 style={{ fontSize: 15, fontWeight: 700, marginBottom: 20, color: "#111827" }}>🔐 {t.changePassword}</h2>

          {pwSuccess && (
            <div style={{ background: "#ECFDF5", border: "1px solid #A7F3D0", borderRadius: 10, padding: "10px 14px", marginBottom: 16, color: "#065F46", fontSize: 13, fontWeight: 600 }}>
              ✅ {t.passwordChanged}
            </div>
          )}

          <div style={{ marginBottom: 14 }}>
            <label style={lbl}>{t.currentPassword}</label>
            <div style={{ position: "relative" }}>
              <input type={showCurrent ? "text" : "password"} value={pwForm.current}
                onChange={e => { setPwForm({ ...pwForm, current: e.target.value }); setPwError(""); }}
                style={{ ...inp, paddingRight: 44 }} />
              <button onClick={() => setShowCurrent(!showCurrent)} style={eyeBtn}>{showCurrent ? "🙈" : "👁️"}</button>
            </div>
          </div>

          <div style={{ marginBottom: 14 }}>
            <label style={lbl}>{t.newPassword}</label>
            <div style={{ position: "relative" }}>
              <input type={showNew ? "text" : "password"} value={pwForm.newPw}
                onChange={e => { setPwForm({ ...pwForm, newPw: e.target.value }); setPwError(""); }}
                style={{ ...inp, paddingRight: 44 }} />
              <button onClick={() => setShowNew(!showNew)} style={eyeBtn}>{showNew ? "🙈" : "👁️"}</button>
            </div>
            {pwForm.newPw && (
              <div style={{ marginTop: 6 }}>
                <div style={{ height: 4, background: "#E5E7EB", borderRadius: 999 }}>
                  <div style={{ height: "100%", width: pwForm.newPw.length >= 8 ? "100%" : pwForm.newPw.length >= 4 ? "50%" : "25%", background: pwForm.newPw.length >= 8 ? "#059669" : pwForm.newPw.length >= 4 ? "#F59E0B" : "#EF4444", borderRadius: 999, transition: "width 0.3s" }} />
                </div>
                <div style={{ fontSize: 10, color: "#9CA3AF", marginTop: 2 }}>{pwForm.newPw.length >= 8 ? "Надёжный" : pwForm.newPw.length >= 4 ? "Средний" : "Слабый"}</div>
              </div>
            )}
          </div>

          <div style={{ marginBottom: 20 }}>
            <label style={lbl}>{t.confirmPassword}</label>
            <input type="password" value={pwForm.confirm}
              onChange={e => { setPwForm({ ...pwForm, confirm: e.target.value }); setPwError(""); }}
              style={{ ...inp, borderColor: pwForm.confirm && pwForm.confirm !== pwForm.newPw ? "#EF4444" : "#E5E7EB" }} />
            {pwForm.confirm && pwForm.confirm !== pwForm.newPw && (
              <div style={{ fontSize: 11, color: "#EF4444", marginTop: 4 }}>⚠️ {t.passwordMismatch}</div>
            )}
          </div>

          {pwError && (
            <div style={{ background: "#FEF2F2", border: "1px solid #FECACA", borderRadius: 8, padding: "8px 12px", marginBottom: 14, color: "#B91C1C", fontSize: 13 }}>⚠️ {pwError}</div>
          )}

          <button onClick={changePassword} disabled={savingPw}
            style={{ width: "100%", padding: 11, background: savingPw ? "#9CA3AF" : "#4F46E5", color: "#fff", border: "none", borderRadius: 10, fontSize: 14, fontWeight: 700, cursor: savingPw ? "not-allowed" : "pointer" }}>
            {savingPw ? t.saving2 : t.savePassword}
          </button>
        </div>
      </div>
    </ClientShell>
  );
}

const lbl: React.CSSProperties = { fontSize: 13, fontWeight: 600, color: "#374151", display: "block", marginBottom: 6 };
const inp: React.CSSProperties = { width: "100%", boxSizing: "border-box", padding: "10px 12px", border: "1px solid #E5E7EB", borderRadius: 10, fontSize: 13, outline: "none" };
const eyeBtn: React.CSSProperties = { position: "absolute", right: 12, top: "50%", transform: "translateY(-50%)", background: "none", border: "none", cursor: "pointer", fontSize: 18, color: "#9CA3AF" };