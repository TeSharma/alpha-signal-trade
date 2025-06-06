import { SignupForm } from '@/components/auth/SignupForm'
import { Card } from '@/components/ui/card'

export default function SignupPage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50 p-4">
      <Card className="w-full max-w-md">
        <SignupForm />
      </Card>
    </div>
  )
}
