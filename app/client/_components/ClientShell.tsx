"use client";
import { useEffect, useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import Link from "next/link";
import { translations, Lang } from "./translations";

export default function ClientShell({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const [client, setClient] = useState<any>(null);
  const [collapsed, setCollapsed] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [lang, setLang] = useState<Lang>("ru");
  const [unreadCount, setUnreadCount] = useState(0);
  const [isMobile, setIsMobile] = useState(false);

  const t = translations[lang];

  useEffect(() => {
    const checkMobile = () => setIsMobile(window.innerWidth < 768);
    checkMobile();
    window.addEventListener("resize", checkMobile);
    return () => window.removeEventListener("resize", checkMobile);
  }, []);

  useEffect(() => {
    const session = localStorage.getItem("client_session");
    if (!session) { router.push("/client/login"); return; }
    const c = JSON.parse(session);
    setClient(c);
    const savedLang = localStorage.getItem("client_lang") as Lang;
    if (savedLang) setLang(savedLang);
    loadUnread(c.id);
  }, []);

  async function loadUnread(clientId: string) {
    try {
      const { createClient } = await import("@supabase/supabase-js");
      const supabase = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
      );
      const { count } = await supabase
        .from("client_notifications")
        .select("*", { count: "exact", head: true })
        .eq("client_id", clientId)
        .eq("is_read", false);
      setUnreadCount(count || 0);
    } catch {}
  }

  function switchLang(l: Lang) {
    setLang(l);
    localStorage.setItem("client_lang", l);
  }

  function logout() {
    localStorage.removeItem("client_session");
    router.push("/client/login");
  }

  if (!client) return (
    <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "#F3F4F6" }}>
      <div style={{ color: "#9CA3AF", fontSize: 14 }}>Загрузка...</div>
    </div>
  );

  const menu = [
    { href: "/client/dashboard",     icon: "📊", label: t.dashboard },
    { href: "/client/orders",        icon: "📦", label: t.myOrders },
    { href: "/client/new-order",     icon: "➕", label: t.newOrder },
    { href: "/client/act",           icon: "📄", label: t.act },
    { href: "/client/notifications", icon: "🔔", label: t.notifications, badge: unreadCount },
    { href: "/client/products", icon: "🏭", label: lang === "uz" ? "Mahsulotlar" : "Товары" },
    { href: "/client/profile",       icon: "👤", label: t.profile },
  ];

  // Bottom nav shows only 5 items on mobile
  const bottomMenu = menu.slice(0, 5);

  return (
    <div style={{ display: "flex", minHeight: "100vh", background: "#F3F4F6" }}>

      {/* ── DESKTOP SIDEBAR ── */}
      {!isMobile && (
        <div style={{
          width: collapsed ? 70 : 230,
          background: "#111827",
          color: "#fff",
          display: "flex",
          flexDirection: "column",
          transition: "width 0.2s",
          flexShrink: 0,
          position: "fixed",
          top: 0, left: 0,
          height: "100vh",
          zIndex: 100,
        }}>
          {/* LOGO */}
          <div style={{ padding: "18px 14px", display: "flex", justifyContent: collapsed ? "center" : "space-between", alignItems: "center", borderBottom: "1px solid #1F2937" }}>
            {!collapsed && <span style={{ fontWeight: 700, fontSize: 15, color: "#F9FAFB" }}>ASAD ERP</span>}
            <button onClick={() => setCollapsed(!collapsed)} style={{ background: "none", border: "none", color: "#9CA3AF", cursor: "pointer", fontSize: 18, padding: 0 }}>☰</button>
          </div>

          {/* CLIENT INFO */}
          {!collapsed && (
            <div style={{ padding: "14px 16px", borderBottom: "1px solid #1F2937" }}>
              <div style={{ width: 36, height: 36, borderRadius: 10, background: "#4F46E5", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 15, fontWeight: 700, marginBottom: 8 }}>
                {client.name?.[0]?.toUpperCase()}
              </div>
              <div style={{ fontSize: 13, fontWeight: 600, color: "#F9FAFB", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{client.name}</div>
              <div style={{ fontSize: 11, color: "#6B7280", marginTop: 2 }}>#{client.code}</div>
            </div>
          )}

          {/* MENU */}
          <nav style={{ flex: 1, padding: "10px 8px", display: "flex", flexDirection: "column", gap: 2, overflowY: "auto" }}>
            {menu.map(item => {
              const active = pathname === item.href;
              return (
                <Link key={item.href} href={item.href} style={{ textDecoration: "none" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 12px", borderRadius: 10, background: active ? "#4F46E5" : "transparent", color: active ? "#fff" : "#D1D5DB", cursor: "pointer", transition: "background 0.15s", justifyContent: collapsed ? "center" : "flex-start", position: "relative" }}
                    onMouseEnter={e => { if (!active) (e.currentTarget as HTMLDivElement).style.background = "#1F2937"; }}
                    onMouseLeave={e => { if (!active) (e.currentTarget as HTMLDivElement).style.background = "transparent"; }}>
                    <span style={{ fontSize: 18, flexShrink: 0 }}>{item.icon}</span>
                    {!collapsed && <span style={{ fontSize: 14, fontWeight: active ? 600 : 400 }}>{item.label}</span>}
                    {(item as any).badge > 0 && (
                      <span style={{ position: "absolute", top: 6, right: collapsed ? 6 : 12, background: "#EF4444", color: "#fff", borderRadius: "50%", width: 18, height: 18, fontSize: 10, fontWeight: 700, display: "flex", alignItems: "center", justifyContent: "center" }}>
                        {(item as any).badge}
                      </span>
                    )}
                  </div>
                </Link>
              );
            })}
          </nav>

          {/* LANG */}
          {!collapsed && (
            <div style={{ padding: "10px 16px", borderTop: "1px solid #1F2937" }}>
              <div style={{ display: "flex", gap: 6 }}>
                {(["ru", "uz"] as Lang[]).map(l => (
                  <button key={l} onClick={() => switchLang(l)}
                    style={{ flex: 1, padding: "6px", borderRadius: 8, border: "none", background: lang === l ? "#4F46E5" : "#1F2937", color: lang === l ? "#fff" : "#9CA3AF", fontSize: 12, fontWeight: 600, cursor: "pointer" }}>
                    {l === "ru" ? "RU" : "UZ"}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* LOGOUT */}
          <div style={{ padding: "8px 8px 16px" }}>
            <button onClick={logout} style={{ width: "100%", display: "flex", alignItems: "center", gap: 10, padding: "10px 12px", borderRadius: 10, background: "none", border: "none", color: "#EF4444", cursor: "pointer", justifyContent: collapsed ? "center" : "flex-start" }}>
              <span style={{ fontSize: 18 }}>🚪</span>
              {!collapsed && <span style={{ fontSize: 14, fontWeight: 600 }}>{t.logout}</span>}
            </button>
          </div>
        </div>
      )}

      {/* ── MOBILE DRAWER OVERLAY ── */}
      {isMobile && mobileMenuOpen && (
        <>
          <div onClick={() => setMobileMenuOpen(false)} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", zIndex: 200 }} />
          <div style={{ position: "fixed", top: 0, left: 0, width: 260, height: "100vh", background: "#111827", zIndex: 201, display: "flex", flexDirection: "column", padding: "20px 12px" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20, paddingBottom: 16, borderBottom: "1px solid #1F2937" }}>
              <span style={{ fontWeight: 700, fontSize: 16, color: "#F9FAFB" }}>ASAD ERP</span>
              <button onClick={() => setMobileMenuOpen(false)} style={{ background: "none", border: "none", color: "#9CA3AF", fontSize: 22, cursor: "pointer" }}>✕</button>
            </div>
            {/* Client info */}
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 20, padding: "10px 12px", background: "#1F2937", borderRadius: 10 }}>
              <div style={{ width: 38, height: 38, borderRadius: 10, background: "#4F46E5", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 16, fontWeight: 700, color: "#fff", flexShrink: 0 }}>
                {client.name?.[0]?.toUpperCase()}
              </div>
              <div>
                <div style={{ fontSize: 13, fontWeight: 600, color: "#F9FAFB" }}>{client.name}</div>
                <div style={{ fontSize: 11, color: "#6B7280" }}>#{client.code}</div>
              </div>
            </div>
            {/* Menu items */}
            <nav style={{ flex: 1, display: "flex", flexDirection: "column", gap: 2 }}>
              {menu.map(item => {
                const active = pathname === item.href;
                return (
                  <Link key={item.href} href={item.href} style={{ textDecoration: "none" }} onClick={() => setMobileMenuOpen(false)}>
                    <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "12px 14px", borderRadius: 10, background: active ? "#4F46E5" : "transparent", color: active ? "#fff" : "#D1D5DB", position: "relative" }}>
                      <span style={{ fontSize: 20 }}>{item.icon}</span>
                      <span style={{ fontSize: 15, fontWeight: active ? 600 : 400 }}>{item.label}</span>
                      {(item as any).badge > 0 && (
                        <span style={{ marginLeft: "auto", background: "#EF4444", color: "#fff", borderRadius: 20, padding: "2px 8px", fontSize: 11, fontWeight: 700 }}>
                          {(item as any).badge}
                        </span>
                      )}
                    </div>
                  </Link>
                );
              })}
            </nav>
            {/* Lang + Logout */}
            <div style={{ borderTop: "1px solid #1F2937", paddingTop: 12, display: "flex", flexDirection: "column", gap: 8 }}>
              <div style={{ display: "flex", gap: 6 }}>
                {(["ru", "uz"] as Lang[]).map(l => (
                  <button key={l} onClick={() => switchLang(l)}
                    style={{ flex: 1, padding: "8px", borderRadius: 8, border: "none", background: lang === l ? "#4F46E5" : "#1F2937", color: lang === l ? "#fff" : "#9CA3AF", fontSize: 13, fontWeight: 600, cursor: "pointer" }}>
                    {l === "ru" ? "RU" : "UZ"}
                  </button>
                ))}
              </div>
              <button onClick={logout} style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 14px", borderRadius: 10, background: "none", border: "none", color: "#EF4444", cursor: "pointer", width: "100%" }}>
                <span style={{ fontSize: 18 }}>🚪</span>
                <span style={{ fontSize: 14, fontWeight: 600 }}>{t.logout}</span>
              </button>
            </div>
          </div>
        </>
      )}

      {/* ── MAIN CONTENT ── */}
      <div style={{
        flex: 1,
        marginLeft: isMobile ? 0 : (collapsed ? 70 : 230),
        transition: "margin-left 0.2s",
        display: "flex",
        flexDirection: "column",
        minHeight: "100vh",
      }}>

        {/* TOPBAR */}
        <div style={{
          background: "#fff",
          borderBottom: "1px solid #E5E7EB",
          padding: isMobile ? "12px 16px" : "14px 28px",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          position: "sticky",
          top: 0,
          zIndex: 50,
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            {isMobile && (
              <button onClick={() => setMobileMenuOpen(true)} style={{ background: "none", border: "none", fontSize: 22, cursor: "pointer", color: "#374151", padding: 0, lineHeight: 1 }}>☰</button>
            )}
            <span style={{ fontSize: isMobile ? 15 : 16, fontWeight: 700, color: "#111827" }}>
              {menu.find(m => m.href === pathname)?.label || "Portal"}
            </span>
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: isMobile ? 8 : 12 }}>
            {/* Lang switcher */}
            <div style={{ display: "flex", gap: 3, background: "#F3F4F6", borderRadius: 8, padding: 3 }}>
              {(["ru", "uz"] as Lang[]).map(l => (
                <button key={l} onClick={() => switchLang(l)}
                  style={{ padding: isMobile ? "3px 8px" : "4px 10px", borderRadius: 6, border: "none", background: lang === l ? "#fff" : "transparent", color: lang === l ? "#111827" : "#9CA3AF", fontSize: 12, fontWeight: 600, cursor: "pointer", boxShadow: lang === l ? "0 1px 3px rgba(0,0,0,0.1)" : "none" }}>
                  {l === "ru" ? "RU" : "UZ"}
                </button>
              ))}
            </div>

            {/* Notifications bell */}
            <Link href="/client/notifications" style={{ textDecoration: "none", position: "relative" }}>
              <div style={{ width: 34, height: 34, borderRadius: 10, background: "#F3F4F6", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 17, cursor: "pointer" }}>
                🔔
                {unreadCount > 0 && (
                  <span style={{ position: "absolute", top: -4, right: -4, background: "#EF4444", color: "#fff", borderRadius: "50%", width: 17, height: 17, fontSize: 10, fontWeight: 700, display: "flex", alignItems: "center", justifyContent: "center" }}>
                    {unreadCount}
                  </span>
                )}
              </div>
            </Link>

            {/* Avatar - hide name on mobile */}
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <div style={{ width: 34, height: 34, borderRadius: "50%", background: "#4F46E5", color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 13, fontWeight: 700, flexShrink: 0 }}>
                {client.name?.[0]?.toUpperCase()}
              </div>
              {!isMobile && (
                <div style={{ display: "flex", flexDirection: "column" }}>
                  <span style={{ fontSize: 13, fontWeight: 600, color: "#111827", lineHeight: 1.2 }}>{client.name}</span>
                  <span style={{ fontSize: 11, color: "#9CA3AF" }}>#{client.code}</span>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* PAGE CONTENT */}
        <div style={{ flex: 1, padding: isMobile ? "16px 12px" : 28, paddingBottom: isMobile ? 90 : 28, overflowY: "auto" }}>
          <div data-lang={lang}>
            {children}
          </div>
        </div>
      </div>

      {/* ── MOBILE BOTTOM NAV ── */}
      {isMobile && (
        <div style={{
          position: "fixed",
          bottom: 0, left: 0, right: 0,
          height: 64,
          background: "#fff",
          borderTop: "1px solid #E5E7EB",
          display: "flex",
          alignItems: "center",
          zIndex: 100,
          boxShadow: "0 -2px 12px rgba(0,0,0,0.08)",
        }}>
          {bottomMenu.map(item => {
            const active = pathname === item.href;
            return (
              <Link key={item.href} href={item.href} style={{ textDecoration: "none", flex: 1 }}>
                <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 2, padding: "8px 4px", position: "relative" }}>
                  <span style={{ fontSize: 20, lineHeight: 1 }}>{item.icon}</span>
                  <span style={{ fontSize: 9, fontWeight: active ? 700 : 400, color: active ? "#4F46E5" : "#9CA3AF", lineHeight: 1 }}>
                    {item.label}
                  </span>
                  {active && (
                    <div style={{ position: "absolute", top: 0, left: "50%", transform: "translateX(-50%)", width: 28, height: 3, background: "#4F46E5", borderRadius: "0 0 3px 3px" }} />
                  )}
                  {(item as any).badge > 0 && (
                    <span style={{ position: "absolute", top: 4, right: "50%", marginRight: -18, background: "#EF4444", color: "#fff", borderRadius: "50%", width: 16, height: 16, fontSize: 9, fontWeight: 700, display: "flex", alignItems: "center", justifyContent: "center" }}>
                      {(item as any).badge}
                    </span>
                  )}
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}