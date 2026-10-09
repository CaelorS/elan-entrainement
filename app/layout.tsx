import type { Metadata, Viewport } from 'next';
import './globals.css';
export const metadata: Metadata = { title: 'Élan · Entraînement', description: 'Ton programme. Une série à la fois.', manifest: '/manifest.webmanifest', appleWebApp: { capable: true, title: 'Élan', statusBarStyle: 'black-translucent' }, icons: {icon:'/favicon.svg',apple:'/icon-192.png'} };
export const viewport: Viewport={width:'device-width',initialScale:1,viewportFit:'cover',themeColor:'#111713'};
export default function RootLayout({children}:Readonly<{children:React.ReactNode}>){return <html lang="fr"><body>{children}</body></html>}
