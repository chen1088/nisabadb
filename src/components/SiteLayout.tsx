import { useEffect } from "react";
import { Link, NavLink, Outlet, useLocation } from "react-router-dom";

export function NisabaMark() {
  return (
    <span className="nisaba-mark" aria-hidden="true">
      <span />
      <span />
      <span />
    </span>
  );
}

function RouteEffects() {
  const { hash, pathname, search } = useLocation();
  const targetId = hash
    ? decodeURIComponent(hash.slice(1))
    : pathname.startsWith("/papers/") && new URLSearchParams(search).has("node")
      ? "explorer"
      : pathname === "/knowledge" && new URLSearchParams(search).has("node")
        ? "knowledge-node-title"
      : "";

  useEffect(() => {
    if (!targetId) return;
    const timer = window.setTimeout(() => {
      document.getElementById(targetId)?.scrollIntoView({ block: "start" });
    }, 0);
    return () => window.clearTimeout(timer);
  }, [pathname, targetId]);

  return null;
}

export function SiteLayout() {
  return (
    <div className="site-frame">
      <RouteEffects />
      <header className="global-header">
        <Link className="brand" to="/" aria-label="NisabaDB home">
          <NisabaMark />
          <span>
            <strong>NisabaDB</strong>
            <small>From first arithmetic to research proofs.</small>
          </span>
        </Link>
        <nav aria-label="Primary navigation">
          <NavLink to="/knowledge">Knowledge</NavLink>
          <NavLink to="/papers">Papers</NavLink>
          <NavLink to="/unsolved">Unsolved</NavLink>
          <NavLink to="/train">Train</NavLink>
        </nav>
      </header>
      <main id="main-content">
        <Outlet />
      </main>
      <footer className="global-footer">
        <div className="footer-brand">
          <NisabaMark />
          <span>
            <strong>NisabaDB</strong>
            <small>A shorter, inspectable route into mathematics.</small>
          </span>
        </div>
        <p>
          One unified mathematics text, connected to inspectable paper evidence. Every explanation
          is rewritten; every prerequisite remains open to compression.
        </p>
      </footer>
    </div>
  );
}
