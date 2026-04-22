import { useState, useEffect } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { supabase } from '@/integrations/supabase/client'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { useToast } from '@/components/ui/use-toast'
import { Mail, CheckCircle, RefreshCw, ArrowLeft } from 'lucide-react'
import { Link } from 'react-router-dom'

export default function MobileVerifyEmailForm() {
  const [searchParams] = useSearchParams()
  const [isResending, setIsResending] = useState(false)
  const [isVerified, setIsVerified] = useState(false)
  const [email, setEmail] = useState('')
  const navigate = useNavigate()
  const { toast } = useToast()

  useEffect(() => {
    // Get email from URL params or localStorage
    const urlEmail = searchParams.get('email')
    const storedEmail = localStorage.getItem('pendingVerificationEmail')

    if (urlEmail) {
      setEmail(urlEmail)
      localStorage.setItem('pendingVerificationEmail', urlEmail)
    } else if (storedEmail) {
      setEmail(storedEmail)
    }

    // Check if user is already verified and logged in
    const checkAuthStatus = async () => {
      const { data: { session } } = await supabase.auth.getSession()
      if (session?.user?.email_confirmed_at) {
        setIsVerified(true)
        setTimeout(() => {
          navigate('/dashboard')
        }, 2000)
      }
    }

    checkAuthStatus()

    // Listen for auth changes (verification completion)
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'SIGNED_IN' && session?.user?.email_confirmed_at) {
        setIsVerified(true)
        localStorage.removeItem('pendingVerificationEmail')
        toast({
          title: 'Email verified!',
          description: 'Your account has been successfully verified.',
        })
        setTimeout(() => {
          navigate('/dashboard')
        }, 2000)
      }
    })

    return () => subscription.unsubscribe()
  }, [searchParams, navigate, toast])

  const handleResendVerification = async () => {
    if (!email) {
      toast({
        title: 'Error',
        description: 'No email address found. Please try signing up again.',
        variant: 'destructive'
      })
      return
    }

    setIsResending(true)

    const { error } = await supabase.auth.resend({
      type: 'signup',
      email: email,
      options: {
        emailRedirectTo: `${window.location.origin}/`
      }
    })

    if (error) {
      toast({
        title: 'Failed to resend',
        description: error.message,
        variant: 'destructive'
      })
    } else {
      toast({
        title: 'Email sent!',
        description: 'A new verification email has been sent to your inbox.',
      })
    }

    setIsResending(false)
  }

  if (isVerified) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-purple-50">
        {/* Header */}
        <div className="flex items-center justify-between p-4">
          <h1 className="text-xl font-bold text-foreground">Email Verified!</h1>
          <Button variant="ghost" size="sm" onClick={() => window.history.back()}>
            <svg className="h-4 w-4" viewBox="0 0 24 24">
              <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
              <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
              <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
              <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
            </svg>
          </Button>
        </div>

        {/* Success message */}
        <div className="p-4 space-y-4">
          <div className="text-center mb-6">
            <div className="mx-auto mb-4 w-16 h-16 bg-green-100 rounded-full flex items-center justify-center">
              <CheckCircle className="w-8 h-8 text-green-600" />
            </div>
            <h2 className="text-2xl font-bold text-green-700">Email Verified!</h2>
            <p className="text-sm text-muted-foreground mt-2">
              Your account has been successfully verified. You'll be redirected to your dashboard shortly.
            </p>
          </div>
        </div>

        {/* Bottom padding */}
        <div className="h-16"></div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-purple-50">
      {/* Header */}
      <div className="flex items-center justify-between p-4">
        <h1 className="text-xl font-bold text-foreground">Check Your Email</h1>
        <Button variant="ghost" size="sm" onClick={() => window.history.back()}>
          <svg className="h-4 w-4" viewBox="0 0 24 24">
            <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
            <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
            <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
            <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
          </svg>
        </Button>
      </div>

      {/* Form */}
      <div className="p-4 space-y-4">
        <div className="text-center mb-6">
          <h2 className="text-2xl font-bold text-foreground">Check Your Email</h2>
          <p className="text-sm text-muted-foreground mt-2">
            We've sent a verification link to {email ? (
              <span className="font-medium text-foreground">{email}</span>
            ) : (
              'your email address'
            )}
          </p>
        </div>

        <div className="text-center space-y-4">
          <div className="p-4 bg-muted/50 rounded-lg text-sm text-muted-foreground">
            <p className="mb-2">
              <strong>Next steps:</strong>
            </p>
            <ol className="text-left space-y-1 list-decimal list-inside">
              <li>Check your email inbox (and spam folder)</li>
              <li>Click the verification link in the email</li>
              <li>You'll be automatically signed in</li>
            </ol>
          </div>

          <div className="space-y-3">
            <Button
              onClick={handleResendVerification}
              disabled={isResending || !email}
              variant="outline"
              className="w-full h-12"
            >
              {isResending ? (
                <>
                  <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                  Sending...
                </>
              ) : (
                <>
                  <Mail className="mr-2 h-4 w-4" />
                  Resend verification email
                </>
              )}
            </Button>

            <div className="text-sm text-muted-foreground">
              Didn't receive the email? Check your spam folder or try resending.
            </div>
          </div>
        </div>

        <div className="pt-4 border-t">
          <div className="flex items-center justify-center">
            <Link 
              to="/login"
              className="inline-flex items-center text-sm text-muted-foreground hover:text-foreground transition-colors"
            >
              <ArrowLeft className="mr-1 h-3 w-3" />
              Back to login
            </Link>
          </div>
        </div>
      </div>

      {/* Bottom padding */}
      <div className="h-16"></div>
    </div>
  )
}