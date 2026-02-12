export const metadata = {
  title: 'Hello Next.js',
  description: 'A hello world project built with Next.js',
};

export default function RootLayout({ children }) {
  return (
    <html lang="zh-CN">
      <body style={{ fontFamily: 'Arial, sans-serif', margin: 0 }}>{children}</body>
    </html>
  );
}
