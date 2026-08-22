import { Route, Routes } from "react-router-dom";
import { SiteLayout } from "./components/SiteLayout";
import { DistilledPaperPage } from "./pages/DistilledPaperPage";
import { LandingPage } from "./pages/LandingPage";
import { LearnPage } from "./pages/LearnPage";
import { KnowledgePage } from "./pages/KnowledgePage";
import { MaterialsPage } from "./pages/MaterialsPage";
import { NotFoundPage } from "./pages/NotFoundPage";
import { PaperPage } from "./pages/PaperPage";
import { PapersPage } from "./pages/PapersPage";
import { TheoremPage } from "./pages/TheoremPage";
import { UnsolvedPage } from "./pages/UnsolvedPage";

export default function App() {
  return (
    <Routes>
      <Route element={<SiteLayout />}>
        <Route index element={<LandingPage />} />
        <Route path="materials" element={<MaterialsPage />} />
        <Route path="knowledge" element={<KnowledgePage />} />
        <Route path="papers" element={<PapersPage />} />
        <Route path="papers/:paperId" element={<PaperPage />} />
        <Route path="papers/:paperId/distilled" element={<DistilledPaperPage />} />
        <Route path="theorems/:globalId" element={<TheoremPage />} />
        <Route path="unsolved" element={<UnsolvedPage />} />
        <Route path="learn" element={<LearnPage />} />
        <Route path="*" element={<NotFoundPage />} />
      </Route>
    </Routes>
  );
}
