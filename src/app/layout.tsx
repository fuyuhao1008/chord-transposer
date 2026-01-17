import type { Metadata } from 'next';
import './globals.css';
import { ErrorBoundary } from '@/components/error-boundary';

export const metadata: Metadata = {
  title: {
    default: '琴献馨香',
    template: '%s | 琴献馨香',
  },
  description:
    '上传简谱图片，可进行和弦转调，输出新图。基于AI驱动的智能和弦转调工具，支持12个调性转换，自动在原图上原位替换和弦。',
  keywords: [
    '简谱',
    '和弦转调',
    'AI识别',
    '音乐转调',
    '自动转调',
    '智能和弦',
    '转调工具',
    '音乐助手',
  ],
  authors: [{ name: '琴献馨香', url: '' }],
  generator: '琴献馨香',
  // icons: {
  //   icon: '',
  // },
  openGraph: {
    title: '琴献馨香 | 简谱和弦智能转调工具',
    description:
      '上传简谱图片，可进行和弦转调，输出新图。基于AI驱动的智能和弦转调工具，支持12个调性转换。',
    url: '',
    siteName: '琴献馨香',
    locale: 'zh_CN',
    type: 'website',
    // images: [
    //   {
    //     url: '',
    //     width: 1200,
    //     height: 630,
    //     alt: '琴献馨香 - 简谱和弦转调工具',
    //   },
    // ],
  },
  // twitter: {
  //   card: 'summary_large_image',
  //   title: '琴献馨香 | 简谱和弦智能转调工具',
  //   description:
  //     '上传简谱图片，自动识别和弦并转调到任意调性。基于AI驱动的智能和弦转调工具，支持12个调性转换。',
  //   // images: [''],
  // },
  robots: {
    index: true,
    follow: true,
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="zh-CN" suppressHydrationWarning>
      <body className="antialiased">
        <ErrorBoundary>
          {children}
          <div className="fixed bottom-4 right-6 text-xs z-50" style={{ fontFamily: '"Noto Serif SC", "Georgia", serif' }}>
            I <span className="text-red-300 text-[10px]">❤</span> <span className="text-black">普宣</span>
          </div>
        </ErrorBoundary>
      </body>
    </html>
  );
}
