import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

// Validate and normalize URL before creating client
let supabase = null
if (supabaseUrl && supabaseAnonKey) {
  try {
    // Normalize URL - ensure proper format
    let normalizedUrl = supabaseUrl.trim()
    
    // Remove any existing protocol
    normalizedUrl = normalizedUrl.replace(/^https?:\/\//, '')
    
    // Add single https:// protocol
    normalizedUrl = `https://${normalizedUrl}`
    
    // Remove trailing slashes
    normalizedUrl = normalizedUrl.replace(/\/+$/, '')
    
    // Validate URL structure
    const urlObj = new URL(normalizedUrl)
    if (!urlObj.hostname) {
      throw new Error('Invalid Supabase URL - missing hostname')
    }
    
    supabase = createClient(normalizedUrl, supabaseAnonKey)
    console.log('Supabase client initialized with URL:', normalizedUrl)
  } catch (error) {
    console.error('Supabase initialization failed:', {
      originalUrl: supabaseUrl,
      error: error.message
    })
    throw error // Re-throw to prevent silent failures
  }
} else {
  console.warn('Supabase environment variables not found. Please set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY.')
}

export { supabase }

// Auth functions with null checks
export const signInWithEmail = async (email: string, password: string) => {
  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password
  })
  return { data, error }
}

export const signUpWithEmail = async (email: string, password: string) => {
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
  const { error } = await supabase.auth.signOut()
  return { error }
}

export const resetPassword = async (email: string) => {
  const { data, error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: `${window.location.origin}/update-password`
  })
  return { data, error }
}

export const updatePassword = async (newPassword: string) => {
  const { data, error } = await supabase.auth.updateUser({
    password: newPassword
  })
  return { data, error }
}

export const getSession = async () => {
  const { data, error } = await supabase.auth.getSession()
  return { session: data.session, error }
}

export const getUser = async () => {
  const { data: { user }, error } = await supabase.auth.getUser()
  return { user, error }
}

// Test connection function
export const testConnection = async () => {
  try {
    // Test database connection by checking database health
    const { error: dbError } = await supabase
      .from('_health')
      .select('*')
      .limit(1)
    
    if (dbError) {
      console.log('Database connection test:', { status: 'error', error: dbError.message })
    } else {
      console.log('Database connection test:', { status: 'success' })
    }

    // Test authentication
    const { data: authData, error: authError } = await supabase.auth.getSession()
    if (authError) {
      console.log('Auth service test:', { status: 'error', error: authError.message })
    } else {
      console.log('Auth service test:', { status: 'success' })
    }

    return {
      database: !dbError,
      auth: !authError,
      errors: {
        database: dbError?.message,
        auth: authError?.message
      }
    }
  } catch (error) {
    console.error('Connection test failed:', error)
    return {
      database: false,
      auth: false,
      errors: {
        general: error.message
      }
    }
  }
}
