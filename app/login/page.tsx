"use client";

import { useEffect, useState } from "react";
import { createBrowserClient } from "@supabase/ssr";

const supabase = createBrowserClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [focus, setFocus] = useState("");
  const [showPass, setShowPass] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) window.location.href = "/dashboard";
    });
  }, []);

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");

    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      setError(error.message);
      setLoading(false);
      return;
    }

    window.location.href = "/dashboard";
  }

  return (
    <div style={wrapper}>
      {/* LEFT BRAND */}
      <div style={leftSide}>
        <h1 style={brand}>ASAD ERP</h1>
        <p style={desc}>
          Enterprise Warehouse & Production Management Platform
        </p>
      </div>

      {/* RIGHT LOGIN */}
      <div style={rightSide}>
        <form onSubmit={handleLogin} style={card}>
          <h2 style={title}>Sign in</h2>

          <div style={field}>
            <label
              style={{
                ...label,
                transform:
                  email || focus === "email"
                    ? "translateY(-18px) scale(.85)"
                    : "translateY(0)",
              }}
            >
              Email address
            </label>

            <input
              value={email}
              onFocus={() => setFocus("email")}
              onBlur={() => setFocus("")}
              onChange={(e) => setEmail(e.target.value)}
              style={input}
              required
            />
          </div>

          <div style={field}>
            <label
              style={{
                ...label,
                transform:
                  password || focus === "pass"
                    ? "translateY(-18px) scale(.85)"
                    : "translateY(0)",
              }}
            >
              Password
            </label>

            <input
              type={showPass ? "text" : "password"}
              value={password}
              onFocus={() => setFocus("pass")}
              onBlur={() => setFocus("")}
              onChange={(e) => setPassword(e.target.value)}
              style={input}
              required
            />

            <span onClick={() => setShowPass(!showPass)} style={showBtn}>
              {showPass ? "Hide" : "Show"}
            </span>
          </div>

          {error && <div style={errorBox}>{error}</div>}

          <button disabled={loading} style={button}>
            {loading ? "Signing..." : "Continue"}
          </button>

          <div style={secure}>Secure enterprise authentication</div>
        </form>
      </div>
    </div>
  );
}

/* ===== WHITE ENTERPRISE STYLES ===== */

const wrapper = {
  height: "100vh",
  display: "flex",
  background: "#F8FAFC",
};

const leftSide = {
  flex: 1,
  padding: 80,
  background: "#FFFFFF",
  borderRight: "1px solid #E2E8F0",
};

const brand = {
  fontSize: 40,
  fontWeight: 700,
  color: "#0F172A",
};

const desc = {
  marginTop: 12,
  color: "#64748B",
  maxWidth: 420,
};

const rightSide = {
  flex: 1,
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
};

const card = {
  width: 420,
  padding: 40,
  borderRadius: 14,
  background: "#FFFFFF",
  border: "1px solid #E2E8F0",
  boxShadow: "0 10px 30px rgba(0,0,0,0.05)",
};

const title = {
  fontSize: 24,
  marginBottom: 24,
  color: "#0F172A",
};

const field = {
  position: "relative" as const,
  marginBottom: 22,
};

const label = {
  position: "absolute" as const,
  left: 12,
  top: 16,
  color: "#64748B",
  fontSize: 13,
  transition: "all .2s ease",
  pointerEvents: "none" as const,
};

const input = {
  width: "100%",
  height: 50,
  padding: "20px 12px 0",
  borderRadius: 10,
  border: "1px solid #CBD5E1",
  background: "#fff",
  color: "#0F172A",
  outline: "none",
};

const showBtn = {
  position: "absolute" as const,
  right: 12,
  top: 16,
  color: "#6366F1",
  fontSize: 12,
  cursor: "pointer",
};

const button = {
  width: "100%",
  height: 48,
  borderRadius: 10,
  border: "none",
  background: "#6366F1",
  color: "#fff",
  fontWeight: 600,
  cursor: "pointer",
};

const errorBox = {
  background: "#FEE2E2",
  color: "#B91C1C",
  padding: 10,
  borderRadius: 8,
  marginBottom: 12,
  fontSize: 13,
};

const secure = {
  marginTop: 14,
  fontSize: 11,
  textAlign: "center" as const,
  color: "#94A3B8",
};