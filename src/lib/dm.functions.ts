import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

type Peer = { id: string; full_name: string | null; username: string | null; avatar_url: string | null };

/** Users who follow each other with me — the only people I can DM. */
export const listDmContacts = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const [{ data: iFollow }, { data: followMe }] = await Promise.all([
      supabase.from("follows").select("following_id").eq("follower_id", userId),
      supabase.from("follows").select("follower_id").eq("following_id", userId),
    ]);
    const mine = new Set((iFollow ?? []).map((r) => r.following_id));
    const ids = (followMe ?? []).map((r) => r.follower_id).filter((id) => mine.has(id));
    if (!ids.length) return [] as Peer[];
    const { data: profs } = await supabase
      .from("profiles")
      .select("id, full_name, username, avatar_url")
      .in("id", ids);
    return (profs ?? []) as Peer[];
  });

/** Inbox: one row per conversation, newest first. */
export const listDmThreads = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const { data: msgs, error } = await supabase
      .from("direct_messages")
      .select("id, sender_id, recipient_id, body, read_at, created_at")
      .or(`sender_id.eq.${userId},recipient_id.eq.${userId}`)
      .order("created_at", { ascending: false })
      .limit(400);
    if (error) throw new Error(error.message);

    const threads = new Map<
      string,
      { peer_id: string; last_body: string; last_at: string; unread: number; outgoing: boolean }
    >();
    for (const m of msgs ?? []) {
      const peer = m.sender_id === userId ? m.recipient_id : m.sender_id;
      const t = threads.get(peer);
      if (!t) {
        threads.set(peer, {
          peer_id: peer,
          last_body: m.body,
          last_at: m.created_at,
          unread: m.recipient_id === userId && !m.read_at ? 1 : 0,
          outgoing: m.sender_id === userId,
        });
      } else if (m.recipient_id === userId && !m.read_at) {
        t.unread += 1;
      }
    }
    const ids = [...threads.keys()];
    if (!ids.length) return [];
    const { data: profs } = await supabase
      .from("profiles")
      .select("id, full_name, username, avatar_url")
      .in("id", ids);
    const byId = new Map((profs ?? []).map((p) => [p.id, p as Peer]));
    return [...threads.values()].map((t) => ({ ...t, peer: byId.get(t.peer_id) ?? null }));
  });

/** Messages with one peer (also marks incoming ones read). */
export const getDmConversation = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ peer_id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const peerId = data.peer_id;
    const { data: msgs, error } = await supabase
      .from("direct_messages")
      .select("id, sender_id, recipient_id, body, read_at, created_at")
      .or(
        `and(sender_id.eq.${userId},recipient_id.eq.${peerId}),and(sender_id.eq.${peerId},recipient_id.eq.${userId})`,
      )
      .order("created_at", { ascending: true })
      .limit(300);
    if (error) throw new Error(error.message);

    await supabase
      .from("direct_messages")
      .update({ read_at: new Date().toISOString() })
      .eq("sender_id", peerId)
      .eq("recipient_id", userId)
      .is("read_at", null);

    const { data: prof } = await supabase
      .from("profiles")
      .select("id, full_name, username, avatar_url")
      .eq("id", peerId)
      .maybeSingle();

    const [{ data: a }, { data: b }] = await Promise.all([
      supabase.from("follows").select("follower_id").eq("follower_id", userId).eq("following_id", peerId).maybeSingle(),
      supabase.from("follows").select("follower_id").eq("follower_id", peerId).eq("following_id", userId).maybeSingle(),
    ]);

    return {
      me: userId,
      peer: (prof ?? null) as Peer | null,
      canSend: !!a && !!b,
      messages: msgs ?? [],
    };
  });

export const sendDm = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z.object({ peer_id: z.string().uuid(), body: z.string().trim().min(1).max(2000) }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    if (data.peer_id === userId) throw new Error("You cannot message yourself");
    const { data: row, error } = await supabase
      .from("direct_messages")
      .insert({ sender_id: userId, recipient_id: data.peer_id, body: data.body })
      .select("id, sender_id, recipient_id, body, read_at, created_at")
      .single();
    if (error) throw new Error("You can only chat with people who follow you back.");
    return row;
  });
