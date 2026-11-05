import { createRoot } from "react-dom/client";
import "@fontsource-variable/archivo";
import "./styles.css";
import { App } from "./App";

void navigator.storage?.persist?.();
createRoot(document.getElementById("root")!).render(<App />);
