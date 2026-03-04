"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";

const AVATAR_COLORS = ["#7C3AED","#2563EB","#059669","#D97706","#DB2777","#0891B2","#DC2626","#65A30D"];
function getAvatarColor(id: string) { return AVATAR_COLORS[id.charCodeAt(0) % AVATAR_COLORS.length]; }
function getInitials(name: string) { return name.split(" ").slice(0,2).map((w) => w[0]?.toUpperCase()).join(""); }
function formatUZS(n: number) { return new Intl.NumberFormat("uz-UZ").format(n) + " UZS"; }
function formatUSD(n: number) { return "$" + new Intl.NumberFormat("en-US", { minimumFractionDigits: 2 }).format(n); }

type Tab = "info" | "prices" | "transactions" | "shipments" | "orders" | "act";

// ─── Orders config ────────────────────────────────────────────────────────────
const URGENCY_CONFIG: Record<string, { label: string; bg: string; color: string; border: string }> = {
  normal:   { label: "Обычный",       bg: "#F9FAFB", color: "#374151", border: "#E5E7EB" },
  urgent:   { label: "Срочный",       bg: "#FFF7ED", color: "#C2410C", border: "#FED7AA" },
  critical: { label: "Очень срочный", bg: "#FEF2F2", color: "#B91C1C", border: "#FECACA" },
};
const ITEM_STATUS_CONFIG: Record<string, { label: string; bg: string; color: string }> = {
  new:        { label: "Новый",          bg: "#EEF2FF", color: "#4338CA" },
  confirmed:  { label: "Подтверждён",    bg: "#F0FDF4", color: "#15803D" },
  production: { label: "В производстве", bg: "#FFF7ED", color: "#C2410C" },
  ready:      { label: "Готов",          bg: "#ECFDF5", color: "#065F46" },
  shipped:    { label: "Отгружен",       bg: "#F3F4F6", color: "#374151" },
};
const ORDER_STATUS_CONFIG: Record<string, { label: string; bg: string; color: string }> = {
  new:         { label: "Новый",       bg: "#EEF2FF", color: "#4338CA" },
  in_progress: { label: "В процессе",  bg: "#FFF7ED", color: "#C2410C" },
  ready:       { label: "Готов",       bg: "#ECFDF5", color: "#065F46" },
  completed:   { label: "Завершён",    bg: "#F3F4F6", color: "#374151" },
  cancelled:   { label: "Отменён",     bg: "#FEF2F2", color: "#B91C1C" },
};
const STATUS_ORDER_ARR = ["new", "confirmed", "production", "ready", "shipped"];
function computeOrderStatus(items: any[]): string {
  if (!items || items.length === 0) return "new";
  const statuses = items.map((i: any) => i.status);
  if (statuses.every((s: string) => s === "shipped")) return "completed";
  if (statuses.every((s: string) => s === "ready" || s === "shipped")) return "ready";
  if (statuses.some((s: string) => s === "production" || s === "ready" || s === "shipped")) return "in_progress";
  if (statuses.some((s: string) => s === "confirmed")) return "in_progress";
  return "new";
}

const emptyTxForm = {
  type: "payment",
  amount_uzs: "",
  amount_usd: "",
  payment_method: "cash",
  description: "",
  date: new Date().toISOString().split("T")[0],
};

export default function ClientDetailPage() {
  const params = useParams();
  const clientId = params.id as string;
  const router = useRouter();

  const [client, setClient] = useState<any>(null);
  const [tab, setTab] = useState<Tab>("info");
  const [loading, setLoading] = useState(true);

  // Prices
  const [products, setProducts] = useState<any[]>([]);
  const [prices, setPrices] = useState<Record<string, { uzs: number; usd: number }>>({});
  const [savingPrice, setSavingPrice] = useState<string | null>(null);

  // Transactions
  const [transactions, setTransactions] = useState<any[]>([]);
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [txLoading, setTxLoading] = useState(false);
  const [txModal, setTxModal] = useState(false);
  const [editingTxId, setEditingTxId] = useState<string | null>(null);
  const [txForm, setTxForm] = useState({ ...emptyTxForm });

  // Shipments
  const [shipments, setShipments] = useState<any[]>([]);
  const [shipLoading, setShipLoading] = useState(false);
  const [shipDateFrom, setShipDateFrom] = useState("");
  const [shipDateTo, setShipDateTo] = useState("");
  const [shipModal, setShipModal] = useState(false);
  const [shipDate, setShipDate] = useState(new Date().toISOString().split("T")[0]);
  const [shipNotes, setShipNotes] = useState("");
  const [shipItems, setShipItems] = useState<Record<string, { qty: string }>>({});
  const [savingShip, setSavingShip] = useState(false);
  const [expandedShipment, setExpandedShipment] = useState<string | null>(null);
  const [shipmentItems, setShipmentItems] = useState<Record<string, any[]>>({});

  // ACT
  const [actDateFrom, setActDateFrom] = useState("");
  const [actDateTo, setActDateTo] = useState("");
  const [actTx, setActTx] = useState<any[]>([]);
  const [actShipments, setActShipments] = useState<any[]>([]);
  const [actLoading, setActLoading] = useState(false);

  // Orders
  const [orders, setOrders] = useState<any[]>([]);
  const [expandedOrder, setExpandedOrder] = useState<string | null>(null);
  const [orderItemsData, setOrderItemsData] = useState<Record<string, any[]>>({});
  const [editingOrderItem, setEditingOrderItem] = useState<any | null>(null);
  const [editOrderForm, setEditOrderForm] = useState<any>({});
  const [editQtyItem, setEditQtyItem] = useState<any | null>(null);
  const [editQtyForm, setEditQtyForm] = useState({ quantity: "", price_uzs: "", price_usd: "" });
  const [savingQty, setSavingQty] = useState(false);

  useEffect(() => {
    if (clientId) {
      loadClient();
      loadProducts();
      loadPrices();
      loadTransactions();
      loadShipments();
      loadOrders();
    }
  }, [clientId]);

  async function loadClient() {
    const { data } = await supabase.from("clients").select("*").eq("id", clientId).single();
    setClient(data);
    setLoading(false);
  }

  async function loadProducts() {
    const { data } = await supabase.from("products").select("*").order("category");
    setProducts(data || []);
  }

  async function loadPrices() {
    const { data } = await supabase.from("client_prices").select("*").eq("client_id", clientId);
    const map: Record<string, { uzs: number; usd: number }> = {};
    (data || []).forEach((p: any) => { map[p.product_id] = { uzs: p.price_uzs, usd: p.price_usd }; });
    setPrices(map);
  }

  async function savePrice(productId: string, uzs: number, usd: number) {
    setSavingPrice(productId);
    await supabase.from("client_prices").upsert(
      { client_id: clientId, product_id: productId, price_uzs: uzs, price_usd: usd },
      { onConflict: "client_id,product_id" }
    );
    setSavingPrice(null);
  }

  async function loadTransactions() {
    setTxLoading(true);
    let query = supabase.from("client_transactions").select("*").eq("client_id", clientId).order("created_at", { ascending: false });
    if (dateFrom) query = query.gte("created_at", dateFrom);
    if (dateTo) query = query.lte("created_at", dateTo + "T23:59:59");
    const { data } = await query;
    setTransactions(data || []);
    setTxLoading(false);
  }

  async function saveTx() {
    await supabase.from("client_transactions").insert({
      client_id: clientId,
      type: txForm.type,
      amount_uzs: Number(txForm.amount_uzs) || 0,
      amount_usd: Number(txForm.amount_usd) || 0,
      payment_method: txForm.payment_method,
      description: txForm.description,
      created_at: txForm.date ? new Date(txForm.date).toISOString() : new Date().toISOString(),
    });
    closeTxModal();
    loadTransactions();
  }

  async function updateTx() {
    await supabase.from("client_transactions").update({
      type: txForm.type,
      amount_uzs: Number(txForm.amount_uzs) || 0,
      amount_usd: Number(txForm.amount_usd) || 0,
      payment_method: txForm.payment_method,
      description: txForm.description,
      created_at: txForm.date ? new Date(txForm.date).toISOString() : undefined,
    }).eq("id", editingTxId as string);
    closeTxModal();
    loadTransactions();
  }

  async function deleteTx(txId: string) {
    if (!confirm("Удалить транзакцию?")) return;
    await supabase.from("client_transactions").delete().eq("id", txId);
    loadTransactions();
  }

  function openEditTx(t: any) {
    setEditingTxId(t.id);
    setTxForm({
      type: t.type || "payment",
      amount_uzs: String(t.amount_uzs || ""),
      amount_usd: String(t.amount_usd || ""),
      payment_method: t.payment_method || "cash",
      description: t.description || "",
      date: t.created_at ? t.created_at.split("T")[0] : new Date().toISOString().split("T")[0],
    });
    setTxModal(true);
  }

  function closeTxModal() {
    setTxModal(false);
    setEditingTxId(null);
    setTxForm({ ...emptyTxForm, date: new Date().toISOString().split("T")[0] });
  }

  // ─── SHIPMENTS ───────────────────────────────────────────────────────────────

  async function loadShipments() {
    setShipLoading(true);
    let query = supabase.from("shipments").select("*").eq("client_id", clientId).order("date", { ascending: false });
    if (shipDateFrom) query = query.gte("date", shipDateFrom);
    if (shipDateTo) query = query.lte("date", shipDateTo);
    const { data } = await query;
    setShipments(data || []);
    setShipLoading(false);
  }

  async function loadShipmentItems(shipmentId: string) {
    if (shipmentItems[shipmentId]) return;
    const { data } = await supabase
      .from("shipment_items")
      .select("*, products(name, category, product_code)")
      .eq("shipment_id", shipmentId);
    setShipmentItems(prev => ({ ...prev, [shipmentId]: data || [] }));
  }

  function toggleShipment(shipmentId: string) {
    if (expandedShipment === shipmentId) {
      setExpandedShipment(null);
    } else {
      setExpandedShipment(shipmentId);
      loadShipmentItems(shipmentId);
    }
  }

  const pricedProducts = products.filter(p => prices[p.id]);

  async function saveShipment() {
    const items = Object.entries(shipItems)
      .filter(([, v]) => Number(v.qty) > 0)
      .map(([productId, v]) => {
        const pr = prices[productId] || { uzs: 0, usd: 0 };
        const qty = Number(v.qty);
        return { product_id: productId, quantity: qty, price_uzs: pr.uzs, price_usd: pr.usd, total_uzs: pr.uzs * qty, total_usd: pr.usd * qty };
      });

    if (items.length === 0) { alert("Добавьте хотя бы один товар!"); return; }

    setSavingShip(true);
    const { data: ship } = await supabase.from("shipments").insert({
      client_id: clientId, date: shipDate, status: "confirmed", notes: shipNotes,
    }).select().single();

    if (!ship) { setSavingShip(false); return; }

    await supabase.from("shipment_items").insert(items.map(item => ({ ...item, shipment_id: ship.id })));

    const totalUZS = items.reduce((s, i) => s + i.total_uzs, 0);
    const totalUSD = items.reduce((s, i) => s + i.total_usd, 0);

    await supabase.from("client_transactions").insert({
      client_id: clientId, type: "shipment",
      amount_uzs: totalUZS, amount_usd: totalUSD,
      payment_method: "transfer",
      description: `Отгрузка от ${shipDate}`,
      created_at: new Date(shipDate).toISOString(),
    });

    setSavingShip(false);
    setShipModal(false);
    setShipItems({});
    setShipNotes("");
    setShipDate(new Date().toISOString().split("T")[0]);
    setShipmentItems({});
    loadShipments();
    loadTransactions();
  }

  async function deleteShipment(shipId: string) {
    if (!confirm("Удалить отгрузку?")) return;
    await supabase.from("shipments").delete().eq("id", shipId);
    loadShipments();
  }

  // ─── ACT ─────────────────────────────────────────────────────────────────────

  async function loadAct() {
    setActLoading(true);

    let txQuery = supabase
      .from("client_transactions")
      .select("*")
      .eq("client_id", clientId)
      .order("created_at", { ascending: true });
    if (actDateFrom) txQuery = txQuery.gte("created_at", actDateFrom);
    if (actDateTo) txQuery = txQuery.lte("created_at", actDateTo + "T23:59:59");
    const { data: txData } = await txQuery;

    let shipQuery = supabase
      .from("shipments")
      .select("*, shipment_items(*, products(name, product_code))")
      .eq("client_id", clientId)
      .order("date", { ascending: true });
    if (actDateFrom) shipQuery = shipQuery.gte("date", actDateFrom);
    if (actDateTo) shipQuery = shipQuery.lte("date", actDateTo);
    const { data: shipData } = await shipQuery;

    setActTx(txData || []);
    setActShipments(shipData || []);
    setActLoading(false);
  }

  useEffect(() => {
    if (tab === "act") loadAct();
  }, [tab]);

  function getPaymentTypeLabel(t: any): string {
    if (t.payment_type) {
      if (t.payment_type === "sum") return "💵 Наличные";
      if (t.payment_type === "usd") return "💲 Доллар";
      if (t.payment_type === "rs") return "🏦 Bank sum";
      if (t.payment_type === "rs_usd") return "🏦💲 Bank $";
    }
    if (t.payment_method === "cash") return "💵 Наличные";
    if (t.payment_method === "card") return "💳 Карта";
    if (t.payment_method === "order") return "";
    if (t.payment_method === "transfer") return "🏦 Перечисление";
    return "";
  }

  function getAmounts(t: any): { uzs: number; usd: number } {
    const isUSD = t.payment_type === "usd" || t.payment_type === "rs_usd";
    if (isUSD) return { uzs: 0, usd: Number(t.amount_usd || 0) };
    if (t.payment_type === "rs") return { uzs: Number(t.amount_uzs || 0), usd: 0 };
    return { uzs: Number(t.amount_uzs || 0), usd: Number(t.amount_usd || 0) };
  }

  function downloadActPDF() {
    const allRows: any[] = [];

    actTx.forEach(t => {
      if (t.type === "shipment") return; // shipments handled separately
      const isExpenseOrReturn = t.type === "return" || t.type === "expense";
      const { uzs, usd } = getAmounts(t);
      const typeLabel = t.type === "payment" ? "Поступление"
        : t.type === "return" ? "Возврат"
        : "Расход";
      allRows.push({
        date: t.created_at,
        type: typeLabel,
        description: t.description || "-",
        debit_uzs: isExpenseOrReturn ? uzs : 0,
        debit_usd: isExpenseOrReturn ? usd : 0,
        credit_uzs: !isExpenseOrReturn ? uzs : 0,
        credit_usd: !isExpenseOrReturn ? usd : 0,
        method: getPaymentTypeLabel(t),
      });
    });

    actShipments.forEach(s => {
      const totalUZS = (s.shipment_items || []).reduce((sum: number, i: any) => sum + Number(i.total_uzs || 0), 0);
      const totalUSD = (s.shipment_items || []).reduce((sum: number, i: any) => sum + Number(i.total_usd || 0), 0);
      allRows.push({
        date: s.date + "T00:00:00",
        type: "Отгрузка",
        description: s.notes || `Отгрузка от ${new Date(s.date).toLocaleDateString("ru-RU")}`,
        debit_uzs: totalUZS,
        debit_usd: totalUSD,
        credit_uzs: 0,
        credit_usd: 0,
        method: "---",
      });
    });

    allRows.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

    let balUZS = 0, balUSD = 0;
    const rows = allRows.map(r => {
      balUZS += r.credit_uzs - r.debit_uzs;
      balUSD += r.credit_usd - r.debit_usd;
      return `<tr>
        <td>${new Date(r.date).toLocaleDateString("ru-RU")}</td>
        <td>${r.type}</td>
        <td>${r.description}</td>
        <td>${r.method}</td>
        <td style="color:#065F46">${r.credit_uzs ? formatUZS(r.credit_uzs) : "-"}</td>
        <td style="color:#065F46">${r.credit_usd ? formatUSD(r.credit_usd) : "-"}</td>
        <td style="color:#B91C1C">${r.debit_uzs ? formatUZS(r.debit_uzs) : "-"}</td>
        <td style="color:#B91C1C">${r.debit_usd ? formatUSD(r.debit_usd) : "-"}</td>
        <td style="font-weight:600;color:${balUZS >= 0 ? "#065F46" : "#B91C1C"}">${formatUZS(balUZS)}</td>
        <td style="font-weight:600;color:${balUSD >= 0 ? "#065F46" : "#B91C1C"}">${formatUSD(balUSD)}</td>
      </tr>`;
    }).join("");

    const html = `<html><head><meta charset="utf-8">
    <style>
      body{font-family:Arial,sans-serif;padding:32px;color:#111;font-size:12px}
      h1{font-size:20px;margin-bottom:4px}
      p{color:#666;margin:0 0 20px}
      table{width:100%;border-collapse:collapse}
      th{background:#F3F4F6;padding:8px;text-align:left;border:1px solid #E5E7EB;font-size:11px}
      td{padding:7px 8px;border:1px solid #E5E7EB}
      .total{margin-top:16px;font-size:14px;font-weight:bold;padding:12px;background:#F9FAFB;border-radius:8px}
    </style></head>
    <body>
      <h1>Акт сверки — ${client?.name}</h1>
      <p>Период: ${actDateFrom || "начало"} — ${actDateTo || "сегодня"} &nbsp;|&nbsp; Дата печати: ${new Date().toLocaleDateString("ru-RU")}</p>
      <table>
        <thead><tr>
          <th>Дата</th><th>Тип</th><th>Описание</th><th>Касса</th>
          <th>Приход (UZS)</th><th>Приход (USD)</th>
          <th>Расход (UZS)</th><th>Расход (USD)</th>
          <th>Баланс (UZS)</th><th>Баланс (USD)</th>
        </tr></thead>
        <tbody>${rows}</tbody>
      </table>
      <div class="total">
        Итоговый баланс: ${formatUZS(balUZS)} &nbsp;/&nbsp; ${formatUSD(balUSD)}
      </div>
    </body></html>`;

    const win = window.open("", "_blank");
    if (win) { win.document.write(html); win.document.close(); win.print(); }
  }

  async function loadOrders() {
    const { data } = await supabase.from("orders").select("*").eq("client_id", clientId).order("created_at", { ascending: false });
    setOrders(data || []);
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

  async function saveQtyEdit() {
    if (!editQtyItem) return;
    setSavingQty(true);
    const qty = Number(editQtyForm.quantity);
    const price_uzs = Number(editQtyForm.price_uzs);
    const price_usd = Number(editQtyForm.price_usd);
    await supabase.from("order_items").update({
      quantity: qty, price_uzs, price_usd,
      total_uzs: price_uzs * qty, total_usd: price_usd * qty,
    }).eq("id", editQtyItem.id);
    const orderId = Object.keys(orderItemsData).find(oid => orderItemsData[oid]?.some((i: any) => i.id === editQtyItem.id));
    if (orderId) {
      await reloadOrderItems(orderId);
      const { data: allItems } = await supabase.from("order_items").select("total_uzs, total_usd").eq("order_id", orderId);
      const newTotalUZS = (allItems || []).reduce((s: number, i: any) => s + Number(i.total_uzs), 0);
      const newTotalUSD = (allItems || []).reduce((s: number, i: any) => s + Number(i.total_usd), 0);
      await supabase.from("orders").update({ total_uzs: newTotalUZS, total_usd: newTotalUSD }).eq("id", orderId);
      await loadOrders();
    }
    setSavingQty(false);
    setEditQtyItem(null);
  }

  async function updateOrderItem(itemId: string, fields: any) {
    const orderId = Object.keys(orderItemsData).find(oid => orderItemsData[oid]?.some((i: any) => i.id === itemId));
    const currentItem = orderId ? orderItemsData[orderId]?.find((i: any) => i.id === itemId) : null;
    await supabase.from("order_items").update(fields).eq("id", itemId);
    if (fields.status === "shipped" && currentItem && currentItem.status !== "shipped") {
      const shipDate = fields.due_date || currentItem.due_date || new Date().toISOString().split("T")[0];
      const prodName = currentItem.products?.name || "Товар";
      const prodCode = currentItem.products?.product_code || "";
      const { data: ship } = await supabase.from("shipments").insert({
        client_id: clientId, date: shipDate, status: "confirmed",
        notes: `Из заказа: ${prodCode ? "[" + prodCode + "] " : ""}${prodName}`,
      }).select().single();
      if (ship) {
        await supabase.from("shipment_items").insert({
          shipment_id: ship.id, product_id: currentItem.product_id,
          quantity: currentItem.quantity, price_uzs: currentItem.price_uzs,
          price_usd: currentItem.price_usd, total_uzs: currentItem.total_uzs, total_usd: currentItem.total_usd,
        });
        await supabase.from("client_transactions").insert({
          client_id: clientId, type: "shipment",
          amount_uzs: currentItem.total_uzs, amount_usd: currentItem.total_usd,
          payment_method: "transfer",
          description: `Отгрузка из заказа: ${prodCode ? "[" + prodCode + "] " : ""}${prodName}`,
          created_at: new Date(shipDate).toISOString(),
        });
      }
    }
    if (orderId) await reloadOrderItems(orderId);
    setEditingOrderItem(null);
  }

  async function deleteOrder(orderId: string) {
    if (!confirm("Удалить заказ?")) return;
    await supabase.from("orders").delete().eq("id", orderId);
    loadOrders();
  }

  function downloadTxPDF() {
    const totalUZS = transactions.reduce((s, t) => t.type === "payment" ? s + Number(t.amount_uzs) : t.type === "shipment" ? s - Number(t.amount_uzs) : s, 0);
    const totalUSD = transactions.reduce((s, t) => t.type === "payment" ? s + Number(t.amount_usd) : t.type === "shipment" ? s - Number(t.amount_usd) : s, 0);
    const rows = transactions.map((t) => `<tr><td>${new Date(t.created_at).toLocaleDateString("ru-RU")}</td><td>${t.type === "payment" ? "Поступление" : t.type === "shipment" ? "Отгрузка" : "Возврат"}</td><td>${t.description || "-"}</td><td>${t.amount_uzs ? formatUZS(t.amount_uzs) : "-"}</td><td>${t.amount_usd ? formatUSD(t.amount_usd) : "-"}</td><td>${t.payment_method === "cash" ? "Наличные" : t.payment_method === "card" ? "Карта" : "Перечисление"}</td></tr>`).join("");
    const html = `<html><head><meta charset="utf-8"><style>body{font-family:Arial,sans-serif;padding:40px;color:#111}table{width:100%;border-collapse:collapse;font-size:13px}th{background:#F3F4F6;padding:10px;text-align:left;border:1px solid #E5E7EB}td{padding:9px;border:1px solid #E5E7EB}.total{margin-top:20px;font-size:15px;font-weight:bold}</style></head><body><h1>Транзакции — ${client?.name}</h1><p>Период: ${dateFrom || "начало"} — ${dateTo || "сегодня"} | ${new Date().toLocaleDateString("ru-RU")}</p><table><thead><tr><th>Дата</th><th>Тип</th><th>Описание</th><th>UZS</th><th>USD</th><th>Метод</th></tr></thead><tbody>${rows}</tbody></table><div class="total">Баланс: ${formatUZS(totalUZS)} / ${formatUSD(totalUSD)}</div></body></html>`;
    const win = window.open("", "_blank");
    if (win) { win.document.write(html); win.document.close(); win.print(); }
  }

  if (loading) return <div style={{ padding: 40, color: "#9CA3AF" }}>Loading...</div>;
  if (!client) return <div style={{ padding: 40 }}><div style={{ color: "#EF4444" }}>Client not found.</div><Link href="/clients" style={{ color: "#4F46E5" }}>← Back</Link></div>;

  const TABS: { key: Tab; label: string }[] = [
    { key: "info", label: "Информация" },
    { key: "prices", label: "Цены" },
    { key: "orders", label: "Заказы" },
    { key: "act", label: "Все операции" },
  ];

  const grouped = products.reduce((acc: any, p: any) => {
    const w = p.category || "Прочие";
    if (!acc[w]) acc[w] = [];
    acc[w].push(p);
    return acc;
  }, {});

  const txTotalUZS = transactions.reduce((s, t) => t.type === "payment" ? s + Number(t.amount_uzs) : t.type === "shipment" ? s - Number(t.amount_uzs) : s, 0);
  const txTotalUSD = transactions.reduce((s, t) => t.type === "payment" ? s + Number(t.amount_usd) : t.type === "shipment" ? s - Number(t.amount_usd) : s, 0);
  const totalПоступUZS = transactions.filter(t => t.type === "payment").reduce((s, t) => s + Number(t.amount_uzs || 0), 0);
  const totalПоступUSD = transactions.filter(t => t.type === "payment").reduce((s, t) => s + Number(t.amount_usd || 0), 0);
  const totalОтгрузкиUZS = transactions.filter(t => t.type === "shipment").reduce((s, t) => s + Number(t.amount_uzs || 0), 0);
  const totalОтгрузкиUSD = transactions.filter(t => t.type === "shipment").reduce((s, t) => s + Number(t.amount_usd || 0), 0);

  const shipTotalUZS = Object.entries(shipItems).reduce((s, [pid, v]) => s + (prices[pid]?.uzs || 0) * (Number(v.qty) || 0), 0);
  const shipTotalUSD = Object.entries(shipItems).reduce((s, [pid, v]) => s + (prices[pid]?.usd || 0) * (Number(v.qty) || 0), 0);

  // ─── ACT computed ─────────────────────────────────────────────────────────────
  // Include payment, return, expense from transactions + shipments
  const txRows: any[] = actTx
    .filter(t => ["payment", "return", "expense"].includes(t.type))
    .map(t => {
      const isExpenseOrReturn = t.type === "return" || t.type === "expense";
      const { uzs, usd } = getAmounts(t);
      const typeLabel = t.type === "payment" ? "Поступление"
        : t.type === "return" ? "Возврат"
        : "Расход";
      return {
        date: t.created_at,
        source: "tx",
        type: typeLabel,
        description: t.description || "-",
        credit_uzs: !isExpenseOrReturn ? uzs : 0,
        credit_usd: !isExpenseOrReturn ? usd : 0,
        debit_uzs: isExpenseOrReturn ? uzs : 0,
        debit_usd: isExpenseOrReturn ? usd : 0,
        method: getPaymentTypeLabel(t),
        itemNames: "",
      };
    });

  const shipRows: any[] = actShipments.map(s => {
    const totalUZS = (s.shipment_items || []).reduce((sum: number, i: any) => sum + Number(i.total_uzs || 0), 0);
    const totalUSD = (s.shipment_items || []).reduce((sum: number, i: any) => sum + Number(i.total_usd || 0), 0);
    const itemNames = (s.shipment_items || []).map((i: any) => `${i.products?.product_code ? "["+i.products.product_code+"] " : ""}${i.products?.name || "?"} x${i.quantity}`).join(", ");
    return {
      date: s.date + "T00:00:00",
      source: "shipment",
      type: "Отгрузка",
      description: s.notes ? s.notes : `Отгрузка от ${new Date(s.date).toLocaleDateString("ru-RU")}`,
      credit_uzs: 0,
      credit_usd: 0,
      debit_uzs: totalUZS,
      debit_usd: totalUSD,
      method: "---",
      itemNames,
    };
  });

  const actAllRows: any[] = [...txRows, ...shipRows]
    .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

  let runBalUZS = 0, runBalUSD = 0;
  const actRowsWithBal = actAllRows.map(r => {
    runBalUZS += r.credit_uzs - r.debit_uzs;
    runBalUSD += r.credit_usd - r.debit_usd;
    return { ...r, balUZS: runBalUZS, balUSD: runBalUSD };
  });

  const typeColors: Record<string, { bg: string; color: string }> = {
    "Поступление": { bg: "#ECFDF5", color: "#065F46" },
    "Отгрузка":    { bg: "#EEF2FF", color: "#4338CA" },
    "Возврат":     { bg: "#FFFBEB", color: "#B45309" },
    "Расход":      { bg: "#FEF2F2", color: "#B91C1C" },
  };

  return (
    <div style={{ padding: 32 }}>

      {/* BREADCRUMB */}
      <div style={{ fontSize: 13, color: "#9CA3AF", marginBottom: 20, display: "flex", alignItems: "center", gap: 6 }}>
        <Link href="/clients" style={{ color: "#4F46E5", textDecoration: "none" }}>Clients</Link>
        <span>›</span>
        <span style={{ color: "#374151", fontWeight: 500 }}>{client.name}</span>
      </div>

      {/* HEADER */}
      <div style={{ background: "#fff", border: "1px solid #E5E7EB", borderRadius: 16, padding: 28, marginBottom: 24, display: "flex", alignItems: "center", gap: 20 }}>
        <div style={{ width: 64, height: 64, borderRadius: 16, background: getAvatarColor(client.id), color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 22, fontWeight: 700, flexShrink: 0 }}>
          {getInitials(client.name)}
        </div>
        <div style={{ flex: 1 }}>
          <h1 style={{ fontSize: 22, fontWeight: 700, color: "#111827", margin: 0 }}>{client.name}</h1>
          <div style={{ display: "flex", gap: 12, marginTop: 6, flexWrap: "wrap" }}>
            {client.phone_number && <span style={{ fontSize: 13, color: "#6B7280" }}>📞 {client.phone_number}</span>}
            {client.address && <span style={{ fontSize: 13, color: "#6B7280" }}>📍 {client.address}</span>}
          </div>
        </div>
        <button onClick={() => router.back()} style={{ background: "#F9FAFB", border: "1px solid #E5E7EB", borderRadius: 8, padding: "8px 16px", fontSize: 13, cursor: "pointer" }}>← Back</button>
      </div>

      {/* TABS */}
      <div style={{ display: "flex", gap: 4, marginBottom: 24, background: "#F3F4F6", borderRadius: 10, padding: 4, width: "fit-content" }}>
        {TABS.map((t) => (
          <button key={t.key} onClick={() => setTab(t.key)} style={{
            padding: "8px 20px", borderRadius: 8, border: "none", fontSize: 13, fontWeight: 600, cursor: "pointer",
            background: tab === t.key ? "#fff" : "transparent",
            color: tab === t.key ? "#111827" : "#6B7280",
            boxShadow: tab === t.key ? "0 1px 4px rgba(0,0,0,0.1)" : "none",
          }}>{t.label}</button>
        ))}
      </div>

      {/* TAB: INFO */}
      {tab === "info" && (
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
          {[
            { label: "Client ID", value: client.id },
            { label: "Client Code", value: client.client_code || "-" },
            { label: "Phone", value: client.phone_number || "-" },
            { label: "Address", value: client.address || "-" },
            { label: "Email", value: client.email || "-" },
            { label: "Contact Person", value: client.contact_person || "-" },
            { label: "Notes", value: client.notes || "-" },
            { label: "Created", value: new Date(client.created_at).toLocaleDateString("ru-RU") },
          ].map((item) => (
            <div key={item.label} style={{ background: "#fff", border: "1px solid #E5E7EB", borderRadius: 12, padding: "16px 20px" }}>
              <div style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", color: "#9CA3AF", marginBottom: 6 }}>{item.label}</div>
              <div style={{ fontSize: 14, color: "#111827", wordBreak: "break-all" }}>{item.value}</div>
            </div>
          ))}
        </div>
      )}

      {/* TAB: PRICES */}
      {tab === "prices" && (
        <div>
          <h2 style={{ fontSize: 16, fontWeight: 700, marginBottom: 16 }}>Individual Prices for {client.name}</h2>
          {Object.keys(grouped).length === 0 && <div style={{ color: "#9CA3AF", padding: 20 }}>No products found.</div>}
          {Object.entries(grouped).map(([workshop, prods]: any) => (
            <div key={workshop} style={{ marginBottom: 24 }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: "#4F46E5", marginBottom: 10, textTransform: "uppercase" }}>🏭 {workshop}</div>
              <div style={{ background: "#fff", border: "1px solid #E5E7EB", borderRadius: 12, overflow: "hidden" }}>
                <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
                  <thead>
                    <tr style={{ background: "#F9FAFB", borderBottom: "1px solid #E5E7EB" }}>
                      <th style={th}>Product</th><th style={th}>Price (UZS)</th><th style={th}>Price (USD)</th><th style={th}>Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {prods.map((p: any) => {
                      const pr = prices[p.id] || { uzs: 0, usd: 0 };
                      return (
                        <tr key={p.id} style={{ borderBottom: "1px solid #F3F4F6" }}>
                          <td style={{ ...td, fontWeight: 500 }}>{p.name}</td>
                          <td style={td}><input type="number" value={pr.uzs} onChange={(e) => setPrices({ ...prices, [p.id]: { ...pr, uzs: Number(e.target.value) } })} style={{ width: 140, padding: "6px 10px", border: "1px solid #E5E7EB", borderRadius: 8, fontSize: 13 }} /></td>
                          <td style={td}><input type="number" value={pr.usd} onChange={(e) => setPrices({ ...prices, [p.id]: { ...pr, usd: Number(e.target.value) } })} style={{ width: 120, padding: "6px 10px", border: "1px solid #E5E7EB", borderRadius: 8, fontSize: 13 }} /></td>
                          <td style={td}><button onClick={() => savePrice(p.id, pr.uzs, pr.usd)} disabled={savingPrice === p.id} style={{ background: "#4F46E5", color: "#fff", border: "none", borderRadius: 8, padding: "6px 14px", fontSize: 12, fontWeight: 600, cursor: "pointer" }}>{savingPrice === p.id ? "Saving..." : "Save"}</button></td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* TAB: TRANSACTIONS */}
      {tab === "transactions" && (
        <div>
          <div style={{ display: "flex", gap: 12, alignItems: "flex-end", marginBottom: 20, flexWrap: "wrap", justifyContent: "space-between" }}>
            <div style={{ display: "flex", gap: 12, alignItems: "flex-end", flexWrap: "wrap" }}>
              <div><label style={lbl}>From</label><input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} style={{ padding: "8px 12px", border: "1px solid #E5E7EB", borderRadius: 8, fontSize: 13 }} /></div>
              <div><label style={lbl}>To</label><input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} style={{ padding: "8px 12px", border: "1px solid #E5E7EB", borderRadius: 8, fontSize: 13 }} /></div>
              <button onClick={loadTransactions} style={{ background: "#4F46E5", color: "#fff", border: "none", borderRadius: 8, padding: "8px 16px", fontSize: 13, fontWeight: 600, cursor: "pointer" }}>Filter</button>
              <button onClick={downloadTxPDF} style={{ background: "#059669", color: "#fff", border: "none", borderRadius: 8, padding: "8px 16px", fontSize: 13, fontWeight: 600, cursor: "pointer" }}>📄 PDF</button>
            </div>
            <button onClick={() => { setEditingTxId(null); setTxForm({ ...emptyTxForm, date: new Date().toISOString().split("T")[0] }); setTxModal(true); }}
              style={{ background: "#4F46E5", color: "#fff", border: "none", borderRadius: 8, padding: "8px 18px", fontSize: 13, fontWeight: 600, cursor: "pointer" }}>
              + Add Transaction
            </button>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr 1fr", gap: 12, marginBottom: 16 }}>
            {[
              { label: "Поступления (UZS)", value: formatUZS(totalПоступUZS), color: "#065F46", bg: "#ECFDF5", border: "#A7F3D0" },
              { label: "Поступления (USD)", value: formatUSD(totalПоступUSD), color: "#065F46", bg: "#ECFDF5", border: "#A7F3D0" },
              { label: "Отгрузки (UZS)", value: formatUZS(totalОтгрузкиUZS), color: "#B91C1C", bg: "#FEF2F2", border: "#FECACA" },
              { label: "Отгрузки (USD)", value: formatUSD(totalОтгрузкиUSD), color: "#B91C1C", bg: "#FEF2F2", border: "#FECACA" },
            ].map((card) => (
              <div key={card.label} style={{ background: card.bg, border: `1px solid ${card.border}`, borderRadius: 12, padding: "14px 18px" }}>
                <div style={{ fontSize: 11, color: "#6B7280", marginBottom: 4 }}>{card.label}</div>
                <div style={{ fontSize: 17, fontWeight: 700, color: card.color }}>{card.value}</div>
              </div>
            ))}
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 20 }}>
            <div style={{ background: txTotalUZS >= 0 ? "#ECFDF5" : "#FEF2F2", border: `1px solid ${txTotalUZS >= 0 ? "#A7F3D0" : "#FECACA"}`, borderRadius: 12, padding: "14px 18px" }}>
              <div style={{ fontSize: 11, color: "#6B7280", marginBottom: 4 }}>Баланс (UZS)</div>
              <div style={{ fontSize: 20, fontWeight: 700, color: txTotalUZS >= 0 ? "#065F46" : "#B91C1C" }}>{formatUZS(txTotalUZS)}</div>
            </div>
            <div style={{ background: txTotalUSD >= 0 ? "#ECFDF5" : "#FEF2F2", border: `1px solid ${txTotalUSD >= 0 ? "#A7F3D0" : "#FECACA"}`, borderRadius: 12, padding: "14px 18px" }}>
              <div style={{ fontSize: 11, color: "#6B7280", marginBottom: 4 }}>Баланс (USD)</div>
              <div style={{ fontSize: 20, fontWeight: 700, color: txTotalUSD >= 0 ? "#065F46" : "#B91C1C" }}>{formatUSD(txTotalUSD)}</div>
            </div>
          </div>

          {txLoading ? <div style={{ color: "#9CA3AF", padding: 20 }}>Loading...</div> : (
            <div style={{ background: "#fff", border: "1px solid #E5E7EB", borderRadius: 12, overflow: "hidden" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
                <thead>
                  <tr style={{ background: "#F9FAFB", borderBottom: "1px solid #E5E7EB" }}>
                    <th style={th}>Дата</th><th style={th}>Тип</th><th style={th}>Описание</th>
                    <th style={th}>Сумма (UZS)</th><th style={th}>Сумма (USD)</th><th style={th}>Метод</th><th style={th}></th>
                  </tr>
                </thead>
                <tbody>
                  {transactions.length === 0 ? (
                    <tr><td colSpan={7} style={{ textAlign: "center", padding: 32, color: "#9CA3AF" }}>No transactions</td></tr>
                  ) : transactions.map((t) => (
                    <tr key={t.id} style={{ borderBottom: "1px solid #F3F4F6" }}>
                      <td style={td}>{new Date(t.created_at).toLocaleDateString("ru-RU")}</td>
                      <td style={td}>
                        <span style={{ padding: "3px 10px", borderRadius: 20, fontSize: 11, fontWeight: 600, background: t.type === "payment" ? "#ECFDF5" : t.type === "shipment" ? "#EEF2FF" : "#FEF2F2", color: t.type === "payment" ? "#065F46" : t.type === "shipment" ? "#4338CA" : "#B91C1C" }}>
                          {t.type === "payment" ? "Поступление" : t.type === "shipment" ? "Отгрузка" : "Возврат"}
                        </span>
                      </td>
                      <td style={td}>{t.description || "-"}</td>
                      <td style={td}>{t.amount_uzs ? formatUZS(Number(t.amount_uzs)) : "-"}</td>
                      <td style={td}>{t.amount_usd ? formatUSD(Number(t.amount_usd)) : "-"}</td>
                      <td style={td}>{t.payment_method === "cash" ? "Наличные" : t.payment_method === "card" ? "Карта" : t.payment_method === "transfer" ? "Перечисление" : "-"}</td>
                      <td style={td}>
                        <div style={{ display: "flex", gap: 6 }}>
                          <button onClick={() => openEditTx(t)} style={{ background: "#EEF2FF", border: "1px solid #C7D2FE", color: "#4F46E5", borderRadius: 6, padding: "4px 10px", fontSize: 11, cursor: "pointer" }}>Edit</button>
                          <button onClick={() => deleteTx(t.id)} style={{ background: "#FEF2F2", border: "1px solid #FECACA", color: "#EF4444", borderRadius: 6, padding: "4px 10px", fontSize: 11, cursor: "pointer" }}>Delete</button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* TAB: SHIPMENTS */}
      {tab === "shipments" && (
        <div>
          <div style={{ display: "flex", gap: 12, alignItems: "flex-end", marginBottom: 20, flexWrap: "wrap", justifyContent: "space-between" }}>
            <div style={{ display: "flex", gap: 12, alignItems: "flex-end", flexWrap: "wrap" }}>
              <div><label style={lbl}>From</label><input type="date" value={shipDateFrom} onChange={(e) => setShipDateFrom(e.target.value)} style={{ padding: "8px 12px", border: "1px solid #E5E7EB", borderRadius: 8, fontSize: 13 }} /></div>
              <div><label style={lbl}>To</label><input type="date" value={shipDateTo} onChange={(e) => setShipDateTo(e.target.value)} style={{ padding: "8px 12px", border: "1px solid #E5E7EB", borderRadius: 8, fontSize: 13 }} /></div>
              <button onClick={loadShipments} style={{ background: "#4F46E5", color: "#fff", border: "none", borderRadius: 8, padding: "8px 16px", fontSize: 13, fontWeight: 600, cursor: "pointer" }}>Filter</button>
            </div>
            <button onClick={() => setShipModal(true)} style={{ background: "#4F46E5", color: "#fff", border: "none", borderRadius: 8, padding: "8px 18px", fontSize: 13, fontWeight: 600, cursor: "pointer" }}>
              + Новая отгрузка
            </button>
          </div>

          {shipLoading ? <div style={{ color: "#9CA3AF", padding: 20 }}>Loading...</div> : shipments.length === 0 ? (
            <div style={{ background: "#fff", border: "1px solid #E5E7EB", borderRadius: 12, padding: 40, textAlign: "center", color: "#9CA3AF" }}>Нет отгрузок</div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              {shipments.map((s) => (
                <div key={s.id} style={{ background: "#fff", border: "1px solid #E5E7EB", borderRadius: 12, overflow: "hidden" }}>
                  <div style={{ display: "flex", alignItems: "center", padding: "16px 20px", gap: 16, cursor: "pointer" }} onClick={() => toggleShipment(s.id)}>
                    <div style={{ fontSize: 20 }}>📦</div>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontWeight: 600, fontSize: 14 }}>Отгрузка от {new Date(s.date).toLocaleDateString("ru-RU")}</div>
                      {s.notes && <div style={{ fontSize: 12, color: "#6B7280", marginTop: 2 }}>{s.notes}</div>}
                    </div>
                    <span style={{ padding: "3px 10px", borderRadius: 20, fontSize: 11, fontWeight: 600, background: "#ECFDF5", color: "#065F46" }}>Подтверждено</span>
                    <button onClick={(e) => { e.stopPropagation(); deleteShipment(s.id); }} style={{ background: "#FEF2F2", border: "1px solid #FECACA", color: "#EF4444", borderRadius: 6, padding: "4px 10px", fontSize: 11, cursor: "pointer" }}>Delete</button>
                    <span style={{ fontSize: 18, color: "#9CA3AF" }}>{expandedShipment === s.id ? "▲" : "▼"}</span>
                  </div>
                  {expandedShipment === s.id && (
                    <div style={{ borderTop: "1px solid #F3F4F6" }}>
                      {!shipmentItems[s.id] ? (
                        <div style={{ padding: 20, color: "#9CA3AF" }}>Loading...</div>
                      ) : (
                        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
                          <thead>
                            <tr style={{ background: "#F9FAFB" }}>
                              <th style={th}>Код</th><th style={th}>Товар</th><th style={th}>Кол-во</th><th style={th}>Цена (UZS)</th><th style={th}>Цена (USD)</th><th style={th}>Итого (UZS)</th><th style={th}>Итого (USD)</th>
                            </tr>
                          </thead>
                          <tbody>
                            {shipmentItems[s.id].map((item: any) => (
                              <tr key={item.id} style={{ borderTop: "1px solid #F3F4F6" }}>
                                <td style={td}><span style={{ fontFamily: "monospace", fontSize: 11, background: "#F3F4F6", padding: "2px 6px", borderRadius: 4, color: "#374151" }}>{item.products?.product_code || "-"}</span></td>
                                <td style={{ ...td, fontWeight: 500 }}>{item.products?.name || "-"}</td>
                                <td style={td}>{item.quantity}</td>
                                <td style={td}>{formatUZS(item.price_uzs)}</td>
                                <td style={td}>{formatUSD(item.price_usd)}</td>
                                <td style={{ ...td, fontWeight: 600, color: "#065F46" }}>{formatUZS(item.total_uzs)}</td>
                                <td style={{ ...td, fontWeight: 600, color: "#065F46" }}>{formatUSD(item.total_usd)}</td>
                              </tr>
                            ))}
                            <tr style={{ background: "#F9FAFB", borderTop: "2px solid #E5E7EB" }}>
                              <td style={{ ...td, fontWeight: 700 }} colSpan={4}>Итого</td>
                              <td style={{ ...td, fontWeight: 700, color: "#065F46" }}>{formatUZS(shipmentItems[s.id].reduce((sum: number, i: any) => sum + Number(i.total_uzs), 0))}</td>
                              <td style={{ ...td, fontWeight: 700, color: "#065F46" }}>{formatUSD(shipmentItems[s.id].reduce((sum: number, i: any) => sum + Number(i.total_usd), 0))}</td>
                            </tr>
                          </tbody>
                        </table>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* TAB: ORDERS */}
      {tab === "orders" && (
        <div>
          {orders.length === 0 ? (
            <div style={{ background: "#fff", border: "1px solid #E5E7EB", borderRadius: 12, padding: 48, textAlign: "center", color: "#9CA3AF" }}>Нет заказов</div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              {orders.map(order => {
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
                          {order.order_number && (
                            <span style={{ fontSize: 11, fontFamily: "monospace", background: "#EEF2FF", color: "#4338CA", padding: "2px 8px", borderRadius: 6, fontWeight: 600 }}>
                              {order.order_number}
                            </span>
                          )}
                          {hasCritical && <span style={{ fontSize: 11, fontWeight: 700, background: "#FEF2F2", color: "#B91C1C", padding: "2px 8px", borderRadius: 20 }}>🔴 СРОЧНО</span>}
                          {!hasCritical && hasUrgent && <span style={{ fontSize: 11, fontWeight: 700, background: "#FFF7ED", color: "#C2410C", padding: "2px 8px", borderRadius: 20 }}>🟠 Срочный</span>}
                        </div>
                        <div style={{ fontSize: 12, color: "#6B7280", marginTop: 4, display: "flex", gap: 12, flexWrap: "wrap" }}>
                          <span>📅 {order.date ? new Date(order.date).toLocaleDateString("ru-RU") : new Date(order.created_at).toLocaleDateString("ru-RU")}</span>
                          <span style={{ color: "#9CA3AF" }}>создан: {new Date(order.created_at).toLocaleDateString("ru-RU")} {new Date(order.created_at).toLocaleTimeString("ru-RU", { hour: "2-digit", minute: "2-digit" })}</span>
                          {order.notes && <span>📝 {order.notes}</span>}
                        </div>
                      </div>
                      <div style={{ display: "flex", gap: 16, alignItems: "center" }}>
                        {order.total_uzs > 0 && (
                          <div style={{ textAlign: "right" }}>
                            <div style={{ fontSize: 14, fontWeight: 700, color: "#111827" }}>{formatUZS(order.total_uzs)}</div>
                            {order.total_usd > 0 && <div style={{ fontSize: 12, color: "#6B7280" }}>{formatUSD(order.total_usd)}</div>}
                          </div>
                        )}
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
                                <th style={th}>Цена (UZS)</th><th style={th}>Итого (UZS)</th>
                                <th style={th}>Срочность</th><th style={th}>Статус</th>
                                <th style={th}>Срок</th><th style={th}>Заметка</th><th style={th}></th>
                              </tr>
                            </thead>
                            <tbody>
                              {orderItemsData[order.id].map((item: any) => {
                                const urg = URGENCY_CONFIG[item.urgency] || URGENCY_CONFIG.normal;
                                const st = ITEM_STATUS_CONFIG[item.status] || ITEM_STATUS_CONFIG.new;
                                const isOverdue = item.due_date && new Date(item.due_date) < new Date() && item.status !== "shipped";
                                const isNew = item.status === "new";
                                return (
                                  <tr key={item.id} style={{ borderTop: "1px solid #F3F4F6", background: item.urgency === "critical" ? "#FFF5F5" : "transparent" }}>
                                    <td style={td}><span style={{ fontFamily: "monospace", fontSize: 11, background: "#F3F4F6", padding: "2px 6px", borderRadius: 4 }}>{item.products?.product_code || "-"}</span></td>
                                    <td style={{ ...td, fontWeight: 600 }}>{item.products?.name || "-"}</td>
                                    <td style={td}>{item.quantity}</td>
                                    <td style={td}>{formatUZS(item.price_uzs)}</td>
                                    <td style={{ ...td, fontWeight: 700, color: "#065F46" }}>{formatUZS(item.total_uzs)}</td>
                                    <td style={td}><span style={{ padding: "3px 10px", borderRadius: 20, fontSize: 11, fontWeight: 600, background: urg.bg, color: urg.color, border: `1px solid ${urg.border}` }}>{urg.label}</span></td>
                                    <td style={td}><span style={{ padding: "3px 10px", borderRadius: 20, fontSize: 11, fontWeight: 600, background: st.bg, color: st.color }}>{st.label}</span></td>
                                    <td style={td}>
                                      {item.due_date ? (
                                        <span style={{ color: isOverdue ? "#B91C1C" : "#374151", fontWeight: isOverdue ? 700 : 400 }}>
                                          {isOverdue ? "⚠️ " : ""}{new Date(item.due_date).toLocaleDateString("ru-RU")}
                                        </span>
                                      ) : <span style={{ color: "#9CA3AF" }}>—</span>}
                                    </td>
                                    <td style={{ ...td, color: "#6B7280", maxWidth: 140 }}><span style={{ display: "block", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{item.notes || "—"}</span></td>
                                    <td style={td}>
                                      {item.status === "shipped" ? (
                                        <span style={{ fontSize: 11, color: "#6B7280", fontStyle: "italic" }}>✅ Отгружен</span>
                                      ) : (
                                        <div style={{ display: "flex", gap: 5 }}>
                                          {isNew && (
                                            <button onClick={() => { setEditQtyItem(item); setEditQtyForm({ quantity: String(item.quantity), price_uzs: String(item.price_uzs), price_usd: String(item.price_usd) }); }}
                                              style={{ background: "#F0FDF4", border: "1px solid #A7F3D0", color: "#065F46", borderRadius: 6, padding: "4px 10px", fontSize: 11, cursor: "pointer", fontWeight: 600 }}>
                                              ✏️ Кол-во
                                            </button>
                                          )}
                                          <button onClick={() => { setEditingOrderItem(item); setEditOrderForm({ urgency: item.urgency, status: item.status, due_date: item.due_date || "", notes: item.notes || "" }); }}
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
                                <td colSpan={4} style={{ ...td, fontWeight: 700 }}>Итого по заказу</td>
                                <td style={{ ...td, fontWeight: 700, color: "#065F46" }}>{formatUZS(orderItemsData[order.id].reduce((s: number, i: any) => s + Number(i.total_uzs || 0), 0))}</td>
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

          {/* EDIT QTY MODAL */}
          {editQtyItem && (
            <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.45)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000 }}>
              <div style={{ background: "#fff", borderRadius: 16, padding: 28, width: 400, boxShadow: "0 24px 60px rgba(0,0,0,0.2)" }}>
                <h2 style={{ fontSize: 18, fontWeight: 700, marginBottom: 4 }}>Редактировать товар</h2>
                <p style={{ fontSize: 13, color: "#6B7280", marginBottom: 20 }}>{editQtyItem.products?.name}</p>
                <div style={{ background: "#FFF7ED", border: "1px solid #FED7AA", borderRadius: 8, padding: "8px 14px", marginBottom: 16, fontSize: 12, color: "#C2410C" }}>
                  ℹ️ Редактирование доступно только пока статус <b>Новый</b>.
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
                  <button onClick={() => setEditQtyItem(null)} style={{ flex: 1, padding: 10, borderRadius: 8, border: "1px solid #E5E7EB", background: "#fff", fontWeight: 600, fontSize: 13, cursor: "pointer" }}>Отмена</button>
                  <button onClick={saveQtyEdit} disabled={savingQty}
                    style={{ flex: 2, padding: 10, borderRadius: 8, border: "none", background: savingQty ? "#9CA3AF" : "#059669", color: "#fff", fontWeight: 600, fontSize: 13, cursor: savingQty ? "not-allowed" : "pointer" }}>
                    {savingQty ? "Сохранение..." : "Сохранить"}
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* EDIT STATUS MODAL */}
          {editingOrderItem && (
            <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.45)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000 }}>
              <div style={{ background: "#fff", borderRadius: 16, padding: 28, width: 440, boxShadow: "0 24px 60px rgba(0,0,0,0.2)" }}>
                <h2 style={{ fontSize: 18, fontWeight: 700, marginBottom: 6 }}>Редактировать статус</h2>
                <p style={{ fontSize: 13, color: "#6B7280", marginBottom: 20 }}>{editingOrderItem.products?.name}</p>
                <div style={{ marginBottom: 14 }}>
                  <label style={lbl}>Срочность</label>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8 }}>
                    {Object.entries(URGENCY_CONFIG).map(([k, v]) => (
                      <button key={k} onClick={() => setEditOrderForm({ ...editOrderForm, urgency: k })}
                        style={{ padding: "8px 6px", borderRadius: 8, border: `2px solid ${editOrderForm.urgency === k ? v.color : "#E5E7EB"}`, background: editOrderForm.urgency === k ? v.bg : "#fff", fontSize: 12, fontWeight: 600, cursor: "pointer", color: editOrderForm.urgency === k ? v.color : "#374151" }}>
                        {v.label}
                      </button>
                    ))}
                  </div>
                </div>
                <div style={{ marginBottom: 14 }}>
                  <label style={lbl}>Статус процесса</label>
                  <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                    {Object.entries(ITEM_STATUS_CONFIG).map(([k, v]) => {
                      const currentIdx = STATUS_ORDER_ARR.indexOf(editingOrderItem.status);
                      const targetIdx = STATUS_ORDER_ARR.indexOf(k);
                      const isDisabled = editingOrderItem.status !== "new" && targetIdx < currentIdx;
                      return (
                        <button key={k} disabled={isDisabled} onClick={() => !isDisabled && setEditOrderForm({ ...editOrderForm, status: k })}
                          style={{ padding: "9px 14px", borderRadius: 8, border: `2px solid ${editOrderForm.status === k ? v.color : "#E5E7EB"}`, background: isDisabled ? "#F9FAFB" : editOrderForm.status === k ? v.bg : "#fff", fontSize: 13, fontWeight: 600, cursor: isDisabled ? "not-allowed" : "pointer", color: isDisabled ? "#9CA3AF" : editOrderForm.status === k ? v.color : "#374151", textAlign: "left", opacity: isDisabled ? 0.5 : 1 }}>
                          {editOrderForm.status === k ? "✓ " : ""}{v.label}
                          {isDisabled && <span style={{ fontSize: 10, marginLeft: 8, fontWeight: 400 }}>🔒 нельзя вернуть</span>}
                        </button>
                      );
                    })}
                  </div>
                </div>
                <div style={{ marginBottom: 14 }}>
                  <label style={lbl}>Срок выполнения</label>
                  <input type="date" value={editOrderForm.due_date} onChange={e => setEditOrderForm({ ...editOrderForm, due_date: e.target.value })}
                    style={{ width: "100%", boxSizing: "border-box", padding: "9px 12px", border: "1px solid #E5E7EB", borderRadius: 8, fontSize: 13 }} />
                </div>
                <div style={{ marginBottom: 20 }}>
                  <label style={lbl}>Заметка</label>
                  <textarea value={editOrderForm.notes} onChange={e => setEditOrderForm({ ...editOrderForm, notes: e.target.value })} placeholder="Заметка..." rows={3}
                    style={{ width: "100%", boxSizing: "border-box", padding: "9px 12px", border: "1px solid #E5E7EB", borderRadius: 8, fontSize: 13, resize: "none" }} />
                </div>
                <div style={{ display: "flex", gap: 10 }}>
                  <button onClick={() => setEditingOrderItem(null)} style={{ flex: 1, padding: 10, borderRadius: 8, border: "1px solid #E5E7EB", background: "#fff", fontWeight: 600, fontSize: 13, cursor: "pointer" }}>Отмена</button>
                  <button onClick={() => updateOrderItem(editingOrderItem.id, editOrderForm)}
                    style={{ flex: 2, padding: 10, borderRadius: 8, border: "none", background: "#4F46E5", color: "#fff", fontWeight: 600, fontSize: 13, cursor: "pointer" }}>Сохранить</button>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* TAB: ACT */}
      {tab === "act" && (
        <div>
          {/* FILTERS */}
          <div style={{ display: "flex", gap: 12, alignItems: "flex-end", marginBottom: 20, flexWrap: "wrap", justifyContent: "space-between" }}>
            <div style={{ display: "flex", gap: 12, alignItems: "flex-end", flexWrap: "wrap" }}>
              <div><label style={lbl}>От</label><input type="date" value={actDateFrom} onChange={(e) => setActDateFrom(e.target.value)} style={{ padding: "8px 12px", border: "1px solid #E5E7EB", borderRadius: 8, fontSize: 13 }} /></div>
              <div><label style={lbl}>До</label><input type="date" value={actDateTo} onChange={(e) => setActDateTo(e.target.value)} style={{ padding: "8px 12px", border: "1px solid #E5E7EB", borderRadius: 8, fontSize: 13 }} /></div>
              <button onClick={loadAct} style={{ background: "#4F46E5", color: "#fff", border: "none", borderRadius: 8, padding: "8px 16px", fontSize: 13, fontWeight: 600, cursor: "pointer" }}>Фильтр</button>
            </div>
            <button onClick={downloadActPDF} style={{ background: "#059669", color: "#fff", border: "none", borderRadius: 8, padding: "8px 18px", fontSize: 13, fontWeight: 600, cursor: "pointer" }}>
              📄 Скачать PDF
            </button>
          </div>

          {/* SUMMARY */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 12, marginBottom: 20 }}>
            <div style={{ background: "#ECFDF5", border: "1px solid #A7F3D0", borderRadius: 12, padding: "14px 18px" }}>
              <div style={{ fontSize: 11, color: "#6B7280", marginBottom: 4 }}>Поступления (UZS)</div>
              <div style={{ fontSize: 17, fontWeight: 700, color: "#065F46" }}>{formatUZS(actAllRows.reduce((s, r) => s + r.credit_uzs, 0))}</div>
              <div style={{ fontSize: 12, color: "#6B7280", marginTop: 2 }}>{formatUSD(actAllRows.reduce((s, r) => s + r.credit_usd, 0))}</div>
            </div>
            <div style={{ background: "#FEF2F2", border: "1px solid #FECACA", borderRadius: 12, padding: "14px 18px" }}>
              <div style={{ fontSize: 11, color: "#6B7280", marginBottom: 4 }}>Расходы / Возвраты (UZS)</div>
              <div style={{ fontSize: 17, fontWeight: 700, color: "#B91C1C" }}>{formatUZS(actAllRows.filter(r => r.source === "tx" && r.type !== "Поступление").reduce((s, r) => s + r.debit_uzs, 0))}</div>
              <div style={{ fontSize: 12, color: "#6B7280", marginTop: 2 }}>{formatUSD(actAllRows.filter(r => r.source === "tx" && r.type !== "Поступление").reduce((s, r) => s + r.debit_usd, 0))}</div>
            </div>
            <div style={{ background: "#EEF2FF", border: "1px solid #C7D2FE", borderRadius: 12, padding: "14px 18px" }}>
              <div style={{ fontSize: 11, color: "#6B7280", marginBottom: 4 }}>Отгрузки (UZS)</div>
              <div style={{ fontSize: 17, fontWeight: 700, color: "#4338CA" }}>{formatUZS(actAllRows.filter(r => r.source === "shipment").reduce((s, r) => s + r.debit_uzs, 0))}</div>
              <div style={{ fontSize: 12, color: "#6B7280", marginTop: 2 }}>{formatUSD(actAllRows.filter(r => r.source === "shipment").reduce((s, r) => s + r.debit_usd, 0))}</div>
            </div>
            <div style={{ background: runBalUZS >= 0 ? "#ECFDF5" : "#FEF2F2", border: `1px solid ${runBalUZS >= 0 ? "#A7F3D0" : "#FECACA"}`, borderRadius: 12, padding: "14px 18px" }}>
              <div style={{ fontSize: 11, color: "#6B7280", marginBottom: 4 }}>Итоговый баланс</div>
              <div style={{ fontSize: 17, fontWeight: 700, color: runBalUZS >= 0 ? "#065F46" : "#B91C1C" }}>{formatUZS(runBalUZS)}</div>
              <div style={{ fontSize: 12, color: runBalUSD >= 0 ? "#065F46" : "#B91C1C", marginTop: 2, fontWeight: 600 }}>{formatUSD(runBalUSD)}</div>
            </div>
          </div>

          {/* TABLE */}
          {actLoading ? <div style={{ color: "#9CA3AF", padding: 20 }}>Loading...</div> : (
            <div style={{ background: "#fff", border: "1px solid #E5E7EB", borderRadius: 12, overflow: "hidden" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
                <thead>
                  <tr style={{ background: "#F9FAFB", borderBottom: "1px solid #E5E7EB" }}>
                    <th style={th}>Дата</th>
                    <th style={th}>Тип</th>
                    <th style={th}>Описание</th>
                    <th style={th}>Касса</th>
                    <th style={{ ...th, color: "#065F46" }}>Приход (UZS)</th>
                    <th style={{ ...th, color: "#065F46" }}>Приход (USD)</th>
                    <th style={{ ...th, color: "#B91C1C" }}>Расход (UZS)</th>
                    <th style={{ ...th, color: "#B91C1C" }}>Расход (USD)</th>
                    <th style={th}>Баланс (UZS)</th>
                    <th style={th}>Баланс (USD)</th>
                  </tr>
                </thead>
                <tbody>
                  {actRowsWithBal.length === 0 ? (
                    <tr><td colSpan={10} style={{ textAlign: "center", padding: 32, color: "#9CA3AF" }}>Нет данных</td></tr>
                  ) : actRowsWithBal.map((r, i) => {
                    const tc = typeColors[r.type] || { bg: "#F3F4F6", color: "#374151" };
                    return (
                      <tr key={i} style={{ borderBottom: "1px solid #F3F4F6", background: r.source === "shipment" ? "#FAFAFA" : "#fff" }}>
                        <td style={td}>{new Date(r.date).toLocaleDateString("ru-RU")}</td>
                        <td style={td}>
                          <span style={{ padding: "3px 10px", borderRadius: 20, fontSize: 11, fontWeight: 600, background: tc.bg, color: tc.color }}>
                            {r.type}
                          </span>
                        </td>
                        <td style={td}>
                          <div>{r.description}</div>
                          {r.itemNames && <div style={{ fontSize: 11, color: "#6B7280", marginTop: 2 }}>{r.itemNames}</div>}
                        </td>
                        <td style={{ ...td, color: "#6B7280", fontSize: 12 }}>{r.method}</td>
                        <td style={{ ...td, color: "#065F46", fontWeight: r.credit_uzs > 0 ? 600 : 400 }}>{r.credit_uzs > 0 ? formatUZS(r.credit_uzs) : "-"}</td>
                        <td style={{ ...td, color: "#065F46", fontWeight: r.credit_usd > 0 ? 600 : 400 }}>{r.credit_usd > 0 ? formatUSD(r.credit_usd) : "-"}</td>
                        <td style={{ ...td, color: "#B91C1C", fontWeight: r.debit_uzs > 0 ? 600 : 400 }}>{r.debit_uzs > 0 ? formatUZS(r.debit_uzs) : "-"}</td>
                        <td style={{ ...td, color: "#B91C1C", fontWeight: r.debit_usd > 0 ? 600 : 400 }}>{r.debit_usd > 0 ? formatUSD(r.debit_usd) : "-"}</td>
                        <td style={{ ...td, fontWeight: 700, color: r.balUZS >= 0 ? "#065F46" : "#B91C1C" }}>{formatUZS(r.balUZS)}</td>
                        <td style={{ ...td, fontWeight: 700, color: r.balUSD >= 0 ? "#065F46" : "#B91C1C" }}>{formatUSD(r.balUSD)}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* TRANSACTION MODAL */}
      {txModal && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.4)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 999 }}>
          <div style={{ background: "#fff", borderRadius: 16, padding: 28, width: 440, boxShadow: "0 20px 50px rgba(0,0,0,0.2)" }}>
            <h2 style={{ fontSize: 18, fontWeight: 700, marginBottom: 20 }}>{editingTxId ? "Редактировать" : "Добавить транзакцию"}</h2>
            <div style={{ marginBottom: 14 }}>
              <label style={lbl}>Тип операции</label>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                {[{ val: "payment", label: "💰 Поступление" }, { val: "shipment", label: "📦 Отгрузка" }].map((opt) => (
                  <button key={opt.val} onClick={() => setTxForm({ ...txForm, type: opt.val })}
                    style={{ padding: 10, borderRadius: 8, border: `2px solid ${txForm.type === opt.val ? "#4F46E5" : "#E5E7EB"}`, background: txForm.type === opt.val ? "#EEF2FF" : "#fff", fontWeight: 600, fontSize: 13, cursor: "pointer", color: txForm.type === opt.val ? "#4F46E5" : "#374151" }}>
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 14 }}>
              <div><label style={lbl}>Сумма (UZS)</label><input type="number" placeholder="0" value={txForm.amount_uzs} onChange={(e) => setTxForm({ ...txForm, amount_uzs: e.target.value })} style={{ width: "100%", boxSizing: "border-box", padding: "8px 12px", border: "1px solid #E5E7EB", borderRadius: 8, fontSize: 13 }} /></div>
              <div><label style={lbl}>Сумма (USD)</label><input type="number" placeholder="0" value={txForm.amount_usd} onChange={(e) => setTxForm({ ...txForm, amount_usd: e.target.value })} style={{ width: "100%", boxSizing: "border-box", padding: "8px 12px", border: "1px solid #E5E7EB", borderRadius: 8, fontSize: 13 }} /></div>
            </div>
            <div style={{ marginBottom: 14 }}>
              <label style={lbl}>Метод оплаты</label>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8 }}>
                {[{ val: "cash", label: "💵 Наличные" }, { val: "card", label: "💳 Карта" }, { val: "transfer", label: "🏦 Перечисление" }].map((opt) => (
                  <button key={opt.val} onClick={() => setTxForm({ ...txForm, payment_method: opt.val })}
                    style={{ padding: 8, borderRadius: 8, border: `2px solid ${txForm.payment_method === opt.val ? "#4F46E5" : "#E5E7EB"}`, background: txForm.payment_method === opt.val ? "#EEF2FF" : "#fff", fontWeight: 600, fontSize: 12, cursor: "pointer", color: txForm.payment_method === opt.val ? "#4F46E5" : "#374151" }}>
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>
            <div style={{ marginBottom: 14 }}><label style={lbl}>Дата операции</label><input type="date" value={txForm.date} onChange={(e) => setTxForm({ ...txForm, date: e.target.value })} style={{ width: "100%", boxSizing: "border-box", padding: "8px 12px", border: "1px solid #E5E7EB", borderRadius: 8, fontSize: 13 }} /></div>
            <div style={{ marginBottom: 20 }}><label style={lbl}>Описание</label><textarea placeholder="Описание операции..." value={txForm.description} onChange={(e) => setTxForm({ ...txForm, description: e.target.value })} style={{ width: "100%", boxSizing: "border-box", padding: "8px 12px", border: "1px solid #E5E7EB", borderRadius: 8, fontSize: 13, resize: "none", height: 80 }} /></div>
            <div style={{ display: "flex", gap: 10 }}>
              <button onClick={closeTxModal} style={{ flex: 1, padding: 10, borderRadius: 8, border: "1px solid #E5E7EB", background: "#fff", fontWeight: 600, fontSize: 13, cursor: "pointer" }}>Отмена</button>
              <button onClick={editingTxId ? updateTx : saveTx} style={{ flex: 2, padding: 10, borderRadius: 8, border: "none", background: "#4F46E5", color: "#fff", fontWeight: 600, fontSize: 13, cursor: "pointer" }}>{editingTxId ? "Сохранить" : "Добавить"}</button>
            </div>
          </div>
        </div>
      )}

      {/* SHIPMENT MODAL */}
      {shipModal && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.4)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 999 }}>
          <div style={{ background: "#fff", borderRadius: 16, padding: 28, width: 600, maxHeight: "90vh", overflowY: "auto", boxShadow: "0 20px 50px rgba(0,0,0,0.2)" }}>
            <h2 style={{ fontSize: 18, fontWeight: 700, marginBottom: 20 }}>Новая отгрузка — {client.name}</h2>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 16 }}>
              <div><label style={lbl}>Дата отгрузки</label><input type="date" value={shipDate} onChange={(e) => setShipDate(e.target.value)} style={{ width: "100%", boxSizing: "border-box", padding: "8px 12px", border: "1px solid #E5E7EB", borderRadius: 8, fontSize: 13 }} /></div>
              <div><label style={lbl}>Примечание</label><input type="text" placeholder="Необязательно" value={shipNotes} onChange={(e) => setShipNotes(e.target.value)} style={{ width: "100%", boxSizing: "border-box", padding: "8px 12px", border: "1px solid #E5E7EB", borderRadius: 8, fontSize: 13 }} /></div>
            </div>
            <label style={{ ...lbl, marginBottom: 10 }}>Товары (только с установленными ценами)</label>
            {pricedProducts.length === 0 ? (
              <div style={{ padding: 20, background: "#FEF2F2", borderRadius: 8, color: "#B91C1C", fontSize: 13, marginBottom: 16 }}>
                У этого клиента нет товаров с ценами. Сначала установите цены во вкладке Prices.
              </div>
            ) : (
              <div style={{ border: "1px solid #E5E7EB", borderRadius: 10, overflow: "hidden", marginBottom: 16 }}>
                <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
                  <thead>
                    <tr style={{ background: "#F9FAFB" }}>
                      <th style={th}>Код</th><th style={th}>Товар</th><th style={th}>Цена (UZS)</th><th style={th}>Цена (USD)</th><th style={{ ...th, width: 100 }}>Кол-во</th><th style={th}>Итого (UZS)</th>
                    </tr>
                  </thead>
                  <tbody>
                    {pricedProducts.map((p) => {
                      const pr = prices[p.id];
                      const qty = Number(shipItems[p.id]?.qty || 0);
                      return (
                        <tr key={p.id} style={{ borderTop: "1px solid #F3F4F6", background: qty > 0 ? "#F0FDF4" : "transparent" }}>
                          <td style={td}><span style={{ fontFamily: "monospace", fontSize: 11, background: "#F3F4F6", padding: "2px 6px", borderRadius: 4, color: "#374151" }}>{p.product_code || "-"}</span></td>
                          <td style={{ ...td, fontWeight: 500 }}>{p.name}</td>
                          <td style={td}>{formatUZS(pr.uzs)}</td>
                          <td style={td}>{formatUSD(pr.usd)}</td>
                          <td style={td}><input type="number" min="0" placeholder="0" value={shipItems[p.id]?.qty || ""} onChange={(e) => setShipItems({ ...shipItems, [p.id]: { qty: e.target.value } })} style={{ width: 80, padding: "6px 8px", border: "1px solid #E5E7EB", borderRadius: 6, fontSize: 13, textAlign: "center" }} /></td>
                          <td style={{ ...td, fontWeight: qty > 0 ? 600 : 400, color: qty > 0 ? "#065F46" : "#9CA3AF" }}>{qty > 0 ? formatUZS(pr.uzs * qty) : "-"}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
            {(shipTotalUZS > 0 || shipTotalUSD > 0) && (
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 16 }}>
                <div style={{ background: "#ECFDF5", border: "1px solid #A7F3D0", borderRadius: 10, padding: "12px 16px" }}>
                  <div style={{ fontSize: 11, color: "#6B7280" }}>Итого (UZS)</div>
                  <div style={{ fontSize: 18, fontWeight: 700, color: "#065F46" }}>{formatUZS(shipTotalUZS)}</div>
                </div>
                <div style={{ background: "#ECFDF5", border: "1px solid #A7F3D0", borderRadius: 10, padding: "12px 16px" }}>
                  <div style={{ fontSize: 11, color: "#6B7280" }}>Итого (USD)</div>
                  <div style={{ fontSize: 18, fontWeight: 700, color: "#065F46" }}>{formatUSD(shipTotalUSD)}</div>
                </div>
              </div>
            )}
            <div style={{ display: "flex", gap: 10 }}>
              <button onClick={() => { setShipModal(false); setShipItems({}); }} style={{ flex: 1, padding: 10, borderRadius: 8, border: "1px solid #E5E7EB", background: "#fff", fontWeight: 600, fontSize: 13, cursor: "pointer" }}>Отмена</button>
              <button onClick={saveShipment} disabled={savingShip || pricedProducts.length === 0} style={{ flex: 2, padding: 10, borderRadius: 8, border: "none", background: savingShip ? "#9CA3AF" : "#4F46E5", color: "#fff", fontWeight: 600, fontSize: 13, cursor: savingShip ? "not-allowed" : "pointer" }}>
                {savingShip ? "Сохранение..." : "Сохранить отгрузку"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

const th: React.CSSProperties = { padding: "10px 16px", textAlign: "left", fontSize: 12, fontWeight: 600, color: "#6B7280" };
const td: React.CSSProperties = { padding: "10px 16px", color: "#111827" };
const lbl: React.CSSProperties = { fontSize: 12, fontWeight: 600, color: "#374151", display: "block", marginBottom: 6 };