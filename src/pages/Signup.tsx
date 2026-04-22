import { MobileSignupForm } from '@/components/auth/MobileSignupForm'
import { GuestGuard } from '@/components/auth/AuthGuard'

export default function SignupPage() {
  return (
    <GuestGuard>
      <MobileSignupForm />
    </GuestGuard>
  )
}
