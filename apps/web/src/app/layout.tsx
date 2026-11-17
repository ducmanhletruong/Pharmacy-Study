import type { Metadata } from 'next'
import type { ReactNode } from 'react'
import './globals.css'
import 'katex/dist/katex.min.css'

export const metadata: Metadata = {
  title: 'Pharmacy Study',
  description: 'Dự án web ôn thi cho 5 môn Dược.',
}

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="vi">
      <body>{children}</body>
    </html>
  )
}
