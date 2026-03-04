"use client";

import { useEffect, useState, useMemo } from "react";
import { supabase } from "@/lib/supabase";
import {
  Warehouse, Package, ArrowDownToLine, ArrowUpFromLine,
  AlertTriangle, Ban, TrendingUp, TrendingDown, DollarSign,
  ChevronDown, ChevronRight, Search, RefreshCw,
  BarChart2, List, Clock, Tag, Layers
} from "lucide-react";

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
  return new Intl.NumberFormat("uz-UZ").format(Math.round(price)) + " сум";
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleString("ru-RU", {
    day: "2-digit", month: "2-digit", year: "2-digit",
    hour: "2-digit", minute: "2-digit",
  });
}

interface StockItem {
  variant_id: string;
  product_id: string;
  product_name: string;
  product_code: string;
  product_image: string | null;
  category: string;
  sku: string;
  attributes: Record<string, string>;
  price: number | null;
  stock_quantity: number;
  min_stock: number;
}

interface Movement {
  id: string;
  variant_id: string | null;
  product_id: string;
  product_name: string;
  sku: string;
  attributes: Record<string, string>;
  delta: number;
  note: string | null;
  created_at: string;
  qty_before: number;
  qty_after: number;
}

type Tab = "stock" | "movements" | "analytics";

export default function WarehousePage() {
  const [items, setItems] = useState<StockItem[]>([]);
  const [movements, setMovements] = useState<Movement[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<Tab>("stock");
  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("Все");
  const [stockFilter, setStockFilter] = useState<"all" | "low" | "out">("all");
  const [expandedProducts, setExpandedProducts] = useState<Set<string>>(new Set());

  const [adjustItem, setAdjustItem] = useState<StockItem | null>(null);
  const [adjustDelta, setAdjustDelta] = useState("");
  const [adjustNote, setAdjustNote] = useState("");
  const [adjustType, setAdjustType] = useState<"in" | "out">("in");
  const [adjusting, setAdjusting] = useState(false);
  const [saveMsg, setSaveMsg] = useState<{ text: string; type: "in" | "out" } | null>(null);

  const [minStockItem, setMinStockItem] = useState<StockItem | null>(null);
  const [minStockValue, setMinStockValue] = useState("");

  useEffect(() => { loadAll(); }, []);

  async function loadAll() {
    setLoading(true);
    await Promise.all([loadStock(), loadMovements()]);
    setLoading(false);
  }

  async function loadStock() {
    const { data: products } = await supabase.from("products").select("*").order("name");
    const { data: variants } = await supabase.from("product_variants").select("*").eq("is_active", true);
    if (!products) return;
    const result: StockItem[] = [];
    for (const p of products) {
      const pvs = (variants || []).filter((v: any) => v.product_id === p.id);
      if (pvs.length === 0) {
        result.push({
          variant_id: `product-${p.id}`, product_id: p.id,
          product_name: p.name, product_code: p.product_code || "",
          product_image: p.image_url, category: p.category || "Прочие",
          sku: p.product_code || "", attributes: {},
          price: p.price, stock_quantity: 0, min_stock: p.min_stock || 0,
        });
      } else {
        pvs.forEach((v: any) => result.push({
          variant_id: v.id, product_id: p.id,
          product_name: p.name, product_code: p.product_code || "",
          product_image: p.image_url, category: p.category || "Прочие",
          sku: v.sku || "", attributes: v.attributes || {},
          price: v.price ?? p.price, stock_quantity: v.stock_quantity || 0,
          min_stock: v.min_stock || 0,
        }));
      }
    }
    setItems(result);
  }

  async function loadMovements() {
    const { data } = await supabase
      .from("stock_movements").select("*")
      .order("created_at", { ascending: false }).limit(300);
    setMovements(data || []);
  }

  async function saveMovement() {
    if (!adjustItem || !adjustDelta) return;
    const delta = parseInt(adjustDelta);
    if (isNaN(delta) || delta <= 0) return;
    setAdjusting(true);
    const realDelta = adjustType === "in" ? delta : -delta;
    const newQty = Math.max(0, adjustItem.stock_quantity + realDelta);
    const isVariant = !adjustItem.variant_id.startsWith("product-");
    if (isVariant) {
      await supabase.from("product_variants").update({ stock_quantity: newQty }).eq("id", adjustItem.variant_id);
    }
    await supabase.from("stock_movements").insert({
      variant_id: isVariant ? adjustItem.variant_id : null,
      product_id: adjustItem.product_id,
      product_name: adjustItem.product_name,
      sku: adjustItem.sku,
      attributes: adjustItem.attributes,
      delta: realDelta,
      note: adjustNote.trim() || null,
      qty_before: adjustItem.stock_quantity,
      qty_after: newQty,
    });
    setAdjusting(false);
    setAdjustItem(null);
    setAdjustDelta("");
    setAdjustNote("");
    setSaveMsg({ text: adjustType === "in" ? `+${delta} шт` : `−${delta} шт`, type: adjustType });
    setTimeout(() => setSaveMsg(null), 3000);
    await loadAll();
  }

  async function saveMinStock() {
    if (!minStockItem) return;
    const val = parseInt(minStockValue);
    if (isNaN(val) || val < 0) return;
    const isVariant = !minStockItem.variant_id.startsWith("product-");
    if (isVariant) {
      await supabase.from("product_variants").update({ min_stock: val }).eq("id", minStockItem.variant_id);
    } else {
      await supabase.from("products").update({ min_stock: val }).eq("id", minStockItem.product_id);
    }
    setMinStockItem(null);
    await loadStock();
  }

  function toggleProduct(id: string) {
    setExpandedProducts(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }

  const grouped = useMemo(() => {
    const filtered = items.filter(item => {
      const matchSearch =
        item.product_name.toLowerCase().includes(search.toLowerCase()) ||
        item.sku.toLowerCase().includes(search.toLowerCase()) ||
        Object.values(item.attributes).some(v => v.toLowerCase().includes(search.toLowerCase()));
      const matchCat = categoryFilter === "Все" || item.category === categoryFilter;
      const matchStock =
        stockFilter === "all" ? true :
        stockFilter === "out" ? item.stock_quantity === 0 :
        item.min_stock > 0 && item.stock_quantity > 0 && item.stock_quantity <= item.min_stock;
      return matchSearch && matchCat && matchStock;
    });
    const map = new Map<string, StockItem[]>();
    filtered.forEach(item => {
      if (!map.has(item.product_id)) map.set(item.product_id, []);
      map.get(item.product_id)!.push(item);
    });
    return map;
  }, [items, search, categoryFilter, stockFilter]);

  const stats = useMemo(() => ({
    totalValue: items.reduce((s, i) => s + (i.price || 0) * i.stock_quantity, 0),
    outOfStock: items.filter(i => i.stock_quantity === 0).length,
    lowStock: items.filter(i => i.min_stock > 0 && i.stock_quantity > 0 && i.stock_quantity <= i.min_stock).length,
    totalIn: movements.filter(m => m.delta > 0).reduce((s, m) => s + m.delta, 0),
    totalOut: movements.filter(m => m.delta < 0).reduce((s, m) => s + Math.abs(m.delta), 0),
  }), [items, movements]);

  const analytics = useMemo(() => {
    const byValue = [...items]
      .filter(i => i.stock_quantity > 0 && i.price)
      .sort((a, b) => (b.price! * b.stock_quantity) - (a.price! * a.stock_quantity))
      .slice(0, 5);
    const moveCounts: Record<string, { name: string; count: number; in: number; out: number }> = {};
    movements.forEach(m => {
      if (!moveCounts[m.product_name]) moveCounts[m.product_name] = { name: m.product_name, count: 0, in: 0, out: 0 };
      moveCounts[m.product_name].count += Math.abs(m.delta);
      if (m.delta > 0) moveCounts[m.product_name].in += m.delta;
      else moveCounts[m.product_name].out += Math.abs(m.delta);
    });
    const topMoved = Object.values(moveCounts).sort((a, b) => b.count - a.count).slice(0, 5);
    const catStock: Record<string, number> = {};
    const catValue: Record<string, number> = {};
    items.forEach(i => {
      catStock[i.category] = (catStock[i.category] || 0) + i.stock_quantity;
      catValue[i.category] = (catValue[i.category] || 0) + (i.price || 0) * i.stock_quantity;
    });
    return { byValue, topMoved, catStock, catValue };
  }, [items, movements]);

  const categories = ["Все", ...Array.from(new Set(items.map(i => i.category)))];
  const warnings = items.filter(i => i.min_stock > 0 && i.stock_quantity <= i.min_stock);

  const inp: React.CSSProperties = {
    padding: "9px 14px", border: "1.5px solid #E5E7EB", borderRadius: 8,
    fontSize: 13, outline: "none", background: "#fff", color: "#111827", boxSizing: "border-box",
  };

  // Button style helpers
  const btnIn: React.CSSProperties = {
    display: "inline-flex", alignItems: "center", gap: 5,
    padding: "6px 12px", border: "1px solid #D1FAE5", borderRadius: 7,
    background: "#F0FDF4", fontSize: 12, fontWeight: 600, cursor: "pointer", color: "#15803D",
  };
  const btnOut: React.CSSProperties = {
    display: "inline-flex", alignItems: "center", gap: 5,
    padding: "6px 12px", border: "1px solid #FECACA", borderRadius: 7,
    background: "#FEF2F2", fontSize: 12, fontWeight: 600, cursor: "pointer", color: "#DC2626",
  };
  const btnWarn: React.CSSProperties = {
    display: "inline-flex", alignItems: "center", justifyContent: "center",
    width: 30, height: 30, border: "1px solid #FDE68A", borderRadius: 7,
    background: "#FFFBEB", cursor: "pointer", color: "#D97706",
  };

  return (
    <div style={{ padding: 32, maxWidth: 1400 }}>

      {/* ── MOVEMENT MODAL ── */}
      {adjustItem && (
        <>
          <div onClick={() => setAdjustItem(null)} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.4)", backdropFilter: "blur(3px)", zIndex: 50 }} />
          <div style={{ position: "fixed", top: "50%", left: "50%", transform: "translate(-50%,-50%)", zIndex: 51, width: 420, background: "#fff", borderRadius: 14, boxShadow: "0 20px 50px rgba(0,0,0,0.18)", padding: 28 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 4 }}>
              <Package size={18} color="#6B7280" />
              <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: "#111827" }}>Движение товара</h3>
            </div>
            <p style={{ margin: "4px 0 20px", fontSize: 13, color: "#6B7280", paddingLeft: 28 }}>
              {adjustItem.product_name}
              {Object.keys(adjustItem.attributes).length > 0 && (
                <span style={{ color: "#4F46E5", marginLeft: 6 }}>· {Object.values(adjustItem.attributes).join(" / ")}</span>
              )}
            </p>

            {/* IN / OUT */}
            <div style={{ display: "flex", gap: 8, marginBottom: 20 }}>
              {(["in", "out"] as const).map(t => (
                <button key={t} onClick={() => setAdjustType(t)} style={{
                  flex: 1, padding: "10px", border: "1.5px solid",
                  borderColor: adjustType === t ? (t === "in" ? "#16A34A" : "#DC2626") : "#E5E7EB",
                  borderRadius: 8,
                  background: adjustType === t ? (t === "in" ? "#F0FDF4" : "#FEF2F2") : "#F9FAFB",
                  color: adjustType === t ? (t === "in" ? "#15803D" : "#DC2626") : "#9CA3AF",
                  fontSize: 13, fontWeight: 600, cursor: "pointer",
                  display: "flex", alignItems: "center", justifyContent: "center", gap: 7,
                }}>
                  {t === "in"
                    ? <><ArrowDownToLine size={15} /> Приход</>
                    : <><ArrowUpFromLine size={15} /> Расход</>}
                </button>
              ))}
            </div>

            {/* Qty */}
            <div style={{ marginBottom: 12 }}>
              <div style={{ fontSize: 12, fontWeight: 600, color: "#374151", marginBottom: 6 }}>Количество (шт)</div>
              <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                <button onClick={() => setAdjustDelta(v => String(Math.max(1, (parseInt(v) || 1) - 1)))} style={{ width: 40, height: 40, border: "1.5px solid #E5E7EB", borderRadius: 8, background: "#F9FAFB", fontSize: 20, cursor: "pointer", fontWeight: 700, color: "#374151" }}>−</button>
                <input type="number" min="1" value={adjustDelta} onChange={e => setAdjustDelta(e.target.value)} placeholder="0"
                  style={{ ...inp, flex: 1, textAlign: "center", fontSize: 22, fontWeight: 800 }} />
                <button onClick={() => setAdjustDelta(v => String((parseInt(v) || 0) + 1))} style={{ width: 40, height: 40, border: "1.5px solid #E5E7EB", borderRadius: 8, background: "#F9FAFB", fontSize: 20, cursor: "pointer", fontWeight: 700, color: "#374151" }}>+</button>
              </div>
            </div>

            {/* Preview */}
            <div style={{ padding: "10px 14px", background: "#F9FAFB", borderRadius: 8, fontSize: 13, marginBottom: 14, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <span style={{ color: "#6B7280" }}>Сейчас: <strong style={{ color: "#111827" }}>{adjustItem.stock_quantity} шт</strong></span>
              <span style={{ color: adjustType === "in" ? "#15803D" : "#DC2626", fontWeight: 700, fontSize: 14 }}>
                → {Math.max(0, adjustItem.stock_quantity + (adjustType === "in" ? 1 : -1) * (parseInt(adjustDelta) || 0))} шт
              </span>
            </div>

            <input value={adjustNote} onChange={e => setAdjustNote(e.target.value)} placeholder="Примечание (поставщик, причина...)"
              style={{ ...inp, width: "100%", marginBottom: 16 }} />

            <div style={{ display: "flex", gap: 8 }}>
              <button onClick={() => setAdjustItem(null)} style={{ flex: 1, padding: 10, border: "1.5px solid #E5E7EB", borderRadius: 8, background: "transparent", fontSize: 13, fontWeight: 600, color: "#374151", cursor: "pointer" }}>Отмена</button>
              <button onClick={saveMovement} disabled={adjusting || !adjustDelta} style={{
                flex: 2, padding: 10, border: "none", borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: "pointer",
                background: !adjustDelta || adjusting ? "#9CA3AF" : adjustType === "in" ? "#16A34A" : "#DC2626",
                color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", gap: 7,
              }}>
                {adjusting ? <><RefreshCw size={14} /> Сохраняем...</> :
                  adjustType === "in"
                    ? <><ArrowDownToLine size={14} /> Приход +{adjustDelta || 0} шт</>
                    : <><ArrowUpFromLine size={14} /> Расход −{adjustDelta || 0} шт</>}
              </button>
            </div>
          </div>
        </>
      )}

      {/* ── MIN STOCK MODAL ── */}
      {minStockItem && (
        <>
          <div onClick={() => setMinStockItem(null)} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.4)", backdropFilter: "blur(3px)", zIndex: 50 }} />
          <div style={{ position: "fixed", top: "50%", left: "50%", transform: "translate(-50%,-50%)", zIndex: 51, width: 360, background: "#fff", borderRadius: 14, boxShadow: "0 20px 50px rgba(0,0,0,0.18)", padding: 28 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 4 }}>
              <AlertTriangle size={17} color="#D97706" />
              <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700 }}>Минимальный остаток</h3>
            </div>
            <p style={{ margin: "4px 0 16px", fontSize: 13, color: "#6B7280", paddingLeft: 27 }}>{minStockItem.product_name}</p>
            <div style={{ fontSize: 12, fontWeight: 600, color: "#374151", marginBottom: 6 }}>Порог предупреждения (шт)</div>
            <input type="number" min="0" value={minStockValue} onChange={e => setMinStockValue(e.target.value)}
              style={{ ...inp, width: "100%", fontSize: 20, fontWeight: 700, textAlign: "center", marginBottom: 16 }} />
            <div style={{ display: "flex", gap: 8 }}>
              <button onClick={() => setMinStockItem(null)} style={{ flex: 1, padding: 10, border: "1.5px solid #E5E7EB", borderRadius: 8, background: "transparent", fontSize: 13, fontWeight: 600, color: "#374151", cursor: "pointer" }}>Отмена</button>
              <button onClick={saveMinStock} style={{ flex: 2, padding: 10, border: "none", borderRadius: 8, background: "#D97706", color: "#fff", fontSize: 13, fontWeight: 600, cursor: "pointer" }}>Сохранить</button>
            </div>
          </div>
        </>
      )}

      {/* ── HEADER ── */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 24 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <div style={{ width: 40, height: 40, background: "#EEF2FF", borderRadius: 10, display: "flex", alignItems: "center", justifyContent: "center" }}>
            <Warehouse size={20} color="#4F46E5" />
          </div>
          <div>
            <h1 style={{ fontSize: 22, fontWeight: 700, color: "#111827", margin: 0 }}>Склад</h1>
            <p style={{ fontSize: 12, color: "#9CA3AF", marginTop: 2 }}>
              {loading ? "Загрузка..." : `${items.length} позиций · ${new Set(items.map(i => i.product_id)).size} товаров`}
            </p>
          </div>
        </div>
        {saveMsg && (
          <div style={{
            display: "flex", alignItems: "center", gap: 7,
            padding: "8px 14px",
            background: saveMsg.type === "in" ? "#F0FDF4" : "#FEF2F2",
            color: saveMsg.type === "in" ? "#15803D" : "#DC2626",
            borderRadius: 8, fontSize: 13, fontWeight: 600,
            border: `1px solid ${saveMsg.type === "in" ? "#D1FAE5" : "#FECACA"}`,
          }}>
            {saveMsg.type === "in" ? <ArrowDownToLine size={14} /> : <ArrowUpFromLine size={14} />}
            {saveMsg.text}
          </div>
        )}
      </div>

      {/* ── STATS ── */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: 14, marginBottom: 24 }}>
        {[
          { label: "Стоимость склада", value: formatPrice(stats.totalValue), Icon: DollarSign, color: "#15803D", bg: "#F0FDF4", iconBg: "#DCFCE7" },
          { label: "Нет в наличии", value: stats.outOfStock, Icon: Ban, color: "#DC2626", bg: "#FEF2F2", iconBg: "#FEE2E2" },
          { label: "Мало (ниже мин.)", value: stats.lowStock, Icon: AlertTriangle, color: "#D97706", bg: "#FFFBEB", iconBg: "#FEF3C7" },
          { label: "Всего приход", value: `+${stats.totalIn} шт`, Icon: ArrowDownToLine, color: "#0369A1", bg: "#F0F9FF", iconBg: "#E0F2FE" },
          { label: "Всего расход", value: `-${stats.totalOut} шт`, Icon: ArrowUpFromLine, color: "#7E22CE", bg: "#FDF4FF", iconBg: "#F3E8FF" },
        ].map(s => (
          <div key={s.label} style={{ background: "#fff", border: "1px solid #E5E7EB", borderRadius: 12, padding: "16px 18px", display: "flex", alignItems: "center", gap: 12 }}>
            <div style={{ width: 38, height: 38, background: s.iconBg, borderRadius: 9, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
              <s.Icon size={17} color={s.color} />
            </div>
            <div>
              <div style={{ fontSize: 16, fontWeight: 800, color: s.color }}>{s.value}</div>
              <div style={{ fontSize: 10, color: "#9CA3AF", marginTop: 1 }}>{s.label}</div>
            </div>
          </div>
        ))}
      </div>

      {/* ── WARNINGS ── */}
      {warnings.length > 0 && (
        <div style={{ background: "#FFFBEB", border: "1px solid #FDE68A", borderRadius: 10, padding: "12px 18px", marginBottom: 20, display: "flex", gap: 12, alignItems: "flex-start" }}>
          <AlertTriangle size={18} color="#D97706" style={{ flexShrink: 0, marginTop: 1 }} />
          <div>
            <div style={{ fontWeight: 600, fontSize: 13, color: "#92400E", marginBottom: 6 }}>
              {warnings.length} позиций ниже минимального остатка
            </div>
            <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
              {warnings.slice(0, 8).map(w => (
                <span key={w.variant_id} style={{ background: "#fff", border: "1px solid #FDE68A", padding: "2px 10px", borderRadius: 6, fontSize: 11, color: "#B45309", fontWeight: 500 }}>
                  {w.product_name}{Object.values(w.attributes).length > 0 ? ` · ${Object.values(w.attributes).join("/")}` : ""} — {w.stock_quantity} / {w.min_stock} шт
                </span>
              ))}
              {warnings.length > 8 && <span style={{ fontSize: 11, color: "#9CA3AF" }}>+{warnings.length - 8} ещё</span>}
            </div>
          </div>
        </div>
      )}

      {/* ── TABS ── */}
      <div style={{ display: "flex", gap: 2, marginBottom: 20, background: "#F3F4F6", borderRadius: 10, padding: 4, width: "fit-content" }}>
        {([
          ["stock", List, "Остатки"],
          ["movements", Clock, `Движение${movements.length > 0 ? ` (${movements.length})` : ""}`],
          ["analytics", BarChart2, "Аналитика"],
        ] as [Tab, any, string][]).map(([t, Icon, label]) => (
          <button key={t} onClick={() => setTab(t)} style={{
            padding: "7px 16px", border: "none", borderRadius: 7,
            background: tab === t ? "#fff" : "transparent",
            color: tab === t ? "#111827" : "#6B7280",
            fontSize: 13, fontWeight: tab === t ? 600 : 500, cursor: "pointer",
            display: "flex", alignItems: "center", gap: 6,
            boxShadow: tab === t ? "0 1px 3px rgba(0,0,0,0.08)" : "none",
          }}>
            <Icon size={14} />
            {label}
          </button>
        ))}
      </div>

      {/* ══ TAB: ОСТАТКИ ══ */}
      {tab === "stock" && (
        <>
          <div style={{ display: "flex", gap: 10, marginBottom: 16, flexWrap: "wrap", alignItems: "center" }}>
            {/* Search */}
            <div style={{ position: "relative" }}>
              <Search size={14} color="#9CA3AF" style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)" }} />
              <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Поиск по товару, SKU, характеристикам..."
                style={{ ...inp, paddingLeft: 34, width: 300 }} />
            </div>

            {/* Category */}
            <select value={categoryFilter} onChange={e => setCategoryFilter(e.target.value)} style={{ ...inp, cursor: "pointer" }}>
              {categories.map(c => <option key={c}>{c}</option>)}
            </select>

            {/* Stock filter */}
            <div style={{ display: "flex", gap: 6 }}>
              {([
                ["all", `Все (${items.length})`, null],
                ["low", `Мало (${stats.lowStock})`, AlertTriangle],
                ["out", `Нет (${stats.outOfStock})`, Ban],
              ] as [string, string, any][]).map(([f, label, Icon]) => (
                <button key={f} onClick={() => setStockFilter(f as any)} style={{
                  padding: "7px 13px", borderRadius: 8, border: "1.5px solid",
                  fontSize: 12, fontWeight: 500, cursor: "pointer",
                  display: "flex", alignItems: "center", gap: 5,
                  background: stockFilter === f ? (f === "out" ? "#DC2626" : f === "low" ? "#D97706" : "#4F46E5") : "#fff",
                  color: stockFilter === f ? "#fff" : "#374151",
                  borderColor: stockFilter === f ? "transparent" : "#E5E7EB",
                }}>
                  {Icon && <Icon size={12} />}
                  {label}
                </button>
              ))}
            </div>

            <div style={{ display: "flex", gap: 6, marginLeft: "auto" }}>
              <button onClick={() => setExpandedProducts(new Set(Array.from(grouped.keys())))}
                style={{ ...inp, cursor: "pointer", fontSize: 12, color: "#6B7280", display: "flex", alignItems: "center", gap: 5, padding: "7px 12px" }}>
                <ChevronDown size={13} /> Раскрыть все
              </button>
              <button onClick={() => setExpandedProducts(new Set())}
                style={{ ...inp, cursor: "pointer", fontSize: 12, color: "#6B7280", display: "flex", alignItems: "center", gap: 5, padding: "7px 12px" }}>
                <ChevronRight size={13} /> Свернуть
              </button>
            </div>
          </div>

          {loading ? (
            <div style={{ textAlign: "center", padding: 60, color: "#9CA3AF", display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}>
              <RefreshCw size={16} /> Загрузка...
            </div>
          ) : grouped.size === 0 ? (
            <div style={{ textAlign: "center", padding: 60, color: "#9CA3AF" }}>Ничего не найдено</div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              {Array.from(grouped.entries()).map(([productId, productItems]) => {
                const first = productItems[0];
                const isExpanded = expandedProducts.has(productId);
                const hasVariants = productItems.length > 1 || Object.keys(first.attributes).length > 0;
                const totalStock = productItems.reduce((s, i) => s + i.stock_quantity, 0);
                const totalValue = productItems.reduce((s, i) => s + (i.price || 0) * i.stock_quantity, 0);
                const catColors = CATEGORY_COLORS[first.category] || CATEGORY_COLORS["Прочие"];
                const hasOut = productItems.some(i => i.stock_quantity === 0);
                const hasLow = productItems.some(i => i.min_stock > 0 && i.stock_quantity > 0 && i.stock_quantity <= i.min_stock);

                return (
                  <div key={productId} style={{ background: "#fff", border: "1px solid #E5E7EB", borderRadius: 10, overflow: "hidden" }}>
                    {/* Product row */}
                    <div
                      onClick={() => hasVariants && toggleProduct(productId)}
                      style={{ padding: "12px 18px", display: "flex", alignItems: "center", gap: 14, cursor: hasVariants ? "pointer" : "default", background: isExpanded ? "#FAFAFA" : "#fff", borderBottom: isExpanded ? "1px solid #F3F4F6" : "none" }}
                      onMouseEnter={e => { if (!isExpanded) (e.currentTarget as HTMLDivElement).style.background = "#FAFAFA"; }}
                      onMouseLeave={e => { if (!isExpanded) (e.currentTarget as HTMLDivElement).style.background = "#fff"; }}
                    >
                      {/* Image */}
                      <div style={{ width: 40, height: 40, borderRadius: 8, background: "#F3F4F6", display: "flex", alignItems: "center", justifyContent: "center", overflow: "hidden", flexShrink: 0 }}>
                        {first.product_image
                          ? <img src={first.product_image} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                          : <Package size={18} color="#9CA3AF" />}
                      </div>

                      {/* Name */}
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontWeight: 600, fontSize: 14, color: "#111827" }}>{first.product_name}</div>
                        <div style={{ display: "flex", gap: 6, marginTop: 3, flexWrap: "wrap", alignItems: "center" }}>
                          <span style={{ fontFamily: "monospace", fontSize: 10, background: "#F3F4F6", padding: "1px 6px", borderRadius: 4, color: "#6B7280" }}>{first.product_code}</span>
                          <span style={{ background: catColors.bg, color: catColors.color, padding: "1px 7px", borderRadius: 4, fontSize: 10, fontWeight: 600 }}>{first.category}</span>
                          {hasVariants && (
                            <span style={{ display: "inline-flex", alignItems: "center", gap: 3, background: "#EEF2FF", color: "#4338CA", padding: "1px 7px", borderRadius: 4, fontSize: 10, fontWeight: 600 }}>
                              <Layers size={9} /> {productItems.length} вар.
                            </span>
                          )}
                          {hasOut && (
                            <span style={{ display: "inline-flex", alignItems: "center", gap: 3, background: "#FEF2F2", color: "#DC2626", padding: "1px 7px", borderRadius: 4, fontSize: 10, fontWeight: 600 }}>
                              <Ban size={9} /> Нет
                            </span>
                          )}
                          {hasLow && !hasOut && (
                            <span style={{ display: "inline-flex", alignItems: "center", gap: 3, background: "#FFFBEB", color: "#D97706", padding: "1px 7px", borderRadius: 4, fontSize: 10, fontWeight: 600 }}>
                              <AlertTriangle size={9} /> Мало
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Stock qty */}
                      <div style={{ textAlign: "right", flexShrink: 0, marginRight: 8 }}>
                        <div style={{ fontSize: 17, fontWeight: 800, color: totalStock === 0 ? "#DC2626" : hasLow ? "#D97706" : "#111827" }}>{totalStock} шт</div>
                        {totalValue > 0 && <div style={{ fontSize: 11, color: "#9CA3AF" }}>{formatPrice(totalValue)}</div>}
                      </div>

                      {/* Actions */}
                      {!hasVariants ? (
                        <div style={{ display: "flex", gap: 6 }} onClick={e => e.stopPropagation()}>
                          <button style={btnIn} onClick={() => { setAdjustItem(first); setAdjustType("in"); setAdjustDelta(""); }}>
                            <ArrowDownToLine size={13} /> Приход
                          </button>
                          <button style={btnOut} onClick={() => { setAdjustItem(first); setAdjustType("out"); setAdjustDelta(""); }}>
                            <ArrowUpFromLine size={13} /> Расход
                          </button>
                          <button style={btnWarn} onClick={() => { setMinStockItem(first); setMinStockValue(first.min_stock.toString()); }}>
                            <AlertTriangle size={13} />
                          </button>
                        </div>
                      ) : (
                        <div style={{ color: "#9CA3AF", flexShrink: 0 }}>
                          {isExpanded ? <ChevronDown size={18} /> : <ChevronRight size={18} />}
                        </div>
                      )}
                    </div>

                    {/* Variant rows */}
                    {isExpanded && hasVariants && productItems.map((item, idx) => {
                      const isLow = item.min_stock > 0 && item.stock_quantity <= item.min_stock;
                      const stockColor = item.stock_quantity === 0 ? "#DC2626" : isLow ? "#D97706" : "#15803D";
                      const stockBg = item.stock_quantity === 0 ? "#FEF2F2" : isLow ? "#FFFBEB" : "#F0FDF4";
                      return (
                        <div key={item.variant_id} style={{ padding: "9px 18px 9px 74px", display: "flex", alignItems: "center", gap: 12, borderBottom: idx < productItems.length - 1 ? "1px solid #F9FAFB" : "none", background: "#FAFAFA" }}>
                          <span style={{ fontFamily: "monospace", fontSize: 10, background: "#F3F4F6", padding: "2px 7px", borderRadius: 4, color: "#6B7280", flexShrink: 0 }}>{item.sku || "—"}</span>
                          <div style={{ display: "flex", gap: 5, flex: 1, flexWrap: "wrap" }}>
                            {Object.entries(item.attributes).map(([k, v]) => (
                              <span key={k} style={{ display: "inline-flex", alignItems: "center", gap: 4, background: "#fff", border: "1px solid #E5E7EB", padding: "2px 9px", borderRadius: 5, fontSize: 12, color: "#374151" }}>
                                <span style={{ color: "#9CA3AF", fontSize: 10 }}>{k}</span>
                                <span style={{ color: "#D1D5DB" }}>·</span>
                                {v}
                              </span>
                            ))}
                          </div>
                          {item.price != null && <span style={{ fontSize: 12, color: "#6B7280", flexShrink: 0 }}>{formatPrice(item.price)}</span>}
                          {item.min_stock > 0 && (
                            <span style={{ display: "inline-flex", alignItems: "center", gap: 3, fontSize: 10, color: "#9CA3AF", flexShrink: 0 }}>
                              <AlertTriangle size={9} /> мин: {item.min_stock}
                            </span>
                          )}
                          <div style={{ background: stockBg, color: stockColor, padding: "3px 12px", borderRadius: 6, fontSize: 12, fontWeight: 700, flexShrink: 0, minWidth: 58, textAlign: "center" }}>
                            {item.stock_quantity} шт
                          </div>
                          <div style={{ display: "flex", gap: 5, flexShrink: 0 }}>
                            <button style={{ ...btnIn, padding: "5px 9px" }} onClick={() => { setAdjustItem(item); setAdjustType("in"); setAdjustDelta(""); }}>
                              <ArrowDownToLine size={12} />
                            </button>
                            <button style={{ ...btnOut, padding: "5px 9px" }} onClick={() => { setAdjustItem(item); setAdjustType("out"); setAdjustDelta(""); }}>
                              <ArrowUpFromLine size={12} />
                            </button>
                            <button style={{ ...btnWarn, width: 28, height: 28 }} onClick={() => { setMinStockItem(item); setMinStockValue(item.min_stock.toString()); }}>
                              <AlertTriangle size={12} />
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                );
              })}
            </div>
          )}
        </>
      )}

      {/* ══ TAB: ДВИЖЕНИЕ ══ */}
      {tab === "movements" && (
        <div style={{ background: "#fff", border: "1px solid #E5E7EB", borderRadius: 12, overflow: "hidden" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
            <thead>
              <tr style={{ background: "#F9FAFB", borderBottom: "1px solid #E5E7EB" }}>
                {["Дата", "Товар", "Вариант", "SKU", "Движение", "Было", "Стало", "Примечание"].map(h => (
                  <th key={h} style={{ padding: "10px 14px", textAlign: "left", fontSize: 11, fontWeight: 600, color: "#6B7280", whiteSpace: "nowrap" }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {movements.length === 0 ? (
                <tr><td colSpan={8} style={{ textAlign: "center", padding: 48, color: "#9CA3AF", fontSize: 13 }}>Движений пока нет — сделайте первый приход</td></tr>
              ) : movements.map(m => (
                <tr key={m.id} style={{ borderBottom: "1px solid #F3F4F6" }}
                  onMouseEnter={e => (e.currentTarget.style.background = "#FAFAFA")}
                  onMouseLeave={e => (e.currentTarget.style.background = "transparent")}>
                  <td style={{ padding: "10px 14px", color: "#9CA3AF", whiteSpace: "nowrap", fontSize: 11 }}>{formatDate(m.created_at)}</td>
                  <td style={{ padding: "10px 14px", fontWeight: 600, color: "#111827" }}>{m.product_name}</td>
                  <td style={{ padding: "10px 14px", color: "#6B7280", fontSize: 12 }}>
                    {m.attributes && Object.values(m.attributes).length > 0 ? Object.values(m.attributes).join(" / ") : "—"}
                  </td>
                  <td style={{ padding: "10px 14px" }}>
                    <span style={{ fontFamily: "monospace", fontSize: 10, background: "#F3F4F6", padding: "2px 7px", borderRadius: 4, color: "#6B7280" }}>{m.sku || "—"}</span>
                  </td>
                  <td style={{ padding: "10px 14px" }}>
                    <span style={{ display: "inline-flex", alignItems: "center", gap: 5, padding: "3px 10px", borderRadius: 6, fontWeight: 600, fontSize: 12, background: m.delta > 0 ? "#F0FDF4" : "#FEF2F2", color: m.delta > 0 ? "#15803D" : "#DC2626" }}>
                      {m.delta > 0 ? <ArrowDownToLine size={12} /> : <ArrowUpFromLine size={12} />}
                      {m.delta > 0 ? `+${m.delta}` : m.delta} шт
                    </span>
                  </td>
                  <td style={{ padding: "10px 14px", color: "#9CA3AF", fontSize: 13 }}>{m.qty_before ?? "—"}</td>
                  <td style={{ padding: "10px 14px", fontWeight: 600, fontSize: 13 }}>{m.qty_after ?? "—"}</td>
                  <td style={{ padding: "10px 14px", color: "#6B7280", fontSize: 12, maxWidth: 180 }}>
                    <span style={{ display: "block", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{m.note || "—"}</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* ══ TAB: АНАЛИТИКА ══ */}
      {tab === "analytics" && (
        <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>

          {/* Top by value */}
          <div style={{ background: "#fff", border: "1px solid #E5E7EB", borderRadius: 12, padding: 24 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 18 }}>
              <DollarSign size={16} color="#6B7280" />
              <h3 style={{ margin: 0, fontSize: 14, fontWeight: 700, color: "#111827" }}>Топ-5 по стоимости на складе</h3>
            </div>
            {analytics.byValue.length === 0 ? (
              <p style={{ color: "#9CA3AF", fontSize: 13, margin: 0 }}>Нет данных — добавьте цены и остатки</p>
            ) : analytics.byValue.map((item, i) => {
              const val = (item.price || 0) * item.stock_quantity;
              const maxVal = (analytics.byValue[0].price || 0) * analytics.byValue[0].stock_quantity;
              const pct = maxVal > 0 ? (val / maxVal) * 100 : 0;
              return (
                <div key={item.variant_id} style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 14 }}>
                  <span style={{ fontSize: 12, fontWeight: 700, color: i === 0 ? "#D97706" : "#D1D5DB", width: 20, textAlign: "center" }}>#{i + 1}</span>
                  <div style={{ minWidth: 200 }}>
                    <div style={{ fontSize: 13, fontWeight: 600, color: "#111827" }}>{item.product_name}</div>
                    {Object.values(item.attributes).length > 0 && (
                      <div style={{ fontSize: 11, color: "#9CA3AF" }}>{Object.values(item.attributes).join(" / ")}</div>
                    )}
                  </div>
                  <div style={{ flex: 1, background: "#F3F4F6", borderRadius: 999, height: 6, overflow: "hidden" }}>
                    <div style={{ width: `${pct}%`, height: "100%", background: "#4F46E5", borderRadius: 999 }} />
                  </div>
                  <span style={{ fontSize: 13, fontWeight: 700, color: "#15803D", minWidth: 130, textAlign: "right" }}>{formatPrice(val)}</span>
                  <span style={{ fontSize: 11, color: "#9CA3AF", minWidth: 48, textAlign: "right" }}>{item.stock_quantity} шт</span>
                </div>
              );
            })}
          </div>

          {/* Top by movement */}
          <div style={{ background: "#fff", border: "1px solid #E5E7EB", borderRadius: 12, padding: 24 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 18 }}>
              <TrendingUp size={16} color="#6B7280" />
              <h3 style={{ margin: 0, fontSize: 14, fontWeight: 700, color: "#111827" }}>Топ-5 по обороту</h3>
            </div>
            {analytics.topMoved.length === 0 ? (
              <p style={{ color: "#9CA3AF", fontSize: 13, margin: 0 }}>Движений пока нет</p>
            ) : analytics.topMoved.map((item, i) => (
              <div key={item.name} style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 12 }}>
                <span style={{ fontSize: 12, fontWeight: 700, color: i === 0 ? "#D97706" : "#D1D5DB", width: 20, textAlign: "center" }}>#{i + 1}</span>
                <span style={{ fontSize: 13, fontWeight: 500, color: "#111827", flex: 1 }}>{item.name}</span>
                <span style={{ display: "inline-flex", alignItems: "center", gap: 4, fontSize: 12, color: "#15803D", fontWeight: 600, background: "#F0FDF4", padding: "3px 10px", borderRadius: 6 }}>
                  <TrendingUp size={11} /> +{item.in}
                </span>
                <span style={{ display: "inline-flex", alignItems: "center", gap: 4, fontSize: 12, color: "#DC2626", fontWeight: 600, background: "#FEF2F2", padding: "3px 10px", borderRadius: 6 }}>
                  <TrendingDown size={11} /> −{item.out}
                </span>
                <span style={{ fontSize: 11, color: "#9CA3AF", minWidth: 64, textAlign: "right" }}>{item.count} шт</span>
              </div>
            ))}
          </div>

          {/* Category breakdown */}
          <div style={{ background: "#fff", border: "1px solid #E5E7EB", borderRadius: 12, padding: 24 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 18 }}>
              <Tag size={16} color="#6B7280" />
              <h3 style={{ margin: 0, fontSize: 14, fontWeight: 700, color: "#111827" }}>По категориям</h3>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(180px, 1fr))", gap: 10 }}>
              {Object.entries(analytics.catStock).sort((a, b) => b[1] - a[1]).map(([cat, qty]) => {
                const catColors = CATEGORY_COLORS[cat] || CATEGORY_COLORS["Прочие"];
                const val = analytics.catValue[cat] || 0;
                return (
                  <div key={cat} style={{ background: catColors.bg, borderRadius: 8, padding: "12px 14px", border: `1px solid ${catColors.color}22` }}>
                    <div style={{ fontSize: 10, fontWeight: 600, color: catColors.color, marginBottom: 6, textTransform: "uppercase", letterSpacing: "0.04em" }}>{cat}</div>
                    <div style={{ fontSize: 20, fontWeight: 800, color: "#111827" }}>{qty} <span style={{ fontSize: 12, fontWeight: 400, color: "#9CA3AF" }}>шт</span></div>
                    {val > 0 && <div style={{ fontSize: 11, color: "#6B7280", marginTop: 3 }}>{formatPrice(val)}</div>}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}