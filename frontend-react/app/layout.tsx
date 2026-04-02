import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Optezum",
  description: "Optezum - demand forecasting and price optimization"
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
