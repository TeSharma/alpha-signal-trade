import { Check, X } from 'lucide-react'
import { Progress } from '@/components/ui/progress'

interface PasswordStrengthProps {
  password: string
  confirmPassword?: string
  showConfirmation?: boolean
}

export const PasswordStrength = ({ 
  password, 
  confirmPassword = '', 
  showConfirmation = false 
}: PasswordStrengthProps) => {
  const requirements = {
    length: password.length >= 8,
    upper: /[A-Z]/.test(password),
    lower: /[a-z]/.test(password),
    number: /\d/.test(password),
    special: /[!@#$%^&*(),.?":{}|<>]/.test(password)
  }

  const matches = confirmPassword.length > 0 && password === confirmPassword

  const score = Object.values(requirements).filter(Boolean).length
  const percentage = (score / 5) * 100

  const getStrengthColor = () => {
    if (score <= 2) return 'bg-destructive'
    if (score <= 3) return 'bg-yellow-500'
    return 'bg-[hsl(var(--success))]'
  }

  const getStrengthText = () => {
    if (score <= 2) return 'Weak'
    if (score <= 3) return 'Good'
    return 'Strong'
  }

  if (password.length === 0) return null

  return (
    <div className="space-y-3 mt-2">
      {/* Strength Bar */}
      <div className="space-y-1">
        <div className="flex justify-between text-xs">
          <span className="text-muted-foreground">Password strength</span>
          <span className={`font-medium ${score > 3 ? 'text-[hsl(var(--success))]' : score > 2 ? 'text-yellow-600' : 'text-destructive'}`}>
            {getStrengthText()}
          </span>
        </div>
        <Progress value={percentage} className="h-2" />
      </div>

      {/* Requirements */}
      <div className="space-y-1">
        <RequirementItem met={requirements.length} text="At least 8 characters" />
        <RequirementItem met={requirements.upper} text="One uppercase letter" />
        <RequirementItem met={requirements.lower} text="One lowercase letter" />
        <RequirementItem met={requirements.number} text="One number" />
        <RequirementItem met={requirements.special} text="One special character" />
        
        {showConfirmation && confirmPassword.length > 0 && (
          <RequirementItem met={matches} text="Passwords match" />
        )}
      </div>
    </div>
  )
}

const RequirementItem = ({ met, text }: { met: boolean; text: string }) => (
  <div className="flex items-center gap-2 text-sm">
    {met ? (
      <Check className="h-3 w-3 text-[hsl(var(--success))]" />
    ) : (
      <X className="h-3 w-3 text-destructive" />
    )}
    <span className={met ? 'text-[hsl(var(--success))]' : 'text-muted-foreground'}>
      {text}
    </span>
  </div>
)