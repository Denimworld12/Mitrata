import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/router';
import { useSelector } from 'react-redux';
import { clientServer } from '@/config';
import DashboardLayout from '@/layout/DashboardLayout';
import Card from '@/Components/ui/Card';
import Button from '@/Components/ui/Button';
import Skeleton from '@/Components/ui/Skeleton';
import EmptyState from '@/Components/ui/EmptyState';
import GrowthChart from '@/Components/ui/GrowthChart';

const TABS = ['Overview', 'Users', 'Content', 'People', 'Reports'];

export default function AdminPortal() {
  const router = useRouter();
  const authState = useSelector((state) => state.auth);
  const [tab, setTab] = useState('Overview');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const [overview, setOverview] = useState(null);
  const [users, setUsers] = useState({ users: [], total: 0, page: 1, pages: 1 });
  const [userPage, setUserPage] = useState(1);
  const [userQueryInput, setUserQueryInput] = useState('');
  const [userQuery, setUserQuery] = useState('');

  useEffect(() => {
    const t = setTimeout(() => setUserQuery(userQueryInput), 300);
    return () => clearTimeout(t);
  }, [userQueryInput]);
  const [posts, setPosts] = useState([]);
  const [people, setPeople] = useState([]);
  const [reports, setReports] = useState([]);

  const role = authState.user?.userId?.role;

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
      if (tab === 'Overview') {
        const { data } = await clientServer.get('/admin/analytics/overview');
        setOverview(data);
      } else if (tab === 'Users') {
        const { data } = await clientServer.get('/admin/users', { params: { page: userPage, q: userQuery || undefined } });
        setUsers(data);
      } else if (tab === 'Content') {
        const { data } = await clientServer.get('/admin/trending/posts', { params: { days: 30 } });
        setPosts(data.posts);
      } else if (tab === 'People') {
        const { data } = await clientServer.get('/admin/trending/people', { params: { days: 30 } });
        setPeople(data.people);
      } else if (tab === 'Reports') {
        const { data } = await clientServer.get('/admin/reports');
        setReports(data.reports);
      }
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to load admin data');
    } finally {
      setLoading(false);
    }
  }, [tab, userPage, userQuery]);

  useEffect(() => { load(); }, [load]);

  const toggleActive = async (userId, active) => {
    await clientServer.post('/admin/users/set_active', { userId, active: !active });
    load();
  };

  const deletePost = async (postId) => {
    if (!window.confirm('Remove this post? This cannot be undone.')) return;
    await clientServer.post('/admin/posts/delete', { postId });
    load();
  };

  const resolveReport = async (reportId, status) => {
    await clientServer.post('/admin/reports/resolve', { reportId, status });
    load();
  };

  return (
        <DashboardLayout fullWidth>
    <div className="max-w-5xl mx-auto p-6">
      <h1 className="text-2xl font-bold mb-1 bg-gradient-to-r from-brand-500 to-[color:var(--mt-live)] bg-clip-text text-transparent inline-block">Admin Portal</h1>
      <p className="text-sm text-neutral-500 mb-5">Users, content, people, and platform health at a glance.</p>

      <div className="flex gap-2 mb-5 flex-wrap">
        {TABS.map((t) => (
          <Button key={t} variant={tab === t ? 'primary' : 'ghost'} className="mt-btn-lift" onClick={() => setTab(t)}>
            {t}
          </Button>
        ))}
      </div>

      {error && <p className="text-danger text-sm mb-3">{error}</p>}

      {loading ? (
        <Skeleton />
      ) : (
        <>
          {tab === 'Overview' && overview && (
            <div className="flex flex-col gap-5">
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                <Stat label="Total users" value={overview.totalUsers} delay={0} />
                <Stat label="Online now" value={overview.onlineNow} delay={60} />
                <Stat label="Active users" value={overview.activeUsers} delay={120} />
                <Stat label="Suspended" value={overview.suspendedUsers} delay={180} />
                <Stat label="Total posts" value={overview.totalPosts} delay={240} />
                <Stat label="Connections made" value={overview.totalConnections} delay={300} />
                <Stat label="Pending reports" value={overview.pendingReports} delay={360} />
                <Stat label="Signups (window)" value={overview.signupTrend.reduce((s, d) => s + d.count, 0)} delay={420} />
              </div>
              <Card className="p-4 mt-enter">
                <p className="text-sm font-medium mb-3">Signups — last 30 days</p>
                <GrowthChart data={overview.signupTrend} />
              </Card>
            </div>
          )}

          {tab === 'Users' && (
            <div className="flex flex-col gap-3">
              <input
                value={userQueryInput}
                onChange={(e) => { setUserPage(1); setUserQueryInput(e.target.value); }}
                placeholder="Search by name, username, or email…"
                className="w-full rounded-md border border-neutral-200 px-3 py-2 text-sm"
              />
              {users.users.length === 0 ? <EmptyState title="No users found" /> : (
                <Card className="divide-y divide-neutral-200">
                  {users.users.map((u, idx) => (
                    <div key={u._id} className="flex items-center justify-between py-3 px-1 mt-enter-sm" style={{ animationDelay: `${idx * 60}ms` }}>
                      <div>
                        <p className="font-medium">{u.name} <span className="text-neutral-400 font-normal">@{u.username}</span></p>
                        <p className="text-xs text-neutral-500">{u.email} · {u.role}</p>
                      </div>
                      <Button
                        variant={u.active ? 'danger' : 'secondary'}
                        className="mt-btn-lift"
                        onClick={() => toggleActive(u._id, u.active)}
                        disabled={u.role === 'admin'}
                      >
                        {u.active ? 'Suspend' : 'Reactivate'}
                      </Button>
                    </div>
                  ))}
                </Card>
              )}
              {users.pages > 1 && (
                <div className="flex items-center justify-between text-sm">
                  <Button variant="ghost" disabled={userPage <= 1} onClick={() => setUserPage((p) => p - 1)}>Previous</Button>
                  <span className="text-neutral-500">Page {users.page} of {users.pages} · {users.total} users</span>
                  <Button variant="ghost" disabled={userPage >= users.pages} onClick={() => setUserPage((p) => p + 1)}>Next</Button>
                </div>
              )}
            </div>
          )}

          {tab === 'Content' && (
            posts.length === 0 ? <EmptyState title="Nothing trending" description="No posts have picked up likes or comments in the last 30 days." /> : (
              <Card className="divide-y divide-neutral-200">
                {posts.map((p, idx) => (
                  <div key={p._id} className="flex items-start justify-between gap-3 py-3 px-1 mt-enter-sm" style={{ animationDelay: `${idx * 60}ms` }}>
                    <div className="min-w-0">
                      <p className="text-sm">
                        <span className="font-medium">{p.author?.name}</span>{' '}
                        <span className="text-neutral-400">@{p.author?.username}</span>
                      </p>
                      <p className="text-sm text-neutral-700 truncate max-w-md">{p.body}</p>
                      <p className="text-xs text-neutral-500 mt-1">
                        {p.reactionCount} reaction{p.reactionCount === 1 ? '' : 's'} · {p.commentCount} comment{p.commentCount === 1 ? '' : 's'} · score {p.engagementScore}
                      </p>
                    </div>
                    <Button variant="danger" className="mt-btn-lift" onClick={() => deletePost(p._id)}>Remove</Button>
                  </div>
                ))}
              </Card>
            )
          )}

          {tab === 'People' && (
            people.length === 0 ? <EmptyState title="Nothing trending" description="No one has picked up engagement in the last 30 days." /> : (
              <Card className="divide-y divide-neutral-200">
                {people.map((p, i) => (
                  <div key={p._id} className="flex items-center gap-3 py-3 px-1 mt-enter-sm" style={{ animationDelay: `${i * 60}ms` }}>
                    <span className="text-sm text-neutral-400 w-5">{i + 1}</span>
                    <img src={p.user.profilePicture} alt="" className="size-9 rounded-full object-cover" />
                    <div className="flex-1">
                      <p className="font-medium">{p.user.name} <span className="text-neutral-400 font-normal">@{p.user.username}</span></p>
                      <p className="text-xs text-neutral-500">
                        {p.postCount} post{p.postCount === 1 ? '' : 's'} · {p.totalReactions} reactions · {p.totalComments} comments
                      </p>
                    </div>
                    <span className="text-sm font-semibold text-brand-600">{p.engagementScore}</span>
                  </div>
                ))}
              </Card>
            )
          )}

          {tab === 'Reports' && (
            reports.length === 0 ? <EmptyState title="No reports" description="Nothing flagged right now." /> : (
              <Card className="divide-y divide-neutral-200">
                {reports.map((r, idx) => (
                  <div key={r._id} className="py-3 px-1 mt-enter-sm" style={{ animationDelay: `${idx * 60}ms` }}>
                    <p className="text-sm">
                      <span className="font-medium">{r.reporterId?.name || 'Someone'}</span> reported a {r.targetType}: {r.reason}
                    </p>
                    <p className="text-xs text-neutral-500 mb-2">Status: {r.status}</p>
                    {r.status === 'pending' && (
                      <div className="flex gap-2">
                        <Button variant="secondary" className="mt-btn-lift" onClick={() => resolveReport(r._id, 'resolved')}>Resolve</Button>
                        <Button variant="ghost" className="mt-btn-lift" onClick={() => resolveReport(r._id, 'dismissed')}>Dismiss</Button>
                      </div>
                    )}
                  </div>
                ))}
              </Card>
            )
          )}
        </>
      )}
    </div>
    </DashboardLayout>
  );
}

function Stat({ label, value, delay = 0 }) {
  return (
    <Card className="p-4 mt-enter" style={{ animationDelay: `${delay}ms` }}>
      <p className="text-2xl font-semibold">{value}</p>
      <p className="text-xs text-neutral-500">{label}</p>
    </Card>
  );
}
