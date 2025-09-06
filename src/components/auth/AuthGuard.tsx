import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '@/integrations/supabase/client'
import { useToast } from '@/components/ui/use-toast'

export const AuthGuard = ({ children }: { children: React.ReactNode }) => {
  const navigate = useNavigate()
  const { toast } = useToast()
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    const checkAuth = async () => {
      try {
        const { data: { session }, error } = await supabase.auth.getSession()
        
        if (error || !session) {
          toast({
            title: 'Authentication required',
            description: 'Please sign in to access this page',
            variant: 'destructive'
          })
          navigate('/login')
        }
      } catch (error) {
        console.error('Auth check error:', error)
        navigate('/login')
      } finally {
        setIsLoading(false)
      }
    }
    checkAuth()
  }, [navigate, toast])

  if (isLoading) {
    return <div className="flex items-center justify-center min-h-screen">Loading...</div>
  }

  return <>{children}</>
}
