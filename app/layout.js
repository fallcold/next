export const metadata = {
  title: '星环行星动画',
  description: 'Next.js 动画示例：星星组成星环围绕行星',
};

export default function RootLayout({ children }) {
  return (
    <html lang="zh-CN">
      <body style={{ margin: 0, fontFamily: 'system-ui, sans-serif' }}>{children}</body>
    </html>
  );
}
