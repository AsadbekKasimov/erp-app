"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";

type Profile = {
  id: string;
  email: string;
  full_name: string;
  role: string;
};

const ROLES = ["superadmin", "admin", "manager", "warehouse"];

const ROLE_COLORS: Record<string, string> = {
  superadmin: "#7C3AED",
  admin: "#2563EB",
  manager: "#059669",
  warehouse: "#D97706",
};

export default function UsersPage() {
  const [users, setUsers] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchUsers();
  }, []);

  async function fetchUsers() {
    const { data } = await supabase.from("profiles").select("*");
    if (data) setUsers(data);
    setLoading(false);
  }

  async function changeRole(id: string, role: string) {
    await supabase.from("profiles").update({ role }).eq("id", id);
    fetchUsers();
  }

  return (
    <div style={{ padding: 30 }}>
      <h1 style={{ fontSize: 24, fontWeight: 700, marginBottom: 20 }}>Users Management</h1>

      {loading ? (
        <p>Loading...</p>
      ) : (
        <table style={{ width: "100%", borderCollapse: "collapse", background: "#fff", borderRadius: 12, overflow: "hidden", boxShadow: "0 2px 8px rgba(0,0,0,0.08)" }}>
          <thead>
            <tr style={{ background: "#F9FAFB", borderBottom: "1px solid #E5E7EB" }}>
              <th style={th}>Email</th>
              <th style={th}>Full Name</th>
              <th style={th}>Role</th>
              <th style={th}>Change Role</th>
            </tr>
          </thead>
          <tbody>
            {users.map((user) => (
              <tr key={user.id} style={{ borderBottom: "1px solid #F3F4F6" }}>
                <td style={td}>{user.email}</td>
                <td style={td}>{user.full_name ?? "-"}</td>
                <td style={td}>
                  <span style={{
                    background: ROLE_COLORS[user.role] ?? "#6B7280",
                    color: "#fff",
                    padding: "3px 10px",
                    borderRadius: 20,
                    fontSize: 12,
                    fontWeight: 600,
                    textTransform: "uppercase",
                  }}>
                    {user.role}
                  </span>
                </td>
                <td style={td}>
                  <select
                    value={user.role}
                    onChange={(e) => changeRole(user.id, e.target.value)}
                    style={{ padding: "6px 10px", borderRadius: 8, border: "1px solid #E5E7EB", cursor: "pointer" }}
                  >
                    {ROLES.map((r) => (
                      <option key={r} value={r}>{r}</option>
                    ))}
                  </select>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}

const th: React.CSSProperties = {
  padding: "12px 16px",
  textAlign: "left",
  fontSize: 13,
  fontWeight: 600,
  color: "#6B7280",
};

const td: React.CSSProperties = {
  padding: "12px 16px",
  fontSize: 14,
  color: "#111827",
};