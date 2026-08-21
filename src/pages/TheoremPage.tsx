import { Link, useNavigate, useParams, useSearchParams } from "react-router-dom";
import { ProofPanel } from "../components/GraphExplorer";
import {
  getRoute,
  graphPath,
  paperById,
  statementByGlobalId,
  theoremPath,
} from "../components/content";
import { NotFoundPage } from "./NotFoundPage";

export function TheoremPage() {
  const { globalId } = useParams();
  const [parameters, setParameters] = useSearchParams();
  const navigate = useNavigate();
  const statement = globalId ? statementByGlobalId.get(globalId) : undefined;
  const paper = statement ? paperById.get(statement.paperId) : undefined;
  if (!statement || !paper) return <NotFoundPage />;
  const activeRoute = getRoute(statement, parameters.get("route"));

  const selectReference = (id: string) => {
    const target = [...statementByGlobalId.values()].find((candidate) => candidate.id === id);
    if (!target) return;
    navigate(theoremPath(target));
  };

  return (
    <div className="theorem-page page-shell">
      <nav className="breadcrumbs" aria-label="Breadcrumb">
        <Link to="/papers">Papers</Link>
        <span aria-hidden="true">/</span>
        <Link to={`/papers/${paper.id}`}>{paper.title}</Link>
        <span aria-hidden="true">/</span>
        <span>{statement.localLabel}</span>
      </nav>
      <div className="canonical-banner">
        <div>
          <p className="eyebrow">Canonical statement record</p>
          <p>
            Stable ID <code>{statement.globalStatementId}</code>
          </p>
        </div>
        <Link className="button-link subtle-button" to={graphPath(paper, statement, { routeId: activeRoute?.id })}>
          Locate in graph
        </Link>
      </div>
      <ProofPanel
        paper={paper}
        statement={statement}
        activeRoute={activeRoute}
        headingLevel="h1"
        standalone
        onRouteChange={(routeId) => {
          const next = new URLSearchParams(parameters);
          next.set("route", routeId);
          setParameters(next);
        }}
        onSelectStatement={selectReference}
      />
    </div>
  );
}
