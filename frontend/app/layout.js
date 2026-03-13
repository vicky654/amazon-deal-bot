import './globals.css'

export const metadata = {
  title: 'Amazon Deal Generator',
  description: 'Generate and share Amazon deals to Telegram',
}

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-gray-50">{children}</body>
    </html>
  )
}

