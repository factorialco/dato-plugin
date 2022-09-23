import React, { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import '../styles.css'

const container = document.getElementById("root");
const root = createRoot(container!);

export function render(component: React.ReactNode): void {
  root.render(<StrictMode>{component}</StrictMode>);
}
