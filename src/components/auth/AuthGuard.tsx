import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { getSession } from '@/lib/supabase'
import { Toaster } from '@/components/ui/toaster'
import { useToast } from '@/components/ui/use-toast'

export const AuthGuard = ({ children }: { children: React.ReactNode }) => {
  const navigate = useNavigate()
  const { toast } = useToast()

  useEffect(() => {
    const checkAuth = async () => {
      const { session, error } = await getSession()
      
      if (error || !session) {
        toast({
          title: 'Authentication required',
          description: 'Please sign in to access this page',
          variant: 'destructive'
        })
        navigate('/login')
      }
    }
    checkAuth()
  }, [navigate, toast])

  return (
    <>
      <Toaster />
      {children}
    </>
  )
}
