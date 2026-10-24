import { useEffect, useState } from 'react';

// Tampilan sementara saat halaman menunggu data (gantinya layar kosong)
export default function Memuat() {
  const [lama, setLama] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => setLama(true), 12000);
    return () => clearTimeout(t);
  }, []);

  return (
    <div style={{ minHeight: '70vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 14 }}>
      <style>{'@keyframes denyut { 0%, 100% { transform: scale(1); opacity: 0.8; } 50% { transform: scale(1.08); opacity: 1; } }'}</style>
      <img
        src="/icon-192.png"
        alt=""
        width="64"
        height="64"
        onError={(e) => { e.currentTarget.style.display = 'none'; }}
        style={{ borderRadius: 14, animation: 'denyut 1.4s ease-in-out infinite' }}
      />
      <p className="subtle" style={{ margin: 0 }}>Memuat…</p>
      {lama && (
        <>
          <p className="subtle" style={{ margin: 0, fontSize: 11 }}>Lebih lama dari biasanya.</p>
          <button className="secondary" onClick={() => window.location.reload()}>Muat ulang</button>
        </>
      )}
    </div>
  );
}
