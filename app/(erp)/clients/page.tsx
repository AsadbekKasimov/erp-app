"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { useRouter } from "next/navigation";
import AddClientModal from "./AddClientModal";

const AVATAR_COLORS = ["#7C3AED","#2563EB","#059669","#D97706","#DB2777","#0891B2","#DC2626","#65A30D"];
function getAvatarColor(id: string) { return AVATAR_COLORS[id.charCodeAt(0) % AVATAR_COLORS.length]; }
function getInitials(name: string) { return name.split(" ").slice(0,2).map((w) => w[0]?.toUpperCase()).join(""); }

export default function ClientsPage() {
  const router = useRouter();
  const [clients, setClients] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [modalOpen, setModalOpen] = useState(false);
  const [editingClient, setEditingClient] = useState<any | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  useEffect(() => { loadClients(); }, []);

  async function loadClients() {
    const { data } = await supabase.from("clients").select("*").order("name");
    setClients(data || []);
    setLoading(false);
  }

  async function deleteClient(id: string) {
    if (!confirm("Удалить клиента?")) return;
    setDeletingId(id);
    await supabase.from("clients").delete().eq("id", id);
    await loadClients();
    setDeletingId(null);
  }

  const filtered = clients.filter((c) =>
    c.name?.toLowerCase().includes(search.toLowerCase()) ||
    c.phone_number?.includes(search) ||
    c.client_code?.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div style={{ padding: 32 }}>

      <AddClientModal
        open={modalOpen}
        onClose={() => { setModalOpen(false); setEditingClient(null); }}
        onSaved={loadClients}
        editingClient={editingClient}
      />

      {/* HEADER */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 24 }}>
        <div>
          <h1 style={{ fontSize: 24, fontWeight: 700, color: "#111827", margin: 0 }}>Clients</h1>
          <p style={{ fontSize: 13, color: "#6B7280", marginTop: 4 }}>{clients.length} клиентов всего</p>
        </div>
        <button
          onClick={() => { setEditingClient(null); setModalOpen(true); }}
          style={{ background: "#4F46E5", color: "#fff", border: "none", borderRadius: 8, padding: "10px 20px", fontSize: 13, fontWeight: 600, cursor: "pointer" }}
        >
          + Add Client
        </button>
      </div>

      {/* SEARCH */}
      <div style={{ marginBottom: 20 }}>
        <input
          type="text"
          placeholder="Поиск по имени, телефону или коду..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          style={{ width: "100%", maxWidth: 400, padding: "10px 14px", border: "1px solid #E5E7EB", borderRadius: 10, fontSize: 13, boxSizing: "border-box", outline: "none" }}
        />
      </div>

      {/* TABLE */}
      {loading ? (
        <div style={{ color: "#9CA3AF", padding: 40 }}>Loading...</div>
      ) : (
        <div style={{ background: "#fff", border: "1px solid #E5E7EB", borderRadius: 12, overflow: "hidden" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
            <thead>
              <tr style={{ background: "#F9FAFB", borderBottom: "1px solid #E5E7EB" }}>
                <th style={th}>Клиент</th>
                <th style={th}>Код</th>
                <th style={th}>Телефон</th>
                <th style={th}>Адрес</th>
                <th style={th}>Дата</th>
                <th style={th}></th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={6} style={{ textAlign: "center", padding: 40, color: "#9CA3AF" }}>
                    Клиенты не найдены
                  </td>
                </tr>
              ) : filtered.map((c) => (
                <tr
                  key={c.id}
                  style={{ borderBottom: "1px solid #F3F4F6", cursor: "pointer" }}
                  onClick={() => router.push(`/clients/${c.id}`)}
                  onMouseEnter={(e) => (e.currentTarget.style.background = "#F9FAFB")}
                  onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
                >
                  <td style={{ padding: "12px 16px" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                      <div style={{ width: 36, height: 36, borderRadius: 10, background: getAvatarColor(c.id), color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 13, fontWeight: 700, flexShrink: 0 }}>
                        {getInitials(c.name)}
                      </div>
                      <span style={{ fontWeight: 600, color: "#111827" }}>{c.name}</span>
                    </div>
                  </td>
                  <td style={td}>{c.client_code || "-"}</td>
                  <td style={td}>{c.phone_number || "-"}</td>
                  <td style={td}>{c.address || "-"}</td>
                  <td style={td}>{new Date(c.created_at).toLocaleDateString("ru-RU")}</td>
                  <td style={{ padding: "12px 16px" }}>
                    <div style={{ display: "flex", gap: 6 }} onClick={(e) => e.stopPropagation()}>
                      <button
                        onClick={() => { setEditingClient(c); setModalOpen(true); }}
                        style={{ background: "#EEF2FF", color: "#4F46E5", border: "none", borderRadius: 8, padding: "6px 12px", fontSize: 12, fontWeight: 600, cursor: "pointer" }}
                      >
                         Edit
                      </button>
                      <button
                        onClick={() => deleteClient(c.id)}
                        disabled={deletingId === c.id}
                        style={{ background: "#FEF2F2", color: "#EF4444", border: "none", borderRadius: 8, padding: "6px 12px", fontSize: 12, fontWeight: 600, cursor: "pointer", opacity: deletingId === c.id ? 0.5 : 1 }}
                      >
                        Delete
                      </button>
                      <button
                        onClick={() => router.push(`/clients/${c.id}`)}
                        style={{ background: "#F3F4F6", color: "#374151", border: "none", borderRadius: 8, padding: "6px 12px", fontSize: 12, fontWeight: 600, cursor: "pointer" }}
                      >
                        Открыть →
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

const th: React.CSSProperties = { padding: "10px 16px", textAlign: "left", fontSize: 12, fontWeight: 600, color: "#6B7280" };
const td: React.CSSProperties = { padding: "12px 16px", color: "#374151" };