import { Navigate, Route, Routes } from "react-router-dom";
import Layout from "./components/Layout";
import Overview from "./pages/Overview";
import Sites from "./pages/Sites";
import Workers from "./pages/Workers";
import Certificates from "./pages/Certificates";
import Reports from "./pages/Reports";
import TrainHome from "./pages/train/TrainHome";
import TrainModule from "./pages/train/TrainModule";
import TrainAssess from "./pages/train/TrainAssess";
import TrainCert from "./pages/train/TrainCert";

export default function App() {
  return (
    <Routes>
      <Route element={<Layout />}>
        <Route path="/" element={<Overview />} />
        <Route path="/sites" element={<Sites />} />
        <Route path="/workers" element={<Workers />} />
        <Route path="/certificates" element={<Certificates />} />
        <Route path="/reports" element={<Reports />} />
        <Route path="/train" element={<TrainHome />} />
        <Route path="/train/module/:id" element={<TrainModule />} />
        <Route path="/train/assess/:id" element={<TrainAssess />} />
        <Route path="/train/cert/:id/:score" element={<TrainCert />} />
      </Route>
      <Route path="*" element={<Navigate to="/" />} />
    </Routes>
  );
}