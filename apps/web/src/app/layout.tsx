import type { Metadata } from 'next'
import type { ReactNode } from 'react'
import { currentActor } from '../server/auth/actor'
import './globals.css'
import 'katex/dist/katex.min.css'
export const dynamic = 'force-dynamic'

export const metadata: Metadata = {
  title: 'Pharmacy Study',
  description: 'Dự án web ôn thi cho 5 môn Dược.',
}

export default async function RootLayout({
  children,
}: {
  children: ReactNode
}) {
  const showDevTools =
    process.env.NODE_ENV === 'development' &&
    (await currentActor())?.role === 'admin'
  return (
    <html lang="vi">
      {/* Grammarly adds body attributes before hydration; limit the exception to this element. */}
      <body
        data-devtools={showDevTools ? 'admin' : undefined}
        suppressHydrationWarning
      >
        {children}
      </body>
    </html>
  )
}
