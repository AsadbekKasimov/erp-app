"use client";

import { useEffect, useState, useMemo } from "react";
import { supabase } from "@/lib/supabase";
import ClientShell from "../_components/ClientShell";
import { useLang } from "../_components/useLang";

const CATEGORIES = [
  "Все","Цех гель 1","Цех гель 2","ПЭТ","ПП","ПЭ",
  "Формовка","Соль","Химикаты","Прочие"
];

const CATEGORY_COLORS: Record<string, { bg: string; color: string }> = {
  "Цех гель 1": { bg: "#EEF2FF", color: "#4338CA" },
  "Цех гель 2": { bg: "#F0FDF4", color: "#15803D" },
  "ПЭТ":        { bg: "#FFF7ED", color: "#C2410C" },
  "ПП":         { bg: "#FDF4FF", color: "#7E22CE" },
  "ПЭ":         { bg: "#F0F9FF", color: "#0369A1" },
  "Формовка":   { bg: "#FFF1F2", color: "#BE123C" },
  "Соль":       { bg: "#F0FDFA", color: "#0F766E" },
  "Химикаты":   { bg: "#FFFBEB", color: "#B45309" },
  "Прочие":     { bg: "#F9FAFB", color: "#374151" },
};

export default function ClientProductsPage() {
  const { t, lang } = useLang();
  const [products, setProducts] = useState<any[]>([]);
  const [search, setSearch] = useState("");
  const [activeCategory, setActiveCategory] = useState("Все");
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState<"grid" | "table">("grid");

  useEffect(() => { loadProducts(); }, []);

  async function loadProducts() {
    setLoading(true);
    const { data } = await supabase.from("products").select("*").order("name");
    setProducts(data || []);
    setLoading(false);
  }

  const filtered = useMemo(() => products.filter(p => {
    const matchSearch = p.name?.toLowerCase().includes(search.toLowerCase()) ||
                        (p.product_code || "").toLowerCase().includes(search.toLowerCase());
    const matchCat = activeCategory === "Все" || p.category === activeCategory;
    return matchSearch && matchCat;
  }), [products, search, activeCategory]);

  // Group by category for grid view
  const grouped = useMemo(() => {
    return filtered.reduce((acc: any, p: any) => {
      const cat = p.category || "Прочие";
      if (!acc[cat]) acc[cat] = [];
      acc[cat].push(p);
      return acc;
    }, {});
  }, [filtered]);

  const labels: Record<string, string> = {
    "Все": lang === "uz" ? "Barchasi" : "Все",
    "Цех гель 1": lang === "uz" ? "Gel sex 1" : "Цех гель 1",
    "Цех гель 2": lang === "uz" ? "Gel sex 2" : "Цех гель 2",
    "ПЭТ": "ПЭТ", "ПП": "ПП", "ПЭ": "ПЭ",
    "Формовка": lang === "uz" ? "Formovka" : "Формовка",
    "Соль": lang === "uz" ? "Tuz" : "Соль",
    "Химикаты": lang === "uz" ? "Kimyoviy moddalar" : "Химикаты",
    "Прочие": lang === "uz" ? "Boshqalar" : "Прочие",
  };

  return (
    <ClientShell>
      {/* HEADER */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 24 }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 700, color: "#111827", margin: 0 }}>
            {lang === "uz" ? "Mahsulotlar katalogi" : "Каталог товаров"}
          </h1>
          <p style={{ fontSize: 13, color: "#6B7280", marginTop: 4 }}>
            {loading ? t.loading : `${products.length} ${lang === "uz" ? "ta mahsulot" : "товаров"}`}
          </p>
        </div>
        {/* View switcher */}
        <div style={{ display: "flex", gap: 4, background: "#F3F4F6", borderRadius: 10, padding: 3 }}>
          {[
            { key: "grid",  icon: "⊞", label: lang === "uz" ? "Kartalar" : "Карточки" },
            { key: "table", icon: "☰", label: lang === "uz" ? "Jadval"   : "Таблица"  },
          ].map(v => (
            <button key={v.key} onClick={() => setView(v.key as any)}
              style={{ padding: "7px 14px", borderRadius: 8, border: "none", background: view === v.key ? "#fff" : "transparent", color: view === v.key ? "#111827" : "#9CA3AF", fontSize: 13, fontWeight: view === v.key ? 700 : 400, cursor: "pointer", boxShadow: view === v.key ? "0 1px 3px rgba(0,0,0,0.1)" : "none" }}>
              {v.icon} {v.label}
            </button>
          ))}
        </div>
      </div>

      {/* SEARCH */}
      <div style={{ marginBottom: 16 }}>
        <input
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder={lang === "uz" ? "Mahsulot nomi yoki kodi bo'yicha qidirish..." : "Поиск по названию или коду..."}
          style={{ width: "100%", boxSizing: "border-box", padding: "11px 16px", border: "1.5px solid #E5E7EB", borderRadius: 10, fontSize: 14, outline: "none", background: "#FAFAFA" }}
        />
      </div>

      {/* CATEGORY FILTER */}
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 24 }}>
        {CATEGORIES.map(cat => {
          const isActive = activeCategory === cat;
          const count = cat === "Все" ? products.length : products.filter(p => p.category === cat).length;
          if (count === 0 && cat !== "Все") return null;
          return (
            <button key={cat} onClick={() => setActiveCategory(cat)}
              style={{ padding: "6px 14px", borderRadius: 999, border: "1.5px solid", fontSize: 13, cursor: "pointer", fontWeight: isActive ? 700 : 400, background: isActive ? "#4F46E5" : "#fff", color: isActive ? "#fff" : "#374151", borderColor: isActive ? "#4F46E5" : "#E5E7EB", transition: "all 0.15s" }}>
              {labels[cat] || cat} ({count})
            </button>
          );
        })}
      </div>

      {loading ? (
        <div style={{ color: "#9CA3AF", padding: 40, textAlign: "center" }}>{t.loading}</div>
      ) : filtered.length === 0 ? (
        <div style={{ background: "#fff", border: "1px solid #E5E7EB", borderRadius: 14, padding: 60, textAlign: "center" }}>
          <div style={{ fontSize: 48, marginBottom: 12 }}>🔍</div>
          <div style={{ color: "#9CA3AF", fontSize: 14 }}>{lang === "uz" ? "Mahsulot topilmadi" : "Товары не найдены"}</div>
        </div>
      ) : view === "grid" ? (

        /* ─── GRID VIEW ─────────────────────────────────────────── */
        <div>
          {Object.entries(grouped).map(([cat, prods]: any) => {
            const catColors = CATEGORY_COLORS[cat] || CATEGORY_COLORS["Прочие"];
            return (
              <div key={cat} style={{ marginBottom: 28 }}>
                {/* Category header */}
                <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 14 }}>
                  <span style={{ padding: "5px 14px", borderRadius: 999, fontSize: 12, fontWeight: 700, background: catColors.bg, color: catColors.color }}>
                    🏭 {labels[cat] || cat}
                  </span>
                  <span style={{ fontSize: 12, color: "#9CA3AF" }}>{prods.length} {lang === "uz" ? "ta" : "шт."}</span>
                  <div style={{ flex: 1, height: 1, background: "#E5E7EB" }} />
                </div>

                {/* Cards */}
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))", gap: 14 }}>
                  {prods.map((p: any) => (
                    <div key={p.id}
                      style={{ background: "#fff", border: "1px solid #E5E7EB", borderRadius: 14, overflow: "hidden", transition: "box-shadow 0.2s, transform 0.2s", cursor: "default" }}
                      onMouseEnter={e => { (e.currentTarget as HTMLDivElement).style.boxShadow = "0 8px 24px rgba(0,0,0,0.1)"; (e.currentTarget as HTMLDivElement).style.transform = "translateY(-2px)"; }}
                      onMouseLeave={e => { (e.currentTarget as HTMLDivElement).style.boxShadow = "none"; (e.currentTarget as HTMLDivElement).style.transform = "translateY(0)"; }}>

                      {/* Image */}
                      <div style={{ height: 120, background: catColors.bg, display: "flex", alignItems: "center", justifyContent: "center", position: "relative" }}>
                        {p.image_url ? (
                          <img src={p.image_url} alt={p.name} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                        ) : (
                          <span style={{ fontSize: 48 }}>📦</span>
                        )}
                        {/* Code badge */}
                        {p.product_code && (
                          <span style={{ position: "absolute", top: 8, right: 8, fontFamily: "monospace", fontSize: 10, background: "rgba(0,0,0,0.6)", color: "#fff", padding: "2px 6px", borderRadius: 4 }}>
                            {p.product_code}
                          </span>
                        )}
                      </div>

                      {/* Info */}
                      <div style={{ padding: "12px 14px" }}>
                        <div style={{ fontWeight: 700, fontSize: 13, color: "#111827", marginBottom: 4, lineHeight: 1.3 }}>{p.name}</div>
                        {p.description && (
                          <div style={{ fontSize: 11, color: "#9CA3AF", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{p.description}</div>
                        )}
                        <div style={{ marginTop: 8 }}>
                          <span style={{ padding: "3px 10px", borderRadius: 999, fontSize: 10, fontWeight: 600, background: catColors.bg, color: catColors.color }}>
                            {labels[p.category] || p.category || "-"}
                          </span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>

      ) : (

        /* ─── TABLE VIEW ────────────────────────────────────────── */
        <div style={{ background: "#fff", border: "1px solid #E5E7EB", borderRadius: 14, overflow: "hidden" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
            <thead>
              <tr style={{ background: "#F9FAFB", borderBottom: "1px solid #E5E7EB" }}>
                <th style={th}>{lang === "uz" ? "Mahsulot" : "Товар"}</th>
                <th style={th}>{lang === "uz" ? "Kod" : "Код"}</th>
                <th style={th}>{lang === "uz" ? "Kategoriya" : "Категория"}</th>
                <th style={th}>{lang === "uz" ? "Tavsif" : "Описание"}</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((p: any) => {
                const catColors = CATEGORY_COLORS[p.category] || CATEGORY_COLORS["Прочие"];
                return (
                  <tr key={p.id} style={{ borderBottom: "1px solid #F3F4F6" }}>
                    <td style={{ padding: "12px 16px" }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                        <div style={{ width: 40, height: 40, borderRadius: 10, background: catColors.bg, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, overflow: "hidden" }}>
                          {p.image_url ? (
                            <img src={p.image_url} alt={p.name} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                          ) : (
                            <span style={{ fontSize: 18 }}>📦</span>
                          )}
                        </div>
                        <span style={{ fontWeight: 600, color: "#111827" }}>{p.name}</span>
                      </div>
                    </td>
                    <td style={{ padding: "12px 16px" }}>
                      <span style={{ fontFamily: "monospace", fontSize: 11, background: "#F3F4F6", padding: "3px 8px", borderRadius: 6, color: "#374151" }}>
                        {p.product_code || "-"}
                      </span>
                    </td>
                    <td style={{ padding: "12px 16px" }}>
                      <span style={{ padding: "4px 12px", borderRadius: 999, fontSize: 11, fontWeight: 600, background: catColors.bg, color: catColors.color }}>
                        {labels[p.category] || p.category || "-"}
                      </span>
                    </td>
                    <td style={{ padding: "12px 16px", color: "#6B7280", maxWidth: 250 }}>
                      <span style={{ display: "block", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                        {p.description || "—"}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </ClientShell>
  );
}

const th: React.CSSProperties = { padding: "10px 16px", textAlign: "left", fontSize: 12, fontWeight: 600, color: "#6B7280" };