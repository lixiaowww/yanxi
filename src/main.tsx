import React from "react";
import { createRoot } from "react-dom/client";
import { App } from "./App";
import { Portfolio } from "./Portfolio";
import { Reader } from "./Reader";
import "./styles.css";

const path = window.location.pathname.replace(/\/$/, "") || "/";
// "/" is the reading product (category → list → detail); "/compose" is the
// paste playground that used to live at "/". Anything else falls through to
// the reader too, since the server's SPA fallback serves index.html for any
// unmatched path.
const Root = path === "/portfolio" ? Portfolio : path === "/compose" ? App : Reader;

createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <Root />
  </React.StrictMode>
);
