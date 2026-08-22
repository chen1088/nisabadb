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
            <small>The distilled, verified graph of mathematics.</small>
          </span>
        </Link>
        <nav aria-label="Primary navigation">
          <NavLink to="/papers">Papers</NavLink>
          <NavLink to="/knowledge">Knowledge</NavLink>
          <NavLink to="/unsolved">Unsolved</NavLink>
          <NavLink to="/learn">Learn</NavLink>
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
            <small>Mathematical statements, proofs, and formal evidence in one graph.</small>
          </span>
        </div>
        <p>
          Source papers remain immutable. Distillations preserve attribution, provenance,
          and honest verification boundaries.
        </p>
      </footer>
    </div>
  );
}
