import { useEffect, useRef, useState } from 'react';

export default function useSpendReviews() {
  const [reviews, setReviews] = useState({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [busyId, setBusyId] = useState('');
  const [message, setMessage] = useState('');
  const mounted = useRef(false);
  const busy = useRef(false);
  async function request(method = 'GET', body) {
    const response = await fetch('/api/spend-reviews', { method, credentials: 'same-origin', cache: 'no-store',
      ...(body ? { headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) } : {}) });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || 'Could not update category reviews');
    return data;
  }
  async function reload() {
    if (busy.current) return;
    setLoading(true); setError('');
    try { const data = await request(); if (mounted.current) setReviews(data.reviews || {}); }
    catch (err) { if (mounted.current) setError(err.message || 'Could not load saved reviews'); }
    finally { if (mounted.current) setLoading(false); }
  }
  useEffect(() => {
    mounted.current = true; void reload();
    return () => { mounted.current = false; };
  }, []);
  async function save(row, category, subcategory, reset = false) {
    if (busy.current) return false;
    busy.current = true; setBusyId(row.id); setError(''); setMessage('');
    try {
      const data = await request(reset ? 'DELETE' : 'PATCH', { id: row.id, category, subcategory });
      if (mounted.current) {
        setReviews(previous => { const next = { ...previous }; if (reset) delete next[row.id]; else next[row.id] = data.review; return next; });
        setMessage(reset ? 'Saved review removed. The estimated category is restored.' : `Category confirmed for ${row.normalizedMerchant || 'this transaction'}.`);
      }
      return true;
    } catch (err) { if (mounted.current) setError(err.message || 'Could not save category'); return false; }
    finally { busy.current = false; if (mounted.current) setBusyId(''); }
  }
  return { reviews, loading, error, busyId, message, reload, save };
}
