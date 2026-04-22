import { MobileLoginForm } from '@/components/auth/MobileLoginForm'
import { GuestGuard } from '@/components/auth/AuthGuard'

export default function LoginPage() {
  return (
    <GuestGuard>
      <MobileLoginForm />
    </GuestGuard>
  )
}
