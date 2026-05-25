'use client'

import { useEffect, useRef } from 'react'
import { supabase } from './supabase'

export function usePushNotifications(userId: string, workerId: string) {
  const attempted = useRef(false)

  useEffect(() => {
    if (!userId || !workerId) return
    if (attempted.current) return
    attempted.current = true

    void registerPush(userId, workerId)
  }, [userId, workerId])
}

async function registerPush(userId: string, workerId: string) {
  try {
    if (!('serviceWorker' in navigator) || !('PushManager' in window)) return

    const registration = await navigator.serviceWorker.ready

    const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY
    if (!publicKey) return

    let subscription = await registration.pushManager.getSubscription()

    if (!subscription) {
      const permission = await Notification.requestPermission()
      if (permission !== 'granted') return

      subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(publicKey),
      })
    }

    const subscriptionJson = subscription.toJSON()
    if (!subscriptionJson.keys?.p256dh || !subscriptionJson.keys?.auth) return

    const { data: existing } = await supabase
      .from('push_subscriptions')
      .select('id, endpoint')
      .eq('user_id', userId)
      .maybeSingle()

    if (existing?.endpoint === subscription.endpoint) return

    if (existing) {
      await supabase
        .from('push_subscriptions')
        .update({
          endpoint: subscription.endpoint,
          p256dh: subscriptionJson.keys.p256dh,
          auth: subscriptionJson.keys.auth,
        })
        .eq('user_id', userId)
    } else {
      await supabase.from('push_subscriptions').insert({
        user_id: userId,
        worker_id: workerId,
        endpoint: subscription.endpoint,
        p256dh: subscriptionJson.keys.p256dh,
        auth: subscriptionJson.keys.auth,
      })
    }
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
