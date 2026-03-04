"use client";

import { useEffect, useState, useMemo } from "react";
import { supabase } from "@/lib/supabase";
import { useRouter } from "next/navigation";
import AddProductModal from "./AddProductModal";
import { Package, Layers, Plus, Pencil, Trash2, ExternalLink, Search } from "lucide-react";

const CATEGORIES = [
  "Все","Цех гель 1","Цех гель 2","ПЭТ","ПП","ПЭ",
  "Формовка","Соль","Химикаты","Прочие"
];

const CATEGORY_COLORS: Record<string, { bg: string; color: string }> = {
  "Цех гель 1": { bg: "#EEF2FF", color: "#4338CA" },
  "Цех гель 2": { bg: "#F0FDF4", color: "#15803D" },
  "ПЭТ": { bg: "#FFF7ED", color: "#C2410C" },
  "ПП": { bg: "#FDF4FF", color: "#7E22CE" },
  "ПЭ": { bg: "#F0F9FF", color: "#0369A1" },
  "Формовка": { bg: "#FFF1F2", color: "#BE123C" },
  "Соль": { bg: "#F0FDFA", color: "#0F766E" },
  "Химикаты": { bg: "#FFFBEB", color: "#B45309" },
  "Прочие": { bg: "#F9FAFB", color: "#374151" },
};

function formatPrice(price: number) {
  return new Intl.NumberFormat("uz-UZ").format(price) + " сум";
}

export default function ProductsPage() {
  const router = useRouter();
  const [products, setProducts] = useState<any[]>([]);
  const [variantCounts, setVariantCounts] = useState<Record<string, number>>({});
  const [search, setSearch] = useState("");
  const [activeCategory, setActiveCategory] = useState("Все");
  const [modalOpen, setModalOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<any | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => { loadProducts(); }, []);

  async function loadProducts() {
    setLoading(true);
    const { data, error } = await supabase.from("products").select("*").order("name");
    if (error) console.error(error);
    const prods = data || [];
    setProducts(prods);

    if (prods.length > 0) {
      const ids = prods.map((p: any) => p.id);
      const { data: variants } = await supabase
        .from("product_variants")
        .select("product_id")
        .in("product_id", ids)
        .eq("is_active", true);
      if (variants) {
        const counts: Record<string, number> = {};
        variants.forEach((v: any) => {
          counts[v.product_id] = (counts[v.product_id] || 0) + 1;
        });
        setVariantCounts(counts);
      }
    }

    setLoading(false);
  }

  async function deleteProduct(id: string) {
    if (!confirm("Удалить товар и все его варианты?")) return;
    setDeletingId(id);
    await supabase.from("products").delete().eq("id", id);
    await loadProducts();
    setDeletingId(null);
  }

  const filtered = useMemo(() => products.filter(p => {
    const matchSearch = p.name?.toLowerCase().includes(search.toLowerCase());
    const matchCat = activeCategory === "Все" || p.category === activeCategory;
    return matchSearch && matchCat;
  }), [products, search, activeCategory]);

  return (
    <div style={{ padding: 32 }}>

      <AddProductModal
        open={modalOpen}
        onClose={() => { setModalOpen(false); setEditingProduct(null); }}
        onSaved={loadProducts}
        editingProduct={editingProduct}
      />

      {/* HEADER */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <div style={{ width: 40, height: 40, background: "#EEF2FF", borderRadius: 10, display: "flex", alignItems: "center", justifyContent: "center" }}>
            <Package size={20} color="#4F46E5" />
          </div>
          <div>
            <h1 style={{ fontSize: 22, fontWeight: 700, color: "#111827", margin: 0 }}>Products</h1>
            <p style={{ fontSize: 12, color: "#9CA3AF", marginTop: 2 }}>
              {loading ? "Загрузка..." : `${products.length} товаров всего`}
            </p>
          </div>
        </div>
        <div style={{ display: "flex", gap: 10 }}>
          <div style={{ position: "relative" }}>
            <Search size={13} color="#9CA3AF" style={{ position: "absolute", left: 11, top: "50%", transform: "translateY(-50%)" }} />
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Поиск товара..."
              style={{ paddingLeft: 32, padding: "10px 14px 10px 32px", border: "1px solid #E5E7EB", borderRadius: 8, fontSize: 13, outline: "none", width: 220 }}
            />
          </div>
          <button
            onClick={() => { setEditingProduct(null); setModalOpen(true); }}
            style={{ display: "flex", alignItems: "center", gap: 6, background: "#4F46E5", color: "#fff", border: "none", borderRadius: 8, padding: "10px 18px", fontSize: 13, fontWeight: 600, cursor: "pointer" }}
          >
            <Plus size={15} /> Add Product
          </button>
        </div>
      </div>

      {/* CATEGORY FILTER */}
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 24 }}>
        {CATEGORIES.map(cat => {
          const isActive = activeCategory === cat;
          const count = cat === "Все" ? products.length : products.filter(p => p.category === cat).length;
          return (
            <button key={cat} onClick={() => setActiveCategory(cat)} style={{
              padding: "6px 14px", borderRadius: "999px", border: "1.5px solid",
              background: isActive ? "#4F46E5" : "#fff",
              color: isActive ? "#fff" : "#374151",
              borderColor: isActive ? "#4F46E5" : "#E5E7EB",
              cursor: "pointer", fontSize: 13,
            }}>
              {cat} ({count})
            </button>
          );
        })}
      </div>

      {/* TABLE */}
      {loading ? (
        <div style={{ color: "#9CA3AF", padding: 40 }}>Загрузка...</div>
      ) : (
        <div style={{ background: "#fff", border: "1px solid #E5E7EB", borderRadius: 12, overflow: "hidden" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
            <thead>
              <tr style={{ background: "#F9FAFB", borderBottom: "1px solid #E5E7EB" }}>
                <th style={th}>Товар</th>
                <th style={th}>Код</th>
                <th style={th}>Цех / Категория</th>
                <th style={th}>Варианты</th>
                <th style={th}>Цена</th>
                <th style={th}>Описание</th>
                <th style={th}></th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={7} style={{ textAlign: "center", padding: 40, color: "#9CA3AF" }}>
                    Товары не найдены
                  </td>
                </tr>
              ) : filtered.map((p) => {
                const catColors = CATEGORY_COLORS[p.category] || CATEGORY_COLORS["Прочие"];
                const varCount = variantCounts[p.id] || 0;
                return (
                  <tr
                    key={p.id}
                    style={{ borderBottom: "1px solid #F3F4F6", cursor: "pointer" }}
                    onClick={() => router.push(`/products/${p.id}`)}
                    onMouseEnter={(e) => (e.currentTarget.style.background = "#F9FAFB")}
                    onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
                  >
                    {/* ФОТО + НАЗВАНИЕ */}
                    <td style={{ padding: "12px 16px" }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                        <div style={{
                          width: 44, height: 44, borderRadius: 9, background: "#F3F4F6",
                          display: "flex", alignItems: "center", justifyContent: "center",
                          flexShrink: 0, overflow: "hidden"
                        }}>
                          {p.image_url
                            ? <img src={p.image_url} alt={p.name} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                            : <Package size={18} color="#9CA3AF" />
                          }
                        </div>
                        <span style={{ fontWeight: 600, color: "#111827" }}>{p.name}</span>
                      </div>
                    </td>

                    {/* КОД */}
                    <td style={{ padding: "12px 16px" }}>
                      <span style={{ fontFamily: "monospace", fontSize: 11, background: "#F3F4F6", padding: "3px 8px", borderRadius: 5, color: "#6B7280" }}>
                        {p.product_code || "—"}
                      </span>
                    </td>

                    {/* КАТЕГОРИЯ */}
                    <td style={{ padding: "12px 16px" }}>
                      <span style={{
                        background: catColors.bg, color: catColors.color,
                        padding: "3px 10px", borderRadius: 5,
                        fontSize: 11, fontWeight: 600
                      }}>
                        {p.category || "—"}
                      </span>
                    </td>

                    {/* ВАРИАНТЫ */}
                    <td style={{ padding: "12px 16px" }}>
                      {varCount > 0 ? (
                        <span style={{
                          display: "inline-flex", alignItems: "center", gap: 5,
                          background: "#F0FDF4", color: "#15803D",
                          padding: "3px 10px", borderRadius: 5, fontSize: 11, fontWeight: 600
                        }}>
                          <Layers size={11} /> {varCount} вар.
                        </span>
                      ) : (
                        <span style={{ color: "#D1D5DB", fontSize: 12 }}>—</span>
                      )}
                    </td>

                    {/* ЦЕНА */}
                    <td style={{ padding: "12px 16px", fontWeight: 700, color: "#111827" }}>
                      {p.price != null ? formatPrice(p.price) : (
                        <span style={{ color: "#9CA3AF", fontWeight: 400 }}>Не указана</span>
                      )}
                    </td>

                    {/* ОПИСАНИЕ */}
                    <td style={{ padding: "12px 16px", color: "#6B7280", maxWidth: 200 }}>
                      <span style={{ display: "block", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                        {p.description || "—"}
                      </span>
                    </td>

                    {/* КНОПКИ */}
                    <td style={{ padding: "12px 16px" }}>
                      <div style={{ display: "flex", gap: 6 }} onClick={(e) => e.stopPropagation()}>
                        <button
                          onClick={() => { setEditingProduct(p); setModalOpen(true); }}
                          style={{ display: "inline-flex", alignItems: "center", gap: 5, background: "#EEF2FF", color: "#4F46E5", border: "none", borderRadius: 7, padding: "6px 11px", fontSize: 12, fontWeight: 600, cursor: "pointer" }}
                        >
                          <Pencil size={12} /> Edit
                        </button>
                        <button
                          onClick={() => deleteProduct(p.id)}
                          disabled={deletingId === p.id}
                          style={{ display: "inline-flex", alignItems: "center", gap: 5, background: "#FEF2F2", color: "#EF4444", border: "none", borderRadius: 7, padding: "6px 11px", fontSize: 12, fontWeight: 600, cursor: "pointer", opacity: deletingId === p.id ? 0.5 : 1 }}
                        >
                          <Trash2 size={12} /> Delete
                        </button>
                        <button
                          onClick={() => router.push(`/products/${p.id}`)}
                          style={{ display: "inline-flex", alignItems: "center", gap: 5, background: "#F3F4F6", color: "#374151", border: "none", borderRadius: 7, padding: "6px 11px", fontSize: 12, fontWeight: 600, cursor: "pointer" }}
                        >
                          <ExternalLink size={12} /> Открыть
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

const th: React.CSSProperties = { padding: "10px 16px", textAlign: "left", fontSize: 12, fontWeight: 600, color: "#6B7280" };