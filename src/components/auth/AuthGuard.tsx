import { useEffect, useState } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { useAuthState } from '@/hooks/useAuthState'
import { useToast } from '@/components/ui/use-toast'
import { Loader2, Shield } from 'lucide-react'

export const AuthGuard = ({ children }: { children: React.ReactNode }) => {
  const navigate = useNavigate()
  const location = useLocation()
  const { toast } = useToast()
  const { user, session, loading } = useAuthState()
  const [hasChecked, setHasChecked] = useState(false)

  useEffect(() => {
    if (!loading && !hasChecked) {
      setHasChecked(true)
      
      if (!session || !user) {
        toast({
          title: 'Authentication required',
          description: 'Please sign in to access this page',
          variant: 'destructive'
        })
        
        // Store the intended destination for redirect after login
        const intendedPath = location.pathname + location.search
        navigate(`/login?redirect=${encodeURIComponent(intendedPath)}`)
      }
    }
  }, [loading, session, user, hasChecked, navigate, toast, location])

  if (loading || !hasChecked) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gradient-to-br from-[hsl(var(--auth-bg))] to-white">
        <div className="flex flex-col items-center gap-6 p-8 bg-[hsl(var(--auth-card))] rounded-2xl shadow-lg border border-[hsl(var(--border))]">
          <div className="relative">
            <Shield className="h-12 w-12 text-[hsl(var(--auth-gradient-from))] animate-pulse" />
            <Loader2 className="h-6 w-6 animate-spin text-[hsl(var(--auth-gradient-to))] absolute -top-1 -right-1" />
          </div>
          
          <div className="text-center space-y-2">
            <h3 className="text-lg font-semibold text-foreground">
              Verifying access...
            </h3>
            <p className="text-sm text-muted-foreground">
              Please wait while we check your authentication
            </p>
          </div>
          
          <div className="flex space-x-1">
            <div className="w-2 h-2 bg-[hsl(var(--auth-gradient-from))] rounded-full animate-bounce"></div>
            <div className="w-2 h-2 bg-[hsl(var(--auth-gradient-from))] rounded-full animate-bounce" style={{ animationDelay: '0.1s' }}></div>
            <div className="w-2 h-2 bg-[hsl(var(--auth-gradient-from))] rounded-full animate-bounce" style={{ animationDelay: '0.2s' }}></div>
          </div>
        </div>
      </div>
    )
  }

  if (!session || !user) {
    return null // Will redirect in useEffect
  }

  return <>{children}</>
}
