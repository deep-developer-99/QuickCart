import { CartProvider } from "./context/CartProvider";
import useAuth from "./hooks/useAuth";
import AppRoutes from "./routes/AppRoutes";

function App() {
  useAuth();

  return (
    <CartProvider>
      <AppRoutes />
    </CartProvider>
  );
}

export default App;
