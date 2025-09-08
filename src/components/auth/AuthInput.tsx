import { useState } from 'react'
import { Eye, EyeOff, Mail, Lock, User, MapPin } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

interface AuthInputProps {
  id: string
  type: 'email' | 'password' | 'text'
  label: string
  value: string
  onChange: (value: string) => void
  placeholder?: string
  required?: boolean
  icon?: 'email' | 'password' | 'user' | 'location'
  error?: string
  autoComplete?: string
}

export const AuthInput = ({
  id,
  type,
  label,
  value,
  onChange,
  placeholder,
  required = false,
  icon,
  error,
  autoComplete
}: AuthInputProps) => {
  const [showPassword, setShowPassword] = useState(false)
  const [focused, setFocused] = useState(false)

  const getIcon = () => {
    switch (icon) {
      case 'email': return <Mail className="h-4 w-4" />
      case 'password': return <Lock className="h-4 w-4" />
      case 'user': return <User className="h-4 w-4" />
      case 'location': return <MapPin className="h-4 w-4" />
      default: return null
    }
  }

  const inputType = type === 'password' && showPassword ? 'text' : type

  return (
    <div className="space-y-2">
      <Label 
        htmlFor={id} 
        className={`text-sm font-medium transition-colors ${error ? 'text-destructive' : 'text-foreground'}`}
      >
        {label}
        {required && <span className="text-destructive ml-1">*</span>}
      </Label>
      
      <div className="relative">
        {icon && (
          <div className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">
            {getIcon()}
          </div>
        )}
        
        <Input
          id={id}
          type={inputType}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          required={required}
          autoComplete={autoComplete}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          className={`
            h-12 transition-all duration-200 
            ${icon ? 'pl-10' : 'pl-4'} 
            ${type === 'password' ? 'pr-10' : 'pr-4'}
            ${error ? 'border-destructive focus:border-destructive' : ''}
            ${focused ? 'ring-2 ring-[hsl(var(--auth-gradient-from))]/20' : ''}
          `}
        />
        
        {type === 'password' && (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="absolute right-0 top-0 h-full px-3 hover:bg-transparent"
            onClick={() => setShowPassword(!showPassword)}
          >
            {showPassword ? (
              <EyeOff className="h-4 w-4 text-muted-foreground" />
            ) : (
              <Eye className="h-4 w-4 text-muted-foreground" />
            )}
          </Button>
        )}
      </div>
      
      {error && (
        <p className="text-sm text-destructive font-medium">{error}</p>
      )}
    </div>
  )
}