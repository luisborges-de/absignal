import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import { QueryProvider } from '@/components/providers/QueryProvider'
import { BRAND_NAME } from '@/lib/brand'
import './globals.css'

const inter = Inter({ subsets: ['latin'], weight: ['400', '700'] })

export const metadata: Metadata = {
  title: BRAND_NAME,
  description: 'ABS credit surveillance for data center deals.',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className={inter.className}>
        <QueryProvider>{children}</QueryProvider>
      </body>
    </html>
  )
}
