import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/router';
import { useSelector } from 'react-redux';
import Link from 'next/link';
import { clientServer } from '@/config';
import DashboardLayout from '@/layout/DashboardLayout';
import Card from '@/Components/ui/Card';
import Button from '@/Components/ui/Button';
import Skeleton from '@/Components/ui/Skeleton';
import EmptyState from '@/Components/ui/EmptyState';
import { Search, Ban, RotateCcw } from 'lucide-react';

export default function AdminMembers() {
  const router = useRouter();
  const authState = useSelector((state) => state.auth);
  const role = authState.user?.userId?.role;

  const [users, setUsers] = useState({ users: [], total: 0, page: 1, pages: 1 });
  const [page, setPage] = useState(1);
  const [queryInput, setQueryInput] = useState('');
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!localStorage.getItem('token')) {
      router.replace('/login');
      return;
    }
    if (authState.profileFetched && role !== 'admin') {
      router.replace('/dashboard');
    }
  }, [authState.profileFetched, role, router]);

  useEffect(() => {
    const t = setTimeout(() => setQuery(queryInput), 300);
    return () => clearTimeout(t);
  }, [queryInput]);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const { data } = await clientServer.get('/admin/users', { params: { page, q: query || undefined } });
      setUsers(data);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to load members');
    } finally {
      setLoading(false);
    }
  }, [page, query]);

  useEffect(() => { load(); }, [load]);

  const toggleActive = async (userId, active) => {
    await clientServer.post('/admin/users/set_active', { userId, active: !active });
    load();
  };

  return (
          <DashboardLayout fullWidth>
        <div className="max-w-5xl mx-auto p-6">
          <div className="flex items-center justify-between gap-4 mb-5 flex-wrap">
            <div>
              <h1 className="text-2xl font-bold mb-1 bg-gradient-to-r from-brand-500 to-[color:var(--mt-live)] bg-clip-text text-transparent inline-block">Members</h1>
              <p className="text-sm text-neutral-500">Manage member access and roles.</p>
            </div>
            <div className="relative">
              <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--mt-ink3)]" />
              <input
                value={queryInput}
                onChange={(e) => { setPage(1); setQueryInput(e.target.value); }}
                placeholder="Search by name, username, or email…"
                className="w-72 max-w-full rounded-full border border-[var(--mt-border)] bg-[var(--mt-surface)] pl-9 pr-4 py-2 text-sm"
              />
            </div>
          </div>

          {error && <p className="text-danger text-sm mb-3">{error}</p>}

          {loading ? (
            <Skeleton />
          ) : users.users.length === 0 ? (
            <EmptyState title="No members found" />
          ) : (
            <Card className="divide-y divide-neutral-200">
              {users.users.map((u, idx) => (
                <div key={u._id} className="flex items-center justify-between gap-3 py-3 px-4 mt-enter-sm" style={{ animationDelay: `${idx * 60}ms` }}>
                  <div className="min-w-0">
                    <p className="font-medium truncate">{u.name} <span className="text-neutral-400 font-normal">@{u.username}</span></p>
                    <p className="text-xs text-neutral-500 truncate">{u.email}</p>
                  </div>
                  <span className="text-xs font-medium capitalize text-[var(--mt-ink2)] w-16 shrink-0">{u.role}</span>
                  <span className="flex items-center gap-1.5 text-xs font-medium w-24 shrink-0">
                    <span className={`size-2 rounded-full ${u.active ? 'bg-[var(--mt-online)]' : 'bg-neutral-400'}`} />
                    {u.active ? 'Active' : 'Suspended'}
                  </span>
                  <div className="flex items-center gap-2 shrink-0">
                    <Link href={`/view_profile/${u.username}`}>
                      <Button variant="ghost" className="mt-btn-lift">View</Button>
                    </Link>
                    <button
                      type="button"
                      title={u.active ? 'Suspend' : 'Reactivate'}
                      className="mt-icon-btn flex items-center justify-center size-9 rounded-full border border-[var(--mt-border)] disabled:opacity-40 disabled:cursor-not-allowed"
                      disabled={u.role === 'admin'}
                      onClick={() => toggleActive(u._id, u.active)}
                    >
                      {u.active ? <Ban size={16} /> : <RotateCcw size={16} />}
                    </button>
                  </div>
                </div>
              ))}
            </Card>
          )}

          {users.pages > 1 && (
            <div className="flex items-center justify-between text-sm mt-4">
              <Button variant="ghost" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>Previous</Button>
              <span className="text-neutral-500">Page {users.page} of {users.pages} · {users.total} members</span>
              <Button variant="ghost" disabled={page >= users.pages} onClick={() => setPage((p) => p + 1)}>Next</Button>
            </div>
          )}
        </div>
      </DashboardLayout>
  );
}
