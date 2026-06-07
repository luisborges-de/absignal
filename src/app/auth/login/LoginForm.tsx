'use client'

import { useSearchParams, useRouter } from 'next/navigation'
import { FormEvent, useState } from 'react'
import { LockKeyhole } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { Input } from '@/components/ui/Input'
import { DEMO_DEAL_ID } from '@/lib/demo/seedDemo'
import { useAuth } from '@/hooks/useAuth'
import { DEMO_EMAIL, DEMO_PASSWORD } from '@/lib/brand'

export function LoginForm() {
  const [email, setEmail] = useState(DEMO_EMAIL)
  const [password, setPassword] = useState(DEMO_PASSWORD)
  const [error, setError] = useState<string | null>(null)
  const params = useSearchParams()
  const router = useRouter()
  const { signIn } = useAuth()

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError(null)

    try {
      await signIn(email, password)
      router.push(params.get('redirect') ?? `/deals/${DEMO_DEAL_ID}`)
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Unable to sign in.')
    }
  }

  return (
    <Card dark>
      <form onSubmit={(event) => void submit(event)} className="space-y-5">
        <Input
          label="Email"
          type="email"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
        />
        <Input
          label="Password"
          type="password"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
        />
        {error && <p className="text-body-sm font-bold text-nv-error">{error}</p>}
        <Button type="submit" icon={<LockKeyhole className="h-4 w-4" aria-hidden="true" />}>
          Sign In
        </Button>
      </form>
    </Card>
  )
}
