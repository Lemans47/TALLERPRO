import type React from "react"
import type { Metadata, Viewport } from "next"
import { Analytics } from "@vercel/analytics/next"
import "./globals.css"
import { MonthProvider } from "@/lib/month-context"
import { SidebarNav } from "@/components/sidebar-nav"
import { Toaster } from "@/components/ui/toaster"

export const metadata: Metadata = {
  title: "TallerPro - Gestión de Taller Automotriz",
  description: "Sistema profesional de gestión para talleres de reparación de vehículos",
    generator: 'v0.app'
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
          <div className="flex min-h-screen bg-background">
            <SidebarNav />
            <main className="flex-1 md:ml-64 pt-16 md:pt-0">
              <div className="p-4 md:p-6 lg:p-8 max-w-7xl mx-auto">{children}</div>
            </main>
          </div>
          <Toaster />
        </MonthProvider>
        <Analytics />
      </body>
    </html>
  )
}
