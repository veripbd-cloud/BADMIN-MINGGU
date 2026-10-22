import { useEffect, useState } from 'react';

// Pemberitahuan kecil di bawah layar. Dipanggil dari mana saja: tampilToast('Tersimpan ✓')
export function tampilToast(teks, tipe = 'ok') {
  if (typeof window === 'undefined' || !teks) return;
  window.dispatchEvent(new CustomEvent('badmin-toast', {
    detail: { teks, tipe, id: Date.now() + Math.random() },
  }));
}

export default function ToastHost() {
  const [daftar, setDaftar] = useState([]);

  useEffect(() => {
    function dengar(e) {
      const t = e.detail;
      const lama = t.tipe === 'error' ? 6000 : 2600;
      setDaftar((d) => [...d.slice(-2), { ...t, keluar: false }]);
      setTimeout(() => setDaftar((d) => d.map((x) => (x.id === t.id ? { ...x, keluar: true } : x))), lama);
      setTimeout(() => setDaftar((d) => d.filter((x) => x.id !== t.id)), lama + 450);
    }
    window.addEventListener('badmin-toast', dengar);
    return () => window.removeEventListener('badmin-toast', dengar);
  }, []);

  return (
    <div
      aria-live="polite"
      style={{
        position: 'fixed', left: 0, right: 0, bottom: 24, zIndex: 1000,
        display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8, pointerEvents: 'none',
      }}
    >
      {daftar.map((t) => (
        <div
          key={t.id}
          style={{
            maxWidth: '88vw', padding: '10px 18px', borderRadius: 999, fontSize: 12, fontWeight: 600,
            background: '#1b3a2f', color: t.tipe === 'error' ? '#e8988c' : '#f4f7f2',
            border: `1px solid ${t.tipe === 'error' ? '#b5493a' : '#e8b64c'}`,
            boxShadow: '0 6px 24px #00000066',
            opacity: t.keluar ? 0 : 1, transition: 'opacity 0.4s ease',
            animation: 'naikPelan 0.35s cubic-bezier(0.22, 0.61, 0.36, 1) backwards',
          }}
        >
          {t.tipe === 'error' ? '⚠ ' : ''}{t.teks}
        </div>
      ))}
    </div>
  );
}
