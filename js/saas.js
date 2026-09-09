import { db, auth } from './firebase.js';
import { ref, get, set, update, push, query, orderByChild, equalTo } from 'https://www.gstatic.com/firebasejs/12.1.0/firebase-database.js';
import { onAuthStateChanged, createUserWithEmailAndPassword, updateProfile, signOut } from 'https://www.gstatic.com/firebasejs/12.1.0/firebase-auth.js';

export const $ = s => document.querySelector(s);
export const esc = v => String(v ?? '').replace(/[&<>'"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]));
export const uidKey = (p='id') => `${p}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2,7)}`;
export const fmtDate = v => v ? new Date(v+'T12:00:00').toLocaleDateString('es-EC',{day:'2-digit',month:'short',year:'numeric'}) : '';

export function guardPage({login='registro', onUser}={}){
  return onAuthStateChanged(auth,u=>{ if(!u){ location.href=login; return; } onUser?.(u); });
}
export function redirectIfAuth(url='cuenta'){
  return onAuthStateChanged(auth,u=>{ if(u) location.href=url; });
}
export async function registerUser({name,email,password,phone=''}={}){
  const cred=await createUserWithEmailAndPassword(auth,email,password);
  await updateProfile(cred.user,{displayName:name});
  await set(ref(db,`usuarios/${cred.user.uid}`),{name,email,phone,country:'Ecuador',createdAt:Date.now(),role:'organizer'});
  return cred.user;
}
export async function getUserProfile(uid){const s=await get(ref(db,`usuarios/${uid}`));return s.val()||{};}
export async function saveTournament(tid,data){await set(ref(db,`tournaments/${tid}`),data);}
export async function getOwnedTournaments(uid){
  const s=await get(query(ref(db,'tournaments'),orderByChild('ownerUid'),equalTo(uid)));
  return s.val()||{};
}
export async function logout(){await signOut(auth);location.href='inicio';}
