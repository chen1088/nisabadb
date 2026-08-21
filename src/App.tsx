import { Route, Routes } from "react-router-dom";
import { SiteLayout } from "./components/SiteLayout";
import { DistilledPaperPage } from "./pages/DistilledPaperPage";
import { LandingPage } from "./pages/LandingPage";
import { NotFoundPage } from "./pages/NotFoundPage";
import { PaperPage } from "./pages/PaperPage";
import { PapersPage } from "./pages/PapersPage";
import { TheoremPage } from "./pages/TheoremPage";

export default function App() {
  return (
    <Routes>
      <Route element={<SiteLayout />}>
        <Route index element={<LandingPage />} />
        <Route path="papers" element={<PapersPage />} />
        <Route path="papers/:paperId" element={<PaperPage />} />
        <Route path="papers/:paperId/distilled" element={<DistilledPaperPage />} />
        <Route path="theorems/:globalId" element={<TheoremPage />} />
        <Route path="*" element={<NotFoundPage />} />
      </Route>
    </Routes>
  );
}
