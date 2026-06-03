import { Route, Routes } from "react-router-dom";

import IndexPage from "@/pages/index";
import EditorPage from "@/pages/editor";

function App() {
  return (
    <Routes>
      <Route element={<IndexPage />} path="/" />
      <Route element={<EditorPage />} path="/editor" />
    </Routes>
  );
}

export default App;
