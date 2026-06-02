'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'

const NAV_ITEMS = [
  { href: '/', label: 'ホーム', icon: '🏇' },
  { href: '/results', label: '結果入力', icon: '📝' },
  { href: '/dashboard', label: '分析', icon: '📈' },
  { href: '/stats', label: '統計', icon: '📊' },
  { href: '/import', label: 'CSV取込', icon: '📂' },
  { href: '/n8n', label: 'n8n連携', icon: '⚡' },
  { href: '/simple', label: 'シンプルAI', icon: '🤖' },
]

export default function Navigation() {
  const pathname = usePathname()

  return (
    <>
      {/* PC 上部ナビ */}
      <nav className="hidden md:block sticky top-0 z-50 bg-slate-900/80 backdrop-blur-md border-b border-white/10">
        <div className="max-w-4xl mx-auto px-4">
          <div className="flex items-center gap-2 h-16">
            <span className="text-amber-400 font-bold text-xl mr-6">競馬AI</span>
            {NAV_ITEMS.map((item) => {
              const isActive =
                item.href === '/' ? pathname === '/' : pathname.startsWith(item.href)
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200 ${
                    isActive
                      ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30'
                      : 'text-white/60 hover:text-white/90 hover:bg-white/5'
                  }`}
                >
                  <span>{item.icon}</span>
                  <span>{item.label}</span>
                </Link>
              )
            })}
          </div>
        </div>
      </nav>

      {/* モバイル 下部固定ナビ */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 z-50 bg-slate-900/95 backdrop-blur-md border-t border-white/10">
        <div className="flex">
          {NAV_ITEMS.map((item) => {
            const isActive =
              item.href === '/' ? pathname === '/' : pathname.startsWith(item.href)
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex-1 flex flex-col items-center gap-1 py-3 text-xs font-medium transition-all duration-200 ${
                  isActive ? 'text-amber-400' : 'text-white/50'
                }`}
              >
                <span className="text-xl">{item.icon}</span>
                <span>{item.label}</span>
                {isActive && (
                  <span className="absolute bottom-0 w-8 h-0.5 bg-amber-400 rounded-full" />
                )}
              </Link>
            )
          })}
        </div>
      </nav>
    </>
  )
}
