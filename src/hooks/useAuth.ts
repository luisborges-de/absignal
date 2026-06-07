'use client'

import { useCallback, useEffect, useState } from 'react'
import type { User } from '@supabase/supabase-js'
import { createClient } from '@/lib/supabase/client'
import { isSupabaseConfigured } from '@/lib/supabase/env'

const LOCAL_EMAIL_KEY = 'absignal:demo-email'

interface AuthState {
  user: User | null
  email: string | null
  isLoading: boolean
  signIn: (email: string, password: string) => Promise<void>
  signOut: () => Promise<void>
}

export function useAuth(): AuthState {
  const [user, setUser] = useState<User | null>(null)
  const [localEmail, setLocalEmail] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    if (!isSupabaseConfigured()) {
      setLocalEmail(window.localStorage.getItem(LOCAL_EMAIL_KEY))
      setIsLoading(false)
      return
    }

    const supabase = createClient()
    void supabase.auth.getUser().then(({ data }) => {
      setUser(data.user)
      setIsLoading(false)
    })

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null)
    })

    return () => subscription.unsubscribe()
  }, [])

  const signIn = useCallback(async (email: string, password: string) => {
    if (!isSupabaseConfigured()) {
      if (!email || !password) throw new Error('Email and password are required.')
      window.localStorage.setItem(LOCAL_EMAIL_KEY, email)
      setLocalEmail(email)
      return
    }

    const supabase = createClient()
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) throw error
  }, [])

  const signOut = useCallback(async () => {
    if (!isSupabaseConfigured()) {
      window.localStorage.removeItem(LOCAL_EMAIL_KEY)
      setLocalEmail(null)
      return
    }

    const supabase = createClient()
    const { error } = await supabase.auth.signOut()
    if (error) throw error
  }, [])

  return {
    user,
    email: user?.email ?? localEmail,
    isLoading,
    signIn,
    signOut,
  }
}
