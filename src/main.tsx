import React from "react";
import { createRoot } from "react-dom/client";
import { App } from "./App";
import { Portfolio } from "./Portfolio";
import "./styles.css";

const path = window.location.pathname.replace(/\/$/, "") || "/";
const Root = path === "/portfolio" ? Portfolio : App;

createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <Root />
  </React.StrictMode>
);
