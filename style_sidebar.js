const fs = require('fs');
let code = fs.readFileSync('public/style.css', 'utf8');

const replacement = `.sidebar{
  background: #000000 !important;
  color: #F8FAFC;
  position: sticky; top: 0; height: 100vh;
  overflow-y: auto; overflow-x: hidden;
  scrollbar-width: thin; scrollbar-color: rgba(255,255,255,0.12) #000000;
  z-index: 100; border-right: 1px solid rgba(255,255,255,0.08);
  animation: slideInLeft 0.5s ease both;
}
.sidebar::-webkit-scrollbar { width: 4px; }
.sidebar::-webkit-scrollbar-track { background: #000000; }
.sidebar::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.15); border-radius: 4px; }

.brand { padding: 26px 20px 18px; margin-bottom: 8px; position: relative; }
.brand-inner { display: flex; align-items: center; gap: 12px; }
.brand-icon {
  width: 42px; height: 42px; border-radius: 12px;
  background: linear-gradient(135deg, var(--brand), var(--accent3));
  display: grid; place-items: center; font-size: 22px; flex-shrink: 0;
  box-shadow: 0 4px 16px rgba(79,70,229,0.4);
  color: #fff;
}
.brand h1 { font-size: 1.12rem; font-weight: 900; color: #FFFFFF; letter-spacing: -0.02em; }
.brand p { font-size: 0.68rem; color: #94A3B8; margin: 0; }
.brand-school {
  margin-top: 12px;
  background: rgba(255,255,255,0.03);
  border: 1px solid rgba(255,255,255,0.08);
  border-radius: 8px; padding: 7px 10px;
  font-size: 0.7rem; color: #94A3B8;
  display: flex; align-items: center; gap: 6px;
}
.brand-school span { color: #FFFFFF; font-weight: 700; }

#moduleNav { padding: 8px 12px 28px; }
.nav-section-label {
  font-size: 0.6rem; font-weight: 800; letter-spacing: 0.12em;
  text-transform: uppercase; color: #64748B; opacity: 1;
  padding: 18px 10px 6px; margin-top: 10px;
}
#moduleNav button {
  display: flex; align-items: center; gap: 11px;
  width: 100%; padding: 12px 14px;
  background: transparent; border: none;
  color: #94A3B8; cursor: pointer;
  border-radius: 12px; font-size: 0.875rem; font-weight: 600;
  font-family: inherit; text-align: left;
  transition: all 0.2s ease;
}
#moduleNav button:hover {
  background: rgba(255,255,255,0.06);
  color: #FFFFFF;
}
#moduleNav button.active {
  background: linear-gradient(90deg, rgba(79,70,229,0.2) 0%, transparent 100%);
  color: #FFFFFF;
  border-left: 3px solid var(--brand);
}
`;

code = code.replace(/\.sidebar\{[\s\S]*?#moduleNav button\.active\{[\s\S]*?\}/, replacement);

fs.writeFileSync('public/style.css', code);
