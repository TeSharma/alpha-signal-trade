import { LoginForm } from '@/components/auth/LoginForm'
import { Card } from '@/components/ui/card'

export default function LoginPage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50 p-4">
      <Card className="w-full max-w-md p-6">
        <LoginForm />
      </Card>
    </div>
  )
}