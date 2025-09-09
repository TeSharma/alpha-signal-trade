import { ForgotPasswordForm } from '@/components/auth/ForgotPasswordForm'
import { GuestGuard } from '@/components/auth/AuthGuard'

export default function ForgotPasswordPage() {
  return (
    <GuestGuard>
      <ForgotPasswordForm />
    </GuestGuard>
  )
}
