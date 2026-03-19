import './globals.css';

export const metadata = {
  title: 'DealBot — Amazon Deal Generator',
  description: 'Generate, preview, and post Amazon deals to Telegram.',
};

export default function RootLayout({ children }) {
  return (
    /*
     * h-full on html + body lets AdminShell's h-screen take effect correctly.
     * Without this, percentage-based heights inside the shell may not resolve
     * to a definite pixel value in some browsers.
     */
    <html lang="en" className="h-full">
      <body className="h-full antialiased">{children}</body>
    </html>
  );
}
