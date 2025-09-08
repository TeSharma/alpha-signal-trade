import { ReactNode } from 'react'
import authIllustration from '@/assets/auth-illustration.jpg'

interface AuthLayoutProps {
  children: ReactNode
  title: string
  subtitle: string
  showIllustration?: boolean
}

export const AuthLayout = ({ 
  children, 
  title, 
  subtitle, 
  showIllustration = true 
}: AuthLayoutProps) => {
  return (
    <div className="min-h-screen flex bg-gradient-to-br from-[hsl(var(--auth-bg))] to-white">
      {/* Form Container */}
      <div className="flex-1 flex items-center justify-center p-4 sm:p-8">
        <div className="w-full max-w-md space-y-6 bg-[hsl(var(--auth-card))] p-8 rounded-2xl shadow-lg border border-[hsl(var(--border))]">
          <div className="space-y-2 text-center">
            <h1 className="text-3xl font-bold bg-gradient-to-r from-[hsl(var(--auth-gradient-from))] to-[hsl(var(--auth-gradient-to))] bg-clip-text text-transparent">
              {title}
            </h1>
            <p className="text-muted-foreground">{subtitle}</p>
          </div>
          {children}
        </div>
      </div>

      {/* Illustration Side */}
      {showIllustration && (
        <div className="hidden lg:flex lg:flex-1 bg-gradient-to-br from-[hsl(var(--auth-gradient-from))]/10 to-[hsl(var(--auth-gradient-to))]/10 items-center justify-center p-8">
          <div className="max-w-lg">
            <img 
              src={authIllustration} 
              alt="Trading illustration" 
              className="w-full h-auto object-contain drop-shadow-2xl"
            />
            <div className="mt-8 text-center">
              <h2 className="text-2xl font-bold text-foreground mb-2">
                Advanced Trading Platform
              </h2>
              <p className="text-muted-foreground">
                Join thousands of traders using our secure and powerful platform
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}