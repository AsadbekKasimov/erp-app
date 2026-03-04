"use client";

import { useEffect, useState, useMemo } from "react";
import { supabase } from "@/lib/supabase";

function formatUZS(n: number) { return new Intl.NumberFormat("uz-UZ").format(n) + " UZS"; }
function formatUSD(n: number) { return "$" + new Intl.NumberFormat("en-US", { minimumFractionDigits: 2 }).format(n); }

const URGENCY_CONFIG: Record<string, { label: string; bg: string; color: string; border: string }> = {
  normal:   { label: "Обычный",       bg: "#F9FAFB", color: "#374151", border: "#E5E7EB" },
  urgent:   { label: "Срочный",       bg: "#FFF7ED", color: "#C2410C", border: "#FED7AA" },
  critical: { label: "Очень срочный", bg: "#FEF2F2", color: "#B91C1C", border: "#FECACA" },
};

const STATUS_CONFIG: Record<string, { label: string; bg: string; color: string }> = {
  new:        { label: "Новый",          bg: "#EEF2FF", color: "#4338CA" },
  confirmed:  { label: "Подтверждён",    bg: "#F0FDF4", color: "#15803D" },
  production: { label: "В производстве", bg: "#FFF7ED", color: "#C2410C" },
  ready:      { label: "Готов",          bg: "#ECFDF5", color: "#065F46" },
  shipped:    { label: "Отгружен",       bg: "#F3F4F6", color: "#374151" },
};

const STATUS_ORDER = ["new", "confirmed", "production", "ready", "shipped"];

const ORDER_STATUS_CONFIG: Record<string, { label: string; bg: string; color: string }> = {
  new:         { label: "Новый",       bg: "#EEF2FF", color: "#4338CA" },
  in_progress: { label: "В процессе",  bg: "#FFF7ED", color: "#C2410C" },
  ready:       { label: "Готов",       bg: "#ECFDF5", color: "#065F46" },
  completed:   { label: "Завершён",    bg: "#F3F4F6", color: "#374151" },
  cancelled:   { label: "Отменён",     bg: "#FEF2F2", color: "#B91C1C" },
};

function computeOrderStatus(items: any[]): string {
  if (!items || items.length === 0) return "new";
  const statuses = items.map(i => i.status);
  if (statuses.every(s => s === "shipped")) return "completed";
  if (statuses.every(s => s === "ready" || s === "shipped")) return "ready";
  if (statuses.some(s => s === "production" || s === "ready" || s === "shipped")) return "in_progress";
  if (statuses.some(s => s === "confirmed")) return "in_progress";
  return "new";
}

function genOrderNumber(): string {
  const now = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  return `ORD${pad(now.getDate())}${pad(now.getMonth() + 1)}${now.getFullYear()}${pad(now.getHours())}${pad(now.getMinutes())}${pad(now.getSeconds())}`;
}

export default function OrdersPage() {
  const [orders, setOrders] = useState<any[]>([]);
  const [clients, setClients] = useState<any[]>([]);
  const [products, setProducts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const [filterClient, setFilterClient] = useState("");
  const [filterStatus, setFilterStatus] = useState("");
  const [searchText, setSearchText] = useState("");

  const [modalOpen, setModalOpen] = useState(false);
  const [selectedClientId, setSelectedClientId] = useState("");
  const [clientPrices, setClientPrices] = useState<Record<string, { uzs: number; usd: number }>>({});
  const [orderNotes, setOrderNotes] = useState("");
  const [orderDate, setOrderDate] = useState(new Date().toISOString().split("T")[0]);
  const [orderItems, setOrderItems] = useState<Record<string, { qty: string; urgency: string; status: string; due_date: string; notes: string }>>({});
  const [savingOrder, setSavingOrder] = useState(false);
  const [dueDateError, setDueDateError] = useState<string | null>(null);

  const [expandedOrder, setExpandedOrder] = useState<string | null>(null);
  const [orderItemsData, setOrderItemsData] = useState<Record<string, any[]>>({});

  const [editingItem, setEditingItem] = useState<any | null>(null);
  const [editForm, setEditForm] = useState<any>({});

  const [editQtyItem, setEditQtyItem] = useState<any | null>(null);
  const [editQtyForm, setEditQtyForm] = useState({ quantity: "", price_uzs: "", price_usd: "" });
  const [savingQty, setSavingQty] = useState(false);

  useEffect(() => { loadAll(); }, []);

  async function loadAll() {
    setLoading(true);
    const [{ data: ordersData }, { data: clientsData }, { data: productsData }] = await Promise.all([
      supabase.from("orders").select("*").order("created_at", { ascending: false }),
      supabase.from("clients").select("id, name").order("name"),
      supabase.from("products").select("*").order("name"),
    ]);
    const clientMap: Record<string, string> = {};
    (clientsData || []).forEach((c: any) => { clientMap[c.id] = c.name; });
    const ordersWithClients = (ordersData || []).map((o: any) => ({
      ...o, clients: { name: clientMap[o.client_id] || "—" }
    }));
    setOrders(ordersWithClients);
    setClients(clientsData || []);
    setProducts(productsData || []);
    setLoading(false);
  }

  async function loadClientPrices(clientId: string) {
    const { data } = await supabase.from("client_prices").select("*").eq("client_id", clientId);
    const map: Record<string, { uzs: number; usd: number }> = {};
    (data || []).forEach((p: any) => { map[p.product_id] = { uzs: p.price_uzs, usd: p.price_usd }; });
    setClientPrices(map);
    setOrderItems({});
  }

  async function loadOrderItems(orderId: string) {
    if (orderItemsData[orderId]) return;
    const { data: items } = await supabase.from("order_items").select("*").eq("order_id", orderId).order("created_at");
    const { data: prods } = await supabase.from("products").select("id, name, product_code, category");
    const prodMap: Record<string, any> = {};
    (prods || []).forEach((p: any) => { prodMap[p.id] = p; });
    const joined = (items || []).map((i: any) => ({ ...i, products: prodMap[i.product_id] || null }));
    setOrderItemsData(prev => ({ ...prev, [orderId]: joined }));
  }

  async function reloadOrderItems(orderId: string) {
    const { data: items } = await supabase.from("order_items").select("*").eq("order_id", orderId).order("created_at");
    const { data: prods } = await supabase.from("products").select("id, name, product_code, category");
    const prodMap: Record<string, any> = {};
    (prods || []).forEach((p: any) => { prodMap[p.id] = p; });
    const joined = (items || []).map((i: any) => ({ ...i, products: prodMap[i.product_id] || null }));
    setOrderItemsData(prev => ({ ...prev, [orderId]: joined }));
  }

  function toggleOrder(orderId: string) {
    if (expandedOrder === orderId) { setExpandedOrder(null); }
    else { setExpandedOrder(orderId); loadOrderItems(orderId); }
  }

  // Показываем только товары у которых UZS > 0 ИЛИ USD > 0
  const pricedProducts = products.filter(p =>
    clientPrices[p.id] && (clientPrices[p.id].uzs > 0 || clientPrices[p.id].usd > 0)
  );

  async function saveOrder() {
    const activeItems = Object.entries(orderItems).filter(([, v]) => Number(v.qty) > 0);
    const missingDueDate = activeItems.some(([, v]) => !v.due_date);
    if (missingDueDate) {
      setDueDateError("Укажите срок выполнения для всех товаров!");
      return;
    }
    setDueDateError(null);

    const items = activeItems.map(([productId, v]) => {
      const pr = clientPrices[productId] || { uzs: 0, usd: 0 };
      const qty = Number(v.qty);
      return {
        product_id: productId, quantity: qty,
        price_uzs: pr.uzs, price_usd: pr.usd,
        total_uzs: pr.uzs * qty, total_usd: pr.usd * qty,
        urgency: v.urgency || "normal", status: v.status || "new",
        due_date: v.due_date, notes: v.notes || "",
      };
    });

    if (items.length === 0) { alert("Добавьте хотя бы один товар!"); return; }
    if (!selectedClientId) { alert("Выберите клиента!"); return; }

    setSavingOrder(true);
    const totalUZS = items.reduce((s, i) => s + i.total_uzs, 0);
    const totalUSD = items.reduce((s, i) => s + i.total_usd, 0);
    const orderNumber = genOrderNumber();

    const { data: order } = await supabase.from("orders").insert({
      client_id: selectedClientId, status: "new",
      notes: orderNotes, total_uzs: totalUZS, total_usd: totalUSD,
      order_number: orderNumber, date: orderDate,
    }).select().single();

    if (!order) { setSavingOrder(false); return; }
    await supabase.from("order_items").insert(items.map(i => ({ ...i, order_id: order.id })));

    setSavingOrder(false);
    setModalOpen(false);
    setSelectedClientId("");
    setClientPrices({});
    setOrderItems({});
    setOrderNotes("");
    setOrderDate(new Date().toISOString().split("T")[0]);
    loadAll();
  }

  async function saveQtyEdit() {
    if (!editQtyItem) return;
    setSavingQty(true);
    const qty = Number(editQtyForm.quantity);
    const price_uzs = Number(editQtyForm.price_uzs);
    const price_usd = Number(editQtyForm.price_usd);
    await supabase.from("order_items").update({
      quantity: qty,
      price_uzs, price_usd,
      total_uzs: price_uzs * qty,
      total_usd: price_usd * qty,
    }).eq("id", editQtyItem.id);

    const orderId = Object.keys(orderItemsData).find(oid => orderItemsData[oid]?.some((i: any) => i.id === editQtyItem.id));
    if (orderId) {
      await reloadOrderItems(orderId);
      const { data: allItems } = await supabase.from("order_items").select("total_uzs, total_usd").eq("order_id", orderId);
      const newTotalUZS = (allItems || []).reduce((s, i: any) => s + Number(i.total_uzs), 0);
      const newTotalUSD = (allItems || []).reduce((s, i: any) => s + Number(i.total_usd), 0);
      await supabase.from("orders").update({ total_uzs: newTotalUZS, total_usd: newTotalUSD }).eq("id", orderId);
      await loadAll();
    }
    setSavingQty(false);
    setEditQtyItem(null);
  }

  async function updateOrderItem(itemId: string, fields: any) {
    const orderId = Object.keys(orderItemsData).find(oid => orderItemsData[oid]?.some((i: any) => i.id === itemId));
    const currentItem = orderId ? orderItemsData[orderId]?.find((i: any) => i.id === itemId) : null;

    await supabase.from("order_items").update(fields).eq("id", itemId);

    if (fields.status === "shipped" && currentItem && currentItem.status !== "shipped") {
      const { data: orderData } = await supabase.from("orders").select("client_id, order_number").eq("id", orderId).single();
      if (orderData?.client_id) {
        const shipDate = fields.due_date || currentItem.due_date || new Date().toISOString().split("T")[0];
        const orderNum = orderData.order_number || orderId;
        const prodName = currentItem.products?.name || "Товар";
        const prodCode = currentItem.products?.product_code || "";
        const { data: ship } = await supabase.from("shipments").insert({
          client_id: orderData.client_id, date: shipDate, status: "confirmed",
          notes: `Из заказа: ${orderNum}`,
        }).select().single();
        if (ship) {
          await supabase.from("shipment_items").insert({
            shipment_id: ship.id, product_id: currentItem.product_id,
            quantity: currentItem.quantity, price_uzs: currentItem.price_uzs,
            price_usd: currentItem.price_usd, total_uzs: currentItem.total_uzs, total_usd: currentItem.total_usd,
          });
          await supabase.from("client_transactions").insert({
            client_id: orderData.client_id, type: "shipment",
            amount_uzs: currentItem.total_uzs, amount_usd: currentItem.total_usd,
            payment_method: "order",
            description: `Из заказа: ${orderNum} — ${prodCode ? "[" + prodCode + "] " : ""}${prodName}`,
            created_at: new Date(shipDate).toISOString(),
          });
        }
      }
    }

    if (orderId) await reloadOrderItems(orderId);
    setEditingItem(null);
  }

  async function deleteOrder(orderId: string) {
    if (!confirm("Удалить заказ и все связанные отгрузки/транзакции?")) return;

    // Найти order_number для этого заказа
    const order = orders.find(o => o.id === orderId);
    const orderNum = order?.order_number || orderId;

    // Удалить client_transactions связанные с этим заказом
    await supabase.from("client_transactions")
      .delete()
      .eq("payment_method", "order")
      .like("description", `%${orderNum}%`);

    // Найти и удалить shipments связанные с этим заказом
    const { data: relatedShipments } = await supabase
      .from("shipments")
      .select("id")
      .like("notes", `%${orderNum}%`);

    if (relatedShipments && relatedShipments.length > 0) {
      const shipIds = relatedShipments.map((s: any) => s.id);
      await supabase.from("shipment_items").delete().in("shipment_id", shipIds);
      await supabase.from("shipments").delete().in("id", shipIds);
    }

    // Удалить order_items и сам заказ
    await supabase.from("order_items").delete().eq("order_id", orderId);
    await supabase.from("orders").delete().eq("id", orderId);
    loadAll();
  }

  const filteredOrders = useMemo(() => orders.filter(o => {
    if (filterClient && o.client_id !== filterClient) return false;
    if (filterStatus && o.status !== filterStatus) return false;
    if (searchText && !o.clients?.name?.toLowerCase().includes(searchText.toLowerCase())) return false;
    return true;
  }), [orders, filterClient, filterStatus, searchText]);

  const newItem = (productId: string) => ({
    qty: orderItems[productId]?.qty || "",
    urgency: orderItems[productId]?.urgency || "normal",
    status: orderItems[productId]?.status || "new",
    due_date: orderItems[productId]?.due_date || "",
    notes: orderItems[productId]?.notes || "",
  });

  const modalTotalUZS = Object.entries(orderItems).reduce((s, [pid, v]) => s + (clientPrices[pid]?.uzs || 0) * (Number(v.qty) || 0), 0);
  const modalTotalUSD = Object.entries(orderItems).reduce((s, [pid, v]) => s + (clientPrices[pid]?.usd || 0) * (Number(v.qty) || 0), 0);

  return (
    <div style={{ padding: 32 }}>

      {/* HEADER */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 24 }}>
        <div>
          <h1 style={{ fontSize: 24, fontWeight: 700, color: "#111827", margin: 0 }}>Заказы</h1>
          <p style={{ fontSize: 13, color: "#6B7280", marginTop: 4 }}>
            {loading ? "Загрузка..." : `${filteredOrders.length} заказов`}
          </p>
        </div>
        <button onClick={() => { setOrderDate(new Date().toISOString().split("T")[0]); setDueDateError(null); setModalOpen(true); }}
          style={{ background: "#4F46E5", color: "#fff", border: "none", borderRadius: 10, padding: "10px 22px", fontSize: 14, fontWeight: 600, cursor: "pointer" }}>
          + Новый заказ
        </button>
      </div>

      {/* FILTERS */}
      <div style={{ display: "flex", gap: 10, marginBottom: 24, flexWrap: "wrap" }}>
        <input value={searchText} onChange={e => setSearchText(e.target.value)} placeholder="Поиск по клиенту..."
          style={{ padding: "8px 12px", border: "1px solid #E5E7EB", borderRadius: 8, fontSize: 13, width: 200 }} />
        <select value={filterClient} onChange={e => setFilterClient(e.target.value)}
          style={{ padding: "8px 12px", border: "1px solid #E5E7EB", borderRadius: 8, fontSize: 13, color: "#374151" }}>
          <option value="">Все клиенты</option>
          {clients.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
        <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)}
          style={{ padding: "8px 12px", border: "1px solid #E5E7EB", borderRadius: 8, fontSize: 13, color: "#374151" }}>
          <option value="">Все статусы</option>
          {Object.entries(ORDER_STATUS_CONFIG).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
        </select>
        {(filterClient || filterStatus || searchText) && (
          <button onClick={() => { setFilterClient(""); setFilterStatus(""); setSearchText(""); }}
            style={{ padding: "8px 12px", border: "1px solid #E5E7EB", borderRadius: 8, fontSize: 13, background: "#fff", cursor: "pointer", color: "#6B7280" }}>
            ✕ Сбросить
          </button>
        )}
      </div>

      {/* ORDERS LIST */}
      {loading ? <div style={{ color: "#9CA3AF", padding: 40 }}>Загрузка...</div> : (
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {filteredOrders.length === 0 ? (
            <div style={{ background: "#fff", border: "1px solid #E5E7EB", borderRadius: 12, padding: 48, textAlign: "center", color: "#9CA3AF" }}>Нет заказов</div>
          ) : filteredOrders.map(order => {
            const items = orderItemsData[order.id] || [];
            const computedStatus = items.length > 0 ? computeOrderStatus(items) : (order.status || "new");
            const statusCfg = ORDER_STATUS_CONFIG[computedStatus] || ORDER_STATUS_CONFIG["new"];
            const hasCritical = items.some((i: any) => i.urgency === "critical");
            const hasUrgent = items.some((i: any) => i.urgency === "urgent");

            return (
              <div key={order.id} style={{ background: "#fff", border: `1px solid ${hasCritical ? "#FECACA" : "#E5E7EB"}`, borderRadius: 12, overflow: "hidden" }}>
                <div style={{ display: "flex", alignItems: "center", padding: "16px 20px", gap: 16, cursor: "pointer" }} onClick={() => toggleOrder(order.id)}>
                  <div style={{ flex: 1 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
                      <span style={{ fontWeight: 700, fontSize: 15, color: "#111827" }}>{order.clients?.name || "—"}</span>
                      {order.order_number && (
                        <span style={{ fontSize: 11, fontFamily: "monospace", background: "#EEF2FF", color: "#4338CA", padding: "2px 8px", borderRadius: 6, fontWeight: 600 }}>
                          {order.order_number}
                        </span>
                      )}
                      {hasCritical && <span style={{ fontSize: 11, fontWeight: 700, background: "#FEF2F2", color: "#B91C1C", padding: "2px 8px", borderRadius: 20 }}>🔴 СРОЧНО</span>}
                      {!hasCritical && hasUrgent && <span style={{ fontSize: 11, fontWeight: 700, background: "#FFF7ED", color: "#C2410C", padding: "2px 8px", borderRadius: 20 }}>🟠 Срочный</span>}
                    </div>
                    <div style={{ fontSize: 12, color: "#6B7280", marginTop: 3, display: "flex", gap: 12, flexWrap: "wrap" }}>
                      <span>📅 {order.date ? new Date(order.date).toLocaleDateString("ru-RU") : new Date(order.created_at).toLocaleDateString("ru-RU")}</span>
                      <span style={{ color: "#9CA3AF" }}>создан: {new Date(order.created_at).toLocaleDateString("ru-RU")} {new Date(order.created_at).toLocaleTimeString("ru-RU", { hour: "2-digit", minute: "2-digit" })}</span>
                      {order.notes && <span>📝 {order.notes}</span>}
                    </div>
                  </div>
                  <div style={{ display: "flex", gap: 16, alignItems: "center" }}>
                    <div style={{ textAlign: "right" }}>
                      {order.total_uzs > 0 && <div style={{ fontSize: 14, fontWeight: 700, color: "#111827" }}>{formatUZS(order.total_uzs)}</div>}
                      {order.total_usd > 0 && <div style={{ fontSize: 13, fontWeight: 700, color: "#374151" }}>{formatUSD(order.total_usd)}</div>}
                    </div>
                    <span style={{ padding: "4px 12px", borderRadius: 20, fontSize: 12, fontWeight: 600, background: statusCfg.bg, color: statusCfg.color }}>
                      {statusCfg.label}
                    </span>
                    <button onClick={e => { e.stopPropagation(); deleteOrder(order.id); }}
                      style={{ background: "#FEF2F2", border: "1px solid #FECACA", color: "#EF4444", borderRadius: 6, padding: "4px 10px", fontSize: 11, cursor: "pointer" }}>
                      Delete
                    </button>
                    <span style={{ fontSize: 16, color: "#9CA3AF" }}>{expandedOrder === order.id ? "▲" : "▼"}</span>
                  </div>
                </div>

                {/* ORDER ITEMS */}
                {expandedOrder === order.id && (
                  <div style={{ borderTop: "1px solid #F3F4F6" }}>
                    {!orderItemsData[order.id] ? (
                      <div style={{ padding: 20, color: "#9CA3AF" }}>Загрузка...</div>
                    ) : orderItemsData[order.id].length === 0 ? (
                      <div style={{ padding: 20, color: "#9CA3AF" }}>Нет товаров</div>
                    ) : (
                      <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
                        <thead>
                          <tr style={{ background: "#F9FAFB" }}>
                            <th style={th}>Код</th><th style={th}>Товар</th><th style={th}>Кол-во</th>
                            <th style={th}>Цена (UZS)</th><th style={th}>Цена (USD)</th>
                            <th style={th}>Итого (UZS)</th><th style={th}>Итого (USD)</th>
                            <th style={th}>Срочность</th><th style={th}>Статус</th>
                            <th style={th}>Срок</th><th style={th}>Заметка</th><th style={th}></th>
                          </tr>
                        </thead>
                        <tbody>
                          {orderItemsData[order.id].map((item: any) => {
                            const urg = URGENCY_CONFIG[item.urgency] || URGENCY_CONFIG.normal;
                            const st = STATUS_CONFIG[item.status] || STATUS_CONFIG.new;
                            const isOverdue = item.due_date && new Date(item.due_date) < new Date() && item.status !== "shipped";
                            const isNew = item.status === "new";
                            return (
                              <tr key={item.id} style={{ borderTop: "1px solid #F3F4F6", background: item.urgency === "critical" ? "#FFF5F5" : "transparent" }}>
                                <td style={td}><span style={{ fontFamily: "monospace", fontSize: 11, background: "#F3F4F6", padding: "2px 6px", borderRadius: 4 }}>{item.products?.product_code || "-"}</span></td>
                                <td style={{ ...td, fontWeight: 600 }}>{item.products?.name || "-"}</td>
                                <td style={td}>{item.quantity}</td>
                                <td style={td}>{item.price_uzs > 0 ? formatUZS(item.price_uzs) : <span style={{ color: "#9CA3AF" }}>—</span>}</td>
                                <td style={td}>{item.price_usd > 0 ? formatUSD(item.price_usd) : <span style={{ color: "#9CA3AF" }}>—</span>}</td>
                                <td style={{ ...td, fontWeight: 700, color: "#065F46" }}>{item.total_uzs > 0 ? formatUZS(item.total_uzs) : <span style={{ color: "#9CA3AF" }}>—</span>}</td>
                                <td style={{ ...td, fontWeight: 700, color: "#065F46" }}>{item.total_usd > 0 ? formatUSD(item.total_usd) : <span style={{ color: "#9CA3AF" }}>—</span>}</td>
                                <td style={td}><span style={{ padding: "3px 10px", borderRadius: 20, fontSize: 11, fontWeight: 600, background: urg.bg, color: urg.color, border: `1px solid ${urg.border}` }}>{urg.label}</span></td>
                                <td style={td}><span style={{ padding: "3px 10px", borderRadius: 20, fontSize: 11, fontWeight: 600, background: st.bg, color: st.color }}>{st.label}</span></td>
                                <td style={td}>
                                  {item.due_date ? (
                                    <span style={{ color: isOverdue ? "#B91C1C" : "#374151", fontWeight: isOverdue ? 700 : 400 }}>
                                      {isOverdue ? "⚠️ " : ""}{new Date(item.due_date).toLocaleDateString("ru-RU")}
                                    </span>
                                  ) : <span style={{ color: "#9CA3AF" }}>—</span>}
                                </td>
                                <td style={{ ...td, color: "#6B7280", maxWidth: 160 }}><span style={{ display: "block", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{item.notes || "—"}</span></td>
                                <td style={td}>
                                  {item.status === "shipped" ? (
                                    <span style={{ fontSize: 11, color: "#6B7280", fontStyle: "italic" }}>✅ Отгружен</span>
                                  ) : (
                                    <div style={{ display: "flex", gap: 5 }}>
                                      {isNew && (
                                        <button onClick={() => {
                                          setEditQtyItem(item);
                                          setEditQtyForm({ quantity: String(item.quantity), price_uzs: String(item.price_uzs), price_usd: String(item.price_usd) });
                                        }}
                                          style={{ background: "#F0FDF4", border: "1px solid #A7F3D0", color: "#065F46", borderRadius: 6, padding: "4px 10px", fontSize: 11, cursor: "pointer", fontWeight: 600 }}>
                                          ✏️ Кол-во
                                        </button>
                                      )}
                                      <button onClick={() => { setEditingItem(item); setEditForm({ urgency: item.urgency, status: item.status, due_date: item.due_date || "", notes: item.notes || "" }); }}
                                        style={{ background: "#EEF2FF", border: "1px solid #C7D2FE", color: "#4F46E5", borderRadius: 6, padding: "4px 10px", fontSize: 11, cursor: "pointer", fontWeight: 600 }}>
                                        Статус
                                      </button>
                                    </div>
                                  )}
                                </td>
                              </tr>
                            );
                          })}
                          <tr style={{ background: "#F9FAFB", borderTop: "2px solid #E5E7EB" }}>
                            <td colSpan={5} style={{ ...td, fontWeight: 700 }}>Итого по заказу</td>
                            <td style={{ ...td, fontWeight: 700, color: "#065F46" }}>
                              {orderItemsData[order.id].reduce((s: number, i: any) => s + Number(i.total_uzs || 0), 0) > 0
                                ? formatUZS(orderItemsData[order.id].reduce((s: number, i: any) => s + Number(i.total_uzs || 0), 0))
                                : <span style={{ color: "#9CA3AF" }}>—</span>}
                            </td>
                            <td style={{ ...td, fontWeight: 700, color: "#065F46" }}>
                              {orderItemsData[order.id].reduce((s: number, i: any) => s + Number(i.total_usd || 0), 0) > 0
                                ? formatUSD(orderItemsData[order.id].reduce((s: number, i: any) => s + Number(i.total_usd || 0), 0))
                                : <span style={{ color: "#9CA3AF" }}>—</span>}
                            </td>
                            <td colSpan={5} />
                          </tr>
                        </tbody>
                      </table>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* NEW ORDER MODAL */}
      {modalOpen && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.45)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 999 }}>
          <div style={{ background: "#fff", borderRadius: 16, padding: 28, width: "min(1100px, 96vw)", maxHeight: "92vh", overflowY: "auto", boxShadow: "0 24px 60px rgba(0,0,0,0.2)" }}>
            <h2 style={{ fontSize: 20, fontWeight: 700, marginBottom: 20 }}>Новый заказ</h2>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 14, marginBottom: 20 }}>
              <div>
                <label style={lbl}>Клиент *</label>
                <select value={selectedClientId}
                  onChange={e => { setSelectedClientId(e.target.value); loadClientPrices(e.target.value); }}
                  style={{ width: "100%", padding: "9px 12px", border: "1px solid #E5E7EB", borderRadius: 8, fontSize: 13, color: "#374151" }}>
                  <option value="">Выберите клиента...</option>
                  {clients.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </div>
              <div>
                <label style={lbl}>Дата заказа *</label>
                <input type="date" value={orderDate} onChange={e => setOrderDate(e.target.value)}
                  style={{ width: "100%", boxSizing: "border-box", padding: "9px 12px", border: "1px solid #E5E7EB", borderRadius: 8, fontSize: 13 }} />
              </div>
              <div>
                <label style={lbl}>Примечание</label>
                <input value={orderNotes} onChange={e => setOrderNotes(e.target.value)} placeholder="Необязательно"
                  style={{ width: "100%", boxSizing: "border-box", padding: "9px 12px", border: "1px solid #E5E7EB", borderRadius: 8, fontSize: 13 }} />
              </div>
            </div>

            {dueDateError && (
              <div style={{ background: "#FEF2F2", border: "1px solid #FECACA", borderRadius: 8, padding: "10px 16px", marginBottom: 16, color: "#B91C1C", fontSize: 13, fontWeight: 600 }}>
                ⚠️ {dueDateError}
              </div>
            )}

            {!selectedClientId ? (
              <div style={{ padding: 32, background: "#F9FAFB", borderRadius: 10, textAlign: "center", color: "#9CA3AF", marginBottom: 20 }}>Сначала выберите клиента</div>
            ) : pricedProducts.length === 0 ? (
              <div style={{ padding: 20, background: "#FEF2F2", borderRadius: 10, color: "#B91C1C", fontSize: 13, marginBottom: 20 }}>У этого клиента нет товаров с ценами. Установите цены в карточке клиента.</div>
            ) : (
              <div style={{ border: "1px solid #E5E7EB", borderRadius: 10, overflowX: "auto", marginBottom: 20 }}>
                <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
                  <thead>
                    <tr style={{ background: "#F9FAFB" }}>
                      <th style={th}>Код</th>
                      <th style={th}>Товар</th>
                      <th style={th}>Цена (UZS)</th>
                      <th style={th}>Цена (USD)</th>
                      <th style={{ ...th, width: 110 }}>Кол-во</th>
                      <th style={{ ...th, minWidth: 200, whiteSpace: "nowrap" }}>Итого</th>
                      <th style={th}>Срочность</th>
                      <th style={th}>Статус</th>
                      <th style={{ ...th, color: "#B91C1C" }}>Срок * <span style={{ fontSize: 10, fontWeight: 400 }}>(обязательно)</span></th>
                      <th style={th}>Заметка</th>
                    </tr>
                  </thead>
                  <tbody>
                    {pricedProducts.map(p => {
                      const pr = clientPrices[p.id];
                      const item = newItem(p.id);
                      const qty = Number(item.qty || 0);
                      const active = qty > 0;
                      const missingDate = active && !item.due_date;
                      const lineUZS = pr.uzs * qty;
                      const lineUSD = pr.usd * qty;
                      return (
                        <tr key={p.id} style={{ borderTop: "1px solid #F3F4F6", background: active ? "#F0FDF4" : "transparent" }}>
                          <td style={td}><span style={{ fontFamily: "monospace", fontSize: 11, background: "#F3F4F6", padding: "2px 6px", borderRadius: 4 }}>{p.product_code || "-"}</span></td>
                          <td style={{ ...td, fontWeight: 600 }}>{p.name}</td>
                          <td style={td}>{pr.uzs > 0 ? formatUZS(pr.uzs) : <span style={{ color: "#9CA3AF" }}>—</span>}</td>
                          <td style={td}>{pr.usd > 0 ? formatUSD(pr.usd) : <span style={{ color: "#9CA3AF" }}>—</span>}</td>
                          <td style={td}>
                            <input type="number" min="0" placeholder="0" value={item.qty}
                              onChange={e => { setOrderItems({ ...orderItems, [p.id]: { ...newItem(p.id), qty: e.target.value } }); setDueDateError(null); }}
                              style={{ width: 90, padding: "6px 8px", border: "1px solid #E5E7EB", borderRadius: 6, fontSize: 13, textAlign: "center" }} />
                          </td>
                          <td style={{ ...td, fontWeight: active ? 700 : 400, color: active ? "#065F46" : "#9CA3AF", whiteSpace: "nowrap", minWidth: 200 }}>
                            {active ? (
                              <div>
                                {lineUZS > 0 && <div style={{ whiteSpace: "nowrap" }}>{formatUZS(lineUZS)}</div>}
                                {lineUSD > 0 && <div style={{ whiteSpace: "nowrap" }}>{formatUSD(lineUSD)}</div>}
                              </div>
                            ) : "—"}
                          </td>
                          <td style={td}>
                            <select value={item.urgency} onChange={e => setOrderItems({ ...orderItems, [p.id]: { ...newItem(p.id), urgency: e.target.value } })}
                              style={{ padding: "5px 8px", border: "1px solid #E5E7EB", borderRadius: 6, fontSize: 12, color: "#374151" }}>
                              {Object.entries(URGENCY_CONFIG).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
                            </select>
                          </td>
                          <td style={td}>
                            <select value={item.status} onChange={e => setOrderItems({ ...orderItems, [p.id]: { ...newItem(p.id), status: e.target.value } })}
                              style={{ padding: "5px 8px", border: "1px solid #E5E7EB", borderRadius: 6, fontSize: 12, color: "#374151" }}>
                              {Object.entries(STATUS_CONFIG).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
                            </select>
                          </td>
                          <td style={td}>
                            <input type="date" value={item.due_date}
                              onChange={e => { setOrderItems({ ...orderItems, [p.id]: { ...newItem(p.id), due_date: e.target.value } }); setDueDateError(null); }}
                              style={{ padding: "5px 8px", border: `1px solid ${missingDate && dueDateError ? "#EF4444" : "#E5E7EB"}`, borderRadius: 6, fontSize: 12, background: missingDate && dueDateError ? "#FEF2F2" : "#fff" }}
                            />
                            {missingDate && dueDateError && <div style={{ fontSize: 10, color: "#EF4444", marginTop: 2 }}>Обязательно!</div>}
                          </td>
                          <td style={td}>
                            <input type="text" placeholder="Заметка" value={item.notes}
                              onChange={e => setOrderItems({ ...orderItems, [p.id]: { ...newItem(p.id), notes: e.target.value } })}
                              style={{ width: 100, padding: "5px 8px", border: "1px solid #E5E7EB", borderRadius: 6, fontSize: 12 }} />
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}

            {(modalTotalUZS > 0 || modalTotalUSD > 0) && (
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 20 }}>
                {modalTotalUZS > 0 && (
                  <div style={{ background: "#ECFDF5", border: "1px solid #A7F3D0", borderRadius: 10, padding: "12px 16px" }}>
                    <div style={{ fontSize: 11, color: "#6B7280" }}>Итого (UZS)</div>
                    <div style={{ fontSize: 18, fontWeight: 700, color: "#065F46" }}>{formatUZS(modalTotalUZS)}</div>
                  </div>
                )}
                {modalTotalUSD > 0 && (
                  <div style={{ background: "#ECFDF5", border: "1px solid #A7F3D0", borderRadius: 10, padding: "12px 16px" }}>
                    <div style={{ fontSize: 11, color: "#6B7280" }}>Итого (USD)</div>
                    <div style={{ fontSize: 18, fontWeight: 700, color: "#065F46" }}>{formatUSD(modalTotalUSD)}</div>
                  </div>
                )}
              </div>
            )}

            <div style={{ display: "flex", gap: 10 }}>
              <button onClick={() => { setModalOpen(false); setSelectedClientId(""); setClientPrices({}); setOrderItems({}); setOrderNotes(""); setDueDateError(null); }}
                style={{ flex: 1, padding: 11, borderRadius: 8, border: "1px solid #E5E7EB", background: "#fff", fontWeight: 600, fontSize: 13, cursor: "pointer" }}>Отмена</button>
              <button onClick={saveOrder} disabled={savingOrder}
                style={{ flex: 2, padding: 11, borderRadius: 8, border: "none", background: savingOrder ? "#9CA3AF" : "#4F46E5", color: "#fff", fontWeight: 600, fontSize: 14, cursor: savingOrder ? "not-allowed" : "pointer" }}>
                {savingOrder ? "Сохранение..." : "Создать заказ"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* EDIT QTY/PRICE MODAL */}
      {editQtyItem && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.45)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000 }}>
          <div style={{ background: "#fff", borderRadius: 16, padding: 28, width: 400, boxShadow: "0 24px 60px rgba(0,0,0,0.2)" }}>
            <h2 style={{ fontSize: 18, fontWeight: 700, marginBottom: 4 }}>Редактировать товар</h2>
            <p style={{ fontSize: 13, color: "#6B7280", marginBottom: 20 }}>{editQtyItem.products?.name}</p>
            <div style={{ background: "#FFF7ED", border: "1px solid #FED7AA", borderRadius: 8, padding: "8px 14px", marginBottom: 16, fontSize: 12, color: "#C2410C" }}>
              ℹ️ Редактирование доступно только пока статус <b>Новый</b>. После подтверждения изменить нельзя.
            </div>
            <div style={{ marginBottom: 14 }}>
              <label style={lbl}>Количество</label>
              <input type="number" min="1" value={editQtyForm.quantity} onChange={e => setEditQtyForm({ ...editQtyForm, quantity: e.target.value })}
                style={{ width: "100%", boxSizing: "border-box", padding: "9px 12px", border: "1px solid #E5E7EB", borderRadius: 8, fontSize: 13 }} />
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 20 }}>
              <div>
                <label style={lbl}>Цена (UZS)</label>
                <input type="number" min="0" value={editQtyForm.price_uzs} onChange={e => setEditQtyForm({ ...editQtyForm, price_uzs: e.target.value })}
                  style={{ width: "100%", boxSizing: "border-box", padding: "9px 12px", border: "1px solid #E5E7EB", borderRadius: 8, fontSize: 13 }} />
              </div>
              <div>
                <label style={lbl}>Цена (USD)</label>
                <input type="number" min="0" value={editQtyForm.price_usd} onChange={e => setEditQtyForm({ ...editQtyForm, price_usd: e.target.value })}
                  style={{ width: "100%", boxSizing: "border-box", padding: "9px 12px", border: "1px solid #E5E7EB", borderRadius: 8, fontSize: 13 }} />
              </div>
            </div>
            {Number(editQtyForm.quantity) > 0 && (
              <div style={{ background: "#ECFDF5", border: "1px solid #A7F3D0", borderRadius: 8, padding: "10px 14px", marginBottom: 16, fontSize: 13 }}>
                Итого: <b>{formatUZS(Number(editQtyForm.price_uzs) * Number(editQtyForm.quantity))}</b> / <b>{formatUSD(Number(editQtyForm.price_usd) * Number(editQtyForm.quantity))}</b>
              </div>
            )}
            <div style={{ display: "flex", gap: 10 }}>
              <button onClick={() => setEditQtyItem(null)}
                style={{ flex: 1, padding: 10, borderRadius: 8, border: "1px solid #E5E7EB", background: "#fff", fontWeight: 600, fontSize: 13, cursor: "pointer" }}>Отмена</button>
              <button onClick={saveQtyEdit} disabled={savingQty}
                style={{ flex: 2, padding: 10, borderRadius: 8, border: "none", background: savingQty ? "#9CA3AF" : "#059669", color: "#fff", fontWeight: 600, fontSize: 13, cursor: savingQty ? "not-allowed" : "pointer" }}>
                {savingQty ? "Сохранение..." : "Сохранить"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* EDIT STATUS MODAL */}
      {editingItem && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.45)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000 }}>
          <div style={{ background: "#fff", borderRadius: 16, padding: 28, width: 440, boxShadow: "0 24px 60px rgba(0,0,0,0.2)" }}>
            <h2 style={{ fontSize: 18, fontWeight: 700, marginBottom: 6 }}>Редактировать статус</h2>
            <p style={{ fontSize: 13, color: "#6B7280", marginBottom: 20 }}>{editingItem.products?.name}</p>

            <div style={{ marginBottom: 14 }}>
              <label style={lbl}>Срочность</label>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8 }}>
                {Object.entries(URGENCY_CONFIG).map(([k, v]) => (
                  <button key={k} onClick={() => setEditForm({ ...editForm, urgency: k })}
                    style={{ padding: "8px 6px", borderRadius: 8, border: `2px solid ${editForm.urgency === k ? v.color : "#E5E7EB"}`, background: editForm.urgency === k ? v.bg : "#fff", fontSize: 12, fontWeight: 600, cursor: "pointer", color: editForm.urgency === k ? v.color : "#374151" }}>
                    {v.label}
                  </button>
                ))}
              </div>
            </div>

            <div style={{ marginBottom: 14 }}>
              <label style={lbl}>Статус процесса</label>
              <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                {Object.entries(STATUS_CONFIG).map(([k, v]) => {
                  const currentIdx = STATUS_ORDER.indexOf(editingItem.status);
                  const targetIdx = STATUS_ORDER.indexOf(k);
                  const isDisabled = editingItem.status !== "new" && targetIdx < currentIdx;
                  return (
                    <button key={k} disabled={isDisabled}
                      onClick={() => !isDisabled && setEditForm({ ...editForm, status: k })}
                      style={{ padding: "9px 14px", borderRadius: 8, border: `2px solid ${editForm.status === k ? v.color : "#E5E7EB"}`, background: isDisabled ? "#F9FAFB" : editForm.status === k ? v.bg : "#fff", fontSize: 13, fontWeight: 600, cursor: isDisabled ? "not-allowed" : "pointer", color: isDisabled ? "#9CA3AF" : editForm.status === k ? v.color : "#374151", textAlign: "left", opacity: isDisabled ? 0.5 : 1 }}>
                      {editForm.status === k ? "✓ " : ""}{v.label}
                      {isDisabled && <span style={{ fontSize: 10, marginLeft: 8, fontWeight: 400 }}>🔒 нельзя вернуть</span>}
                    </button>
                  );
                })}
              </div>
            </div>

            <div style={{ marginBottom: 14 }}>
              <label style={lbl}>Срок выполнения</label>
              <input type="date" value={editForm.due_date} onChange={e => setEditForm({ ...editForm, due_date: e.target.value })}
                style={{ width: "100%", boxSizing: "border-box", padding: "9px 12px", border: "1px solid #E5E7EB", borderRadius: 8, fontSize: 13 }} />
            </div>
            <div style={{ marginBottom: 20 }}>
              <label style={lbl}>Заметка</label>
              <textarea value={editForm.notes} onChange={e => setEditForm({ ...editForm, notes: e.target.value })} placeholder="Заметка..." rows={3}
                style={{ width: "100%", boxSizing: "border-box", padding: "9px 12px", border: "1px solid #E5E7EB", borderRadius: 8, fontSize: 13, resize: "none" }} />
            </div>
            <div style={{ display: "flex", gap: 10 }}>
              <button onClick={() => setEditingItem(null)}
                style={{ flex: 1, padding: 10, borderRadius: 8, border: "1px solid #E5E7EB", background: "#fff", fontWeight: 600, fontSize: 13, cursor: "pointer" }}>Отмена</button>
              <button onClick={() => updateOrderItem(editingItem.id, editForm)}
                style={{ flex: 2, padding: 10, borderRadius: 8, border: "none", background: "#4F46E5", color: "#fff", fontWeight: 600, fontSize: 13, cursor: "pointer" }}>Сохранить</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

const th: React.CSSProperties = { padding: "10px 14px", textAlign: "left", fontSize: 12, fontWeight: 600, color: "#6B7280" };
const td: React.CSSProperties = { padding: "10px 14px", color: "#111827" };
const lbl: React.CSSProperties = { fontSize: 12, fontWeight: 600, color: "#374151", display: "block", marginBottom: 6 };