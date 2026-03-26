import type React from "react"
import type { Metadata, Viewport } from "next"
import { Analytics } from "@vercel/analytics/next"
import "./globals.css"
import { MonthProvider } from "@/lib/month-context"
import { AppShell } from "@/components/app-shell"
import { Toaster } from "@/components/ui/toaster"

export const metadata: Metadata = {
  title: "TallerPro - Gestión de Taller Automotriz",
  description: "Sistema profesional de gestión para talleres de reparación de vehículos",
  generator: "v0.app",
}

export const viewport: Viewport = {
  themeColor: "#0d0d0d",
  width: "device-width",
  initialScale: 1,
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="es">
      <body className="font-sans antialiased">
        <MonthProvider>
          <AppShell>{children}</AppShell>
          <Toaster />
        </MonthProvider>
        <Analytics />
      </body>
    </html>
  )
}
