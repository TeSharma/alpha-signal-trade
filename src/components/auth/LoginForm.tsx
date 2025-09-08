import { useState, useEffect } from 'react'
import { supabase } from '@/integrations/supabase/client'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { useNavigate, useSearchParams, Link } from 'react-router-dom'
import { useToast } from '@/components/ui/use-toast'
import { AuthLayout } from './AuthLayout'
import { AuthInput } from './AuthInput'

export const LoginForm = () => {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [rememberMe, setRememberMe] = useState(false)
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [loading, setLoading] = useState(false)
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const { toast } = useToast()

  // Get redirect path from URL params
  const redirectPath = searchParams.get('redirect') || '/dashboard'

  // Clear errors when user starts typing
  useEffect(() => {
    if (errors.email && email) setErrors(prev => ({ ...prev, email: '' }))
    if (errors.password && password) setErrors(prev => ({ ...prev, password: '' }))
    if (errors.general) setErrors(prev => ({ ...prev, general: '' }))
  }, [email, password, errors])

  const validateForm = () => {
    const newErrors: Record<string, string> = {}
    
    if (!email) {
      newErrors.email = 'Email is required'
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      newErrors.email = 'Please enter a valid email'
    }
    
    if (!password) {
      newErrors.password = 'Password is required'
    } else if (password.length < 6) {
      newErrors.password = 'Password must be at least 6 characters'
    }
    
    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  const handleGoogleLogin = async () => {
    setLoading(true)
    setErrors({})
    
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: `${window.location.origin}${redirectPath}`
      }
    })
    
    if (error) {
      setErrors({ general: error.message })
      toast({
        title: 'Sign in failed',
        description: error.message,
        variant: 'destructive'
      })
    }
    
    setLoading(false)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!validateForm()) return
    
    setLoading(true)
    setErrors({})

    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    })

    if (error) {
      const errorMessage = error.message
      setErrors({ general: errorMessage })
      toast({
        title: 'Sign in failed',
        description: errorMessage,
        variant: 'destructive'
      })
    } else {
      toast({
        title: 'Welcome back!',
        description: 'You have successfully signed in.',
      })
      navigate(redirectPath)
    }

    setLoading(false)
  }

  return (
    <AuthLayout 
      title="Welcome back 👋" 
      subtitle="Enter your details to sign in to your account"
    >
      {/* Google Login Button */}
      <Button
        type="button"
        variant="outline"
        className="w-full h-12 hover:bg-accent/50 border-border relative overflow-hidden group"
        onClick={handleGoogleLogin}
        disabled={loading}
      >
        <svg className="w-5 h-5 mr-3" viewBox="0 0 24 24">
          <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
          <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
          <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
          <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
        </svg>
        Sign in with Google
      </Button>

      <div className="relative">
        <div className="absolute inset-0 flex items-center">
          <span className="w-full border-t border-border" />
        </div>
        <div className="relative flex justify-center text-sm">
          <span className="px-4 bg-[hsl(var(--auth-card))] text-muted-foreground">Or sign in with email</span>
        </div>
      </div>

      {errors.general && (
        <div className="bg-destructive/10 text-destructive p-3 rounded-md text-sm border border-destructive/20">
          {errors.general}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-4">
        <AuthInput
          id="email"
          type="email"
          label="Email address"
          value={email}
          onChange={setEmail}
          placeholder="Enter your email"
          required
          icon="email"
          error={errors.email}
          autoComplete="username"
        />

        <AuthInput
          id="password"
          type="password"
          label="Password"
          value={password}
          onChange={setPassword}
          placeholder="Enter your password"
          required
          icon="password"
          error={errors.password}
          autoComplete="current-password"
        />

        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <Checkbox
              id="remember"
              checked={rememberMe}
              onCheckedChange={(checked) => setRememberMe(checked as boolean)}
            />
            <label htmlFor="remember" className="text-sm text-muted-foreground cursor-pointer">
              Remember me
            </label>
          </div>
          <Link 
            to="/forgot-password" 
            className="text-sm text-[hsl(var(--auth-gradient-from))] hover:underline transition-colors"
          >
            Forgot password?
          </Link>
        </div>

        <Button 
          type="submit" 
          className="w-full h-12 bg-gradient-to-r from-[hsl(var(--auth-gradient-from))] to-[hsl(var(--auth-gradient-to))] hover:opacity-90 transition-all duration-200 font-medium shadow-lg"
          disabled={loading}
        >
          {loading ? (
            <div className="flex items-center gap-2">
              <div className="animate-spin h-4 w-4 border-2 border-white border-t-transparent rounded-full"></div>
              Signing in...
            </div>
          ) : (
            'Sign in'
          )}
        </Button>

        <div className="text-center text-sm text-muted-foreground">
          Don't have an account?{' '}
          <Link to="/signup" className="text-[hsl(var(--auth-gradient-from))] hover:underline font-medium transition-colors">
            Sign up now
          </Link>
        </div>
      </form>
    </AuthLayout>
  )
}