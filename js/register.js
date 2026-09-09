import { $, registerUser, redirectIfAuth } from './saas.js';
redirectIfAuth();
$('#registerForm').addEventListener('submit',async e=>{e.preventDefault();const msg=$('#msg');msg.textContent='Creando cuenta…';try{const p1=$('#password').value,p2=$('#password2').value;if(p1!==p2)throw new Error('Las contraseñas no coinciden.');await registerUser({name:$('#name').value.trim(),email:$('#email').value.trim(),password:p1,phone:$('#phone').value.trim()});location.href='cuenta';}catch(err){msg.textContent=err?.message||'No se pudo crear la cuenta.';}});
