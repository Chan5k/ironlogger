import { useCallback, useEffect, useState } from 'react';
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom';
import api from '../api/client.js';
import { useAuth } from '../context/AuthContext.jsx';
import { appPath } from '../constants/routes.js';

export default function PublicProfile() {
  const { slug } = useParams();
  const location = useLocation();
  const navigate = useNavigate();
  const { isAuthenticated } = useAuth();
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState('');
  const [data, setData] = useState(null);
  const [wall, setWall] = useState([]);
  const [social, setSocial] = useState(null);
  const [comment, setComment] = useState('');
  const [wallBusy, setWallBusy] = useState(false);
  const [followBusy, setFollowBusy] = useState(false);
  const [inviteNote, setInviteNote] = useState(null); // 'done' | 'already' | null

  useEffect(() => {
    setInviteNote(null);
  }, [slug]);

  useEffect(() => {
    const s = location.state;
    if (!s?.addFriendDone && !s?.addFriendAlready) return;
    setInviteNote(s.addFriendDone ? 'done' : 'already');
    navigate(location.pathname + location.search, { replace: true, state: {} });
  }, [location.pathname, location.search, location.state, navigate]);

  const loadAll = useCallback(async () => {
    const s = encodeURIComponent(slug || '');
    const [prof, wallRes] = await Promise.all([
      api.get(`/public/profile/${s}`),
      api.get(`/public/profile/${s}/wall?limit=50`),
    ]);
    setData(prof.data);
    setWall(wallRes.data.items || []);
    if (isAuthenticated) {
      try {
        const st = await api.get(`/social/profile/${s}/status`);
        setSocial(st.data);
      } catch {
        setSocial(null);
      }
    } else {
      setSocial(null);
    }
  }, [slug, isAuthenticated]);

  useEffect(() => {
    let alive = true;
    setLoading(true);
    setErr('');
    setData(null);
    (async () => {
      try {
        await loadAll();
      } catch (e) {
        if (!alive) return;
        setErr(e?.response?.status === 404 ? 'This profile is not public or does not exist.' : 'Could not load profile.');
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, [loadAll]);

  async function toggleFollow() {
    if (!slug || !social || social.isOwnProfile) return;
    setFollowBusy(true);
    try {
      if (social.isFollowing) {
        await api.delete(`/social/follow/${encodeURIComponent(slug)}`);
      } else {
        await api.post(`/social/follow/${encodeURIComponent(slug)}`);
      }
      const s = encodeURIComponent(slug);
      const st = await api.get(`/social/profile/${s}/status`);
      setSocial(st.data);
    } catch (e) {
      alert(e.response?.data?.error || 'Could not update follow');
    } finally {
      setFollowBusy(false);
    }
  }

  async function sendKudos() {
    if (!slug) return;
    setWallBusy(true);
    try {
      await api.post(`/social/wall/${encodeURIComponent(slug)}`, { kind: 'kudos' });
      const s = encodeURIComponent(slug);
      const st = await api.get(`/social/profile/${s}/status`);
      setSocial(st.data);
      const wallRes = await api.get(`/public/profile/${s}/wall?limit=50`);
      setWall(wallRes.data.items || []);
    } catch (e) {
      alert(e.response?.data?.error || 'Could not send kudos');
    } finally {
      setWallBusy(false);
    }
  }

  async function sendComment(e) {
    e.preventDefault();
    const t = comment.trim();
    if (!slug || !t) return;
    setWallBusy(true);
    try {
      await api.post(`/social/wall/${encodeURIComponent(slug)}`, { kind: 'comment', body: t });
      setComment('');
      const s = encodeURIComponent(slug);
      const wallRes = await api.get(`/public/profile/${s}/wall?limit=50`);
      setWall(wallRes.data.items || []);
    } catch (err) {
      alert(err.response?.data?.error || 'Could not post comment');
    } finally {
      setWallBusy(false);
    }
  }

  async function deleteWallEntry(entryId) {
    if (!slug || !confirm('Remove this entry?')) return;
    try {
      await api.delete(`/social/wall/${encodeURIComponent(slug)}/${entryId}`);
      const s = encodeURIComponent(slug);
      const wallRes = await api.get(`/public/profile/${s}/wall?limit=50`);
      setWall(wallRes.data.items || []);
    } catch (e) {
      alert(e.response?.data?.error || 'Could not delete');
    }
  }

  return (
    <div className="min-h-screen bg-surface px-4 py-10 text-white">
      <div className="mx-auto max-w-md space-y-6">
        <Link to="/" className="text-sm text-slate-400 hover:text-white">
          ← IronLog home
        </Link>

        {loading ? <p className="text-slate-400">Loading…</p> : null}
        {!loading && err ? (
          <div className="rounded-2xl border border-slate-800 bg-surface-card p-6">
            <p className="text-slate-300">{err}</p>
            <Link
              to={appPath()}
              className="mt-4 inline-block text-sm font-medium text-accent-muted hover:text-accent"
            >
              Open app
            </Link>
          </div>
        ) : null}

        {!loading && data ? (
          <>
            {inviteNote ? (
              <div
                className={`rounded-2xl border px-4 py-3 text-sm ${
                  inviteNote === 'done'
                    ? 'border-emerald-800/80 bg-emerald-950/35 text-emerald-100'
                    : 'border-slate-600/80 bg-slate-800/50 text-slate-200'
                }`}
                role="status"
              >
                {inviteNote === 'done'
                  ? "You're now following this athlete. They'll show up in your Following feed."
                  : "You're already following this athlete."}
              </div>
            ) : null}
            <div className="rounded-2xl border border-slate-800 bg-surface-card p-6">
              <h1 className="text-2xl font-bold text-white">{data.profile?.name || 'Athlete'}</h1>
              <p className="mt-1 text-sm text-slate-500">Public IronLog profile</p>
              {data.stats?.followerCount != null ? (
                <p className="mt-2 text-xs text-slate-500">{data.stats.followerCount} follower(s)</p>
              ) : null}

              {isAuthenticated && social && !social.isOwnProfile ? (
                <div className="mt-4 flex flex-wrap gap-2">
                  <button
                    type="button"
                    disabled={followBusy}
                    onClick={toggleFollow}
                    className="rounded-xl bg-accent px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
                  >
                    {social.isFollowing ? 'Unfollow' : 'Follow'}
                  </button>
                  <button
                    type="button"
                    disabled={wallBusy || social.hasGivenKudos}
                    onClick={sendKudos}
                    className="rounded-xl border border-slate-600 px-4 py-2 text-sm text-slate-200 disabled:opacity-50"
                  >
                    {social.hasGivenKudos ? 'Kudos sent' : 'Kudos'}
                  </button>
                </div>
              ) : null}

              {isAuthenticated && social?.isOwnProfile ? (
                <p className="mt-4 text-xs text-slate-500">This is your public profile.</p>
              ) : null}

              {!isAuthenticated ? (
                <p className="mt-4 text-sm text-slate-500">
                  <Link to="/login" className="text-accent-muted hover:text-accent">
                    Log in
                  </Link>{' '}
                  to follow or leave kudos and comments. Profile owners may remove wall posts.
                </p>
              ) : null}

              <dl className="mt-6 space-y-3 text-sm">
                <div className="flex justify-between gap-4 border-b border-slate-800/80 pb-3">
                  <dt className="text-slate-500">Completed workouts</dt>
                  <dd className="font-mono text-slate-200">{data.stats?.totalWorkouts ?? '—'}</dd>
                </div>
                <div className="flex justify-between gap-4 border-b border-slate-800/80 pb-3">
                  <dt className="text-slate-500">Last 30 days</dt>
                  <dd className="font-mono text-slate-200">{data.stats?.workoutsLast30Days ?? '—'}</dd>
                </div>
                <div className="flex justify-between gap-4">
                  <dt className="text-slate-500">Est. total volume ({data.profile?.weightUnit || 'kg'}×reps)</dt>
                  <dd className="font-mono text-slate-200">
                    {data.stats?.estimatedTotalVolume != null ? data.stats.estimatedTotalVolume : '—'}
                  </dd>
                </div>
              </dl>
              <p className="mt-6 text-xs text-slate-600">
                Email and detailed logs are never shown here. Stats reflect completed sessions only
                (warm-up sets excluded from volume).
              </p>
            </div>

            <div className="rounded-2xl border border-slate-800 bg-surface-card p-6">
              <h2 className="text-lg font-semibold text-white">Wall</h2>
              <p className="mb-4 text-xs text-slate-500">
                Kudos and short comments. Be respectful — owners can delete posts. Max 20 comments per day per
                profile.
              </p>

              {isAuthenticated && social && !social.isOwnProfile ? (
                <form onSubmit={sendComment} className="mb-4 space-y-2">
                  <textarea
                    value={comment}
                    onChange={(e) => setComment(e.target.value)}
                    rows={2}
                    maxLength={500}
                    placeholder="Leave a comment…"
                    className="w-full rounded-xl border border-slate-700 bg-surface px-3 py-2 text-sm text-white placeholder:text-slate-500"
                  />
                  <button
                    type="submit"
                    disabled={wallBusy || !comment.trim()}
                    className="rounded-lg bg-slate-700 px-3 py-1.5 text-xs font-medium text-white disabled:opacity-50"
                  >
                    Post comment
                  </button>
                </form>
              ) : null}

              <ul className="space-y-3">
                {wall.length === 0 ? (
                  <li className="text-sm text-slate-500">No posts yet.</li>
                ) : (
                  wall.map((w) => (
                    <li
                      key={w.id}
                      className="rounded-lg border border-slate-800 bg-surface-elevated/50 px-3 py-2 text-sm"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <span className="font-medium text-slate-200">{w.authorName}</span>
                          <span className="ml-2 text-xs text-slate-500">
                            {w.kind === 'kudos' ? 'kudos' : ''}{' '}
                            {new Date(w.createdAt).toLocaleString(undefined, {
                              dateStyle: 'short',
                              timeStyle: 'short',
                            })}
                          </span>
                          {w.kind === 'comment' && w.body ? (
                            <p className="mt-1 text-slate-300">{w.body}</p>
                          ) : null}
                        </div>
                        {isAuthenticated && w.canDelete ? (
                          <button
                            type="button"
                            onClick={() => deleteWallEntry(w.id)}
                            className="shrink-0 text-xs text-red-400 hover:text-red-300"
                          >
                            Remove
                          </button>
                        ) : null}
                      </div>
                    </li>
                  ))
                )}
              </ul>
            </div>
          </>
        ) : null}
      </div>
    </div>
  );
}
