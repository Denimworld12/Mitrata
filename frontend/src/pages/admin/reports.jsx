import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/router';
import { useSelector } from 'react-redux';
import { clientServer } from '@/config';
import DashboardLayout from '@/layout/DashboardLayout';
import Card from '@/Components/ui/Card';
import Button from '@/Components/ui/Button';
import Skeleton from '@/Components/ui/Skeleton';
import EmptyState from '@/Components/ui/EmptyState';
import { Flag } from 'lucide-react';

const FILTERS = ['All', 'Pending', 'Resolved', 'Dismissed'];

export default function AdminReports() {
  const router = useRouter();
  const authState = useSelector((state) => state.auth);
  const role = authState.user?.userId?.role;

  const [filter, setFilter] = useState('All');
  const [reports, setReports] = useState([]);
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

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const status = filter === 'All' ? undefined : filter.toLowerCase();
      const { data } = await clientServer.get('/admin/reports', { params: { status } });
      setReports(data.reports);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to load reports');
    } finally {
      setLoading(false);
    }
  }, [filter]);

  useEffect(() => { load(); }, [load]);

  const resolveReport = async (reportId, status) => {
    await clientServer.post('/admin/reports/resolve', { reportId, status });
    load();
  };

  return (
          <DashboardLayout fullWidth>
        <div className="max-w-5xl mx-auto p-6">
          <h1 className="text-2xl font-bold mb-1 bg-gradient-to-r from-brand-500 to-[color:var(--mt-live)] bg-clip-text text-transparent inline-block">Reports</h1>
          <p className="text-sm text-neutral-500 mb-5">Review flagged content and people.</p>

          <div className="flex gap-2 mb-5 flex-wrap">
            {FILTERS.map((f) => (
              <Button key={f} variant={filter === f ? 'primary' : 'ghost'} className="mt-btn-lift" onClick={() => setFilter(f)}>
                {f}
              </Button>
            ))}
          </div>

          {error && <p className="text-danger text-sm mb-3">{error}</p>}

          {loading ? (
            <Skeleton />
          ) : reports.length === 0 ? (
            <EmptyState icon={Flag} title="No reports" description="Nothing flagged right now." />
          ) : (
            <Card className="divide-y divide-neutral-200">
              {reports.map((r, idx) => (
                <div key={r._id} className="py-3 px-4 mt-enter-sm" style={{ animationDelay: `${idx * 60}ms` }}>
                  <p className="text-sm">
                    <span className="font-medium">{r.reporterId?.name || 'Someone'}</span> reported a {r.targetType}: {r.reason}
                  </p>
                  <p className="text-xs text-neutral-500 mb-2 capitalize">Status: {r.status}</p>
                  {r.status === 'pending' && (
                    <div className="flex gap-2">
                      <Button variant="secondary" className="mt-btn-lift" onClick={() => resolveReport(r._id, 'resolved')}>Resolve</Button>
                      <Button variant="ghost" className="mt-btn-lift" onClick={() => resolveReport(r._id, 'dismissed')}>Dismiss</Button>
                    </div>
                  )}
                </div>
              ))}
            </Card>
          )}
        </div>
      </DashboardLayout>
  );
}
