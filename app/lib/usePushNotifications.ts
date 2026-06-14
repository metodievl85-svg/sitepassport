'use client'

import { useEffect, useRef } from 'react'
import { supabase } from './supabase'

export function usePushNotifications(userId: string, workerId = '') {
  const attempted = useRef(false)

  useEffect(() => {
    if (!userId) return
    if (attempted.current) return
    attempted.current = true

    void registerPush(workerId)
  }, [userId, workerId])
}

async function registerPush(workerId: string) {
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

    const { data: { session } } = await supabase.auth.getSession()
    if (!session?.access_token) return

    await fetch('/api/push-subscribe', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${session.access_token}`
      },
      body: JSON.stringify({
        endpoint,
        p256dh: subscriptionJson.keys.p256dh,
        auth: subscriptionJson.keys.auth,
        ...(workerId ? { worker_id: workerId } : {})
      })
    })
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
