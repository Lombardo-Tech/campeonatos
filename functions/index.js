const {onCall,onRequest,HttpsError}=require('firebase-functions/v2/https');
const {initializeApp}=require('firebase-admin/app');
const {getDatabase}=require('firebase-admin/database');
initializeApp();
const db=getDatabase();
const PRICE_CENTS=2000;
const PAYPHONE_URL='https://pay.payphonetodoesposible.com/api/Links';
async function cfg(){const snap=await db.ref('paymentConfig/payphone').get();const c=snap.val()||{};return {token:c.token||process.env.PAYPHONE_TOKEN,storeId:c.storeId||process.env.PAYPHONE_STORE_ID,enabled:c.enabled===true};}
function txid(){return ('T'+Date.now().toString(36)+Math.random().toString(36).slice(2)).slice(0,15);}
exports.createTournamentPayment=onCall(async request=>{
  if(!request.auth)throw new Error('Debes iniciar sesión.');
  const tid=String(request.data?.tournamentId||'');
  if(!tid)throw new Error('Falta tournamentId.');
  const snap=await db.ref(`tournaments/${tid}`).get();
  if(!snap.exists())throw new Error('Torneo no encontrado.');
  const t=snap.val();
  if(t.ownerUid!==request.auth.uid)throw new Error('No tienes permiso sobre este torneo.');
  if(t.paymentStatus==='paid')throw new Error('Este torneo ya está pagado.');
  const {token,storeId,enabled}=await cfg();
  if(!enabled)throw new Error('El pago con tarjeta está desactivado por el administrador.');
  if(!token||!storeId)throw new Error('Payphone aún no está configurado.');
  const clientTransactionId=txid();
  const body={amount:PRICE_CENTS,amountWithoutTax:PRICE_CENTS,amountWithTax:0,tax:0,service:0,tip:0,currency:'USD',storeId,reference:`Torneo ${String(t.name||tid).slice(0,70)}`,clientTransactionId,additionalData:tid,oneTime:true,expireIn:24,isAmountEditable:false};
  const r=await fetch(PAYPHONE_URL,{method:'POST',headers:{Authorization:`Bearer ${token}`,'Content-Type':'application/json'},body:JSON.stringify(body)});
  const data=await r.json().catch(()=>null);
  if(!r.ok)throw new Error(data?.message||'Payphone rechazó la solicitud.');
  const url=typeof data==='string'?data:(data?.url||data?.link||null);
  if(!url)throw new Error('Payphone no devolvió el enlace de pago.');
  await db.ref(`payments/${clientTransactionId}`).set({tournamentId:tid,uid:request.auth.uid,amount:20,currency:'USD',status:'pending',provider:'payphone',createdAt:Date.now(),clientTransactionId});
  await db.ref(`tournaments/${tid}`).update({paymentStatus:'pending',paymentTransactionId:clientTransactionId,paymentProvider:'payphone'});
  return {url,clientTransactionId};
});

// Payphone ofrece Notificación Externa para avisar al comercio cuando un pago fue aprobado.
// Actívala en Payphone Business y apunta a esta URL. La forma exacta del payload debe validarse
// contra el payload de tu cuenta antes de producción.
exports.payphoneNotification=onRequest(async(req,res)=>{
  if(req.method!=='POST')return res.status(405).send('Method Not Allowed');
  try{
    const p=req.body||{};
    const clientId=String(p.clientTransactionId||p.clientTransactionID||'');
    if(!clientId)return res.status(400).send('Missing clientTransactionId');
    const paymentRef=db.ref(`payments/${clientId}`);const payment=await paymentRef.get();
    if(!payment.exists())return res.status(404).send('Payment not found');
    const d=payment.val();
    await paymentRef.update({status:'paid',providerTransactionId:p.transactionId||p.id||null,approvedAt:Date.now(),providerPayload:p});
    await db.ref(`tournaments/${d.tournamentId}`).update({paymentStatus:'paid',status:'active',paidAt:Date.now(),paymentTransactionId:clientId});
    return res.status(200).json({ok:true});
  }catch(e){console.error(e);return res.status(500).send('Error');}
});


