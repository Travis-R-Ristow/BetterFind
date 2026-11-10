"use strict";(()=>{var x=["bug","idea","praise"],v=[{id:"bug",title:"Report a bug",blurb:"Something is broken or not working",icon:"\u{1F41E}"},{id:"idea",title:"Share an idea",blurb:"Suggest a feature or improvement",icon:"\u{1F4A1}"},{id:"praise",title:"Give praise",blurb:"Tell us what you love",icon:"\u2764\uFE0F"}];function T(s){if(!s)return null;let e=s.split(",").map(i=>i.trim().toLowerCase()).filter(i=>x.includes(i)),t=[...new Set(e)];return t.length?t:null}var C=`
:host { all: initial; }
*, *::before, *::after { box-sizing: border-box; }

.backdrop {
  position: fixed;
  inset: 0;
  z-index: 2147483000;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 20px;
  background: var(--lt3-overlay, rgba(10, 8, 18, 0.72));
  opacity: 0;
  transition: opacity 180ms ease;
  font-family: var(--lt3-font, 'Inter', system-ui, -apple-system, sans-serif);
}
.backdrop.open { opacity: 1; }

.modal {
  position: relative;
  width: 100%;
  max-width: 420px;
  max-height: calc(100vh - 40px);
  overflow-y: auto;
  background: var(--lt3-bg, #15121f);
  color: var(--lt3-text, #f5f3ff);
  border: 1px solid var(--lt3-border, #3a3357);
  border-radius: var(--lt3-radius, 16px);
  box-shadow: 0 20px 60px rgba(0, 0, 0, 0.55);
  padding: 24px;
  transform: translateY(8px) scale(0.985);
  opacity: 0;
  transition: opacity 180ms ease, transform 200ms ease;
}
.backdrop.open .modal { opacity: 1; transform: translateY(0) scale(1); }

/* Branding footer \u2014 spans the full modal width and links to the LT3 home page. */
.lt3-footer {
  display: block;
  margin: 20px -24px -24px;
  padding: 11px 24px;
  border-top: 1px solid var(--lt3-border, #3a3357);
  background: var(--lt3-surface, #1e1a2b);
  color: var(--lt3-text-muted, #a79fc6);
  font-size: 12px;
  text-align: center;
  text-decoration: none;
  letter-spacing: 0.01em;
  transition: color 140ms ease, background 140ms ease;
}
.lt3-footer:hover {
  color: var(--lt3-text, #f5f3ff);
  background: var(--lt3-border, #3a3357);
}
.lt3-footer .lt3-footer-heart {
  color: #f87171;
}
.lt3-footer .lt3-footer-brand {
  font-weight: 600;
  color: var(--lt3-accent-bright, #c77dff);
}

.close {
  position: absolute;
  top: 12px;
  right: 12px;
  width: 28px;
  height: 28px;
  display: grid;
  place-items: center;
  background: transparent;
  border: 1px solid var(--lt3-border, #3a3357);
  border-radius: 8px;
  color: var(--lt3-text-muted, #a79fc6);
  font-size: 15px;
  line-height: 1;
  cursor: pointer;
  transition: color 120ms ease, border-color 120ms ease;
}
.close:hover { color: var(--lt3-text, #f5f3ff); border-color: var(--lt3-text-muted, #a79fc6); }

.head { margin: 0 32px 16px 0; }
.head-icon {
  width: 40px;
  height: 40px;
  margin-bottom: 10px;
  display: grid;
  place-items: center;
  border-radius: 12px;
  background: var(--lt3-surface, #1e1a2b);
  border: 1px solid var(--lt3-border, #3a3357);
  font-size: 20px;
  line-height: 1;
}
.title { margin: 0; font-size: 20px; font-weight: 700; letter-spacing: -0.01em; }
.subtitle { margin: 6px 0 0; font-size: 14px; color: var(--lt3-text-muted, #a79fc6); }

.choices { display: flex; flex-direction: column; gap: 10px; }
.choice {
  display: flex;
  align-items: center;
  gap: 12px;
  width: 100%;
  text-align: left;
  padding: 14px;
  background: var(--lt3-surface, #1e1a2b);
  border: 1px solid var(--lt3-border, #3a3357);
  border-radius: 12px;
  color: inherit;
  font: inherit;
  cursor: pointer;
  transition: border-color 140ms ease, transform 140ms ease, box-shadow 140ms ease;
}
.choice:hover {
  border-color: var(--lt3-accent, #a855f7);
  transform: translateY(-1px);
  box-shadow: 0 6px 18px rgba(168, 85, 247, 0.18);
}
.choice-icon { font-size: 20px; line-height: 1; }
.choice-text { display: flex; flex-direction: column; gap: 2px; }
.choice-title { font-size: 15px; font-weight: 600; }
.choice-blurb { font-size: 12.5px; color: var(--lt3-text-muted, #a79fc6); }

.field { display: flex; flex-direction: column; gap: 6px; margin-bottom: 14px; }
.field label { font-size: 12px; color: var(--lt3-text-muted, #a79fc6); }
.field textarea, .field input {
  width: 100%;
  background: var(--lt3-surface, #1e1a2b);
  border: 1px solid var(--lt3-border, #3a3357);
  border-radius: 10px;
  padding: 10px 12px;
  color: inherit;
  font: inherit;
  font-size: 14px;
  resize: vertical;
  transition: border-color 140ms ease;
}
.field textarea { min-height: 96px; }
.field textarea:focus, .field input:focus {
  outline: none;
  border-color: var(--lt3-accent, #a855f7);
}
.field .err { font-size: 12px; color: var(--lt3-danger, #f87171); }

.actions { display: flex; align-items: center; gap: 10px; margin-top: 4px; }
.spacer { flex: 1; }

.btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  padding: 10px 18px;
  border-radius: 999px;
  border: 1px solid transparent;
  font: inherit;
  font-size: 14px;
  font-weight: 600;
  cursor: pointer;
  transition: transform 120ms ease, box-shadow 200ms ease, opacity 120ms ease;
}
.btn:disabled { opacity: 0.55; cursor: not-allowed; }
.btn.loading { opacity: 1; }
.btn-spinner {
  width: 16px;
  height: 16px;
  border: 2px solid currentColor;
  border-top-color: transparent;
  border-radius: 50%;
  animation: lt3-spin 0.6s linear infinite;
}
@keyframes lt3-spin { to { transform: rotate(360deg); } }
.btn-primary {
  background: var(--lt3-accent, linear-gradient(120deg, #a855f7, #22d3ee));
  color: var(--lt3-accent-contrast, #0b0712);
  box-shadow: 0 0 0 1px rgba(168, 85, 247, 0.25);
}
.btn-primary:not(:disabled):hover { transform: translateY(-1px); box-shadow: 0 8px 22px rgba(168, 85, 247, 0.35); }
.btn-ghost {
  background: transparent;
  color: var(--lt3-text-muted, #a79fc6);
  border-color: var(--lt3-border, #3a3357);
}
.btn-ghost:not(:disabled):hover { color: var(--lt3-text, #f5f3ff); }

.done {
  text-align: center;
  min-height: 240px;
  padding: 24px 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  animation: lt3-done-in 260ms ease both;
}
.done-icon {
  position: relative;
  width: 56px; height: 56px; margin: 0 auto 14px;
  display: grid; place-items: center;
  border-radius: 50%;
  background: var(--lt3-accent, linear-gradient(120deg, #a855f7, #22d3ee));
  color: var(--lt3-accent-contrast, #0b0712);
  font-size: 26px;
  animation: lt3-pop 420ms cubic-bezier(0.34, 1.56, 0.64, 1) both;
}
/* Expanding ring that pulses out once when the confirmation appears. */
.done-icon::after {
  content: '';
  position: absolute;
  inset: 0;
  border-radius: 50%;
  border: 2px solid var(--lt3-accent, #a855f7);
  animation: lt3-ring 700ms ease-out both;
}
.done-check { display: block; animation: lt3-check 420ms 120ms ease both; }
.done-type {
  position: absolute;
  right: -4px; bottom: -4px;
  width: 24px; height: 24px;
  display: grid; place-items: center;
  border-radius: 50%;
  background: var(--lt3-bg, #15121f);
  border: 1px solid var(--lt3-border, #3a3357);
  font-size: 13px;
  animation: lt3-pop 420ms 160ms cubic-bezier(0.34, 1.56, 0.64, 1) both;
}
.done-title { font-size: 17px; font-weight: 700; animation: lt3-rise 300ms 100ms ease both; }
.done-sub { font-size: 13.5px; color: var(--lt3-text-muted, #a79fc6); margin-top: 4px; animation: lt3-rise 300ms 160ms ease both; }

@keyframes lt3-done-in { from { opacity: 0; } to { opacity: 1; } }
@keyframes lt3-pop {
  0% { transform: scale(0.3); opacity: 0; }
  60% { transform: scale(1.12); opacity: 1; }
  100% { transform: scale(1); }
}
@keyframes lt3-check {
  0% { transform: scale(0); opacity: 0; }
  100% { transform: scale(1); opacity: 1; }
}
@keyframes lt3-ring {
  0% { transform: scale(0.8); opacity: 0.6; }
  100% { transform: scale(1.6); opacity: 0; }
}
@keyframes lt3-rise {
  from { transform: translateY(6px); opacity: 0; }
  to { transform: translateY(0); opacity: 1; }
}

.lt3-launch {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  padding: 10px 18px;
  border-radius: 999px;
  border: 1px solid transparent;
  background: var(--lt3-accent, linear-gradient(120deg, #a855f7, #22d3ee));
  color: var(--lt3-accent-contrast, #0b0712);
  font-family: var(--lt3-font, 'Inter', system-ui, -apple-system, sans-serif);
  font-size: 14px;
  font-weight: 600;
  cursor: pointer;
  box-shadow: 0 0 0 1px rgba(168, 85, 247, 0.25);
  transition: transform 120ms ease, box-shadow 200ms ease;
}
.lt3-launch:hover { transform: translateY(-1px); box-shadow: 0 8px 22px rgba(168, 85, 247, 0.35); }

@media (prefers-reduced-motion: reduce) {
  .backdrop, .modal, .btn, .choice, .lt3-launch { transition: none; }
  .done, .done-icon, .done-icon::after, .done-check, .done-type, .done-title, .done-sub {
    animation: none;
  }
  .btn-spinner { animation-duration: 1.2s; }
}
`;function M(){let s=document.currentScript??document.querySelector('script[data-key][src*="lt3"]');if(!s)return null;let e=s.getAttribute("data-key")?.trim()??"";if(!e)return console.error("[LT3] Missing data-key on the widget script tag."),null;let t=s.getAttribute("data-api")?.trim()??"";if(!t)try{t=new URL(s.src).origin}catch{t=""}let i=T(s.getAttribute("data-types"))??x;return{publicKey:e,apiBase:t.replace(/\/$/,""),defaultTypes:i}}function a(s,e,t){let i=document.createElement(s);return e&&(i.className=e),t!==void 0&&(i.textContent=t),i}var k=["#a855f7","#c77dff","#22d3ee","#67e8f9","#f87171","#fbbf24"],u=null;function F(){return u&&document.body.contains(u)||(u=document.createElement("div"),Object.assign(u.style,{position:"fixed",inset:"0",pointerEvents:"none",overflow:"hidden",zIndex:"2147483647"}),document.body.appendChild(u)),u}function S(s,e,t=28){if(window.matchMedia("(prefers-reduced-motion: reduce)").matches)return;let i=F();for(let n=0;n<t;n++){let o=document.createElement("div"),r=6+Math.random()*6;Object.assign(o.style,{position:"absolute",left:`${s}px`,top:`${e}px`,width:`${r}px`,height:`${r}px`,background:k[Math.floor(Math.random()*k.length)],borderRadius:"1px",willChange:"transform, opacity"}),i.appendChild(o);let f=Math.random()*Math.PI*2,l=60+Math.random()*130,c=Math.cos(f)*l,h=Math.sin(f)*l,b=140+Math.random()*160,d=Math.random()*720-360,m=700+Math.random()*600,p=o.animate([{transform:"translate(-50%, -50%) translate(0, 0) rotate(0deg)",opacity:1,offset:0},{transform:`translate(-50%, -50%) translate(${c*.7}px, ${h*.7}px) rotate(${d*.5}deg)`,opacity:1,offset:.4},{transform:`translate(-50%, -50%) translate(${c}px, ${h+b}px) rotate(${d}deg)`,opacity:0,offset:1}],{duration:m,easing:"cubic-bezier(0.2, 0.7, 0.3, 1)"});p.onfinish=()=>o.remove()}}var y=class{constructor(e){this.activeTypes=x;this.dirty=!1;this.lastFocus=null;this.close=()=>{this.backdrop.classList.remove("open"),document.removeEventListener("keydown",this.onKey),window.setTimeout(()=>{this.backdrop.style.display="none",this.body.replaceChildren()},180),this.lastFocus instanceof HTMLElement&&this.lastFocus.focus()};this.onKey=e=>{e.key==="Escape"&&this.close()};this.config=e,this.host=a("div"),this.host.setAttribute("data-lt3-root",""),document.body.appendChild(this.host),this.root=this.host.attachShadow({mode:"open"});let t=a("style");t.textContent=C,this.root.appendChild(t),this.buildShell()}buildShell(){this.backdrop=a("div","backdrop"),this.backdrop.setAttribute("part","backdrop"),this.backdrop.addEventListener("mousedown",i=>{i.target===this.backdrop&&!this.dirty&&this.close()}),this.modal=a("div","modal"),this.modal.setAttribute("part","modal"),this.modal.setAttribute("role","dialog"),this.modal.setAttribute("aria-modal","true");let e=a("button","close","\u2715");e.setAttribute("part","close"),e.setAttribute("aria-label","Close"),e.addEventListener("click",()=>this.close()),this.body=a("div");let t=document.createElement("a");t.className="lt3-footer",t.setAttribute("part","footer"),t.href=`${this.config.apiBase||""}/#/`,t.target="_blank",t.rel="noopener noreferrer",t.title="Collect feedback like this with LT3",t.setAttribute("aria-label","Feedback service provided by LT3"),t.innerHTML='<span class="lt3-footer-heart">&lt;3</span> Feedback service provided by <span class="lt3-footer-brand">LT3</span>',this.modal.append(e,this.body,t),this.backdrop.appendChild(this.modal),this.root.appendChild(this.backdrop)}open(e={}){this.activeLabel=e.label,this.dirty=!1,this.modal.style.overflowY="";let t=e.types?.filter(i=>x.includes(i))??[];this.activeTypes=t.length?t:this.config.defaultTypes,this.lastFocus=document.activeElement,this.activeTypes.length===1?this.renderForm(this.activeTypes[0]):this.renderChooser(),this.backdrop.style.display="flex",requestAnimationFrame(()=>this.backdrop.classList.add("open")),document.addEventListener("keydown",this.onKey)}setHead(e,t,i){let n=a("div","head");if(i){let r=a("div","head-icon",i);r.setAttribute("part","icon"),n.appendChild(r)}let o=a("h2","title",e);if(o.setAttribute("part","title"),n.appendChild(o),t){let r=a("p","subtitle",t);r.setAttribute("part","subtitle"),n.appendChild(r)}return n}renderChooser(){this.dirty=!1;let e=document.createDocumentFragment();e.appendChild(this.setHead("Send feedback","What would you like to share?"));let t=a("div","choices");for(let i of v.filter(n=>this.activeTypes.includes(n.id))){let n=a("button","choice");n.type="button",n.setAttribute("part","choice");let o=a("span","choice-text");o.append(a("span","choice-title",i.title),a("span","choice-blurb",i.blurb)),n.append(a("span","choice-icon",i.icon),o),n.addEventListener("click",()=>this.renderForm(i.id)),t.appendChild(n)}e.appendChild(t),this.body.replaceChildren(e)}renderForm(e){let t=v.find(p=>p.id===e);this.dirty=!1;let i=document.createDocumentFragment();i.appendChild(this.setHead(t.title,t.blurb,t.icon));let n=a("div","field"),o=a("textarea");o.setAttribute("part","input"),o.setAttribute("placeholder","Tell us more\u2026"),o.setAttribute("maxlength","5000");let r=a("span","err");r.style.display="none",n.append(a("label",void 0,"Your message"),o,r);let f=a("div","field"),l=a("input");l.setAttribute("part","input"),l.setAttribute("type","email"),l.setAttribute("placeholder","you@example.com"),l.setAttribute("maxlength","320"),f.append(a("label",void 0,"Email (optional)"),l);let c=()=>{this.dirty=o.value.trim()!==""||l.value.trim()!==""};o.addEventListener("input",c),l.addEventListener("input",c);let h=a("div","actions"),b=a("button","btn btn-ghost","Back");b.type="button",b.setAttribute("part","cancel"),b.addEventListener("click",()=>this.renderChooser());let d=a("button","btn btn-primary","Send");d.type="button",d.setAttribute("part","submit");let m=async()=>{let p=o.value.trim();if(r.style.display="none",!p){r.textContent="Please enter a message.",r.style.display="block",o.focus();return}d.disabled=!0,b.disabled=!0,d.classList.add("loading");let g=d.getBoundingClientRect(),E=g.left+g.width/2,L=g.top+g.height/2;d.replaceChildren(a("span","btn-spinner"));try{await this.submit(e,p,l.value.trim()),this.dirty=!1,S(E,L),this.renderDone(t.icon)}catch(A){d.disabled=!1,b.disabled=!1,d.classList.remove("loading"),d.textContent="Send",r.textContent=A?.message||"Could not send feedback. Please try again.",r.style.display="block"}};d.addEventListener("click",()=>{m()}),o.addEventListener("keydown",p=>{(p.metaKey||p.ctrlKey)&&p.key==="Enter"&&m()}),this.activeTypes.length>1?h.append(b,a("div","spacer"),d):h.append(a("div","spacer"),d),i.append(n,f,h),this.body.replaceChildren(i),o.focus()}renderDone(e){let t=a("div","done"),i=a("div","done-icon");i.append(a("span","done-check","\u2713")),e&&i.append(a("span","done-type",e)),t.appendChild(i),t.appendChild(a("div","done-title","Thanks for your feedback!")),t.appendChild(a("div","done-sub","We really appreciate you taking the time.")),this.modal.style.overflowY="hidden",this.body.replaceChildren(t),window.setTimeout(()=>this.close(),1800)}async submit(e,t,i){let n=await fetch(`${this.config.apiBase}/api/public/feedback`,{method:"POST",headers:{"Content-Type":"application/json","x-api-key":this.config.publicKey},body:JSON.stringify({type:e,message:t,label:this.activeLabel,submittedBy:i||void 0,metadata:{url:location.href,userAgent:navigator.userAgent}})});if(!n.ok){let o="Could not send feedback. Please try again.";try{let r=await n.json();r?.error&&(o=r.error)}catch{}throw new Error(o)}}};function z(s){document.querySelectorAll("[data-lt3-feedback]").forEach(t=>{if(t.hasAttribute("data-lt3-wired"))return;t.setAttribute("data-lt3-wired","");let i=t.getAttribute("data-lt3-label")??void 0,n=T(t.getAttribute("data-lt3-types"))??void 0,o={label:i,types:n},r=!1;if(!t.textContent?.trim()&&t.childElementCount===0)try{let f=t.attachShadow({mode:"open"}),l=document.createElement("style");l.textContent=C;let c=document.createElement("button");c.className="lt3-launch",c.type="button",c.setAttribute("part","button"),c.textContent=t.getAttribute("data-lt3-text")??"Feedback",c.addEventListener("click",()=>s.open(o)),f.append(l,c),r=!0}catch{r=!1}r||(t.style.cursor="pointer",t.addEventListener("click",()=>s.open(o)))})}function w(){let s=M();if(!s)return;let e=new y(s);z(e),window.LT3={open:t=>e.open(t),version:"1.0.0"}}document.readyState==="loading"?document.addEventListener("DOMContentLoaded",w):w();})();
