import { UpdatePasswordForm } from '@/components/auth/UpdatePasswordForm'
import { Card } from '@/components/ui/card'

export default function UpdatePasswordPage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50 p-4">
      <Card className="w-full max-w-md">
        <UpdatePasswordForm />
      </Card>
    </div>
  )
}
