import { CartProvider } from "./context/CartProvider";
import useAuth from "./hooks/useAuth";
import AppRoutes from "./routes/AppRoutes";
import { ThemeProvider } from "./theme/ThemeProvider";

function App() {
  useAuth();

  return (
    <ThemeProvider>
      <CartProvider>
        <AppRoutes />
      </CartProvider>
    </ThemeProvider>
  );
}

export default App;
