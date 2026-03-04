import { NextRequest, NextResponse } from "next/server";

const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN!;

export async function POST(req: NextRequest) {
  const { telegram_id, order_id, message } = await req.json();

  if (!BOT_TOKEN) {
    return NextResponse.json({ error: "TELEGRAM_BOT_TOKEN not set" }, { status: 500 });
  }

  if (!telegram_id || !order_id || !message) {
    return NextResponse.json({ error: "Missing fields" }, { status: 400 });
  }

  // Отправляем сообщение с кнопками Одобрить / Отклонить
  const tgRes = await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      chat_id: telegram_id,
      text: message,
      parse_mode: "Markdown",
      reply_markup: {
        inline_keyboard: [
          [
            { text: "✅ Одобрить заказ", callback_data: `approve_${order_id}` },
            { text: "❌ Отклонить",      callback_data: `reject_${order_id}` },
          ],
        ],
      },
    }),
  });

  if (!tgRes.ok) {
    const err = await tgRes.json();
    return NextResponse.json({ error: err }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}