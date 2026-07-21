import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "OPIc Daily Coach",
  description: "한국어 생각을 자연스러운 영어 답변으로 바꾸는 로컬 OPIc 훈련",
  icons: {
    icon: "/favicon.svg",
    shortcut: "/favicon.svg",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ko">
      <body>{children}</body>
    </html>
  );
}
