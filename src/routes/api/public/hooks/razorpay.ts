import { createFileRoute } from "@tanstack/react-router";

/**
 * Razorpay webhook: activates a subscription even if the user closes the app
 * before the browser-side verification runs. Signature-verified.
 */
export const Route = createFileRoute("/api/public/hooks/razorpay")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const raw = await request.text();
        const signature = request.headers.get("x-razorpay-signature") ?? "";
        const { verifyWebhookSignature, activateSubscription } = await import("@/lib/membership.server");

        if (!signature || !verifyWebhookSignature(raw, signature)) {
          return new Response(JSON.stringify({ error: "Invalid signature" }), {
            status: 401,
            headers: { "Content-Type": "application/json" },
          });
        }

        let event: {
          event?: string;
          payload?: { payment?: { entity?: { id?: string; order_id?: string; notes?: Record<string, string> } } };
        };
        try {
          event = JSON.parse(raw);
        } catch {
          return new Response(JSON.stringify({ error: "Bad JSON" }), { status: 400 });
        }

        const entity = event.payload?.payment?.entity;
        const paymentRow = entity?.notes?.["payment_row"];

        if (event.event === "payment.captured" && paymentRow) {
          try {
            await activateSubscription({ paymentRowId: paymentRow, paymentId: entity?.id ?? null, raw: event });
          } catch {
            // Swallow: Razorpay retries, and the in-app verification is the primary path.
          }
        } else if (event.event === "payment.failed" && paymentRow) {
          const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
          await supabaseAdmin.from("subscription_payments").update({ status: "failed" }).eq("id", paymentRow).neq("status", "paid");
        }

        return Response.json({ ok: true });
      },
    },
  },
});
