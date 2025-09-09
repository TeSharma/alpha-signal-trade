import { SignupForm } from '@/components/auth/SignupForm'
import { GuestGuard } from '@/components/auth/AuthGuard'

export default function SignupPage() {
  return (
    <GuestGuard>
      <SignupForm />
    </GuestGuard>
  )
}
