'use client'

import { useState } from 'react'
import { Button } from './button'
import { testConnection } from '@/lib/supabase'

export function SupabaseTest() {
  const [testResult, setTestResult] = useState<any>(null)
  const [isLoading, setIsLoading] = useState(false)

  const runTest = async () => {
    setIsLoading(true)
    try {
      const result = await testConnection()
      setTestResult(result)
    } catch (error) {
      setTestResult({ error: error.message })
    }
    setIsLoading(false)
  }

  return (
    <div className="p-4 space-y-4">
      <Button 
        onClick={runTest}
        disabled={isLoading}
      >
        {isLoading ? 'Testing...' : 'Test Supabase Connection'}
      </Button>

      {testResult && (
        <div className="mt-4 p-4 border rounded">
          <h3 className="font-bold mb-2">Test Results:</h3>
          <div className="space-y-2">
            <p>Database Connection: {testResult.database ? '✅' : '❌'}</p>
            <p>Auth Service: {testResult.auth ? '✅' : '❌'}</p>
            {testResult.errors && Object.entries(testResult.errors).map(([key, error]) => (
              error && <p key={key} className="text-red-500">
                {key}: {String(error)}
              </p>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
