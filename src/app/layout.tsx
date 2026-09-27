import type { Metadata } from "next";
import type { ReactNode } from "react";
import "./globals.css";

export const metadata: Metadata = {
  title: "ژورنال معاملاتی | Trading Journal",
  description:
    "ژورنال معاملاتی حرفه‌ای با ثبت دستی و خودکار معاملات از متاتریدر، آمار برد/باخت، پروفیت فاکتور و تحلیل رفتار معامله‌گر",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="fa" dir="rtl">
      <body className="antialiased">{children}</body>
    </html>
  );
}
