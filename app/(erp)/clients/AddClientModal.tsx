"use client";

import { useState, useEffect, useRef } from "react";
import { supabase } from "@/lib/supabase";

interface Props {
  open: boolean;
  onClose: () => void;
  onSaved: () => void;
  editingClient?: {
    id: string;
    name: string;
    address?: string;
    phone_number?: string;
    email?: string;
    contact_person?: string;
    client_code?: string;
    notes?: string;
  } | null;
}

export default function AddClientModal({ open, onClose, onSaved, editingClient }: Props) {
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [address, setAddress] = useState("");
  const [email, setEmail] = useState("");
  const [contactPerson, setContactPerson] = useState("");
  const [clientCode, setClientCode] = useState("");
  const [notes, setNotes] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (open) {
      setName(editingClient?.name || "");
      setPhone(editingClient?.phone_number || "");
      setAddress(editingClient?.address || "");
      setEmail(editingClient?.email || "");
      setContactPerson(editingClient?.contact_person || "");
      setClientCode(editingClient?.client_code || "");
      setNotes(editingClient?.notes || "");
      setError("");
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [open, editingClient]);

  useEffect(() => {
    function onKey(e: KeyboardEvent) { if (e.key === "Escape") onClose(); }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  async function handleSave() {
    const trimmed = name.trim();
    if (!trimmed) { setError("Client name is required"); return; }
    setLoading(true);
    setError("");

    const payload = {
      name: trimmed,
      phone_number: phone.trim() || null,
      address: address.trim() || null,
      email: email.trim() || null,
      contact_person: contactPerson.trim() || null,
      client_code: clientCode.trim() || null,
      notes: notes.trim() || null,
    };

    if (editingClient) {
      const { error: err } = await supabase.from("clients").update(payload).eq("id", editingClient.id);
      if (err) { setError(err.message); setLoading(false); return; }
    } else {
      const { error: err } = await supabase.from("clients").insert(payload);
      if (err) { setError(err.message); setLoading(false); return; }
    }
    setLoading(false);
    onSaved();
    onClose();
  }

  if (!open) return null;
  const isEditing = !!editingClient;

  const inputStyle: React.CSSProperties = {
    width: "100%", boxSizing: "border-box",
    border: "1.5px solid #E5E7EB",
    borderRadius: "10px", padding: "10px 14px", fontSize: "14px",
    color: "#111827", outline: "none", background: "#FAFAFA",
  };

  const labelStyle: React.CSSProperties = {
    display: "block", fontSize: "13px", fontWeight: 600,
    color: "#374151", marginBottom: "6px",
  };

  return (
    <>
      <div onClick={onClose} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.45)", backdropFilter: "blur(4px)", zIndex: 50 }} />
      <div style={{ position: "fixed", top: "50%", left: "50%", transform: "translate(-50%,-50%)", zIndex: 51, width: "100%", maxWidth: "520px", padding: "0 16px" }}>
        <div style={{ background: "#fff", borderRadius: "16px", boxShadow: "0 25px 60px rgba(0,0,0,0.2)", overflow: "hidden", maxHeight: "90vh", overflowY: "auto" }}>

          {/* HEADER */}
          <div style={{ padding: "24px 28px 0", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <div>
              <h2 style={{ fontSize: "18px", fontWeight: 700, color: "#111827", margin: 0 }}>
                {isEditing ? "Edit Client" : "Add New Client"}
              </h2>
              <p style={{ fontSize: "13px", color: "#6B7280", marginTop: "4px" }}>Fill in the client details below</p>
            </div>
            <button onClick={onClose} style={{ background: "#F3F4F6", border: "none", borderRadius: "8px", width: "32px", height: "32px", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", fontSize: "18px", color: "#6B7280" }}>×</button>
          </div>

          {/* BODY */}
          <div style={{ padding: "24px 28px", display: "flex", flexDirection: "column", gap: "14px" }}>

            {/* NAME */}
            <div>
              <label style={labelStyle}>Client Name <span style={{ color: "#EF4444" }}>*</span></label>
              <input
                ref={inputRef}
                value={name}
                onChange={(e) => { setName(e.target.value); setError(""); }}
                placeholder="e.g. Acme Corporation"
                style={{ ...inputStyle, borderColor: error ? "#EF4444" : "#E5E7EB" }}
              />
              {error && <p style={{ fontSize: "12px", color: "#EF4444", marginTop: "6px" }}>{error}</p>}
            </div>

            {/* PHONE + EMAIL */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
              <div>
                <label style={labelStyle}>Phone Number</label>
                <input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+998 90 123 45 67" style={inputStyle} />
              </div>
              <div>
                <label style={labelStyle}>Email</label>
                <input value={email} onChange={(e) => setEmail(e.target.value)} placeholder="client@email.com" style={inputStyle} />
              </div>
            </div>

            {/* ADDRESS */}
            <div>
              <label style={labelStyle}>Address</label>
              <input value={address} onChange={(e) => setAddress(e.target.value)} placeholder="Tashkent, Chilonzor..." style={inputStyle} />
            </div>

            {/* CONTACT PERSON + CLIENT CODE */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
              <div>
                <label style={labelStyle}>Contact Person</label>
                <input value={contactPerson} onChange={(e) => setContactPerson(e.target.value)} placeholder="John Doe" style={inputStyle} />
              </div>
              <div>
                <label style={labelStyle}>Client Code</label>
                <input value={clientCode} onChange={(e) => setClientCode(e.target.value)} placeholder="CLI-001" style={inputStyle} />
              </div>
            </div>

            {/* NOTES */}
            <div>
              <label style={labelStyle}>Notes</label>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Additional notes..."
                style={{ ...inputStyle, resize: "none", height: 80, padding: "10px 14px" }}
              />
            </div>

            {/* ACTIONS */}
            <div style={{ display: "flex", gap: "10px", marginTop: "4px" }}>
              <button onClick={onClose} style={{ flex: 1, padding: "10px", borderRadius: "10px", border: "1.5px solid #E5E7EB", background: "transparent", fontSize: "14px", fontWeight: 600, color: "#374151", cursor: "pointer" }}>
                Cancel
              </button>
              <button onClick={handleSave} disabled={loading} style={{ flex: 2, padding: "10px", borderRadius: "10px", border: "none", background: loading ? "#9CA3AF" : "#4F46E5", fontSize: "14px", fontWeight: 600, color: "#fff", cursor: loading ? "not-allowed" : "pointer" }}>
                {loading ? "Saving..." : isEditing ? "Save Changes" : "+ Add Client"}
              </button>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}