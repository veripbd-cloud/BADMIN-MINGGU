// Potongan tampilan bersama untuk daftar dengan kotak centang ala Gmail

// Kotak centang digambar sendiri (bukan <input>) karena gaya input global akan merusak bentuknya
export function KotakCentang({ aktif }) {
  return (
    <span
      aria-hidden="true"
      style={{
        width: 18, height: 18, flex: 'none', borderRadius: 5,
        display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
        border: `1.5px solid ${aktif ? '#e8b64c' : '#ffffff66'}`,
        background: aktif ? '#e8b64c' : 'transparent',
        color: '#0d1a15', fontSize: 12, fontWeight: 700, lineHeight: 1,
        transition: 'background 0.15s, border-color 0.15s',
      }}
    >
      {aktif ? '✓' : ''}
    </span>
  );
}

// Bilah di atas daftar: "pilih semua" + ringkasan di kiri, tombol aksi (children) di kanan
export function BilahAksi({ semuaTerpilih, onToggleSemua, ringkasan, children }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', padding: '6px 2px 10px', marginBottom: 6, borderBottom: '1px solid #ffffff1a' }}>
      <div
        role="checkbox"
        aria-checked={semuaTerpilih}
        onClick={onToggleSemua}
        style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', userSelect: 'none' }}
      >
        <KotakCentang aktif={semuaTerpilih} />
        <span className="subtle" style={{ fontSize: 11 }}>{ringkasan}</span>
      </div>
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginLeft: 'auto' }}>{children}</div>
    </div>
  );
}

// Satu baris yang bisa dipilih (seluruh baris bisa diklik); yang dipilih bercetak tebal + warna emas
export function BarisPilih({ label, subteks, kanan, warnaKanan, terpilih, bisaPilih, onToggle, garis = '#ffffff33', redup = false }) {
  return (
    <div
      role={bisaPilih ? 'checkbox' : undefined}
      aria-checked={bisaPilih ? terpilih : undefined}
      onClick={bisaPilih ? onToggle : undefined}
      style={{
        display: 'flex', alignItems: 'center', gap: 10,
        padding: '8px 12px', marginBottom: 6, borderRadius: 10,
        border: `1px solid ${terpilih ? '#e8b64c' : '#ffffff1a'}`,
        borderLeft: `3px solid ${terpilih ? '#e8b64c' : garis}`,
        background: terpilih ? '#e8b64c26' : '#16302691',
        cursor: bisaPilih ? 'pointer' : 'default',
        opacity: redup && !terpilih ? 0.7 : 1,
        userSelect: 'none',
        transition: 'background 0.15s, border-color 0.15s',
      }}
    >
      {bisaPilih && <KotakCentang aktif={terpilih} />}
      <div style={{ flex: '1 1 auto', minWidth: 0 }}>
        <div style={{ fontSize: 13, fontWeight: terpilih ? 700 : 500, color: terpilih ? '#e8b64c' : undefined }}>{label}</div>
        {subteks && <div className="subtle" style={{ fontSize: 11 }}>{subteks}</div>}
      </div>
      {kanan && <span style={{ marginLeft: 'auto', fontSize: 11, textAlign: 'right', color: warnaKanan || 'var(--muted)' }}>{kanan}</span>}
    </div>
  );
}
