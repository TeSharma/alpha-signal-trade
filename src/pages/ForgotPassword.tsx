import { ForgotPasswordForm } from '@/components/auth/ForgotPasswordForm'
import { Card } from '@/components/ui/card'

export default function ForgotPasswordPage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50 p-4">
      <Card className="w-full max-w-md">
        <ForgotPasswordForm />
      </Card>
    </div>
  )
}
