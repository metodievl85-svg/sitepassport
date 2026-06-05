'use client'

import { useEffect, useRef } from 'react'
import { supabase } from './supabase'

export function usePushNotifications(userId: string, workerId = '') {
  const attempted = useRef(false)

  useEffect(() => {
    if (!userId) return
    if (attempted.current) return
    attempted.current = true

    void registerPush(userId, workerId)
  }, [userId, workerId])
}

async function registerPush(userId: string, workerId: string) {
  try {
    if (!('serviceWorker' in navigator) || !('PushManager' in window)) return

    const registration = await Promise.race([
      navigator.serviceWorker.ready,
      new Promise<null>((resolve) => setTimeout(() => resolve(null), 10000)),
    ])
    if (!registration) return

    const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY
    if (!publicKey) return

    let subscription = await registration.pushManager.getSubscription()

    if (!subscription) {
      const permission = await Notification.requestPermission()
      if (permission !== 'granted') return

      subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(publicKey) as Uint8Array<ArrayBuffer>,
      })
    }

    const subscriptionJson = subscription.toJSON()
    if (!subscriptionJson.keys?.p256dh || !subscriptionJson.keys?.auth) return

    const endpoint = subscription.endpoint

    // Remove any stale rows for this user on a different endpoint (e.g. old domain)
    await supabase
      .from('push_subscriptions')
      .delete()
      .eq('user_id', userId)
      .neq('endpoint', endpoint)

    await supabase.from('push_subscriptions').upsert(
      {
        user_id: userId,
        ...(workerId ? { worker_id: workerId } : {}),
        endpoint,
        p256dh: subscriptionJson.keys.p256dh,
        auth: subscriptionJson.keys.auth,
      },
      { onConflict: 'endpoint' }
    )
  } catch (err) {
    console.error('Push registration error:', err)
  }
}

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4)
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/')
  const rawData = atob(base64)
  const outputArray = new Uint8Array(rawData.length)
  for (let i = 0; i < rawData.length; i++) {
    outputArray[i] = rawData.charCodeAt(i)
  }
  return outputArray
}
