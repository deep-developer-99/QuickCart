import AppRoutes from "./routes/AppRoutes";
import useAuth from "./hooks/useAuth";

function App() {
  useAuth();

  return <AppRoutes />;
}

export default App;
