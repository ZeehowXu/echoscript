import {
  BrowserRouter,
  Navigate,
  Route,
  Routes,
  useParams,
} from "react-router-dom";
import { DictationPage } from "./pages/DictationPage";
import { HomePage } from "./pages/HomePage";
import { LessonDetailPage } from "./pages/LessonDetailPage";
import { NewLessonPage } from "./pages/NewLessonPage";
import { WrongBookPage } from "./pages/WrongBookPage";
import { AddVocabularyPage } from "./pages/AddVocabularyPage";
import { VocabularyHomePage } from "./pages/VocabularyHomePage";
import { VocabularyReviewPage } from "./pages/VocabularyReviewPage";

function DictationPageRoute() {
  const { sentenceId } = useParams();
  return <DictationPage key={sentenceId} />;
}

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<HomePage />} />
        <Route path="/lessons/new" element={<NewLessonPage />} />
        <Route path="/lessons/:lessonId" element={<LessonDetailPage />} />
        <Route
          path="/lessons/:lessonId/sentences/:sentenceId"
          element={<DictationPageRoute />}
        />
        <Route path="/wrong-book" element={<WrongBookPage />} />
        <Route path="/vocabulary" element={<VocabularyHomePage />} />
        <Route path="/vocabulary/new" element={<AddVocabularyPage />} />
        <Route path="/vocabulary/review" element={<VocabularyReviewPage />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}
