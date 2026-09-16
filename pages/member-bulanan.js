import { useEffect } from 'react';
import { useRouter } from 'next/router';

// Halaman ini sudah digabung ke halaman utama (Sesi & Member). File ini dibiarkan
// sebagai redirect aja, buat jaga-jaga kalau ada yang masih buka link lama.
export default function MemberBulananRedirect() {
  const router = useRouter();
  useEffect(() => { router.replace('/'); }, []);
  return null;
}
