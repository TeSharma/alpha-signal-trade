import { MobileForgotPasswordForm } from '@/components/auth/MobileForgotPasswordForm'
import { GuestGuard } from '@/components/auth/AuthGuard'

export default function ForgotPasswordPage() {
  return (
    <GuestGuard>
      <MobileForgotPasswordForm />
    </GuestGuard>
  )
}
