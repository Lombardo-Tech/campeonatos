import { getFunctions, httpsCallable } from 'https://www.gstatic.com/firebasejs/12.1.0/firebase-functions.js';
import { app } from './firebase.js';
export async function startPayment(tournamentId){
  const fn=httpsCallable(getFunctions(app),'createTournamentPayment');
  const result=await fn({tournamentId});
  if(!result.data?.url)throw new Error('No se recibió el enlace de pago.');
  window.open(result.data.url,'_blank','noopener');
  return result.data;
}
