import { onAuthStateChanged, signOut } from 'https://www.gstatic.com/firebasejs/12.1.0/firebase-auth.js';
import { auth } from './firebase.js';
export function guardAdmin(onUser){ return onAuthStateChanged(auth,u=>{ if(!u){ location.href='login.html'; return; } onUser(u); }); }
export { auth, signOut };
