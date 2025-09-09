import { LoginForm } from '@/components/auth/LoginForm'
import { GuestGuard } from '@/components/auth/AuthGuard'

export default function LoginPage() {
  return (
    <GuestGuard>
      <LoginForm />
    </GuestGuard>
  )
}