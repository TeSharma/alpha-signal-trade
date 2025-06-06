
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || ''
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''

// Only create the client if both URL and key are provided
export const supabase = supabaseUrl && supabaseAnonKey 
  ? createClient(supabaseUrl, supabaseAnonKey)
  : null

// Auth functions with null checks
export const signInWithEmail = async (email: string, password: string) => {
  if (!supabase) {
    console.warn('Supabase not configured. Please set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY environment variables.')
    return { data: null, error: new Error('Supabase not configured') }
  }
  
  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password
  })
  return { data, error }
}

export const signUpWithEmail = async (email: string, password: string) => {
  if (!supabase) {
    console.warn('Supabase not configured. Please set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY environment variables.')
    return { data: null, error: new Error('Supabase not configured') }
  }
  
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      emailRedirectTo: `${window.location.origin}/dashboard`
    }
  })
  return { data, error }
}

export const verifyEmail = async (email: string) => {
  if (!supabase) {
    return { data: null, error: new Error('Supabase not configured') }
  }
  
  const token = new URLSearchParams(window.location.search).get('token') || ''
  const { data, error } = await supabase.auth.verifyOtp({
    type: 'email',
    email,
    token,
    options: {
      redirectTo: `${window.location.origin}/dashboard`
    }
  })
  return { data, error }
}

export const signOut = async () => {
  if (!supabase) {
    return { error: new Error('Supabase not configured') }
  }
  
  const { error } = await supabase.auth.signOut()
  return { error }
}

export const resetPassword = async (email: string) => {
  if (!supabase) {
    return { data: null, error: new Error('Supabase not configured') }
  }
  
  const { data, error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: `${window.location.origin}/update-password`
  })
  return { data, error }
}

export const updatePassword = async (newPassword: string) => {
  if (!supabase) {
    return { data: null, error: new Error('Supabase not configured') }
  }
  
  const { data, error } = await supabase.auth.updateUser({
    password: newPassword
  })
  return { data, error }
}

export const getSession = async () => {
  if (!supabase) {
    return { session: null, error: new Error('Supabase not configured') }
  }
  
  const { data, error } = await supabase.auth.getSession()
  return { session: data.session, error }
}

export const getUser = async () => {
  if (!supabase) {
    return { user: null, error: new Error('Supabase not configured') }
  }
  
  const { data: { user }, error } = await supabase.auth.getUser()
  return { user, error }
}
