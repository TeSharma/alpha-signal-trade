import { useState, useEffect } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { supabase } from '@/integrations/supabase/client'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { useToast } from '@/components/ui/use-toast'
import { Mail, CheckCircle, RefreshCw, ArrowLeft } from 'lucide-react'
import { Link } from 'react-router-dom'

export default function VerifyEmailPage() {
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
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-[hsl(var(--auth-bg))] to-white p-4">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <div className="mx-auto mb-4 w-16 h-16 bg-green-100 rounded-full flex items-center justify-center">
              <CheckCircle className="w-8 h-8 text-green-600" />
            </div>
            <CardTitle className="text-2xl text-green-700">Email Verified!</CardTitle>
            <CardDescription>
              Your account has been successfully verified. You'll be redirected to your dashboard shortly.
            </CardDescription>
          </CardHeader>
        </Card>
      </div>
    )
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-[hsl(var(--auth-bg))] to-white p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="mx-auto mb-4 w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center">
            <Mail className="w-8 h-8 text-blue-600" />
          </div>
          <CardTitle className="text-2xl">Check Your Email</CardTitle>
          <CardDescription>
            We've sent a verification link to {email ? (
              <span className="font-medium text-foreground">{email}</span>
            ) : (
              'your email address'
            )}
          </CardDescription>
        </CardHeader>
        
        <CardContent className="space-y-4">
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
                className="w-full"
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
        </CardContent>
      </Card>
    </div>
  )
}
