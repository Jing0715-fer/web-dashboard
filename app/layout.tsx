import type { Metadata } from 'next'
import { Inter } from 'next/font/local'
import './globals.css'
import { ThemeProvider } from '@/components/theme-provider'

const inter = Inter({
  src: './fonts/Inter-Variable.woff2',
  variable: '--font-inter',
  display: 'swap',
})

export const metadata: Metadata = {
  title: 'Web Dashboard',
  description: 'Manage your web applications',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={`${inter.variable} font-sans`}>
        <ThemeProvider
          attribute="class"
          defaultTheme="system"
          enableSystem
          disableTransitionOnChange
        >
          {children}
        </ThemeProvider>
      </body>
    </html>
  )
}
