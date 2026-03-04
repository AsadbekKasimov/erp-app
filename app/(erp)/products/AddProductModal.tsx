"use client";

import { useState, useEffect, useRef } from "react";
import { supabase } from "@/lib/supabase";
import {
  X, RefreshCw, Package, Layers, Plus, Trash2,
  ImageIcon, FolderOpen, Info, Tag, Check, Lightbulb,
} from "lucide-react";

const CATEGORIES = [
  "Цех гель 1", "Цех гель 2", "ПЭТ", "ПП", "ПЭ",
  "Формовка", "Соль", "Химикаты", "Прочие"
];

const CATEGORY_PREFIXES: Record<string, string> = {
  "Цех гель 1": "GL1", "Цех гель 2": "GL2", "ПЭТ": "PET",
  "ПП": "PP", "ПЭ": "PE", "Формовка": "FRM",
  "Соль": "SLT", "Химикаты": "CHM", "Прочие": "OTH",
};

function generateCode(category: string): string {
  const prefix = CATEGORY_PREFIXES[category] || "PRD";
  const random = Math.random().toString(36).substring(2, 6).toUpperCase();
  const num = Math.floor(Math.random() * 900) + 100;
  return `${prefix}-${random}${num}`;
}

interface Variant {
  id?: string;
  sku: string;
  attributes: Record<string, string>;
  price: string;
  stock_quantity: string;
  image_url: string;
  is_active: boolean;
  _isNew?: boolean;
  _deleted?: boolean;
}

interface Props {
  open: boolean;
  onClose: () => void;
  onSaved: () => void;
  editingProduct?: {
    id: string; name: string; description?: string;
    category?: string; price?: number; image_url?: string;
    product_code?: string;
  } | null;
}

const ATTR_SUGGESTIONS = [
  { key: "color", label: "Цвет" },
  { key: "tube_size", label: "Размер трубки" },
  { key: "volume", label: "Объём" },
  { key: "weight", label: "Вес" },
  { key: "material", label: "Материал" },
  { key: "size", label: "Размер" },
];

function newVariant(productCode: string, index: number): Variant {
  return {
    sku: `${productCode}-V${index + 1}`,
    attributes: {}, price: "", stock_quantity: "0",
    image_url: "", is_active: true, _isNew: true,
  };
}

export default function AddProductModal({ open, onClose, onSaved, editingProduct }: Props) {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState(CATEGORIES[0]);
  const [price, setPrice] = useState("");
  const [productCode, setProductCode] = useState("");
  const [imageUrl, setImageUrl] = useState("");
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [activeTab, setActiveTab] = useState<"info" | "variants">("info");

  const [variants, setVariants] = useState<Variant[]>([]);
  const [attrKeys, setAttrKeys] = useState<string[]>([]);
  const [newAttrKey, setNewAttrKey] = useState("");
  const [showAttrInput, setShowAttrInput] = useState(false);

  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (open) {
      setName(editingProduct?.name || "");
      setDescription(editingProduct?.description || "");
      setCategory(editingProduct?.category || CATEGORIES[0]);
      setPrice(editingProduct?.price?.toString() || "");
      setImageUrl(editingProduct?.image_url || "");
      setImagePreview(editingProduct?.image_url || "");
      setImageFile(null);
      setError("");
      setActiveTab("info");
      if (!editingProduct) {
        setProductCode(generateCode(CATEGORIES[0]));
        setVariants([]);
        setAttrKeys([]);
      } else {
        setProductCode(editingProduct?.product_code || "");
        loadVariants(editingProduct.id);
      }
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [open, editingProduct]);

  async function loadVariants(productId: string) {
    const { data } = await supabase.from("product_variants").select("*").eq("product_id", productId).order("created_at");
    if (data && data.length > 0) {
      const allKeys = new Set<string>();
      data.forEach((v: any) => { if (v.attributes) Object.keys(v.attributes).forEach(k => allKeys.add(k)); });
      setAttrKeys(Array.from(allKeys));
      setVariants(data.map((v: any) => ({
        id: v.id, sku: v.sku || "", attributes: v.attributes || {},
        price: v.price?.toString() || "", stock_quantity: v.stock_quantity?.toString() || "0",
        image_url: v.image_url || "", is_active: v.is_active !== false,
      })));
    } else {
      setVariants([]); setAttrKeys([]);
    }
  }

  useEffect(() => {
    if (open && !editingProduct) setProductCode(generateCode(category));
  }, [category]);

  useEffect(() => {
    function onKey(e: KeyboardEvent) { if (e.key === "Escape") onClose(); }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setImageFile(file);
    setImagePreview(URL.createObjectURL(file));
  }

  async function uploadImage(file: File): Promise<string | null> {
    const ext = file.name.split(".").pop();
    const fileName = `${Date.now()}.${ext}`;
    const { error } = await supabase.storage.from("products").upload(fileName, file, { upsert: true });
    if (error) { console.error("Upload error:", error); return null; }
    const { data } = supabase.storage.from("products").getPublicUrl(fileName);
    return data.publicUrl;
  }

  function addVariant() { setVariants(prev => [...prev, newVariant(productCode, prev.length)]); }
  function removeVariant(idx: number) { setVariants(prev => prev.map((v, i) => i === idx ? { ...v, _deleted: true } : v)); }
  function updateVariant(idx: number, field: keyof Variant, value: any) { setVariants(prev => prev.map((v, i) => i === idx ? { ...v, [field]: value } : v)); }
  function updateVariantAttr(idx: number, key: string, value: string) {
    setVariants(prev => prev.map((v, i) => i !== idx ? v : { ...v, attributes: { ...v.attributes, [key]: value } }));
  }
  function addAttrKey(key: string) {
    const k = key.trim().toLowerCase().replace(/\s+/g, "_");
    if (!k || attrKeys.includes(k)) return;
    setAttrKeys(prev => [...prev, k]);
    setNewAttrKey("");
    setShowAttrInput(false);
  }
  function removeAttrKey(key: string) {
    setAttrKeys(prev => prev.filter(k => k !== key));
    setVariants(prev => prev.map(v => { const attrs = { ...v.attributes }; delete attrs[key]; return { ...v, attributes: attrs }; }));
  }
  function getAttrLabel(key: string) { return ATTR_SUGGESTIONS.find(s => s.key === key)?.label || key; }

  async function handleSave() {
    const trimmed = name.trim();
    if (!trimmed) { setError("Product name is required"); return; }
    if (!productCode.trim()) { setError("Product code is required"); return; }
    setLoading(true); setError("");

    let finalImageUrl = imageUrl;
    if (imageFile) { const uploaded = await uploadImage(imageFile); if (uploaded) finalImageUrl = uploaded; }

    const payload = {
      name: trimmed, description: description.trim() || null, category,
      price: price ? parseFloat(price) : null, image_url: finalImageUrl || null,
      product_code: productCode.trim(),
    };

    let productId = editingProduct?.id;
    if (editingProduct) {
      const { error: err } = await supabase.from("products").update(payload).eq("id", editingProduct.id);
      if (err) { setError(err.message); setLoading(false); return; }
    } else {
      const { data, error: err } = await supabase.from("products").insert(payload).select().single();
      if (err) { setError(err.message); setLoading(false); return; }
      productId = data.id;
    }

    if (productId) {
      for (const v of variants) {
        if (v._deleted && v.id) {
          await supabase.from("product_variants").delete().eq("id", v.id);
        } else if (!v._deleted) {
          const varPayload = {
            product_id: productId, sku: v.sku || null, attributes: v.attributes,
            price: v.price ? parseFloat(v.price) : null,
            stock_quantity: parseInt(v.stock_quantity) || 0,
            image_url: v.image_url || null, is_active: v.is_active,
          };
          if (v.id) await supabase.from("product_variants").update(varPayload).eq("id", v.id);
          else await supabase.from("product_variants").insert(varPayload);
        }
      }
    }

    setLoading(false); onSaved(); onClose();
  }

  if (!open) return null;
  const isEditing = !!editingProduct;
  const activeVariants = variants.filter(v => !v._deleted);

  const inputStyle: React.CSSProperties = {
    width: "100%", boxSizing: "border-box", border: "1.5px solid #E5E7EB",
    borderRadius: "9px", padding: "10px 14px", fontSize: "14px",
    color: "#111827", outline: "none", background: "#FAFAFA",
  };
  const labelStyle: React.CSSProperties = {
    display: "block", fontSize: "13px", fontWeight: 600, color: "#374151", marginBottom: "6px",
  };

  return (
    <>
      <div onClick={onClose} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.45)", backdropFilter: "blur(4px)", zIndex: 50 }} />
      <div style={{
        position: "fixed", top: "50%", left: "50%", transform: "translate(-50%,-50%)",
        zIndex: 51, width: "100%", maxWidth: activeTab === "variants" ? "780px" : "520px",
        padding: "0 16px", maxHeight: "90vh", overflowY: "auto",
        transition: "max-width 0.2s ease",
      }}>
        <div style={{ background: "#fff", borderRadius: "14px", boxShadow: "0 25px 60px rgba(0,0,0,0.18)", overflow: "hidden" }}>

          {/* HEADER */}
          <div style={{ padding: "22px 28px 0", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <div style={{ width: 34, height: 34, background: "#EEF2FF", borderRadius: 9, display: "flex", alignItems: "center", justifyContent: "center" }}>
                <Package size={17} color="#4F46E5" />
              </div>
              <div>
                <h2 style={{ fontSize: "17px", fontWeight: 700, color: "#111827", margin: 0 }}>
                  {isEditing ? "Edit Product" : "Add New Product"}
                </h2>
                <p style={{ fontSize: "12px", color: "#9CA3AF", marginTop: "2px" }}>Fill in the product details</p>
              </div>
            </div>
            <button onClick={onClose} style={{ background: "#F3F4F6", border: "none", borderRadius: "8px", width: "32px", height: "32px", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", color: "#6B7280" }}>
              <X size={16} />
            </button>
          </div>

          {/* TABS */}
          <div style={{ padding: "14px 28px 0", display: "flex", gap: 2, borderBottom: "1px solid #F3F4F6" }}>
            {(["info", "variants"] as const).map(tab => (
              <button key={tab} onClick={() => setActiveTab(tab)} style={{
                display: "flex", alignItems: "center", gap: 6,
                padding: "8px 16px", border: "none", borderRadius: "7px 7px 0 0",
                background: activeTab === tab ? "#4F46E5" : "transparent",
                color: activeTab === tab ? "#fff" : "#6B7280",
                fontSize: "13px", fontWeight: 600, cursor: "pointer",
              }}>
                {tab === "info"
                  ? <><Info size={13} /> Основное</>
                  : <><Layers size={13} /> Варианты {activeVariants.length > 0 && `(${activeVariants.length})`}</>
                }
              </button>
            ))}
          </div>

          <div style={{ padding: "20px 28px 28px", display: "flex", flexDirection: "column", gap: "14px" }}>

            {/* ── TAB: INFO ── */}
            {activeTab === "info" && (
              <>
                {/* IMAGE */}
                <div>
                  <label style={labelStyle}>Product Image</label>
                  <div style={{ display: "flex", gap: "12px", alignItems: "center" }}>
                    <div style={{ width: "70px", height: "70px", borderRadius: "10px", background: "#F3F4F6", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, border: "1px solid #E5E7EB", overflow: "hidden" }}>
                      {imagePreview
                        ? <img src={imagePreview} alt="preview" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                        : <ImageIcon size={24} color="#D1D5DB" />
                      }
                    </div>
                    <div style={{ flex: 1 }}>
                      <input type="file" accept="image/*" onChange={handleFileChange} id="img-upload" style={{ display: "none" }} />
                      <label htmlFor="img-upload" style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "7px 13px", border: "1.5px solid #E5E7EB", borderRadius: "8px", fontSize: "13px", fontWeight: 500, color: "#374151", cursor: "pointer", background: "#F9FAFB" }}>
                        <FolderOpen size={14} /> Choose image
                      </label>
                      <p style={{ fontSize: "11px", color: "#9CA3AF", marginTop: "4px" }}>Or paste URL below</p>
                      <input value={imageUrl} onChange={(e) => { setImageUrl(e.target.value); if (!imageFile) setImagePreview(e.target.value); }} placeholder="https://..."
                        style={{ ...inputStyle, marginTop: "6px", fontSize: "12px", padding: "7px 12px" }} />
                    </div>
                  </div>
                </div>

                {/* NAME */}
                <div>
                  <label style={labelStyle}>Product Name <span style={{ color: "#EF4444" }}>*</span></label>
                  <input ref={inputRef} value={name} onChange={(e) => { setName(e.target.value); setError(""); }} placeholder="Product name..."
                    style={{ ...inputStyle, borderColor: error ? "#EF4444" : "#E5E7EB" }} />
                  {error && <p style={{ fontSize: "12px", color: "#EF4444", marginTop: "4px" }}>{error}</p>}
                </div>

                {/* PRODUCT CODE */}
                <div>
                  <label style={labelStyle}>
                    Product Code <span style={{ color: "#EF4444" }}>*</span>
                    <span style={{ fontSize: 11, color: "#9CA3AF", fontWeight: 400, marginLeft: 8 }}>Авто-генерируется</span>
                  </label>
                  <div style={{ display: "flex", gap: 8 }}>
                    <input value={productCode} onChange={(e) => setProductCode(e.target.value.toUpperCase())} placeholder="PET-ABC123"
                      style={{ ...inputStyle, fontFamily: "monospace", letterSpacing: "0.05em" }} />
                    <button onClick={() => setProductCode(generateCode(category))} title="Regenerate"
                      style={{ display: "flex", alignItems: "center", justifyContent: "center", padding: "0 13px", border: "1.5px solid #E5E7EB", borderRadius: 9, background: "#F9FAFB", cursor: "pointer", flexShrink: 0, color: "#6B7280" }}>
                      <RefreshCw size={15} />
                    </button>
                  </div>
                </div>

                {/* CATEGORY */}
                <div>
                  <label style={labelStyle}>Category</label>
                  <select value={category} onChange={(e) => setCategory(e.target.value)} style={{ ...inputStyle, appearance: "none", cursor: "pointer" }}>
                    {CATEGORIES.map((cat) => <option key={cat} value={cat}>{cat}</option>)}
                  </select>
                </div>

                {/* PRICE */}
                <div>
                  <label style={labelStyle}>
                    Базовая цена (сум)
                    <span style={{ fontSize: 11, color: "#9CA3AF", fontWeight: 400, marginLeft: 8 }}>— или задайте цену для каждого варианта</span>
                  </label>
                  <input value={price} onChange={(e) => setPrice(e.target.value)} type="number" min="0" placeholder="0" style={inputStyle} />
                </div>

                {/* DESCRIPTION */}
                <div>
                  <label style={labelStyle}>Description</label>
                  <textarea value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Product description..." rows={3}
                    style={{ ...inputStyle, resize: "vertical", fontFamily: "inherit" }} />
                </div>
              </>
            )}

            {/* ── TAB: VARIANTS ── */}
            {activeTab === "variants" && (
              <div>
                {/* Attribute columns */}
                <div style={{ marginBottom: 16 }}>
                  <label style={labelStyle}>Характеристики вариантов</label>
                  <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
                    {attrKeys.map(key => (
                      <span key={key} style={{ display: "flex", alignItems: "center", gap: 5, background: "#EEF2FF", color: "#4338CA", padding: "4px 10px", borderRadius: 999, fontSize: 12, fontWeight: 600 }}>
                        <Tag size={10} /> {getAttrLabel(key)}
                        <button onClick={() => removeAttrKey(key)} style={{ background: "none", border: "none", cursor: "pointer", color: "#9CA3AF", padding: 0, display: "flex", alignItems: "center" }}>
                          <X size={12} />
                        </button>
                      </span>
                    ))}
                    {showAttrInput ? (
                      <div style={{ display: "flex", gap: 6, alignItems: "center", flexWrap: "wrap" }}>
                        <input
                          autoFocus value={newAttrKey} onChange={e => setNewAttrKey(e.target.value)}
                          onKeyDown={e => { if (e.key === "Enter") addAttrKey(newAttrKey); if (e.key === "Escape") setShowAttrInput(false); }}
                          placeholder="напр. color"
                          style={{ padding: "4px 10px", border: "1.5px solid #4F46E5", borderRadius: 8, fontSize: 12, outline: "none", width: 120 }}
                        />
                        {ATTR_SUGGESTIONS.filter(s => !attrKeys.includes(s.key)).map(s => (
                          <button key={s.key} onClick={() => addAttrKey(s.key)}
                            style={{ display: "inline-flex", alignItems: "center", gap: 4, padding: "4px 10px", border: "1.5px solid #E5E7EB", borderRadius: 8, background: "#F9FAFB", fontSize: 12, cursor: "pointer", color: "#374151" }}>
                            <Plus size={10} /> {s.label}
                          </button>
                        ))}
                        <button onClick={() => addAttrKey(newAttrKey)}
                          style={{ display: "flex", alignItems: "center", justifyContent: "center", width: 28, height: 28, border: "none", borderRadius: 8, background: "#4F46E5", color: "#fff", cursor: "pointer" }}>
                          <Check size={13} />
                        </button>
                      </div>
                    ) : (
                      <button onClick={() => setShowAttrInput(true)}
                        style={{ display: "inline-flex", alignItems: "center", gap: 5, padding: "4px 12px", border: "1.5px dashed #D1D5DB", borderRadius: 999, background: "transparent", fontSize: 12, cursor: "pointer", color: "#6B7280" }}>
                        <Plus size={11} /> Добавить характеристику
                      </button>
                    )}
                  </div>
                </div>

                {/* Variants table */}
                {activeVariants.length === 0 ? (
                  <div style={{ textAlign: "center", padding: "32px 0", color: "#9CA3AF", border: "2px dashed #E5E7EB", borderRadius: 12 }}>
                    <div style={{ display: "flex", justifyContent: "center", marginBottom: 10 }}>
                      <Layers size={32} color="#D1D5DB" />
                    </div>
                    <p style={{ fontSize: 13, margin: 0 }}>Нет вариантов. Добавьте первый вариант товара.</p>
                    <p style={{ fontSize: 11, color: "#D1D5DB", margin: "4px 0 0" }}>Например: Дозатор 28 / Красный / Трубка 28мм</p>
                  </div>
                ) : (
                  <div style={{ overflowX: "auto" }}>
                    <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
                      <thead>
                        <tr style={{ background: "#F9FAFB" }}>
                          <th style={{ padding: "8px 10px", textAlign: "left", color: "#6B7280", fontWeight: 600, borderBottom: "1px solid #E5E7EB", whiteSpace: "nowrap" }}>SKU</th>
                          {attrKeys.map(key => (
                            <th key={key} style={{ padding: "8px 10px", textAlign: "left", color: "#6B7280", fontWeight: 600, borderBottom: "1px solid #E5E7EB", whiteSpace: "nowrap" }}>
                              {getAttrLabel(key)}
                            </th>
                          ))}
                          <th style={{ padding: "8px 10px", textAlign: "left", color: "#6B7280", fontWeight: 600, borderBottom: "1px solid #E5E7EB", whiteSpace: "nowrap" }}>Цена (сум)</th>
                          <th style={{ padding: "8px 10px", textAlign: "left", color: "#6B7280", fontWeight: 600, borderBottom: "1px solid #E5E7EB", whiteSpace: "nowrap" }}>Остаток</th>
                          <th style={{ padding: "8px 10px", borderBottom: "1px solid #E5E7EB" }}></th>
                        </tr>
                      </thead>
                      <tbody>
                        {variants.map((v, idx) => {
                          if (v._deleted) return null;
                          return (
                            <tr key={idx} style={{ borderBottom: "1px solid #F3F4F6" }}>
                              <td style={{ padding: "6px 8px" }}>
                                <input value={v.sku} onChange={e => updateVariant(idx, "sku", e.target.value.toUpperCase())}
                                  style={{ width: 120, padding: "5px 8px", border: "1.5px solid #E5E7EB", borderRadius: 7, fontSize: 11, fontFamily: "monospace", background: "#FAFAFA", outline: "none" }} />
                              </td>
                              {attrKeys.map(key => (
                                <td key={key} style={{ padding: "6px 8px" }}>
                                  <input value={v.attributes[key] || ""} onChange={e => updateVariantAttr(idx, key, e.target.value)} placeholder="—"
                                    style={{ width: 90, padding: "5px 8px", border: "1.5px solid #E5E7EB", borderRadius: 7, fontSize: 12, background: "#FAFAFA", outline: "none" }} />
                                </td>
                              ))}
                              <td style={{ padding: "6px 8px" }}>
                                <input type="number" min="0" value={v.price} onChange={e => updateVariant(idx, "price", e.target.value)} placeholder="0"
                                  style={{ width: 100, padding: "5px 8px", border: "1.5px solid #E5E7EB", borderRadius: 7, fontSize: 12, background: "#FAFAFA", outline: "none" }} />
                              </td>
                              <td style={{ padding: "6px 8px" }}>
                                <input type="number" min="0" value={v.stock_quantity} onChange={e => updateVariant(idx, "stock_quantity", e.target.value)}
                                  style={{ width: 70, padding: "5px 8px", border: "1.5px solid #E5E7EB", borderRadius: 7, fontSize: 12, background: "#FAFAFA", outline: "none" }} />
                              </td>
                              <td style={{ padding: "6px 8px" }}>
                                <button onClick={() => removeVariant(idx)}
                                  style={{ display: "flex", alignItems: "center", justifyContent: "center", width: 28, height: 28, background: "#FEF2F2", color: "#EF4444", border: "none", borderRadius: 6, cursor: "pointer" }}>
                                  <Trash2 size={12} />
                                </button>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}

                <button onClick={addVariant}
                  style={{ marginTop: 12, width: "100%", padding: "9px", border: "1.5px dashed #4F46E5", borderRadius: 10, background: "#F5F3FF", color: "#4F46E5", fontSize: 13, fontWeight: 600, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 6 }}>
                  <Plus size={14} /> Добавить вариант
                </button>

                <div style={{ marginTop: 12, padding: "10px 14px", background: "#FFFBEB", border: "1px solid #FDE68A", borderRadius: 10, fontSize: 12, color: "#92400E", display: "flex", alignItems: "flex-start", gap: 8 }}>
                  <Lightbulb size={14} color="#D97706" style={{ flexShrink: 0, marginTop: 1 }} />
                  <span><strong>Подсказка:</strong> Для дозаторов добавьте характеристики «Цвет» и «Размер трубки». Каждый вариант будет отдельной позицией на складе, но под одним товаром.</span>
                </div>
              </div>
            )}

            {/* ACTIONS */}
            <div style={{ display: "flex", gap: "10px", marginTop: "4px" }}>
              <button onClick={onClose} style={{ flex: 1, padding: "10px", borderRadius: "9px", border: "1.5px solid #E5E7EB", background: "transparent", fontSize: "13px", fontWeight: 600, color: "#374151", cursor: "pointer" }}>
                Cancel
              </button>
              <button onClick={handleSave} disabled={loading}
                style={{ flex: 2, padding: "10px", borderRadius: "9px", border: "none", background: loading ? "#9CA3AF" : "#4F46E5", fontSize: "13px", fontWeight: 600, color: "#fff", cursor: loading ? "not-allowed" : "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 6 }}>
                {loading ? "Saving..." : isEditing
                  ? <><Check size={14} /> Save Changes</>
                  : <><Plus size={14} /> Add Product</>
                }
              </button>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}