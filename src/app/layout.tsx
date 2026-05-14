import type { Metadata } from 'next'
import './globals.css'
import Navigation from '@/components/Navigation'

export const metadata: Metadata = {
  title: '競馬AI - オッズ歪み検出',
  description: '期待値と歪みスコアでバリュー馬券を発見',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="ja">
      <body
        style={{ fontFamily: 'system-ui, -apple-system, sans-serif' }}
        className="min-h-screen bg-gradient-to-br from-slate-900 via-blue-950 to-slate-900 text-white antialiased"
      >
        <Navigation />
        <main className="min-h-screen">{children}</main>
      </body>
    </html>
  )
}
