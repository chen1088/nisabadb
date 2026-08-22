import { lazy, Suspense, type ReactNode } from "react";
import { Navigate, Route, Routes } from "react-router-dom";
import { SiteLayout } from "./components/SiteLayout";
import { DistilledPaperPage } from "./pages/DistilledPaperPage";
import { LandingPage } from "./pages/LandingPage";
import { KnowledgePage } from "./pages/KnowledgePage";
import { NotFoundPage } from "./pages/NotFoundPage";
import { PaperPage } from "./pages/PaperPage";
import { PapersPage } from "./pages/PapersPage";
import { TheoremPage } from "./pages/TheoremPage";
import { TrainPage } from "./pages/TrainPage";
import { UnsolvedPage } from "./pages/UnsolvedPage";

const KnowledgeCompressionPage = lazy(() => import("./pages/KnowledgeCompressionPage").then((module) => ({
  default: module.KnowledgeCompressionPage,
})));
const KnowledgeCoveragePage = lazy(() => import("./pages/KnowledgeCoveragePage").then((module) => ({
  default: module.KnowledgeCoveragePage,
})));

function DeferredKnowledgePage({ children }: { children: ReactNode }) {
  return <Suspense fallback={<p className="deferred-page-loading page-shell">Opening the Knowledge audit…</p>}>{children}</Suspense>;
}

export default function App() {
  return (
    <Routes>
      <Route element={<SiteLayout />}>
        <Route index element={<LandingPage />} />
        <Route path="materials" element={<Navigate replace to="/knowledge" />} />
        <Route path="knowledge" element={<KnowledgePage />} />
        <Route path="knowledge/compression" element={<DeferredKnowledgePage><KnowledgeCompressionPage /></DeferredKnowledgePage>} />
        <Route path="knowledge/coverage" element={<DeferredKnowledgePage><KnowledgeCoveragePage /></DeferredKnowledgePage>} />
        <Route path="papers" element={<PapersPage />} />
        <Route path="papers/:paperId" element={<PaperPage />} />
        <Route path="papers/:paperId/distilled" element={<DistilledPaperPage />} />
        <Route path="theorems/:globalId" element={<TheoremPage />} />
        <Route path="unsolved" element={<UnsolvedPage />} />
        <Route path="train" element={<TrainPage />} />
        <Route path="learn" element={<Navigate replace to="/train" />} />
        <Route path="*" element={<NotFoundPage />} />
      </Route>
    </Routes>
  );
}
