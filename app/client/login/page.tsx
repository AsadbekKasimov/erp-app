"use client";
import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase";
import { useRouter } from "next/navigation";
import { translations, Lang } from "../_components/translations";

export default function ClientLoginPage() {
  const router = useRouter();
  const [code, setCode] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [lang, setLang] = useState<Lang>("ru");
  const [showPass, setShowPass] = useState(false);

  const t = translations[lang];

  useEffect(() => {
    const session = localStorage.getItem("client_session");
    if (session) router.push("/client/dashboard");
    const saved = localStorage.getItem("client_lang") as Lang;
    if (saved) setLang(saved);
  }, []);

  async function handleLogin() {
    if (!code || !password) { setError(t.fillAll); return; }
    setLoading(true); setError("");

    const { data: client } = await supabase
      .from("clients")
      .select("*")
      .eq("client_code", code.trim().toUpperCase())
      .eq("client_password", password)
      .single();

    if (!client) {
      setError(t.loginError);
      setLoading(false);
      return;
    }

    localStorage.setItem("client_session", JSON.stringify({
      id: client.id,
      name: client.name,
      code: client.client_code,
      phone: client.phone_number,
      email: client.email,
      address: client.address,
      contact_person: client.contact_person,
    }));
    localStorage.setItem("client_lang", lang);
    router.push("/client/dashboard");
  }

  function switchLang(l: Lang) {
    setLang(l);
    localStorage.setItem("client_lang", l);
  }

  return (
    <div style={{ minHeight: "100vh", background: "linear-gradient(135deg, #1e1b4b 0%, #312e81 50%, #4338ca 100%)", display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}>
      <div style={{ width: "100%", maxWidth: 420 }}>

        {/* Lang switcher */}
        <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 16 }}>
          <div style={{ display: "flex", gap: 4, background: "rgba(255,255,255,0.1)", borderRadius: 10, padding: 3 }}>
            {(["ru", "uz"] as Lang[]).map(l => (
              <button key={l} onClick={() => switchLang(l)}
                style={{ padding: "6px 14px", borderRadius: 8, border: "none", background: lang === l ? "#fff" : "transparent", color: lang === l ? "#4338CA" : "#C7D2FE", fontSize: 13, fontWeight: 700, cursor: "pointer" }}>
                {l === "ru" ? "RU" : "UZ"}
              </button>
            ))}
          </div>
        </div>

        <div style={{ background: "#fff", borderRadius: 20, padding: "40px 36px", boxShadow: "0 30px 80px rgba(0,0,0,0.3)" }}>
          {/* Logo */}
          <div style={{ textAlign: "center", marginBottom: 32 }}>
            <div style={{ width: 64, height: 64, borderRadius: 18, background: "linear-gradient(135deg, #4F46E5, #7C3AED)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 28, margin: "0 auto 14px" }}>🏢</div>
            <h1 style={{ fontSize: 22, fontWeight: 800, color: "#111827", margin: 0 }}>ASAD ERP</h1>
            <p style={{ fontSize: 14, color: "#6B7280", marginTop: 6 }}>{t.portal}</p>
          </div>

          {/* Form */}
          <div style={{ marginBottom: 18 }}>
            <label style={lbl}>{t.clientCode}</label>
            <input
              value={code}
              onChange={e => { setCode(e.target.value.toUpperCase()); setError(""); }}
              placeholder={t.enterCode}
              onKeyDown={e => e.key === "Enter" && handleLogin()}
              style={{ ...inp, textTransform: "uppercase", fontFamily: "monospace", letterSpacing: "0.05em", fontWeight: 600 }}
            />
          </div>

          <div style={{ marginBottom: 24 }}>
            <label style={lbl}>{t.password}</label>
            <div style={{ position: "relative" }}>
              <input
                type={showPass ? "text" : "password"}
                value={password}
                onChange={e => { setPassword(e.target.value); setError(""); }}
                placeholder={t.enterPassword}
                onKeyDown={e => e.key === "Enter" && handleLogin()}
                style={{ ...inp, paddingRight: 44 }}
              />
              <button onClick={() => setShowPass(!showPass)}
                style={{ position: "absolute", right: 12, top: "50%", transform: "translateY(-50%)", background: "none", border: "none", cursor: "pointer", fontSize: 18, color: "#9CA3AF" }}>
                {showPass ? "🙈" : "👁️"}
              </button>
            </div>
          </div>

          {error && (
            <div style={{ background: "#FEF2F2", border: "1px solid #FECACA", borderRadius: 10, padding: "10px 14px", marginBottom: 18, color: "#B91C1C", fontSize: 13, display: "flex", alignItems: "center", gap: 8 }}>
              <span>⚠️</span> {error}
            </div>
          )}

          <button onClick={handleLogin} disabled={loading}
            style={{ width: "100%", padding: "13px", background: loading ? "#9CA3AF" : "linear-gradient(135deg, #4F46E5, #7C3AED)", color: "#fff", border: "none", borderRadius: 12, fontSize: 15, fontWeight: 700, cursor: loading ? "not-allowed" : "pointer", boxShadow: loading ? "none" : "0 4px 15px rgba(79,70,229,0.4)" }}>
            {loading ? t.loggingIn : t.login}
          </button>
        </div>
      </div>
    </div>
  );
}

const lbl: React.CSSProperties = { fontSize: 13, fontWeight: 600, color: "#374151", display: "block", marginBottom: 6 };
const inp: React.CSSProperties = { width: "100%", boxSizing: "border-box", padding: "11px 14px", border: "1.5px solid #E5E7EB", borderRadius: 10, fontSize: 14, outline: "none", background: "#FAFAFA", transition: "border-color 0.15s" };