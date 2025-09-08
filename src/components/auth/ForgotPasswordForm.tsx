import { useState } from 'react'
import { resetPassword } from '@/lib/supabase'
import { Button } from '@/components/ui/button'
import { Link } from 'react-router-dom'
import { AuthLayout } from './AuthLayout'
import { AuthInput } from './AuthInput'
import { CheckCircle, ArrowLeft } from 'lucide-react'

export const ForgotPasswordForm = () => {
  const [email, setEmail] = useState('')
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [loading, setLoading] = useState(false)

  const validateEmail = (email: string) => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    return emailRegex.test(email)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError('')
    setSuccess('')

    if (!validateEmail(email)) {
      setError('Please enter a valid email address')
      setLoading(false)
      return
    }

    const { error } = await resetPassword(email)
    
    if (error) {
      setError(error.message)
    } else {
      setSuccess('Password reset link sent to your email')
    }

    setLoading(false)
  }

  return (
    <AuthLayout 
      title="Reset Password 🔐" 
      subtitle="Enter your email to receive a reset link"
      showIllustration={false}
    >
      {success ? (
        <div className="text-center space-y-6">
          <div className="mx-auto w-16 h-16 bg-[hsl(var(--success))]/10 rounded-full flex items-center justify-center">
            <CheckCircle className="w-8 h-8 text-[hsl(var(--success))]" />
          </div>
          
          <div className="space-y-2">
            <h3 className="text-lg font-semibold text-foreground">Check your email</h3>
            <p className="text-sm text-muted-foreground">
              We've sent a password reset link to <strong>{email}</strong>
            </p>
            <p className="text-xs text-muted-foreground">
              Didn't receive the email? Check your spam folder or try again.
            </p>
          </div>

          <div className="space-y-3">
            <Button
              onClick={() => {
                setSuccess('')
                setEmail('')
              }}
              variant="outline"
              className="w-full"
            >
              Send another link
            </Button>
            
            <Link to="/login">
              <Button variant="ghost" className="w-full">
                <ArrowLeft className="w-4 h-4 mr-2" />
                Back to sign in
              </Button>
            </Link>
          </div>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-6">
          <AuthInput
            id="email"
            type="email"
            label="Email address"
            value={email}
            onChange={setEmail}
            placeholder="Enter your email"
            required
            icon="email"
            error={error}
            autoComplete="email"
          />

          <Button 
            type="submit" 
            className="w-full h-12 bg-gradient-to-r from-[hsl(var(--auth-gradient-from))] to-[hsl(var(--auth-gradient-to))] hover:opacity-90 transition-all duration-200 font-medium shadow-lg"
            disabled={loading || !email}
          >
            {loading ? (
              <div className="flex items-center gap-2">
                <div className="animate-spin h-4 w-4 border-2 border-white border-t-transparent rounded-full"></div>
                Sending reset link...
              </div>
            ) : (
              'Send reset link'
            )}
          </Button>

          <div className="text-center">
            <Link 
              to="/login" 
              className="text-sm text-muted-foreground hover:text-[hsl(var(--auth-gradient-from))] transition-colors inline-flex items-center gap-1"
            >
              <ArrowLeft className="w-3 h-3" />
              Back to sign in
            </Link>
          </div>
        </form>
      )}
    </AuthLayout>
  )
}
