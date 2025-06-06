import { useEffect, useState } from 'react'
import { verifyEmail } from '@/lib/supabase'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'

export default function VerifyEmailPage() {
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState(false)
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()

  useEffect(() => {
    const email = searchParams.get('email')
    if (!email) {
      setError('Invalid verification link')
      setLoading(false)
      return
    }

    const verify = async () => {
      const { error } = await verifyEmail(email)
      setLoading(false)
      if (error) {
        setError(error.message)
      } else {
        setSuccess(true)
        setTimeout(() => navigate('/dashboard'), 3000)
      }
    }
    verify()
  }, [navigate, searchParams])

  return (
    <div className="flex min-h-screen items-center justify-center p-4">
      <Card className="w-full max-w-md p-6">
        <div className="space-y-4 text-center">
          <h1 className="text-2xl font-bold">Email Verification</h1>
          
          {loading && <p>Verifying your email...</p>}
          
          {error && (
            <div className="bg-red-50 text-red-600 p-3 rounded-md">
              {error}
            </div>
          )}

          {success && (
            <>
              <div className="bg-green-50 text-green-600 p-3 rounded-md">
                Email verified successfully! Redirecting...
              </div>
              <Button onClick={() => navigate('/dashboard')}>
                Go to Dashboard
              </Button>
            </>
          )}
        </div>
      </Card>
    </div>
  )
}
