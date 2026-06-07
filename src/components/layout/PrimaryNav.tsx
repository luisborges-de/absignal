'use client'

import Link from 'next/link'
import { Database, LogOut, Menu, UserRound, X } from 'lucide-react'
import { useState } from 'react'
import { DEMO_DEAL_ID } from '@/lib/demo/seedDemo'
import { BRAND_NAME } from '@/lib/brand'
import { useAuth } from '@/hooks/useAuth'
import { useUIStore } from '@/store/uiStore'
import { cn } from '@/lib/utils'

export function PrimaryNav() {
  const { email, signOut } = useAuth()
  const setDemoMode = useUIStore((state) => state.setDemoMode)
  const [isOpen, setIsOpen] = useState(false)

  const demoHref = `/auth/login?redirect=/deals/${DEMO_DEAL_ID}`

  function close() {
    setIsOpen(false)
  }

  return (
    <header className="sticky top-0 z-50 bg-nv-dark text-nv-on-dark shadow-sticky">
      <nav className="mx-auto flex h-16 max-w-content items-center justify-between px-6">
        <Link href="/" aria-label={BRAND_NAME} className="flex items-center gap-2 text-body-strong font-bold">
          <Database className="h-5 w-5 text-nv-green" aria-hidden="true" />
          <span aria-hidden="true">
            <span className="text-nv-green">ABS</span>ignal
          </span>
        </Link>

        <div className="hidden items-center gap-8 text-body-sm font-bold md:flex">
          <Link href="/deals" className="text-nv-on-dark">
            Deals
          </Link>
          <Link href="/#how-it-works" className="text-nv-on-dark">
            How It Works
          </Link>
        </div>

        <div className="hidden items-center gap-3 md:flex">
          <Link
            href={demoHref}
            onClick={() => setDemoMode(true)}
            className={cn(
              'hidden h-11 items-center rounded-sm border border-nv-on-dark bg-transparent px-4 py-2.5 text-btn-sm font-bold text-nv-on-dark sm:inline-flex',
            )}
          >
            Load Demo
          </Link>
          {email ? (
            <button
              type="button"
              onClick={() => void signOut()}
              className="inline-flex min-h-11 items-center gap-2 rounded-sm text-btn-sm font-bold text-nv-on-dark"
            >
              <UserRound className="h-4 w-4" aria-hidden="true" />
              <span className="hidden max-w-40 truncate lg:inline">{email}</span>
              <LogOut className="h-4 w-4" aria-hidden="true" />
            </button>
          ) : (
            <Link href="/auth/login" className="text-btn-sm font-bold text-nv-on-dark">
              Sign In
            </Link>
          )}
        </div>

        <button
          type="button"
          aria-label={isOpen ? 'Close navigation menu' : 'Open navigation menu'}
          aria-expanded={isOpen}
          onClick={() => setIsOpen((value) => !value)}
          className="inline-flex min-h-11 items-center justify-center rounded-sm text-nv-on-dark md:hidden"
        >
          {isOpen ? <X className="h-6 w-6" aria-hidden="true" /> : <Menu className="h-6 w-6" aria-hidden="true" />}
        </button>
      </nav>
      {isOpen && (
        <div className="border-t border-nv-hairline-strong bg-nv-dark md:hidden">
          <div className="mx-auto flex max-w-content flex-col px-6 py-4 text-btn-md font-bold">
            <Link href="/deals" onClick={close} className="min-h-11 py-3">
              Deals
            </Link>
            <Link href="/#how-it-works" onClick={close} className="min-h-11 py-3">
              How It Works
            </Link>
            <Link
              href={demoHref}
              onClick={() => {
                setDemoMode(true)
                close()
              }}
              className="mt-2 inline-flex h-11 items-center justify-center rounded-sm border border-nv-on-dark px-4 py-2.5 text-btn-sm font-bold"
            >
              Load Demo
            </Link>
            {email ? (
              <button
                type="button"
                onClick={() => {
                  close()
                  void signOut()
                }}
                className="mt-2 inline-flex min-h-11 items-center justify-center gap-2 rounded-sm text-btn-sm font-bold"
              >
                <UserRound className="h-4 w-4" aria-hidden="true" />
                <span>{email}</span>
                <LogOut className="h-4 w-4" aria-hidden="true" />
              </button>
            ) : (
              <Link href="/auth/login" onClick={close} className="min-h-11 py-3 text-center text-btn-sm font-bold">
                Sign In
              </Link>
            )}
          </div>
        </div>
      )}
    </header>
  )
}
