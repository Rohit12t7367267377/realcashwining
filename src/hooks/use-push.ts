import { useCallback, useEffect, useRef, useState } from "react";
import { getPushConfig, registerPushToken } from "@/lib/push.functions";
import { supabase } from "@/integrations/supabase/client";

type Status = "unsupported" | "unconfigured" | "default" | "granted" | "denied";

/**
 * Requests notification permission and registers the device with FCM.
 * Safe to call before Firebase keys are configured — it simply stays idle.
 */
export function usePush() {
  const [status, setStatus] = useState<Status>("default");
  const [busy, setBusy] = useState(false);
  const tokenRef = useRef<string | null>(null);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!("Notification" in window) || !("serviceWorker" in navigator)) {
      setStatus("unsupported");
      return;
    }
    setStatus(Notification.permission as Status);
  }, []);

  const enable = useCallback(async () => {
    if (typeof window === "undefined") return false;
    if (!("Notification" in window) || !("serviceWorker" in navigator)) {
      setStatus("unsupported");
      return false;
    }
    setBusy(true);
    try {
      const cfg = await getPushConfig();
      if (!cfg.configured) {
        setStatus("unconfigured");
        return false;
      }
      const permission = await Notification.requestPermission();
      setStatus(permission as Status);
      if (permission !== "granted") return false;

      const { data: sessionData } = await supabase.auth.getSession();
      if (!sessionData.session) return false;

      const registration = await navigator.serviceWorker.register("/firebase-messaging-sw.js");
      const { initializeApp, getApps } = await import("firebase/app");
      const { getMessaging, getToken, onMessage } = await import("firebase/messaging");
      const app = getApps()[0] ?? initializeApp({
        apiKey: cfg.apiKey,
        projectId: cfg.projectId,
        messagingSenderId: cfg.messagingSenderId,
        appId: cfg.appId,
      });
      const messaging = getMessaging(app);
      const token = await getToken(messaging, {
        vapidKey: cfg.vapidKey,
        serviceWorkerRegistration: registration,
      });
      if (!token) return false;
      tokenRef.current = token;
      await registerPushToken({
        data: { token, platform: "web", userAgent: navigator.userAgent.slice(0, 400) },
      });
      onMessage(messaging, (payload) => {
        const n = payload.notification;
        if (n?.title) {
          new Notification(n.title, { body: n.body ?? "", icon: "/favicon.ico" });
        }
      });
      return true;
    } catch {
      return false;
    } finally {
      setBusy(false);
    }
  }, []);

  return { status, busy, enable, token: tokenRef.current };
}
