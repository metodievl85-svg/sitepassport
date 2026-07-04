import webpush from 'web-push'
import type { SupabaseClient } from '@supabase/supabase-js'

export type StoredPushSubscription = { endpoint: string; p256dh: string; auth: string }

/**
 * Sends a web-push payload to a set of stored subscriptions.
 *
 * Hardening behaviour shared by every route that sends push:
 * - A failing endpoint never aborts the loop — the remaining devices still receive the push.
 * - When an endpoint is gone (HTTP 410) or not found (HTTP 404), its row is deleted from
 *   push_subscriptions by endpoint, so dead FCM/APNs endpoints stop being retried forever.
 *
 * VAPID must already be configured by the caller — this helper does not touch VAPID setup.
 * The payload is passed through verbatim — this helper never builds or alters payloads.
 */
export async function sendWebPush(
  admin: SupabaseClient,
  subscriptions: StoredPushSubscription[] | null | undefined,
  payload: string,
): Promise<{ sent: number; removed: number; failed: number }> {
  const subs = subscriptions ?? []
  let sent = 0
  let failed = 0
  const deadEndpoints: string[] = []

  for (const sub of subs) {
    try {
      await webpush.sendNotification(
        { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
        payload,
      )
      sent++
    } catch (err) {
      const statusCode = (err as { statusCode?: number })?.statusCode
      if (statusCode === 410 || statusCode === 404) {
        // Endpoint is dead (unsubscribed/expired) — schedule its row for removal.
        deadEndpoints.push(sub.endpoint)
      } else {
        failed++
      }
      console.error('Push send failed (status %s):', statusCode ?? 'unknown', err)
    }
  }

  if (deadEndpoints.length > 0) {
    // Best-effort cleanup; a cleanup failure must not surface to callers.
    const { error } = await admin
      .from('push_subscriptions')
      .delete()
      .in('endpoint', deadEndpoints)
    if (error) console.error('Dead push subscription cleanup failed:', error.message)
  }

  return { sent, removed: deadEndpoints.length, failed }
}
