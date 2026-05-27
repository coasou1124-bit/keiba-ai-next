import { createClient, SupabaseClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

function warnMissing(name: string) {
  if (process.env.NODE_ENV !== 'test') {
    console.warn(`[supabase] ${name} が未設定です。Supabase 機能は無効になります。`)
  }
}

// ── クライアントサイド用（RLS 適用・ブラウザ可）─────────────────
let _supabase: SupabaseClient | null = null

export function getSupabase(): SupabaseClient {
  if (!supabaseUrl || !supabaseAnonKey) {
    warnMissing('NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_ANON_KEY')
    throw new Error('Supabase 接続情報が未設定です。.env を確認してください。')
  }
  if (!_supabase) _supabase = createClient(supabaseUrl, supabaseAnonKey)
  return _supabase
}

// ── サーバーサイド専用（RLS 無効・API Routes / n8n proxy のみで使用）──
let _supabaseAdmin: SupabaseClient | null = null

export function getSupabaseAdmin(): SupabaseClient {
  if (!supabaseUrl || !supabaseServiceRoleKey) {
    warnMissing('NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY')
    throw new Error('Supabase サービスロールキーが未設定です。.env を確認してください。')
  }
  if (!_supabaseAdmin) {
    _supabaseAdmin = createClient(supabaseUrl, supabaseServiceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    })
  }
  return _supabaseAdmin
}

// 設定済みか確認するユーティリティ（条件分岐に使用）
export function isSupabaseConfigured(): boolean {
  return Boolean(supabaseUrl && supabaseAnonKey)
}
