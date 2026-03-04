import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN!;

// Service role key — только для webhook (серверный код)
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(req: NextRequest) {
  const body = await req.json();

  // Telegram отправляет callback_query когда клиент нажимает кнопку
  const callback = body?.callback_query;
  if (!callback) return NextResponse.json({ ok: true });

  const data = callback.data as string;        // "approve_<order_id>" или "reject_<order_id>"
  const chatId = callback.message.chat.id;
  const messageId = callback.message.message_id;

  const [action, ...rest] = data.split("_");
  const orderId = rest.join("_");

  const approved = action === "approve";

  // Обновляем заказ в Supabase
  await supabase
    .from("orders")
    .update({
      telegram_approved: approved,
      status: approved ? "confirmed" : "rejected",
    })
    .eq("id", orderId);

  // Отвечаем клиенту в Telegram
  const replyText = approved
    ? "✅ Спасибо! Ваш заказ подтверждён. Мы свяжемся с вами для доставки."
    : "❌ Ваш заказ отклонён. Свяжитесь с нами если это ошибка.";

  // Убираем кнопки с исходного сообщения
  await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/editMessageReplyMarkup`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ chat_id: chatId, message_id: messageId, reply_markup: { inline_keyboard: [] } }),
  });

  // Отправляем подтверждение
  await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ chat_id: chatId, text: replyText }),
  });

  // Отвечаем на callback (убирает loading у кнопки)
  await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/answerCallbackQuery`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ callback_query_id: callback.id }),
  });

  return NextResponse.json({ ok: true });
}