"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import {
  Send, CheckCircle, Clock, XCircle,
  ChevronRight, ArrowLeft, Search,
  MessageSquare, Package
} from "lucide-react";

type Client = {
  id: string;
  name: string;
  phone: string;
  telegram_id: string | null;
};

type Order = {
  id: string;
  created_at: string;
  status: string;
  telegram_sent: boolean;
  telegram_approved: boolean | null;
  total_price: number;
  order_items: {
    quantity: number;
    products: { name: string; price: number };
  }[];
};

export default function TelegramChatPage() {
  const [clients, setClients] = useState<Client[]>([]);
  const [selectedClient, setSelectedClient] = useState<Client | null>(null);
  const [orders, setOrders] = useState<Order[]>([]);
  const [search, setSearch] = useState("");
  const [sending, setSending] = useState<string | null>(null);
  const [loadingClients, setLoadingClients] = useState(true);
  const [loadingOrders, setLoadingOrders] = useState(false);

  // Load all clients
  useEffect(() => {
    supabase
      .from("clients")
      .select("id, name, phone, telegram_id")
      .order("name")
      .then(({ data }) => {
        if (data) setClients(data as Client[]);
        setLoadingClients(false);
      });
  }, []);

  // Load orders when client is selected
  useEffect(() => {
    if (!selectedClient) return;
    setLoadingOrders(true);

    supabase
      .from("orders")
      .select(`
        id, created_at, status, telegram_sent, telegram_approved, total_price,
        order_items ( quantity, products ( name, price ) )
      `)
      .eq("client_id", selectedClient.id)
      .order("created_at", { ascending: false })
      .then(({ data }) => {
        if (data) setOrders(data as any);
        setLoadingOrders(false);
      });

    // Realtime — auto-refresh on order change
    const ch = supabase
      .channel("orders-tg-" + selectedClient.id)
      .on("postgres_changes", { event: "*", schema: "public", table: "orders" }, () => {
        supabase
          .from("orders")
          .select(`id, created_at, status, telegram_sent, telegram_approved, total_price, order_items ( quantity, products ( name, price ) )`)
          .eq("client_id", selectedClient.id)
          .order("created_at", { ascending: false })
          .then(({ data }) => { if (data) setOrders(data as any); });
      })
      .subscribe();

    return () => { supabase.removeChannel(ch); };
  }, [selectedClient]);

  async function sendToTelegram(order: Order) {
    if (!selectedClient?.telegram_id) {
      alert("У клиента нет Telegram ID. Добавьте его в карточке клиента.");
      return;
    }
    setSending(order.id);

    const itemsList = order.order_items
      .map((i) => `• ${i.products.name} × ${i.quantity} — $${(i.products.price * i.quantity).toFixed(2)}`)
      .join("\n");

    const message =
      `🛒 *Заказ #${order.id.slice(0, 8).toUpperCase()}*\n\n` +
      `${itemsList}\n\n` +
      `💰 *Итого: $${order.total_price.toFixed(2)}*\n\n` +
      `Подтвердите ваш заказ:`;

    try {
      const res = await fetch("/api/telegram/send-order", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          telegram_id: selectedClient.telegram_id,
          order_id: order.id,
          message,
        }),
      });

      if (res.ok) {
        await supabase.from("orders").update({ telegram_sent: true }).eq("id", order.id);
        setOrders((prev) =>
          prev.map((o) => o.id === order.id ? { ...o, telegram_sent: true } : o)
        );
      } else {
        alert("Ошибка отправки. Проверьте TELEGRAM_BOT_TOKEN.");
      }
    } catch {
      alert("Сетевая ошибка.");
    } finally {
      setSending(null);
    }
  }

  const filteredClients = clients.filter((c) =>
    c.name.toLowerCase().includes(search.toLowerCase()) ||
    (c.phone ?? "").includes(search)
  );

  const pendingCount  = orders.filter((o) => !o.telegram_sent).length;
  const sentCount     = orders.filter((o) => o.telegram_sent && o.telegram_approved === null).length;
  const approvedCount = orders.filter((o) => o.telegram_approved === true).length;

  return (
    <div style={{ display: "flex", height: "calc(100vh - 56px)", overflow: "hidden", fontFamily: "'Geist','Segoe UI',sans-serif", background: "#F8FAFC" }}>

      {/* ══ LEFT — Client list ══════════════════════════════════════════════ */}
      <aside style={{ width: 290, borderRight: "1px solid #E2E8F0", background: "#fff", display: "flex", flexDirection: "column", flexShrink: 0 }}>

        <div style={{ padding: "20px 16px 12px", borderBottom: "1px solid #F1F5F9" }}>
          <p style={{ margin: "0 0 2px", fontSize: 16, fontWeight: 700, color: "#0F172A" }}>Telegram Chat</p>
          <p style={{ margin: "0 0 12px", fontSize: 12, color: "#94A3B8" }}>Выберите клиента</p>
          <div style={{ position: "relative", display: "flex", alignItems: "center" }}>
            <Search size={14} style={{ position: "absolute", left: 10, color: "#94A3B8", pointerEvents: "none" }} />
            <input
              style={{ width: "100%", padding: "8px 10px 8px 32px", border: "1px solid #E2E8F0", borderRadius: 8, fontSize: 13, outline: "none", color: "#0F172A", background: "#F8FAFC", boxSizing: "border-box" }}
              placeholder="Поиск..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
        </div>

        <div style={{ flex: 1, overflowY: "auto", padding: 8 }}>
          {loadingClients ? (
            <p style={{ color: "#94A3B8", fontSize: 13, padding: 12 }}>Загрузка...</p>
          ) : filteredClients.length === 0 ? (
            <p style={{ color: "#94A3B8", fontSize: 13, padding: 12 }}>Клиенты не найдены</p>
          ) : filteredClients.map((client) => {
            const hasTg  = !!client.telegram_id;
            const active = selectedClient?.id === client.id;
            return (
              <div
                key={client.id}
                onClick={() => { setSelectedClient(client); setOrders([]); }}
                style={{
                  display: "flex", alignItems: "center", gap: 10,
                  padding: "10px 12px", borderRadius: 10, cursor: "pointer", marginBottom: 2,
                  background: active ? "#EFF6FF" : "transparent",
                  border: active ? "1px solid #BFDBFE" : "1px solid transparent",
                  transition: "all 0.12s",
                }}
              >
                {/* Avatar */}
                <div style={{
                  width: 38, height: 38, borderRadius: "50%", flexShrink: 0,
                  background: hasTg ? "linear-gradient(135deg,#0088cc,#29b6f6)" : "#E2E8F0",
                  display: "flex", alignItems: "center", justifyContent: "center",
                  fontSize: 15, fontWeight: 700, color: hasTg ? "#fff" : "#94A3B8",
                }}>
                  {client.name[0].toUpperCase()}
                </div>

                <div style={{ flex: 1, minWidth: 0 }}>
                  <p style={{ margin: 0, fontSize: 13, fontWeight: 600, color: "#0F172A", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {client.name}
                  </p>
                  <p style={{ margin: 0, fontSize: 11, color: hasTg ? "#0088cc" : "#EF4444" }}>
                    {hasTg ? "✅ Telegram подключён" : "⚠ Нет Telegram ID"}
                  </p>
                </div>
                <ChevronRight size={14} color="#CBD5E1" />
              </div>
            );
          })}
        </div>
      </aside>

      {/* ══ RIGHT — Orders panel ════════════════════════════════════════════ */}
      <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden" }}>

        {!selectedClient ? (
          /* Empty state */
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", flex: 1, gap: 10, color: "#94A3B8" }}>
            <div style={{ width: 64, height: 64, borderRadius: 20, background: "#F1F5F9", display: "flex", alignItems: "center", justifyContent: "center" }}>
              <MessageSquare size={28} color="#CBD5E1" />
            </div>
            <p style={{ margin: 0, fontSize: 15, fontWeight: 600, color: "#64748B" }}>Выберите клиента</p>
            <p style={{ margin: 0, fontSize: 13 }}>Список заказов появится здесь</p>
          </div>
        ) : (
          <>
            {/* Header */}
            <div style={{ padding: "16px 28px", borderBottom: "1px solid #E2E8F0", background: "#fff", display: "flex", alignItems: "center", gap: 12 }}>
              <button
                onClick={() => setSelectedClient(null)}
                style={{ background: "#F1F5F9", border: "none", borderRadius: 8, padding: "6px 10px", cursor: "pointer", display: "flex", alignItems: "center", color: "#475569" }}
              >
                <ArrowLeft size={14} />
              </button>

              <div style={{ width: 40, height: 40, borderRadius: "50%", background: "linear-gradient(135deg,#0088cc,#29b6f6)", display: "flex", alignItems: "center", justifyContent: "center", color: "#fff", fontWeight: 700, fontSize: 16, flexShrink: 0 }}>
                {selectedClient.name[0].toUpperCase()}
              </div>

              <div>
                <p style={{ margin: 0, fontSize: 15, fontWeight: 700, color: "#0F172A" }}>{selectedClient.name}</p>
                <p style={{ margin: 0, fontSize: 12, color: selectedClient.telegram_id ? "#0088cc" : "#EF4444" }}>
                  {selectedClient.telegram_id
                    ? `Telegram ID: ${selectedClient.telegram_id}`
                    : "⚠ Нет Telegram ID — добавьте в карточке клиента"}
                </p>
              </div>
            </div>

            {/* Stats bar */}
            <div style={{ display: "flex", gap: 10, padding: "12px 28px", background: "#fff", borderBottom: "1px solid #F1F5F9" }}>
              {[
                { label: "Не отправлено", count: pendingCount,  color: "#F59E0B" },
                { label: "Ожидает ответа", count: sentCount,    color: "#3B82F6" },
                { label: "Одобрено",        count: approvedCount, color: "#10B981" },
              ].map((s) => (
                <span key={s.label} style={{ display: "flex", alignItems: "center", gap: 6, padding: "5px 12px", borderRadius: 20, fontSize: 12, fontWeight: 600, background: s.color + "18", color: s.color }}>
                  {s.label}: {s.count}
                </span>
              ))}
            </div>

            {/* Order cards */}
            <div style={{ flex: 1, overflowY: "auto", padding: "20px 28px" }}>
              {loadingOrders ? (
                <p style={{ color: "#94A3B8", fontSize: 13 }}>Загрузка заказов...</p>
              ) : orders.length === 0 ? (
                <div style={{ display: "flex", flexDirection: "column", alignItems: "center", marginTop: 60, gap: 8, color: "#94A3B8" }}>
                  <Package size={28} color="#CBD5E1" />
                  <p style={{ margin: 0, fontSize: 14 }}>У клиента нет заказов</p>
                </div>
              ) : orders.map((order) => {
                const { telegram_approved: approved, telegram_sent: sent } = order;

                const borderColor = approved === true ? "#10B981" : approved === false ? "#EF4444" : sent ? "#3B82F6" : "#E2E8F0";
                const statusColor = approved === true ? "#10B981" : approved === false ? "#EF4444" : sent ? "#3B82F6" : "#F59E0B";
                const statusText  = approved === true ? "Одобрено" : approved === false ? "Отклонено" : sent ? "Ожидает ответа" : "Не отправлено";
                const StatusIcon  = approved === true ? CheckCircle : approved === false ? XCircle : Clock;

                const canSend = !sent && !!selectedClient.telegram_id;

                return (
                  <div
                    key={order.id}
                    style={{
                      background: "#fff",
                      border: `1px solid ${borderColor}`,
                      borderLeft: `4px solid ${borderColor}`,
                      borderRadius: 12, padding: "16px 20px", marginBottom: 12,
                      display: "flex", alignItems: "center", justifyContent: "space-between", gap: 16,
                      boxShadow: "0 1px 3px rgba(0,0,0,0.04)",
                    }}
                  >
                    {/* Info */}
                    <div style={{ flex: 1 }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 7 }}>
                        <span style={{ fontWeight: 700, fontSize: 14, color: "#0F172A" }}>
                          #{order.id.slice(0, 8).toUpperCase()}
                        </span>
                        <span style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 12, color: statusColor, fontWeight: 600 }}>
                          <StatusIcon size={14} /> {statusText}
                        </span>
                        <span style={{ fontSize: 11, color: "#94A3B8", marginLeft: "auto" }}>
                          {new Date(order.created_at).toLocaleDateString("ru-RU")}
                        </span>
                      </div>

                      <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
                        {order.order_items?.map((item, i) => (
                          <span key={i} style={{ fontSize: 13, color: "#475569" }}>
                            {item.products?.name}
                            <span style={{ color: "#94A3B8" }}> × {item.quantity}</span>
                            <span style={{ color: "#0F172A", fontWeight: 600 }}> — ${(item.products.price * item.quantity).toFixed(2)}</span>
                          </span>
                        ))}
                      </div>
                    </div>

                    {/* Price + action */}
                    <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 8, flexShrink: 0 }}>
                      <span style={{ fontWeight: 800, fontSize: 18, color: "#0F172A" }}>
                        ${order.total_price?.toFixed(2)}
                      </span>

                      {!sent && (
                        <button
                          onClick={() => sendToTelegram(order)}
                          disabled={sending === order.id || !canSend}
                          style={{
                            display: "flex", alignItems: "center", gap: 6,
                            background: canSend ? "linear-gradient(135deg,#0088cc,#29b6f6)" : "#E2E8F0",
                            color: canSend ? "#fff" : "#94A3B8",
                            border: "none", padding: "9px 16px", borderRadius: 9,
                            cursor: canSend ? "pointer" : "not-allowed",
                            fontSize: 13, fontWeight: 600,
                            opacity: sending === order.id ? 0.7 : 1,
                          }}
                        >
                          <Send size={14} />
                          {sending === order.id ? "Отправка..." : "Отправить"}
                        </button>
                      )}

                      {sent && approved === null  && <span style={{ fontSize: 12, color: "#3B82F6", background: "#EFF6FF", padding: "5px 12px", borderRadius: 8, fontWeight: 500 }}>⏳ Ждём ответа</span>}
                      {approved === true           && <span style={{ fontSize: 12, color: "#10B981", background: "#F0FDF4", padding: "5px 12px", borderRadius: 8, fontWeight: 500 }}>✅ Клиент одобрил</span>}
                      {approved === false          && <span style={{ fontSize: 12, color: "#EF4444", background: "#FEF2F2", padding: "5px 12px", borderRadius: 8, fontWeight: 500 }}>❌ Клиент отклонил</span>}
                    </div>
                  </div>
                );
              })}
            </div>
          </>
        )}
      </div>
    </div>
  );
}