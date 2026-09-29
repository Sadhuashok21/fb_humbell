import { useCallback, useEffect, useState } from "react";
import { Link, Outlet, useLocation } from "react-router";
import { AuthUser, SiteLaunch, getAdminSiteLaunch, getCurrentUser, getSiteLaunchStatus, launchWebsite, updateAdminSiteLaunch } from "./api";

export function LaunchGate() {
  const location = useLocation();
  const [launch, setLaunch] = useState<SiteLaunch | null>(null);
  const refresh = useCallback(() => { getSiteLaunchStatus().then(setLaunch).catch(() => setLaunch({ is_active: false, launched_at: null })); }, []);
  useEffect(() => {
    refresh();
    const timer = window.setInterval(refresh, 10000);
    window.addEventListener("humbell-launch-state-change", refresh);
    return () => { window.clearInterval(timer); window.removeEventListener("humbell-launch-state-change", refresh); };
  }, [refresh]);

  const allowedPath = location.pathname === "/signin" || location.pathname === "/create-account" || location.pathname.startsWith("/admin") || location.pathname === "/launch";
  if (!launch && !allowedPath) return <main className="launch-screen launch-checking"><div className="launch-check-message">HUMBELL <span>·</span> PREPARING SOMETHING SPECIAL</div></main>;
  if (!launch || !launch.is_active || allowedPath) return <Outlet />;
  return <ComingSoon />;
}

function ComingSoon() {
  const [user, setUser] = useState<AuthUser | null>(null);
  useEffect(() => { if (localStorage.getItem("humbell_token")) getCurrentUser().then(setUser).catch(() => setUser(null)); }, []);
  return <main className="launch-screen"><div className="launch-grain" /><div className="launch-orbit orbit-one" /><div className="launch-orbit orbit-two" /><div className="launch-content"><Link className="launch-brand" to="/"><span>H</span> HUMBELL</Link><p className="launch-eyebrow">A NEW CHAPTER IN STYLE</p><h1>Something<br /><i>beautiful</i> is coming.</h1><p className="launch-copy">We’re putting the finishing touches on a new way to wear your story. Our store will be live soon.</p><div className="launch-countdown"><span /><span /><span /></div>{user?.is_superuser || user?.can_launch_site ? <Link className="launch-cta" to="/launch">Open launch controls <b>↗</b></Link> : <Link className="launch-login" to="/signin">Team sign in</Link>}<small className="launch-footnote">MADE TO BE REMEMBERED · HUMBELL</small></div></main>;
}

export function LaunchControlPage() {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [launch, setLaunch] = useState<SiteLaunch | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const [countdown, setCountdown] = useState(10);
  useEffect(() => {
    if (!localStorage.getItem("humbell_token")) { setError("Sign in with your assigned launch account to continue."); return; }
    getCurrentUser().then(setUser).catch((requestError: Error) => setError(requestError.message));
    getSiteLaunchStatus().then(setLaunch).catch((requestError: Error) => setError(requestError.message));
  }, []);
  useEffect(() => {
    if (!done) return;
    if (countdown <= 0) { window.location.href = "/"; return; }
    const timer = window.setTimeout(() => setCountdown((seconds) => seconds - 1), 1000);
    return () => window.clearTimeout(timer);
  }, [done, countdown]);
  const launchNow = async () => {
    setBusy(true); setError("");
    try { await launchWebsite(); setDone(true); }
    catch (requestError) { setError((requestError as Error).message); setBusy(false); }
  };
  if (!user && !error) return <main className="launch-control"><p>Checking launch access…</p></main>;
  if (!user || (!user.is_superuser && !user.can_launch_site)) return <main className="launch-control"><div className="launch-control-card"><span className="launch-lock">H</span><p>RESTRICTED ACCESS</p><h1>Launch access required</h1><span>Only the superuser and an assigned launch operator can open the website.</span>{error && <p role="alert">{error}</p>}<Link className="launch-cta" to="/signin">Sign in to continue</Link><Link className="launch-login" to="/">Back to coming soon</Link></div></main>;
  return <main className={`launch-control ${done ? "launch-complete" : ""}`}><div className="launch-control-card"><span className="launch-lock">H</span><p>{user.is_superuser ? "SUPERUSER LAUNCH CONTROL" : "AUTHORIZED LAUNCH OPERATOR"}</p><h1>{done ? "You’re live." : launch?.is_active ? "The moment is yours." : "Your store is already live."}</h1><span>{done ? "Humbell is now open to everyone. Taking you to the live store…" : launch?.is_active ? "One tap opens the Humbell store to the world." : "The website is public. You can return to the store any time."}</span>{done && <div className="launch-timeline" role="status" aria-live="polite"><div><span>THE STORE OPENS IN</span><b>{countdown}s</b></div><div className="launch-timeline-track"><span style={{ transform: `scaleX(${(10 - countdown) / 10})` }} /></div><small>EVERYTHING IS IN PLACE. GET READY.</small></div>}{error && <p role="alert">{error}</p>}{launch?.is_active && !done && <button className="launch-cta" disabled={busy} onClick={launchNow}>{busy ? "Opening the doors…" : "Launch the website"}<b>↗</b></button>}{!launch?.is_active && !done && <Link className="launch-cta" to="/">View the live website <b>↗</b></Link>}<Link className="launch-login" to={user.is_superuser ? "/admin/site-launch" : "/"}>{user.is_superuser ? "Superuser settings" : "Return"}</Link></div></main>;
}

export function AdminSiteLaunch() {
  const [launch, setLaunch] = useState<SiteLaunch | null>(null);
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const refresh = () => getAdminSiteLaunch().then(setLaunch).catch((requestError: Error) => setError(requestError.message));
  useEffect(() => { refresh(); }, []);
  const save = async (data: { is_active?: boolean; operator_email?: string; can_launch_site?: boolean }, success: string) => {
    setBusy(true); setError(""); setNotice("");
    try { const result = await updateAdminSiteLaunch(data); setLaunch(result); setNotice(success); window.dispatchEvent(new Event("humbell-launch-state-change")); }
    catch (requestError) { setError((requestError as Error).message); }
    finally { setBusy(false); }
  };
  const grant = async (event: React.FormEvent) => { event.preventDefault(); await save({ operator_email: email, can_launch_site: true }, `Launch access granted to ${email}.`); setEmail(""); };
  return <div className="admin-content launch-admin-content"><section className={`launch-admin-status ${launch?.is_active ? "is-active" : "is-live"}`}><div><p>PUBLIC WEBSITE STATUS</p><h2>{launch?.is_active ? "Coming soon screen is active" : "Website is live"}</h2><span>{launch?.is_active ? "Visitors see the launch page. Only assigned launch operators can open the store." : launch?.launched_at ? `Launched ${new Date(launch.launched_at).toLocaleString()}` : "Visitors can browse the store."}</span></div><button disabled={busy || !launch} onClick={() => save({ is_active: !launch?.is_active }, launch?.is_active ? "Coming soon screen activated." : "Coming soon screen turned off.")}>{launch?.is_active ? "Turn launch mode off" : "Turn launch mode on"}</button></section>{error && <p className="launch-admin-message error" role="alert">{error}</p>}{notice && <p className="launch-admin-message" role="status">{notice}</p>}<section className="launch-operator-card"><div><p>LAUNCH OPERATORS</p><h2>Give someone launch-only access</h2><span>Operators can open the store from the coming soon screen. They cannot access the admin panel or manage store data.</span></div><form onSubmit={grant}><label htmlFor="launch-operator-email">Existing account email</label><div><input id="launch-operator-email" type="email" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="celebrity@example.com" required /><button disabled={busy}>{busy ? "Saving…" : "Grant access"}</button></div></form><ul>{launch?.operators?.map((operator) => <li key={operator.id}><span><b>{operator.first_name || "Launch operator"}</b><small>{operator.email}</small></span><button disabled={busy} onClick={() => save({ operator_email: operator.email, can_launch_site: false }, `Launch access removed from ${operator.email}.`)}>Revoke access</button></li>)}</ul></section><p className="launch-admin-note">The operator must have a Humbell account first. Ask them to register, then grant access using their account email.</p></div>;
}
