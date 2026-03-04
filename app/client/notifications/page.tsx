"use client";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import ClientShell from "../_components/ClientShell";
import { useLang } from "../_components/useLang";

export default function NotificationsPage() {
  const { t } = useLang();
  const [notifications, setNotifications] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [clientId, setClientId] = useState("");

  const NOTIF_TYPES: Record<string, { icon: string; bg: string; color: string; border: string }> = {
    success: { icon: "✅", bg: "#ECFDF5", color: "#065F46", border: "#A7F3D0" },
    info:    { icon: "ℹ️", bg: "#EEF2FF", color: "#4338CA", border: "#C7D2FE" },
    warning: { icon: "⚠️", bg: "#FFF7ED", color: "#C2410C", border: "#FED7AA" },
    error:   { icon: "❌", bg: "#FEF2F2", color: "#B91C1C", border: "#FECACA" },
  };

  useEffect(() => {
    const session = localStorage.getItem("client_session");
    if (!session) return;
    const c = JSON.parse(session);
    setClientId(c.id);
    loadNotifications(c.id);
  }, []);

  async function loadNotifications(id: string) {
    const { data } = await supabase
      .from("client_notifications")
      .select("*")
      .eq("client_id", id)
      .order("created_at", { ascending: false });
    setNotifications(data || []);
    setLoading(false);
  }

  async function markRead(id: string) {
    await supabase.from("client_notifications").update({ is_read: true }).eq("id", id);
    setNotifications(prev => prev.map(n => n.id === id ? { ...n, is_read: true } : n));
  }

  async function markAllRead() {
    await supabase.from("client_notifications").update({ is_read: true }).eq("client_id", clientId).eq("is_read", false);
    setNotifications(prev => prev.map(n => ({ ...n, is_read: true })));
  }

  function timeAgo(dateStr: string): string {
    const diff = Math.floor((Date.now() - new Date(dateStr).getTime()) / 1000);
    if (diff < 60) return t.justNow;
    if (diff < 3600) return `${Math.floor(diff / 60)} ${t.minutesAgo}`;
    if (diff < 86400) return `${Math.floor(diff / 3600)} ${t.hoursAgo}`;
    return `${Math.floor(diff / 86400)} ${t.daysAgo}`;
  }

  const unread = notifications.filter(n => !n.is_read).length;

  return (
    <ClientShell>
      <div style={{ maxWidth: 700 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 24 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <h1 style={{ fontSize: 22, fontWeight: 700, color: "#111827", margin: 0 }}>{t.notificationsTitle}</h1>
            {unread > 0 && (
              <span style={{ background: "#EF4444", color: "#fff", borderRadius: 20, padding: "2px 10px", fontSize: 12, fontWeight: 700 }}>{unread}</span>
            )}
          </div>
          {unread > 0 && (
            <button onClick={markAllRead}
              style={{ padding: "8px 14px", background: "#F3F4F6", border: "1px solid #E5E7EB", borderRadius: 8, fontSize: 12, fontWeight: 600, cursor: "pointer", color: "#374151" }}>
              ✓ {t.markAllRead}
            </button>
          )}
        </div>

        {loading ? <div style={{ color: "#9CA3AF" }}>{t.loading}</div>
        : notifications.length === 0 ? (
          <div style={{ background: "#fff", border: "1px solid #E5E7EB", borderRadius: 14, padding: 60, textAlign: "center" }}>
            <div style={{ fontSize: 48, marginBottom: 12 }}>🔔</div>
            <div style={{ color: "#9CA3AF", fontSize: 14 }}>{t.noNotifications}</div>
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {notifications.map(n => {
              const cfg = NOTIF_TYPES[n.type] || NOTIF_TYPES.info;
              return (
                <div key={n.id}
                  onClick={() => !n.is_read && markRead(n.id)}
                  style={{ background: n.is_read ? "#fff" : cfg.bg, border: `1px solid ${n.is_read ? "#E5E7EB" : cfg.border}`, borderRadius: 12, padding: "16px 18px", cursor: n.is_read ? "default" : "pointer", display: "flex", gap: 14, alignItems: "flex-start", transition: "all 0.15s" }}>
                  <span style={{ fontSize: 22, flexShrink: 0, marginTop: 1 }}>{cfg.icon}</span>
                  <div style={{ flex: 1 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 4 }}>
                      <div style={{ fontWeight: n.is_read ? 500 : 700, fontSize: 14, color: n.is_read ? "#374151" : cfg.color }}>{n.title}</div>
                      <div style={{ fontSize: 11, color: "#9CA3AF", flexShrink: 0, marginLeft: 12 }}>{timeAgo(n.created_at)}</div>
                    </div>
                    {n.message && <div style={{ fontSize: 13, color: "#6B7280", lineHeight: 1.5 }}>{n.message}</div>}
                  </div>
                  {!n.is_read && (
                    <div style={{ width: 8, height: 8, borderRadius: "50%", background: cfg.color, flexShrink: 0, marginTop: 6 }} />
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </ClientShell>
  );
}