import './globals.css';

export const metadata = {
  title: 'DealBot — Amazon Deal Generator',
  description: 'Generate, preview, and post Amazon deals to Telegram.',
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body className="antialiased">{children}</body>
    </html>
  );
}
