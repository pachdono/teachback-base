// Where the backend lives. Vite only exposes vars beginning with VITE_.
export const API = import.meta.env.VITE_API_URL || "http://localhost:3001";
