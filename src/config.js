// Where the backend lives.
// Deployed, the API sits on the same domain under /api, so an empty string is
// the right base. Locally the server runs on its own port.
// Vite only exposes variables that start with VITE_.
export const API =
  import.meta.env.VITE_API_URL ??
  (import.meta.env.PROD ? "" : "http://localhost:3001");
