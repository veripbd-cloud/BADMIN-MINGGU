import Head from 'next/head';
import '../styles/globals.css';

const SITE_URL = 'https://badmin-minggu.vercel.app';
const JUDUL = 'Badmin Minggu';
const DESKRIPSI = 'Absensi sesi mingguan, kas, stok shuttlecock, dan konfirmasi member badminton.';

export default function App({ Component, pageProps }) {
  return (
    <>
      <Head>
        <title>{JUDUL}</title>
        <meta name="description" content={DESKRIPSI} />

        {/* Ikon tab browser (?v=2 biar browser ambil yang baru, bukan ikon bola dunia lama) */}
        <link rel="icon" href="/favicon.ico?v=2" sizes="any" />
        <link rel="icon" type="image/png" sizes="192x192" href="/icon-192.png?v=2" />
        <link rel="apple-touch-icon" href="/apple-touch-icon.png?v=2" />

        {/* Preview link (WhatsApp, Telegram, dll) */}
        <meta property="og:type" content="website" />
        <meta property="og:site_name" content={JUDUL} />
        <meta property="og:title" content={JUDUL} />
        <meta property="og:description" content={DESKRIPSI} />
        <meta property="og:url" content={SITE_URL} />
        <meta property="og:image" content={`${SITE_URL}/og-thumb.png`} />
        <meta property="og:image:width" content="256" />
        <meta property="og:image:height" content="256" />
        <meta name="twitter:card" content="summary" />
        <meta name="twitter:title" content={JUDUL} />
        <meta name="twitter:description" content={DESKRIPSI} />
        <meta name="twitter:image" content={`${SITE_URL}/og-thumb.png`} />
      </Head>
      <Component {...pageProps} />
    </>
  );
}
