# 競馬AI - オッズ歪み検出アプリ

期待値計算とオッズ歪みスコアで、市場が過小評価している馬券を発見するWebアプリです。

## スクリーンショット（機能概要）

| ページ | 機能 |
|--------|------|
| ホーム | 今日のレース分析・おすすめ3レース・買い目提案・馬券記録 |
| 結果入力 | 的中/不的中・払戻金入力・収支リアルタイム確認 |
| 統計 | 日別/月別回収率・AIスコア別成績・馬券種別分析 |

---

## セットアップ手順

### 1. Node.js をインストール

https://nodejs.org/ja/ から **LTS版** をダウンロードしてインストールしてください。

インストール後、ターミナルで確認：
```
node -v   # v20.x.x などが表示されればOK
npm -v    # 10.x.x などが表示されればOK
```

### 2. プロジェクトのセットアップ

```bash
# このディレクトリに移動
cd "keiba-ai-next"

# 依存パッケージをインストール（初回のみ・数分かかります）
npm install

# 環境変数ファイルを作成
copy .env.example .env

# データベースを初期化
npx prisma db push

# 開発サーバーを起動
npm run dev
```

### 3. ブラウザで開く

```
http://localhost:3000
```

---

## ディレクトリ構成

```
keiba-ai-next/
├── prisma/
│   ├── schema.prisma       # DBスキーマ（SQLite）
│   └── dev.db              # SQLiteデータベース（自動生成）
├── src/
│   ├── app/
│   │   ├── page.tsx        # ホーム（おすすめレース）
│   │   ├── results/        # 結果入力ページ
│   │   ├── stats/          # 統計ページ
│   │   └── api/            # APIルート
│   │       ├── races/      # GET /api/races
│   │       ├── bets/       # GET/POST /api/bets
│   │       │   └── [id]/   # PATCH /api/bets/:id
│   │       └── stats/      # GET /api/stats
│   ├── components/
│   │   └── Navigation.tsx  # ナビゲーション
│   ├── lib/
│   │   ├── calculator.ts   # EV・歪みスコア計算
│   │   └── prisma.ts       # Prismaクライアント
│   ├── services/
│   │   ├── jravan/
│   │   │   └── mock.ts     # モックデータ（← JRA-VAN接続時にここを差し替え）
│   │   └── ai/
│   │       └── mock.ts     # AIコメント生成（← OpenAI/Claude接続時にここを差し替え）
│   └── types/
│       └── index.ts        # TypeScript型定義
├── .env.example            # 環境変数テンプレート
└── package.json
```

---

## アルゴリズム

### 期待値スコア（evScore）
```
推定勝率 = 過去5走の加重平均（1着=1.0点, 2着=0.4点, 3着=0.2点）× 人気補正
期待値   = 単勝オッズ × 推定勝率 − 1
EVスコア = 期待値 × 100（−100〜+100）
```

### 歪みスコア（skewScore）
```
市場勝率 = 1 ÷ 単勝オッズ
歪み     = （推定勝率 − 市場勝率）× 100
正の歪み = 市場が過小評価 → バリュー馬券の候補
```

### レース推奨スコア
```
レーススコア = max(EVスコア) × 0.6 + max(歪みスコア) × 2.0
```

---

## JRA-VAN 接続（後で設定）

`src/services/jravan/mock.ts` の `getMockRaces()` を、実際のJRA-VANデータを返す関数に差し替えます。

```typescript
// 差し替え先: src/services/jravan/index.ts（後で作成）
// 現在: mock.ts のダミーデータを使用
```

JRA-VAN利用には別途、申請・利用キー取得が必要です。

## AI接続（後で設定）

`src/services/ai/mock.ts` の `getMockAiComment()` を、OpenAI または Claude API を呼び出す関数に差し替えます。

`.env` に APIキーを設定：
```
OPENAI_API_KEY=sk-xxxx
# または
ANTHROPIC_API_KEY=sk-ant-xxxx
```

---

## 注意事項

- このアプリは **馬券購入を自動化しません**
- AIは買い目候補と理由を提示するだけです
- **最終判断は必ずユーザー自身が行ってください**
- 回収率の検証を重視した設計です
