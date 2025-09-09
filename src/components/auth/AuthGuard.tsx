import { useAuthState } from '@/hooks/useAuthState'
import { Navigate, useLocation } from 'react-router-dom'
import { ReactNode } from 'react'

interface AuthGuardProps {
  children: ReactNode
  redirectTo?: string
}

export const AuthGuard = ({ children, redirectTo = '/login' }: AuthGuardProps) => {
  const { user, loading } = useAuthState()
  const location = useLocation()
  
  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gradient-to-br from-[hsl(var(--auth-bg))] to-white">
        <div className="text-center space-y-4">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto"></div>
          <p className="text-muted-foreground">Loading...</p>
        </div>
      </div>
    )
  }
  
  if (!user) {
    return <Navigate to={redirectTo} state={{ from: location }} replace />
  }
  
  return <>{children}</>
}

// Reverse auth guard - redirects authenticated users away from auth pages
export const GuestGuard = ({ children }: { children: ReactNode }) => {
  const { user, loading } = useAuthState()
  
  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gradient-to-br from-[hsl(var(--auth-bg))] to-white">
        <div className="text-center space-y-4">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto"></div>
          <p className="text-muted-foreground">Loading...</p>
        </div>
      </div>
    )
  }
  
  if (user) {
    return <Navigate to="/dashboard" replace />
  }
  
  return <>{children}</>
}
