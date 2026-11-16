import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import Mini from "./Mini";
import "./index.css";

// La même page sert la fenêtre principale et le mini-lecteur (« #mini »).
const mini = window.location.hash === "#mini";

ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
  <React.StrictMode>{mini ? <Mini /> : <App />}</React.StrictMode>,
);
