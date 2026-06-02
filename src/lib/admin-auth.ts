import { createMiddleware } from "@tanstack/react-start";
import { getRequest } from "@tanstack/react-start/server";

export const ADMIN_PASSWORD = "Zoe@123";
export const ADMIN_GATE_KEY = "cwl_admin_gate_v1";
const HEADER = "x-admin-pass";

// Client: attach the admin password from sessionStorage on every serverFn call
export const attachAdminPass = createMiddleware({ type: "function" }).client(
  async ({ next }) => {
    let pass = "";
    if (typeof window !== "undefined") {
      pass = sessionStorage.getItem(ADMIN_GATE_KEY) === "1" ? ADMIN_PASSWORD : "";
    }
    return next({
      headers: pass ? { [HEADER]: pass } : {},
    });
  },
);

// Server: validate the header
export const requireAdminPassword = createMiddleware({ type: "function" }).server(
  async ({ next }) => {
    const request = getRequest();
    const provided = request?.headers.get(HEADER);
    if (provided !== ADMIN_PASSWORD) {
      throw new Error("Unauthorized: admin password required");
    }
    return next();
  },
);
