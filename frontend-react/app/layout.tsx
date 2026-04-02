import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Launch Optimizer UI",
  description: "Frontend React UI components showcase"
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
