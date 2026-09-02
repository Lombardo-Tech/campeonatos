import { getAuth } from "https://www.gstatic.com/firebasejs/12.1.0/firebase-auth.js";
import { db } from "./firebase.js";
export const auth = getAuth();
export { db };
