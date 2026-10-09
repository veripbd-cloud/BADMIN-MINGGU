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
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <meta name="description" content={DESKRIPSI} />

        {/* Preview link (WhatsApp, Telegram, Facebook, dll) */}
        <meta property="og:type" content="website" />
        <meta property="og:site_name" content={JUDUL} />
        <meta property="og:title" content={JUDUL} />
        <meta property="og:description" content={DESKRIPSI} />
        <meta property="og:url" content={SITE_URL} />
        <meta property="og:image" content={`${SITE_URL}/og-image.png`} />
        <meta property="og:image:width" content="600" />
        <meta property="og:image:height" content="600" />
        <meta name="twitter:card" content="summary" />
        <meta name="twitter:title" content={JUDUL} />
        <meta name="twitter:description" content={DESKRIPSI} />
        <meta name="twitter:image" content={`${SITE_URL}/og-image.png`} />
      </Head>
      <Component {...pageProps} />
    </>
  );
}
