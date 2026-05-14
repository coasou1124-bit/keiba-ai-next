/** @type {import('next').NextConfig} */
const nextConfig = {
  webpack: (config, { dev }) => {
    if (dev) {
      // OneDrive上の日本語パスでwebpackのファイルリネームが失敗するためメモリキャッシュに切り替え
      config.cache = { type: 'memory' }
    }
    return config
  },
}
module.exports = nextConfig
