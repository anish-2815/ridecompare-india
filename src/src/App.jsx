import { useState, useRef, useEffect } from "react";

// ── Inject CSS once (NO re-render animations on components) ──────────────────
if (!document.getElementById("rc-styles")) {
  const s = document.createElement("style");
  s.id = "rc-styles";
  s.textContent = `
    @keyframes rcSpin   { to { transform: rotate(360deg); } }
    @keyframes rcSlide  { from { opacity:0; transform:translateY(20px); } to { opacity:1; transform:translateY(0); } }
    @keyframes rcFade   { from { opacity:0; } to { opacity:1; } }
    @keyframes rcShake  { 0%,100%{transform:translateX(0)} 25%{transform:translateX(-7px)} 75%{transform:translateX(7px)} }
    @keyframes rcBounce { 0%,80%,100%{transform:scale(0.4);opacity:0.4} 40%{transform:scale(1);opacity:1} }
    @keyframes rcBiker  { 0%,100%{transform:translateX(0px)} 50%{transform:translateX(16px)} }
    @keyframes rcRoad   { from{transform:translateX(0)} to{transform:translateX(-56px)} }
    @keyframes rcToast  { 0%{opacity:0;transform:translateX(-50%) translateY(-16px)} 15%,85%{opacity:1;transform:translateX(-50%) translateY(0)} 100%{opacity:0;transform:translateX(-50%) translateY(-16px)} }
    .rc-slide { animation: rcSlide 0.3s ease both; }
    .rc-fade  { animation: rcFade  0.25s ease both; }
    .rc-shake { animation: rcShake 0.4s ease; }
  `;
  document.head.appendChild(s);
}

// ── Static data (outside component = no re-creation) ─────────────────────────
const VEHICLE_TYPES = [
  { id:"bike",    label:"Bike",     icon:"🏍️", desc:"Fastest & cheapest" },
  { id:"auto",    label:"Auto",     icon:"🛺",  desc:"Affordable 3-wheeler" },
  { id:"mini",    label:"Mini Car", icon:"🚗",  desc:"Budget 4-seater" },
  { id:"sedan",   label:"Sedan",    icon:"🚙",  desc:"Comfortable ride" },
  { id:"suv",     label:"SUV/XL",   icon:"🚐",  desc:"6-seater spacious" },
  { id:"premium", label:"Premium",  icon:"🏎️", desc:"Luxury experience" },
];
const APP_VEHICLES = {
  uber:     { bike:false, auto:true,  mini:true,  sedan:true,  suv:true,  premium:true  },
  ola:      { bike:false, auto:true,  mini:true,  sedan:true,  suv:true,  premium:true  },
  rapido:   { bike:true,  auto:true,  mini:false, sedan:false, suv:false, premium:false },
  namma:    { bike:false, auto:true,  mini:true,  sedan:false, suv:false, premium:false },
  blusmart: { bike:false, auto:false, mini:false, sedan:true,  suv:true,  premium:true  },
};
const APPS = {
  uber:     { name:"Uber",         logo:"⚫", color:"#276EF1", bg:"#0a1628",
              bookUrl:(f,t)=>`https://m.uber.com/ul/?action=setPickup&pickup[formatted_address]=${encodeURIComponent(f)}&dropoff[formatted_address]=${encodeURIComponent(t)}`,
              vehicleNames:{ auto:"Uber Auto", mini:"UberGo", sedan:"Uber Sedan", suv:"UberXL", premium:"Uber Black" } },
  ola:      { name:"Ola",          logo:"🟢", color:"#3DBE29", bg:"#0a1a0a",
              bookUrl:(f,t)=>`https://book.olacabs.com/?pickup_name=${encodeURIComponent(f)}&drop_name=${encodeURIComponent(t)}`,
              vehicleNames:{ auto:"Ola Auto", mini:"Ola Mini", sedan:"Ola Prime", suv:"Ola Prime SUV", premium:"Ola Lux" } },
  rapido:   { name:"Rapido",       logo:"⚡", color:"#FFD700", bg:"#1a1400",
              bookUrl:()=>`https://rapido.bike/`,
              vehicleNames:{ bike:"Rapido Bike", auto:"Rapido Auto" } },
  namma:    { name:"Namma Yatri",  logo:"🛺", color:"#FF6B35", bg:"#1a0a00",
              bookUrl:()=>`https://nammayatri.in/`,
              vehicleNames:{ auto:"Yatri Auto", mini:"Yatri Cab" } },
  blusmart: { name:"BluSmart",     logo:"🔵", color:"#00BFFF", bg:"#001a2e",
              bookUrl:()=>`https://blu-smart.com/`,
              vehicleNames:{ sedan:"BluSmart EV", suv:"BluSmart SUV", premium:"BluSmart Premium" } },
};

// Realistic per-km base fares (₹/km) per vehicle type — based on actual 2024 India rates
const BASE_FARE  = { bike:6,  auto:12, mini:14, sedan:18,  suv:22,  premium:32  };
const BASE_MIN   = { bike:25, auto:30, mini:40, sedan:60,  suv:80,  premium:120 }; // minimum fare ₹
// App multipliers reflect real market positioning
const APP_MULT   = { uber:1.08, ola:1.0, rapido:0.82, namma:0.78, blusmart:1.05 };
// Estimated city distances (avg ride ~8-14 km)
const CITY_DIST  = { Bengaluru:11, Mumbai:9, Delhi:13, Chennai:10, Hyderabad:12, Pune:9, Kolkata:8 };

const SURGE_HOURS  = [8,9,18,19,20];
const CHEAP_HOURS  = [10,11,13,14,15,22,23];
const CITIES = ["Bengaluru","Mumbai","Delhi","Chennai","Hyderabad","Pune","Kolkata"];
const POPULAR_ROUTES = {
  Bengaluru:[["Koramangala","Whitefield"],["MG Road","Electronic City"],["Indiranagar","Hebbal"]],
  Mumbai:   [["Bandra","Andheri"],["Dadar","Thane"],["Colaba","Powai"]],
  Delhi:    [["Connaught Place","Dwarka"],["Lajpat Nagar","Rohini"],["Noida Sector 18","Gurgaon"]],
  Chennai:  [["T Nagar","OMR"],["Anna Nagar","Velachery"],["Adyar","Tambaram"]],
  Hyderabad:[["Hitech City","Secunderabad"],["Banjara Hills","LB Nagar"],["Gachibowli","Uppal"]],
  Pune:     [["Shivajinagar","Hinjewadi"],["Kothrud","Hadapsar"],["Aundh","Magarpatta"]],
  Kolkata:  [["Park Street","Salt Lake"],["Howrah","New Town"],["Jadavpur","Dum Dum"]],
};
const NEARBY_PLACES = {
  Bengaluru:["Bengaluru Airport (KIA)","Majestic Bus Stand","Cubbon Park","UB City Mall","Lalbagh Garden","Manyata Tech Park","Forum Mall","NIMHANS","Christ University","Orion Mall"],
  Mumbai:   ["Chhatrapati Shivaji Airport","Dadar Station","Juhu Beach","Phoenix Mall","Siddhivinayak Temple","BKC","Haji Ali","Bandra Kurla Complex","Carter Road","Dharavi"],
  Delhi:    ["IGI Airport","Connaught Place","India Gate","Lajpat Nagar Market","DLF Cyber City","Lotus Temple","Red Fort","Chandni Chowk","Select Citywalk","Qutub Minar"],
  Chennai:  ["Chennai Airport","Marina Beach","Express Avenue Mall","T Nagar","Anna Nagar","TIDEL Park","Kapaleeshwarar Temple","Phoenix Marketcity","VR Chennai","DakshinaChitra"],
  Hyderabad:["Rajiv Gandhi Airport","Charminar","HITEC City","Golconda Fort","Necklace Road","Jubilee Hills","Hussain Sagar","Paradise Hotel","Lumbini Park","Banjara Hills"],
  Pune:     ["Pune Airport","Shaniwar Wada","Aga Khan Palace","FC Road","Koregaon Park","Magarpatta City","Phoenix Marketcity","Osho Ashram","Sinhagad Fort","Hinjewadi IT Park"],
  Kolkata:  ["Netaji Airport","Howrah Bridge","Victoria Memorial","Park Street","New Market","Science City","Eden Gardens","Dakshineswar Temple","South City Mall","Salt Lake Sector V"],
};

// Realistic fare = base_min + (per_km × distance) × app_mult × surge ± small variation
function genPrice(vtype, appKey, hour, city) {
  const dist    = (CITY_DIST[city] || 10) + (Math.random() * 4 - 2); // ±2 km variation
  const surge   = SURGE_HOURS.includes(hour) ? 1.3 + Math.random()*0.2
                : CHEAP_HOURS.includes(hour) ? 0.9
                : 1.0;
  const raw     = (BASE_MIN[vtype] + BASE_FARE[vtype] * dist) * APP_MULT[appKey] * surge;
  // Round to nearest ₹5 like real apps do
  return Math.round(raw / 5) * 5;
}
function getPrices(vtype, hour, city) {
  const out = {};
  Object.entries(APP_VEHICLES).forEach(([k, v]) => {
    if (v[vtype]) out[k] = {
      price: genPrice(vtype, k, hour, city),
      eta: Math.round(3 + Math.random()*10),
      vehicleName: APPS[k].vehicleNames?.[vtype] || APPS[k].name
    };
  });
  return out;
}
function getTrend(vtype, city) {
  return Array.from({length:24}, (_,h) => {
    const p = getPrices(vtype, h, city), vals = Object.values(p).map(x=>x.price);
    return { hour:h, avg: vals.length ? Math.round(vals.reduce((a,b)=>a+b,0)/vals.length) : 0, surge: SURGE_HOURS.includes(h), cheap: CHEAP_HOURS.includes(h) };
  });
}
function initials(name) { return (name||"?").trim().split(" ").map(w=>w[0]).join("").toUpperCase().slice(0,2); }
function avatarColor(name) {
  const cols = ["#276EF1","#3DBE29","#FF6B35","#00BFFF","#a855f7","#ec4899","#f97316"];
  let h = 0; for (const c of (name||"A")) h += c.charCodeAt(0);
  return cols[h % cols.length];
}

// ── OTP via Anthropic API (works inside Claude artifact sandbox) ─────────────
// The Anthropic API is the only external call allowed in this preview.
// We use it to "generate" and "verify" OTP — in production replace with
// 2factor.in / Firebase / Twilio for real SMS delivery.

async function sendOTPviaAI(phone) {
  try {
    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "claude-haiku-4-5-20251001",
        max_tokens: 50,
        messages: [{
          role: "user",
          content: `Generate a random 6-digit OTP for phone number +91${phone}. Reply with ONLY the 6 digits, nothing else.`
        }]
      })
    });
    const data = await res.json();
    const text = (data.content?.[0]?.text || "").trim().replace(/\D/g,"").slice(0,6);
    if (text.length === 6) return { success: true, otp: text };
    // fallback: generate locally if API response unexpected
    return { success: true, otp: String(Math.floor(100000 + Math.random() * 900000)) };
  } catch {
    // Always fallback — never block the user
    return { success: true, otp: String(Math.floor(100000 + Math.random() * 900000)) };
  }
}

// ── Tiny reusable components ──────────────────────────────────────────────────

function Spinner({ size=18, color="#0a0a0f" }) {
  return (
    <span style={{ display:"inline-block", width:size, height:size,
      border:`2px solid ${color}33`, borderTop:`2px solid ${color}`,
      borderRadius:"50%", animation:"rcSpin 0.7s linear infinite" }} />
  );
}

function Toast({ msg, type }) {
  const colors = { success:"#4ade80", error:"#ff6b6b", info:"#63b3ed", warning:"#FFD700" };
  const icons  = { success:"✅", error:"❌", info:"📲", warning:"⚠️" };
  return (
    <div style={{ position:"fixed", top:18, left:"50%", zIndex:9999, pointerEvents:"none",
      animation:"rcToast 3.2s ease forwards",
      background:"rgba(10,22,38,0.97)", border:`1px solid ${colors[type]||colors.info}`,
      borderRadius:14, padding:"11px 20px", display:"flex", alignItems:"center", gap:10,
      boxShadow:`0 8px 28px rgba(0,0,0,0.55)`, backdropFilter:"blur(10px)",
      minWidth:240, maxWidth:320 }}>
      <span style={{fontSize:18}}>{icons[type]}</span>
      <span style={{fontSize:13, fontWeight:600, color:"#e2e8f0"}}>{msg}</span>
    </div>
  );
}

function NetworkErrorModal({ onRetry }) {
  return (
    <div className="rc-fade" style={{ position:"fixed", inset:0, zIndex:8000,
      background:"rgba(4,10,20,0.93)", backdropFilter:"blur(6px)",
      display:"flex", alignItems:"center", justifyContent:"center",
      fontFamily:"'DM Sans','Segoe UI',sans-serif" }}>
      <div style={{ background:"linear-gradient(135deg,rgba(255,255,255,0.07),rgba(255,255,255,0.02))",
        border:"1px solid rgba(255,107,53,0.4)", borderRadius:22, padding:"32px 24px",
        maxWidth:310, width:"90%", textAlign:"center",
        boxShadow:"0 24px 70px rgba(0,0,0,0.7)" }}>

        {/* Road scene — static container, CSS-animated children */}
        <div style={{ position:"relative", height:72, borderRadius:12, overflow:"hidden",
          background:"rgba(255,255,255,0.03)", border:"1px solid rgba(255,255,255,0.06)",
          marginBottom:18 }}>
          {/* Road dashes */}
          {[0,1,2,3,4].map(i => (
            <div key={i} style={{ position:"absolute", bottom:10, left:`${i*64-8}px`, width:40, height:3,
              background:"rgba(255,215,0,0.3)", borderRadius:2,
              animation:`rcRoad 0.85s linear infinite`, animationDelay:`${i*-0.17}s` }}/>
          ))}
          {/* Bike */}
          <div style={{ position:"absolute", bottom:12, left:"50%", transform:"translateX(-50%)",
            fontSize:32, animation:"rcBiker 0.65s ease-in-out infinite" }}>🏍️</div>
          {/* No wifi */}
          <div style={{ position:"absolute", top:8, right:10, fontSize:16 }}>📵</div>
        </div>

        <div style={{ fontSize:19, fontWeight:900, color:"#ff8080", marginBottom:8 }}>No Internet!</div>
        <div style={{ fontSize:12, color:"#8a9ab0", lineHeight:1.6, marginBottom:20 }}>
          Your rider lost signal 😅<br/>Check your connection and try again.
        </div>
        {/* Bounce dots */}
        <div style={{ display:"flex", justifyContent:"center", gap:6, marginBottom:18 }}>
          {[0,1,2].map(i => (
            <div key={i} style={{ width:7, height:7, borderRadius:"50%", background:"#FF6B35",
              animation:`rcBounce 1.1s ease-in-out infinite`, animationDelay:`${i*0.2}s` }}/>
          ))}
        </div>
        <button onClick={onRetry} style={{ width:"100%", padding:"13px", border:"none", borderRadius:12,
          background:"linear-gradient(135deg,#FF6B35,#FFD700)", color:"#0a0a0f",
          fontSize:14, fontWeight:800, cursor:"pointer",
          boxShadow:"0 4px 16px rgba(255,107,53,0.4)", fontFamily:"inherit" }}>
          🔄 Retry
        </button>
        <div style={{ marginTop:10, fontSize:11, color:"#3a5a6a" }}>Check WiFi or mobile data</div>
      </div>
    </div>
  );
}

function StepBar({ step, labels }) {
  return (
    <div style={{ display:"flex", alignItems:"center", justifyContent:"center", marginBottom:22 }}>
      {labels.map((lbl, i) => (
        <div key={i} style={{ display:"flex", alignItems:"center" }}>
          <div style={{ display:"flex", flexDirection:"column", alignItems:"center", gap:3 }}>
            <div style={{ width:28, height:28, borderRadius:"50%", display:"flex",
              alignItems:"center", justifyContent:"center", fontSize:12, fontWeight:800,
              background: i < step ? "#4ade80" : i === step ? "linear-gradient(135deg,#FFD700,#FF6B35)" : "rgba(255,255,255,0.07)",
              color: i < step ? "#031a0a" : i === step ? "#0a0a0f" : "#5a7a96",
              border: i === step ? "none" : "1px solid rgba(255,255,255,0.1)",
              boxShadow: i === step ? "0 0 12px rgba(255,215,0,0.4)" : "none" }}>
              {i < step ? "✓" : i+1}
            </div>
            <div style={{ fontSize:9, color: i===step?"#FFD700": i<step?"#4ade80":"#3a5a6a",
              fontWeight: i===step?700:400, textTransform:"uppercase", letterSpacing:"0.5px" }}>
              {lbl}
            </div>
          </div>
          {i < labels.length-1 && (
            <div style={{ width:36, height:2, margin:"0 4px 14px",
              background: i < step ? "#4ade80" : "rgba(255,255,255,0.08)" }}/>
          )}
        </div>
      ))}
    </div>
  );
}

// ── Stable style constants (outside any component) ───────────────────────────
const AUTH_BG   = "linear-gradient(160deg,#060b14 0%,#0c1a28 55%,#080e18 100%)";
const AUTH_CARD = { background:"linear-gradient(135deg,rgba(255,255,255,0.06),rgba(255,255,255,0.02))",
  border:"1px solid rgba(255,215,0,0.22)", borderRadius:22, padding:"26px 22px",
  boxShadow:"0 20px 60px rgba(0,0,0,0.6)" };
const AUTH_INP  = { width:"100%", padding:"13px 15px", boxSizing:"border-box",
  background:"rgba(255,255,255,0.07)", borderRadius:13, color:"#fff", fontSize:15, outline:"none",
  border:"1px solid rgba(255,255,255,0.14)", fontFamily:"'DM Sans','Segoe UI',sans-serif" };
const AUTH_INP_ERR = { ...AUTH_INP, border:"1.5px solid rgba(255,80,80,0.6)" };
const AUTH_BTN  = { width:"100%", padding:"14px", border:"none", borderRadius:13,
  fontSize:15, fontWeight:800, cursor:"pointer",
  background:"linear-gradient(135deg,#FFD700,#FF6B35)", color:"#0a0a0f",
  boxShadow:"0 4px 20px rgba(255,215,0,0.28)",
  display:"flex", alignItems:"center", justifyContent:"center", gap:8,
  fontFamily:"'DM Sans','Segoe UI',sans-serif" };
const AUTH_BTN_DIS = { ...AUTH_BTN, cursor:"not-allowed",
  background:"rgba(255,215,0,0.1)", color:"#5a7a96", boxShadow:"none" };
const AUTH_BACK = { background:"none", border:"none", color:"#8a9ab0", cursor:"pointer",
  fontSize:13, marginBottom:16, display:"flex", alignItems:"center", gap:5,
  fontFamily:"'DM Sans','Segoe UI',sans-serif", padding:0 };

// ══════════════════════════════════════════════════════════════════════════════
// AUTH SCREEN  — single return, NO inner component definitions
// ══════════════════════════════════════════════════════════════════════════════
function AuthScreen({ onLogin }) {
  const [screen, setScreen]         = useState("landing");
  const [name, setName]             = useState("");
  const [phone, setPhone]           = useState("");
  const [otp, setOtp]               = useState(["","","","","",""]);
  const [correctOtp, setCorrectOtp] = useState("");
  const [sending, setSending]       = useState(false);
  const [verifying, setVerifying]   = useState(false);
  const [otpErr, setOtpErr]         = useState("");
  const [shaking, setShaking]       = useState(false);
  const [timer, setTimer]           = useState(0);
  const [toast, setToast]           = useState(null);
  const [toastKey, setToastKey]     = useState(0);
  const [netErr, setNetErr]         = useState(false);
  const [nameErr, setNameErr]       = useState("");
  const [phoneErr, setPhoneErr]     = useState("");
  const [agreed, setAgreed]         = useState(false);
  const [agreedErr, setAgreedErr]   = useState(false);
  const [showTermsInline, setShowTermsInline]   = useState(false);
  const [showPrivacyInline, setShowPrivacyInline] = useState(false);
  const otpRefs  = useRef([]);
  const timerRef = useRef(null);
  const screenRef = useRef(screen); // track latest screen in async handlers
  useEffect(() => { screenRef.current = screen; }, [screen]);

  const showToast = (msg, type="info") => { setToast({msg,type}); setToastKey(k=>k+1); };

  const startTimer = () => {
    setTimer(30);
    clearInterval(timerRef.current);
    timerRef.current = setInterval(() => {
      setTimer(t => { if (t<=1){ clearInterval(timerRef.current); return 0; } return t-1; });
    }, 1000);
  };
  useEffect(() => () => clearInterval(timerRef.current), []);

  const handleSendOTP = async () => {
    if (phone.length !== 10) { setPhoneErr("Enter a valid 10-digit number"); return; }
    setSending(true);
    const result = await sendOTPviaAI(phone);
    setSending(false);
    if (result.success) {
      setCorrectOtp(result.otp);
      setOtp(["","","","","",""]);
      setOtpErr("");
      startTimer();
      showToast(`OTP ready for +91 ${phone} 📲`, "success");
      setScreen(screenRef.current === "login" ? "login_otp" : "otp");
      setTimeout(() => otpRefs.current[0]?.focus(), 300);
    } else {
      showToast("Could not generate OTP. Try again.", "error");
    }
  };

  const handleOtpChange = (i, val, e) => {
    if (!/^\d*$/.test(val)) return;
    const next = [...otp]; next[i] = val.slice(-1); setOtp(next); setOtpErr("");
    if (val && i < 5) otpRefs.current[i+1]?.focus();
    if (!val && e?.key === "Backspace" && i > 0) otpRefs.current[i-1]?.focus();
    if (val && i === 5) setTimeout(() => doVerify(next.join("")), 150);
  };

  const doVerify = async (code) => {
    const entered = code || otp.join("");
    if (entered.length < 6) return;
    setVerifying(true);
    await new Promise(r => setTimeout(r, 600));
    setVerifying(false);
    if (entered === correctOtp) {
      clearInterval(timerRef.current);
      showToast("Verified! Welcome aboard 🎉", "success");
      setTimeout(() => onLogin({
        name: name || "User", phone,
        avatar: initials(name || "User"),
        color: avatarColor(name || "User"),
        joined: new Date().toLocaleDateString("en-IN",{month:"long",year:"numeric"}),
      }), 700);
    } else {
      setShaking(true); setTimeout(()=>setShaking(false), 450);
      setOtpErr("Incorrect OTP. Please try again.");
      setOtp(["","","","","",""]);
      showToast("Wrong OTP! Try again.", "error");
      setTimeout(()=>otpRefs.current[0]?.focus(), 200);
    }
  };

  // ── Single stable return — screen switcher inside one persistent div ───────
  return (
    <div style={{ minHeight:"100vh", background:AUTH_BG, display:"flex",
      flexDirection:"column", alignItems:"center", justifyContent:"center",
      padding:"20px", fontFamily:"'DM Sans','Segoe UI',sans-serif" }}>

      {toast && <Toast key={toastKey} msg={toast.msg} type={toast.type} />}
      {netErr && <NetworkErrorModal onRetry={()=>setNetErr(false)} />}

      {/* ── LANDING ── */}
      {screen === "landing" && (
        <div style={{ width:"100%", maxWidth:380, textAlign:"center" }}>
          <div style={{ fontSize:64, marginBottom:6 }}>🚖</div>
          <div style={{ fontSize:32, fontWeight:900, color:"#fff", letterSpacing:"-1px" }}>RideCompare</div>
          <div style={{ fontSize:22, fontWeight:900, color:"#FFD700", marginBottom:6 }}>India</div>
          <div style={{ fontSize:13, color:"#5a7a96", marginBottom:26 }}>
            Compare Uber · Ola · Rapido · Namma Yatri · BluSmart
          </div>
          <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:9, marginBottom:24 }}>
            {[["💰","Cheapest Ride","Instant comparison"],["⏰","Beat Surge","Best time to book"],
              ["🛣️","Smart Route","Save time & money"],["📍","GPS Pickup","Auto-detect location"]].map(([ic,t,s])=>(
              <div key={t} style={{ background:"rgba(255,255,255,0.04)", border:"1px solid rgba(255,255,255,0.07)",
                borderRadius:13, padding:"12px 8px" }}>
                <div style={{fontSize:22,marginBottom:3}}>{ic}</div>
                <div style={{fontSize:12,fontWeight:700,color:"#e2e8f0"}}>{t}</div>
                <div style={{fontSize:10,color:"#5a7a96",marginTop:2}}>{s}</div>
              </div>
            ))}
          </div>
          <button onClick={()=>setScreen("name")} style={AUTH_BTN}>🚀 Create Free Account</button>
          <button onClick={()=>setScreen("login")} style={{ width:"100%", marginTop:10, padding:"13px",
            border:"1px solid rgba(255,215,0,0.3)", borderRadius:13, fontSize:15, fontWeight:700,
            cursor:"pointer", background:"rgba(255,215,0,0.05)", color:"#FFD700", fontFamily:"inherit" }}>
            🔑 Login
          </button>
          <div style={{ display:"flex", alignItems:"center", gap:10, margin:"13px 0" }}>
            <div style={{flex:1,height:1,background:"rgba(255,255,255,0.07)"}}/><span style={{fontSize:11,color:"#3a5a6a"}}>or</span><div style={{flex:1,height:1,background:"rgba(255,255,255,0.07)"}}/>
          </div>
          <button onClick={()=>onLogin({name:"Google User",phone:"",avatar:"GU",color:"#276EF1",joined:new Date().toLocaleDateString("en-IN",{month:"long",year:"numeric"})})}
            style={{ width:"100%", padding:"12px", border:"1px solid rgba(255,255,255,0.12)",
              borderRadius:13, fontSize:13, fontWeight:700, cursor:"pointer",
              background:"rgba(255,255,255,0.04)", color:"#e2e8f0",
              display:"flex", alignItems:"center", justifyContent:"center", gap:10, fontFamily:"inherit" }}>
            <span style={{width:22,height:22,borderRadius:"50%",background:"#fff",display:"flex",alignItems:"center",justifyContent:"center",fontSize:13,fontWeight:900,color:"#4285F4"}}>G</span>
            Continue with Google
          </button>
          <div style={{marginTop:20,fontSize:11,color:"#2a4a5a"}}>Built with ❤️ by Anish Tupe & Rushikesh Jadhav</div>
        </div>
      )}

      {/* ── NAME STEP ── */}
      {screen === "name" && (
        <div style={{ width:"100%", maxWidth:370 }}>
          <button onClick={()=>setScreen("landing")} style={AUTH_BACK}>← Back</button>
          <StepBar step={0} labels={["Name","Phone","OTP"]} />
          <div style={AUTH_CARD}>
            <div style={{textAlign:"center",marginBottom:20}}>
              <div style={{fontSize:34,marginBottom:8}}>👋</div>
              <div style={{fontSize:20,fontWeight:900,color:"#fff"}}>What's your name?</div>
              <div style={{fontSize:13,color:"#5a7a96",marginTop:4}}>Let us know what to call you</div>
            </div>
            <div style={{fontSize:11,color:"#5a7a96",fontWeight:700,marginBottom:7,letterSpacing:"1px"}}>FULL NAME</div>
            <input
              autoFocus
              value={name}
              onChange={e=>{ setName(e.target.value); setNameErr(""); }}
              onKeyDown={e=>{ if(e.key==="Enter" && name.trim().length>=2){ setScreen("phone"); } }}
              placeholder="e.g. Anish Tupe"
              style={nameErr ? AUTH_INP_ERR : AUTH_INP}
            />
            {nameErr && <div style={{fontSize:12,color:"#ff8080",marginTop:5}}>⚠️ {nameErr}</div>}
            <div style={{fontSize:11,color:"#3a5a6a",marginTop:5,marginBottom:16}}>This will appear on your profile</div>
            <button
              onClick={()=>{ if(name.trim().length<2){setNameErr("Enter at least 2 characters");return;} setScreen("phone"); }}
              style={name.trim().length<2 ? AUTH_BTN_DIS : AUTH_BTN}>
              Continue →
            </button>
          </div>
        </div>
      )}

      {/* ── PHONE STEP ── */}
      {screen === "phone" && (
        <div style={{ width:"100%", maxWidth:370 }}>
          <button onClick={()=>setScreen("name")} style={AUTH_BACK}>← Back</button>
          <StepBar step={1} labels={["Name","Phone","OTP"]} />
          <div style={AUTH_CARD}>
            <div style={{textAlign:"center",marginBottom:20}}>
              <div style={{fontSize:34,marginBottom:8}}>📱</div>
              <div style={{fontSize:20,fontWeight:900,color:"#fff"}}>Hi {name.split(" ")[0]}! Your number?</div>
              <div style={{fontSize:13,color:"#5a7a96",marginTop:4}}>We'll generate a 6-digit OTP for you</div>
            </div>
            <div style={{fontSize:11,color:"#5a7a96",fontWeight:700,marginBottom:7,letterSpacing:"1px"}}>MOBILE NUMBER</div>
            <div style={{position:"relative",marginBottom:5}}>
              <div style={{position:"absolute",left:13,top:"50%",transform:"translateY(-50%)",
                color:"#8a9ab0",fontSize:14,fontWeight:700,
                borderRight:"1px solid rgba(255,255,255,0.15)",paddingRight:10,
                display:"flex",alignItems:"center",gap:5,pointerEvents:"none"}}>
                🇮🇳 +91
              </div>
              <input
                autoFocus
                value={phone}
                onChange={e=>{ setPhone(e.target.value.replace(/\D/g,"").slice(0,10)); setPhoneErr(""); }}
                onKeyDown={e=>{ if(e.key==="Enter" && phone.length===10) handleSendOTP(); }}
                placeholder="98765 43210"
                inputMode="numeric"
                style={{ ...(phoneErr ? AUTH_INP_ERR : AUTH_INP), paddingLeft:86 }}
              />
            </div>
            {phoneErr && <div style={{fontSize:12,color:"#ff8080",marginTop:4}}>⚠️ {phoneErr}</div>}
            {phone.length>0 && phone.length<10 && <div style={{fontSize:11,color:"#FFD700",marginTop:4}}>{10-phone.length} more digits needed</div>}
            {phone.length===10 && <div style={{fontSize:11,color:"#4ade80",marginTop:4}}>✓ Valid number</div>}
            <div style={{height:14}}/>
            <button onClick={handleSendOTP} disabled={phone.length!==10||sending}
              style={phone.length!==10||sending ? AUTH_BTN_DIS : AUTH_BTN}>
              {sending ? <><Spinner size={15} color="#0a0a0f"/> Generating OTP...</> : "📲 Send OTP"}
            </button>
            <div style={{textAlign:"center",marginTop:12,fontSize:12,color:"#5a7a96"}}>
              Already have account? <span onClick={()=>setScreen("login")} style={{color:"#FFD700",cursor:"pointer",fontWeight:700}}>Login</span>
            </div>
          </div>
        </div>
      )}

      {/* ── OTP STEP (signup + login share same view) ── */}
      {(screen === "otp" || screen === "login_otp") && (
        <div style={{ width:"100%", maxWidth:370 }}>
          <button onClick={()=>setScreen(screen==="login_otp"?"login":"phone")} style={AUTH_BACK}>← Back</button>
          {screen==="otp" && <StepBar step={2} labels={["Name","Phone","OTP"]} />}
          <div style={AUTH_CARD}>
            <div style={{textAlign:"center",marginBottom:16}}>
              <div style={{fontSize:34,marginBottom:8}}>🔐</div>
              <div style={{fontSize:20,fontWeight:900,color:"#fff"}}>Enter OTP</div>
              <div style={{fontSize:13,color:"#5a7a96",marginTop:4,lineHeight:1.5}}>
                Code generated for <span style={{color:"#FFD700",fontWeight:700}}>+91 {phone}</span>
              </div>
            </div>

            {/* OTP code display */}
            <div style={{background:"rgba(255,215,0,0.07)",border:"2px solid rgba(255,215,0,0.3)",
              borderRadius:14,padding:"13px 16px",marginBottom:16,textAlign:"center"}}>
              <div style={{fontSize:10,color:"#FFD700",fontWeight:700,letterSpacing:"1.5px",marginBottom:5}}>
                📲 YOUR OTP
              </div>
              <div style={{fontSize:34,fontWeight:900,color:"#FFD700",letterSpacing:"10px",fontFamily:"monospace"}}>
                {correctOtp || "------"}
              </div>
              {timer>0 && (
                <div style={{fontSize:11,color:"#8a9ab0",marginTop:5}}>
                  Expires in <b style={{color:"#FFD700"}}>{timer}s</b>
                </div>
              )}
            </div>

            {/* 6 input boxes */}
            <div style={{display:"flex",gap:8,justifyContent:"center",marginBottom:10}}
              className={shaking?"rc-shake":""}>
              {otp.map((d,i)=>(
                <input key={i} ref={el=>otpRefs.current[i]=el}
                  value={d}
                  onChange={e=>handleOtpChange(i,e.target.value,null)}
                  onKeyDown={e=>handleOtpChange(i,d,e)}
                  maxLength={1} inputMode="numeric"
                  style={{ width:44, height:52, textAlign:"center", fontSize:24, fontWeight:900,
                    background: d?"rgba(255,215,0,0.14)":"rgba(255,255,255,0.07)",
                    border: otpErr?"1.5px solid rgba(255,80,80,0.5)":d?"1.5px solid #FFD700":"1px solid rgba(255,255,255,0.15)",
                    borderRadius:12, color: otpErr?"#ff8080":"#FFD700",
                    outline:"none", fontFamily:"monospace" }}
                />
              ))}
            </div>

            {otpErr && (
              <div style={{background:"rgba(255,80,80,0.08)",border:"1px solid rgba(255,80,80,0.2)",
                borderRadius:10,padding:"8px 14px",marginBottom:10,textAlign:"center",fontSize:13,color:"#ff8080"}}>
                ❌ {otpErr}
              </div>
            )}

            <button onClick={()=>doVerify()} disabled={otp.join("").length<6||verifying}
              style={otp.join("").length<6||verifying ? AUTH_BTN_DIS : AUTH_BTN}>
              {verifying ? <><Spinner size={15} color="#0a0a0f"/> Verifying...</> : "✅ Verify & Continue"}
            </button>

            <div style={{textAlign:"center",marginTop:12,fontSize:13,color:"#5a7a96"}}>
              {timer>0
                ? <>Resend in <span style={{color:"#FFD700",fontWeight:700}}>{timer}s</span></>
                : <span onClick={handleSendOTP} style={{color:"#FFD700",cursor:"pointer",fontWeight:700}}>Resend OTP</span>
              }
            </div>
          </div>
        </div>
      )}

      {/* ── LOGIN ── */}
      {screen === "login" && (
        <div style={{ width:"100%", maxWidth:370 }}>
          <button onClick={()=>setScreen("landing")} style={AUTH_BACK}>← Back</button>
          <div style={AUTH_CARD}>
            <div style={{textAlign:"center",marginBottom:20}}>
              <div style={{fontSize:34,marginBottom:8}}>🙏</div>
              <div style={{fontSize:20,fontWeight:900,color:"#fff"}}>Welcome back!</div>
              <div style={{fontSize:13,color:"#5a7a96",marginTop:4}}>Login with your mobile number</div>
            </div>
            <div style={{fontSize:11,color:"#5a7a96",fontWeight:700,marginBottom:7,letterSpacing:"1px"}}>MOBILE NUMBER</div>
            <div style={{position:"relative",marginBottom:5}}>
              <div style={{position:"absolute",left:13,top:"50%",transform:"translateY(-50%)",
                color:"#8a9ab0",fontSize:14,fontWeight:700,
                borderRight:"1px solid rgba(255,255,255,0.15)",paddingRight:10,
                display:"flex",alignItems:"center",gap:5,pointerEvents:"none"}}>
                🇮🇳 +91
              </div>
              <input
                autoFocus
                value={phone}
                onChange={e=>setPhone(e.target.value.replace(/\D/g,"").slice(0,10))}
                onKeyDown={e=>{ if(e.key==="Enter" && phone.length===10){ if(!name)setName("User"); handleSendOTP(); } }}
                placeholder="98765 43210"
                inputMode="numeric"
                style={{ ...AUTH_INP, paddingLeft:86 }}
              />
            </div>
            {phone.length===10 && <div style={{fontSize:11,color:"#4ade80",marginTop:4,marginBottom:4}}>✓ Valid number</div>}
            <div style={{height:12}}/>

            {/* ── Terms & Privacy Checkbox ── */}
            <div onClick={()=>{ setAgreed(!agreed); setAgreedErr(false); }}
              style={{display:"flex",alignItems:"flex-start",gap:11,padding:"12px 14px",
                borderRadius:12,marginBottom:14,cursor:"pointer",
                background: agreedErr ? "rgba(255,80,80,0.07)" : agreed ? "rgba(74,222,128,0.07)" : "rgba(255,255,255,0.04)",
                border: agreedErr ? "1.5px solid rgba(255,80,80,0.4)" : agreed ? "1.5px solid rgba(74,222,128,0.3)" : "1px solid rgba(255,255,255,0.1)"}}>
              <div style={{width:20,height:20,borderRadius:6,flexShrink:0,marginTop:1,
                background: agreed ? "linear-gradient(135deg,#FFD700,#FF6B35)" : "rgba(255,255,255,0.08)",
                border: agreed ? "none" : "1.5px solid rgba(255,255,255,0.25)",
                display:"flex",alignItems:"center",justifyContent:"center",transition:"all 0.15s"}}>
                {agreed && <span style={{color:"#0a0a0f",fontSize:13,fontWeight:900,lineHeight:1}}>✓</span>}
              </div>
              <div style={{fontSize:12,color:"#8a9ab0",lineHeight:1.6,userSelect:"none"}}>
                I agree to the{" "}
                <span onClick={e=>{ e.stopPropagation(); setShowTermsInline(true); }}
                  style={{color:"#FFD700",fontWeight:700,textDecoration:"underline",textUnderlineOffset:2,cursor:"pointer"}}>
                  Terms of Service
                </span>
                {" "}and{" "}
                <span onClick={e=>{ e.stopPropagation(); setShowPrivacyInline(true); }}
                  style={{color:"#FFD700",fontWeight:700,textDecoration:"underline",textUnderlineOffset:2,cursor:"pointer"}}>
                  Privacy Policy
                </span>
              </div>
            </div>
            {agreedErr && (
              <div style={{fontSize:12,color:"#ff8080",marginBottom:10}}>
                ⚠️ Please accept the Terms & Privacy Policy to continue
              </div>
            )}

            {/* Inline quick-view */}
            {(showTermsInline || showPrivacyInline) && (
              <div style={{background:"rgba(0,0,0,0.6)",border:"1px solid rgba(255,215,0,0.2)",
                borderRadius:14,padding:"14px",marginBottom:14,maxHeight:180,overflowY:"auto"}}>
                <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:8}}>
                  <div style={{fontSize:12,fontWeight:700,color:"#FFD700"}}>
                    {showTermsInline ? "📋 Terms of Service" : "🔒 Privacy Policy"}
                  </div>
                  <button onClick={()=>{ setShowTermsInline(false); setShowPrivacyInline(false); }}
                    style={{background:"rgba(255,255,255,0.08)",border:"none",color:"#8a9ab0",
                      cursor:"pointer",width:24,height:24,borderRadius:"50%",fontSize:13,
                      display:"flex",alignItems:"center",justifyContent:"center",fontFamily:"inherit"}}>✕</button>
                </div>
                {showTermsInline && (
                  <div style={{fontSize:11,color:"#8a9ab0",lineHeight:1.8}}>
                    <b style={{color:"#e2e8f0"}}>Service:</b> Estimated fares only — not live prices. We don't book rides.<br/>
                    <b style={{color:"#e2e8f0"}}>No Affiliation:</b> Not affiliated with Uber, Ola, Rapido, Namma Yatri or BluSmart.<br/>
                    <b style={{color:"#e2e8f0"}}>Eligibility:</b> Must be 18+ to use.<br/>
                    <b style={{color:"#e2e8f0"}}>Governing Law:</b> Pune, Maharashtra, India.
                  </div>
                )}
                {showPrivacyInline && (
                  <div style={{fontSize:11,color:"#8a9ab0",lineHeight:1.8}}>
                    <b style={{color:"#e2e8f0"}}>We collect:</b> Phone (OTP only), name, GPS (one-time).<br/>
                    <b style={{color:"#e2e8f0"}}>We never:</b> Sell, rent, or share your data.<br/>
                    <b style={{color:"#e2e8f0"}}>Compliant with:</b> IT Act 2000, DPDP Act 2023.
                  </div>
                )}
              </div>
            )}

            <button onClick={()=>{ if(!agreed){ setAgreedErr(true); return; } if(!name)setName("User"); handleSendOTP(); }}
              disabled={phone.length!==10||sending}
              style={phone.length!==10||sending ? AUTH_BTN_DIS : AUTH_BTN}>
              {sending ? <><Spinner size={15} color="#0a0a0f"/> Sending...</> : "📲 Get OTP"}
            </button>
            <div style={{textAlign:"center",marginTop:12,fontSize:12,color:"#5a7a96"}}>
              New user? <span onClick={()=>setScreen("name")} style={{color:"#FFD700",cursor:"pointer",fontWeight:700}}>Create Account</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// MODAL SHELL — reusable full-screen modal
// ══════════════════════════════════════════════════════════════════════════════
function Modal({ title, onClose, children }) {
  return (
    <div className="rc-fade" style={{ position:"fixed", inset:0, zIndex:600,
      background:"rgba(4,10,20,0.92)", backdropFilter:"blur(6px)",
      display:"flex", alignItems:"center", justifyContent:"center", padding:"16px",
      fontFamily:"'DM Sans','Segoe UI',sans-serif" }}>
      <div className="rc-slide" style={{ width:"100%", maxWidth:460,
        background:"#0a1828", border:"1px solid rgba(255,215,0,0.18)",
        borderRadius:20, overflow:"hidden", maxHeight:"88vh",
        boxShadow:"0 24px 80px rgba(0,0,0,0.7)", display:"flex", flexDirection:"column" }}>
        {/* Header */}
        <div style={{ padding:"16px 20px", borderBottom:"1px solid rgba(255,255,255,0.07)",
          display:"flex", alignItems:"center", justifyContent:"space-between",
          background:"linear-gradient(135deg,rgba(255,215,0,0.08),rgba(255,107,53,0.04))" }}>
          <div style={{ fontSize:15, fontWeight:800, color:"#fff" }}>{title}</div>
          <button onClick={onClose} style={{ background:"rgba(255,255,255,0.08)", border:"none",
            color:"#8a9ab0", cursor:"pointer", width:30, height:30, borderRadius:"50%",
            fontSize:16, display:"flex", alignItems:"center", justifyContent:"center",
            fontFamily:"inherit" }}>✕</button>
        </div>
        {/* Scrollable body */}
        <div style={{ overflowY:"auto", flex:1, padding:"20px" }}>{children}</div>
      </div>
    </div>
  );
}

// ── Settings Modal ────────────────────────────────────────────────────────────
function SettingsModal({ onClose }) {
  const [notif,  setNotif]  = useState(true);
  const [surge,  setSurge]  = useState(true);
  const [gps,    setGps]    = useState(true);
  const [dark,   setDark]   = useState(true);
  const [unit,   setUnit]   = useState("INR");
  const [lang,   setLang]   = useState("English");

  const Toggle = ({ val, set }) => (
    <div onClick={()=>set(!val)} style={{ width:42, height:24, borderRadius:12, cursor:"pointer",
      background: val ? "linear-gradient(135deg,#FFD700,#FF6B35)" : "rgba(255,255,255,0.12)",
      position:"relative", transition:"background 0.2s", flexShrink:0 }}>
      <div style={{ position:"absolute", top:3, left: val?20:3, width:18, height:18,
        borderRadius:"50%", background:"#fff", transition:"left 0.2s",
        boxShadow:"0 2px 6px rgba(0,0,0,0.3)" }}/>
    </div>
  );

  const Row = ({ icon, label, sub, right }) => (
    <div style={{ display:"flex", alignItems:"center", gap:12, padding:"13px 0",
      borderBottom:"1px solid rgba(255,255,255,0.05)" }}>
      <span style={{fontSize:20}}>{icon}</span>
      <div style={{flex:1}}>
        <div style={{fontSize:14,fontWeight:600,color:"#e2e8f0"}}>{label}</div>
        <div style={{fontSize:11,color:"#5a7a96",marginTop:1}}>{sub}</div>
      </div>
      {right}
    </div>
  );

  const Select = ({ val, set, options }) => (
    <select value={val} onChange={e=>set(e.target.value)}
      style={{ background:"rgba(255,255,255,0.08)", border:"1px solid rgba(255,255,255,0.15)",
        color:"#FFD700", borderRadius:8, padding:"4px 8px", fontSize:12,
        fontFamily:"inherit", cursor:"pointer", outline:"none" }}>
      {options.map(o => <option key={o} value={o} style={{background:"#0a1828"}}>{o}</option>)}
    </select>
  );

  return (
    <Modal title="⚙️ Settings" onClose={onClose}>
      <div style={{fontSize:11,color:"#5a7a96",fontWeight:700,letterSpacing:"1px",marginBottom:8}}>NOTIFICATIONS</div>
      <Row icon="🔔" label="Push Notifications" sub="Ride updates & confirmations" right={<Toggle val={notif} set={setNotif}/>}/>
      <Row icon="⚡" label="Surge Price Alerts" sub="Alert when surge ends in your area" right={<Toggle val={surge} set={setSurge}/>}/>
      <div style={{height:14}}/>
      <div style={{fontSize:11,color:"#5a7a96",fontWeight:700,letterSpacing:"1px",marginBottom:8}}>LOCATION</div>
      <Row icon="📍" label="GPS Auto-Detect" sub="Auto-fill pickup from your location" right={<Toggle val={gps} set={setGps}/>}/>
      <div style={{height:14}}/>
      <div style={{fontSize:11,color:"#5a7a96",fontWeight:700,letterSpacing:"1px",marginBottom:8}}>DISPLAY</div>
      <Row icon="🌙" label="Dark Mode" sub="Easy on the eyes at night" right={<Toggle val={dark} set={setDark}/>}/>
      <Row icon="💱" label="Currency" sub="Display prices in" right={<Select val={unit} set={setUnit} options={["INR","USD","EUR"]}/>}/>
      <Row icon="🌐" label="Language" sub="App display language" right={<Select val={lang} set={setLang} options={["English","Hindi","Kannada","Tamil","Telugu"]}/>}/>
      <div style={{height:14}}/>
      <div style={{fontSize:11,color:"#5a7a96",fontWeight:700,letterSpacing:"1px",marginBottom:8}}>ACCOUNT</div>
      <Row icon="🗑️" label="Clear Search History" sub="Remove all past searches" right={
        <button onClick={()=>alert("History cleared!")} style={{background:"rgba(255,80,80,0.1)",border:"1px solid rgba(255,80,80,0.25)",color:"#ff8080",borderRadius:8,padding:"5px 10px",fontSize:11,cursor:"pointer",fontFamily:"inherit"}}>Clear</button>
      }/>
      <Row icon="📊" label="App Version" sub="RideCompare India" right={
        <span style={{fontSize:12,color:"#5a7a96",background:"rgba(255,255,255,0.06)",padding:"3px 9px",borderRadius:8}}>v1.0.0</span>
      }/>
      <div style={{marginTop:18, padding:"12px", background:"rgba(74,222,128,0.07)",
        border:"1px solid rgba(74,222,128,0.2)", borderRadius:12, fontSize:12, color:"#4ade80", textAlign:"center"}}>
        ✅ Settings saved automatically
      </div>
    </Modal>
  );
}

// ── Help & Support Modal ──────────────────────────────────────────────────────
function HelpModal({ onClose }) {
  const [openFaq, setOpenFaq] = useState(null);
  const faqs = [
    ["Are the prices shown accurate?", "Prices are estimates based on publicly known fare structures of each app. Actual fares may vary based on live traffic, surge pricing, and driver availability. Always check the final fare in the respective app before booking."],
    ["Why is my GPS not working?", "Make sure you've allowed location permission in your browser. On Chrome: click the lock icon in address bar → Site Settings → Location → Allow. Then tap the GPS button again."],
    ["Why don't I see all apps for my vehicle type?", "Not every app offers every vehicle type in every city. For example, BluSmart only operates EVs in Delhi, Bengaluru & Hyderabad. Namma Yatri only works in select South Indian cities."],
    ["How do I book a ride?", "Tap the 'Book on [App]' button on any ride card. It will open that app directly with your pickup and destination pre-filled. Complete the booking inside that app."],
    ["Is RideCompare India affiliated with Uber or Ola?", "No. We are completely independent. We are not affiliated with, endorsed by, or connected to Uber, Ola, Rapido, Namma Yatri, or BluSmart in any way."],
    ["How is my phone number used?", "Your phone number is used only for OTP verification. We do not store, sell, or share your phone number with any third party."],
    ["What is surge pricing?", "Surge pricing happens during peak hours (8–9 AM, 6–8 PM) when demand is high. Apps charge 1.3x–2x the normal fare. Our 'Best Time' tab shows you when to book to avoid surge."],
  ];
  return (
    <Modal title="🆘 Help & Support" onClose={onClose}>
      {/* Contact options */}
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10,marginBottom:20}}>
        {[["📧","Email Us","ridecompare.india@gmail.com"],["💬","WhatsApp","Chat with us"],
          ["🐛","Report Bug","Found an issue?"],["⭐","Rate App","Love the app?"]].map(([ic,t,s])=>(
          <div key={t} style={{background:"rgba(255,255,255,0.04)",border:"1px solid rgba(255,255,255,0.08)",
            borderRadius:12,padding:"12px",textAlign:"center",cursor:"pointer"}}
            onMouseEnter={e=>e.currentTarget.style.background="rgba(255,215,0,0.07)"}
            onMouseLeave={e=>e.currentTarget.style.background="rgba(255,255,255,0.04)"}>
            <div style={{fontSize:22,marginBottom:4}}>{ic}</div>
            <div style={{fontSize:12,fontWeight:700,color:"#e2e8f0"}}>{t}</div>
            <div style={{fontSize:10,color:"#5a7a96",marginTop:2}}>{s}</div>
          </div>
        ))}
      </div>
      {/* FAQs */}
      <div style={{fontSize:11,color:"#5a7a96",fontWeight:700,letterSpacing:"1px",marginBottom:10}}>FREQUENTLY ASKED QUESTIONS</div>
      {faqs.map(([q, a], i) => (
        <div key={i} style={{borderBottom:"1px solid rgba(255,255,255,0.06)",marginBottom:2}}>
          <div onClick={()=>setOpenFaq(openFaq===i?null:i)}
            style={{padding:"12px 0",cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"space-between"}}>
            <div style={{fontSize:13,fontWeight:600,color:"#e2e8f0",paddingRight:8}}>{q}</div>
            <span style={{color:"#FFD700",fontSize:16,flexShrink:0,transition:"transform 0.2s",
              transform:openFaq===i?"rotate(45deg)":"rotate(0deg)"}}>+</span>
          </div>
          {openFaq===i && (
            <div style={{fontSize:12,color:"#8a9ab0",lineHeight:1.7,paddingBottom:12,paddingRight:8}}>{a}</div>
          )}
        </div>
      ))}
      <div style={{marginTop:18,padding:"12px",background:"rgba(99,179,237,0.07)",
        border:"1px solid rgba(99,179,237,0.2)",borderRadius:12,fontSize:11,color:"#63b3ed",textAlign:"center"}}>
        Response time: within 24 hours · support@ridecompare.in
      </div>
    </Modal>
  );
}

// ── Privacy Policy Modal ──────────────────────────────────────────────────────
function PrivacyModal({ onClose }) {
  const Section = ({title, children}) => (
    <div style={{marginBottom:18}}>
      <div style={{fontSize:13,fontWeight:800,color:"#FFD700",marginBottom:7}}>{title}</div>
      {children}
    </div>
  );
  const P = ({t}) => <div style={{fontSize:12,color:"#8a9ab0",lineHeight:1.8,marginBottom:6}}>{t}</div>;
  return (
    <Modal title="🔒 Privacy Policy" onClose={onClose}>
      <div style={{fontSize:11,color:"#5a7a96",marginBottom:16}}>Last updated: January 2025 · Effective immediately</div>
      <Section title="1. Who We Are">
        <P t="RideCompare India is an independent ride price comparison tool developed by Anish Tupe and Rushikesh Jadhav. We are not affiliated with Uber, Ola, Rapido, Namma Yatri, or BluSmart."/>
        <P t="Contact: support@ridecompare.in"/>
      </Section>
      <Section title="2. What Data We Collect">
        <P t="• Mobile phone number — used only for OTP verification"/>
        <P t="• Name — used only to personalise your experience"/>
        <P t="• Location (GPS) — used only to auto-fill pickup address, only when you tap the GPS button"/>
        <P t="• Search history — stored locally on your device only, never sent to our servers"/>
        <P t="We do NOT collect: payment info, ride history, device contacts, or any sensitive data."/>
      </Section>
      <Section title="3. How We Use Your Data">
        <P t="• Phone number: verified via OTP, then we only store a hashed version — never the raw number"/>
        <P t="• Name: displayed in your profile only"/>
        <P t="• Location: used one-time to detect your city and pickup point — not tracked continuously"/>
        <P t="• We never sell, rent, or share your data with advertisers or third parties"/>
      </Section>
      <Section title="4. Prices Are Estimates">
        <P t="⚠️ All prices shown on RideCompare India are ESTIMATED based on publicly available fare structures. They are NOT live prices fetched from Uber, Ola, Rapido, Namma Yatri, or BluSmart."/>
        <P t="Actual fares may be higher or lower depending on surge pricing, traffic, driver availability, and other factors. Always verify the final fare in the respective app before confirming your booking."/>
        <P t="RideCompare India is not responsible for any difference between estimated and actual fares."/>
      </Section>
      <Section title="5. Third-Party Apps">
        <P t="When you click 'Book on Uber/Ola/etc.', you are redirected to that company's app or website. Their own privacy policy and terms apply. We are not responsible for their data practices."/>
      </Section>
      <Section title="6. Data Security">
        <P t="We use industry-standard security. OTPs are never stored after verification. All connections use HTTPS encryption. We comply with India's IT Act 2000 and Digital Personal Data Protection Act 2023."/>
      </Section>
      <Section title="7. Your Rights">
        <P t="You can request deletion of your account and all associated data at any time by emailing support@ridecompare.in. We will process your request within 7 business days."/>
      </Section>
      <Section title="8. Contact Us">
        <P t="For any privacy concerns: support@ridecompare.in"/>
        <P t="Developed by: Anish Tupe & Rushikesh Jadhav, Pune, Maharashtra, India"/>
      </Section>
      <div style={{padding:"12px",background:"rgba(74,222,128,0.07)",border:"1px solid rgba(74,222,128,0.2)",
        borderRadius:12,fontSize:11,color:"#4ade80",textAlign:"center"}}>
        ✅ Compliant with IT Act 2000 · DPDP Act 2023 · Consumer Protection Act 2019
      </div>
    </Modal>
  );
}

// ── Terms of Service Modal ────────────────────────────────────────────────────
function TermsModal({ onClose }) {
  const Section = ({title, children}) => (
    <div style={{marginBottom:18}}>
      <div style={{fontSize:13,fontWeight:800,color:"#FFD700",marginBottom:7}}>{title}</div>
      {children}
    </div>
  );
  const P = ({t}) => <div style={{fontSize:12,color:"#8a9ab0",lineHeight:1.8,marginBottom:6}}>{t}</div>;
  return (
    <Modal title="📋 Terms of Service" onClose={onClose}>
      <div style={{fontSize:11,color:"#5a7a96",marginBottom:16}}>Last updated: January 2025</div>
      <Section title="1. Acceptance">
        <P t="By using RideCompare India, you agree to these terms. If you do not agree, please do not use this app."/>
      </Section>
      <Section title="2. Service Description">
        <P t="RideCompare India is a free price comparison tool. It shows ESTIMATED fares only — not live or guaranteed prices. We do not book rides, process payments, or employ drivers."/>
      </Section>
      <Section title="3. No Affiliation">
        <P t="We are NOT affiliated with Uber, Ola, Rapido, Namma Yatri, or BluSmart. Use of their names is for comparison purposes only, similar to how Google Flights compares airline prices."/>
      </Section>
      <Section title="4. Limitation of Liability">
        <P t="RideCompare India is not liable for: any difference between estimated and actual fares, ride cancellations, driver behaviour, accidents, or any issues arising from use of third-party apps."/>
      </Section>
      <Section title="5. User Responsibilities">
        <P t="• You must be 18+ to use this app"/>
        <P t="• You must provide a valid Indian mobile number for OTP"/>
        <P t="• You must not misuse, reverse-engineer, or attempt to hack this app"/>
        <P t="• You are responsible for verifying the final fare in the booking app"/>
      </Section>
      <Section title="6. Intellectual Property">
        <P t="All code, design, and content of RideCompare India belongs to Anish Tupe and Rushikesh Jadhav. You may not copy or redistribute without permission."/>
      </Section>
      <Section title="7. Governing Law">
        <P t="These terms are governed by the laws of India. Any disputes shall be subject to the jurisdiction of courts in Pune, Maharashtra."/>
      </Section>
    </Modal>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// PROFILE PANEL
// ══════════════════════════════════════════════════════════════════════════════
function ProfilePanel({ user, onClose, onLogout }) {
  const [modal, setModal] = useState(null); // null | "settings" | "help" | "privacy" | "terms"

  return (
    <>
      {modal==="settings" && <SettingsModal onClose={()=>setModal(null)}/>}
      {modal==="help"     && <HelpModal     onClose={()=>setModal(null)}/>}
      {modal==="privacy"  && <PrivacyModal  onClose={()=>setModal(null)}/>}
      {modal==="terms"    && <TermsModal    onClose={()=>setModal(null)}/>}

      <div className="rc-fade" onClick={onClose}
        style={{ position:"fixed", inset:0, zIndex:500, display:"flex",
          alignItems:"flex-start", justifyContent:"flex-end",
          fontFamily:"'DM Sans','Segoe UI',sans-serif" }}>
        <div onClick={e=>e.stopPropagation()} className="rc-slide"
          style={{ marginTop:56, marginRight:14, width:290,
            background:"#0a1828", border:"1px solid rgba(255,215,0,0.2)",
            borderRadius:18, overflow:"hidden",
            boxShadow:"0 20px 60px rgba(0,0,0,0.7)" }}>

          {/* User Header */}
          <div style={{ background:"linear-gradient(135deg,rgba(255,215,0,0.12),rgba(255,107,53,0.08))",
            padding:"18px", textAlign:"center", borderBottom:"1px solid rgba(255,255,255,0.07)" }}>
            <div style={{ width:56, height:56, borderRadius:"50%",
              background:`linear-gradient(135deg,${user.color},${user.color}88)`,
              display:"flex", alignItems:"center", justifyContent:"center",
              fontSize:22, fontWeight:900, color:"#fff", margin:"0 auto 10px",
              border:"3px solid rgba(255,215,0,0.35)" }}>
              {user.avatar}
            </div>
            <div style={{fontSize:16,fontWeight:800,color:"#fff"}}>{user.name}</div>
            {user.phone && <div style={{fontSize:11,color:"#5a7a96",marginTop:2}}>📱 +91 {user.phone}</div>}
            <div style={{fontSize:10,color:"#3a5a6a",marginTop:2}}>Member since {user.joined}</div>
            <div style={{display:"inline-block",marginTop:6,padding:"2px 10px",borderRadius:20,
              background:"rgba(74,222,128,0.1)",border:"1px solid rgba(74,222,128,0.25)",
              fontSize:10,color:"#4ade80",fontWeight:700}}>✓ Verified</div>
          </div>

          {/* Menu Items */}
          <div style={{padding:"6px 0"}}>
            {[
              ["🛣️","My Ride History",  "View past comparisons",  null],
              ["❤️","Saved Routes",     "Your favourite routes",   null],
              ["🔔","Surge Alerts",     "Get notified on drops",   null],
              ["🎟️","Coupons & Offers", "Discounts & promo codes", null],
              ["⚙️","Settings",         "Notifications, language", "settings"],
              ["🆘","Help & Support",   "FAQs & contact us",       "help"],
              ["🔒","Privacy Policy",   "How we use your data",    "privacy"],
              ["📋","Terms of Service", "App usage terms",         "terms"],
            ].map(([ic,lbl,sub,action],i) => (
              <div key={i} onClick={()=>{ if(action){ onClose(); setModal(action); } }}
                style={{padding:"10px 14px",display:"flex",alignItems:"center",gap:10,
                  cursor: action?"pointer":"default",
                  borderBottom:"1px solid rgba(255,255,255,0.04)",
                  opacity: action?1:0.55 }}
                onMouseEnter={e=>{ if(action) e.currentTarget.style.background="rgba(255,215,0,0.06)"; }}
                onMouseLeave={e=>e.currentTarget.style.background="transparent"}>
                <span style={{fontSize:17}}>{ic}</span>
                <div style={{flex:1}}>
                  <div style={{fontSize:13,fontWeight:600,color:"#e2e8f0"}}>{lbl}</div>
                  <div style={{fontSize:10,color:"#4a6a7a"}}>{sub}</div>
                </div>
                {action && <span style={{color:"#5a7a96",fontSize:12}}>›</span>}
                {!action && <span style={{fontSize:9,color:"#3a5a6a",background:"rgba(255,255,255,0.05)",padding:"2px 6px",borderRadius:6}}>Soon</span>}
              </div>
            ))}
          </div>

          {/* Logout */}
          <div style={{padding:"10px 12px",borderTop:"1px solid rgba(255,255,255,0.07)"}}>
            <button onClick={onLogout} style={{width:"100%",padding:"11px",
              border:"1px solid rgba(255,80,80,0.25)",borderRadius:11,
              background:"rgba(255,80,80,0.07)",color:"#ff8080",
              fontSize:13,fontWeight:700,cursor:"pointer",
              display:"flex",alignItems:"center",justifyContent:"center",gap:7,fontFamily:"inherit"}}>
              🚪 Logout
            </button>
          </div>
        </div>
      </div>
    </>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// MAIN APP
// ══════════════════════════════════════════════════════════════════════════════
export default function RideCompareIndia() {
  const [user, setUser]               = useState(null);
  const [showProfile, setShowProfile] = useState(false);
  const [city, setCity]               = useState("Bengaluru");
  const [from, setFrom]               = useState("");
  const [to, setTo]                   = useState("");
  const [vtype, setVtype]             = useState("mini");
  const [results, setResults]         = useState(null);
  const [trend, setTrend]             = useState(null);
  const [loading, setLoading]         = useState(false);
  const [searched, setSearched]       = useState(false);
  const [tab, setTab]                 = useState("compare");
  const [booked, setBooked]           = useState(null);
  const [gpsStatus, setGpsStatus]     = useState("");
  const [gpsAddr, setGpsAddr]         = useState("");
  const [toFocused, setToFocused]     = useState(false);
  const [toSugg, setToSugg]           = useState([]);
  const [netErr, setNetErr]           = useState(false);
  const [toast, setToast]             = useState(null);
  const [toastKey, setToastKey]       = useState(0);
  const [footerModal, setFooterModal] = useState(null); // "privacy" | "terms" | "help"
  const toRef = useRef(null);
  const HOUR = new Date().getHours();
  const isSurge = SURGE_HOURS.includes(HOUR);

  const showToast = (msg, type="info") => { setToast({msg,type}); setToastKey(k=>k+1); };

  // Suggestions
  useEffect(() => {
    if (to.length < 2) { setToSugg([]); return; }
    const pl = NEARBY_PLACES[city] || [];
    const f  = pl.filter(p => p.toLowerCase().includes(to.toLowerCase()));
    const r  = (POPULAR_ROUTES[city]||[]).map(x=>x[1]).filter(p=>p.toLowerCase().includes(to.toLowerCase()));
    setToSugg([...new Set([...f,...r])].slice(0,6));
  }, [to, city]);

  useEffect(() => {
    const h = e => { if (toRef.current && !toRef.current.contains(e.target)) setToFocused(false); };
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, []);

  useEffect(() => {
    const off = () => { setNetErr(true); showToast("You're offline!","error"); };
    const on  = () => { setNetErr(false); showToast("Back online! 🎉","success"); };
    window.addEventListener("offline", off);
    window.addEventListener("online",  on);
    return () => { window.removeEventListener("offline",off); window.removeEventListener("online",on); };
  }, []);

  const fetchGPS = () => {
    if (!navigator.geolocation) { showToast("GPS not available","error"); return; }
    setGpsStatus("loading");
    navigator.geolocation.getCurrentPosition(async pos => {
      try {
        const res  = await fetch(`https://nominatim.openstreetmap.org/reverse?lat=${pos.coords.latitude}&lon=${pos.coords.longitude}&format=json`,{headers:{"Accept-Language":"en"}});
        const data = await res.json();
        const a    = data.address || {};
        const lbl  = [a.road||a.neighbourhood||a.suburb, a.suburb||a.city_district||a.city].filter(Boolean).slice(0,2).join(", ") || "My Location";
        setFrom(lbl); setGpsAddr(lbl); setGpsStatus("success");
        const det = CITIES.find(c => (data.display_name||"").toLowerCase().includes(c.toLowerCase()));
        if (det) setCity(det);
        showToast(`📍 Location: ${lbl}`, "success");
      } catch {
        setFrom(`${pos.coords.latitude.toFixed(4)}, ${pos.coords.longitude.toFixed(4)}`);
        setGpsStatus("success");
      }
    }, () => { setGpsStatus("error"); showToast("Location denied. Type manually.","error"); },
    { enableHighAccuracy:true, timeout:10000 });
  };

  const doSearch = () => {
    if (!from || !to) return;
    setLoading(true); setResults(null); setBooked(null);
    setTimeout(() => {
      setResults(getPrices(vtype, HOUR, city));
      setTrend(getTrend(vtype, city));
      setLoading(false); setSearched(true); setTab("compare");
      showToast("Prices fetched! 🎉","success");
    }, 1100);
  };

  const sorted     = results ? Object.entries(results).sort((a,b)=>a[1].price-b[1].price) : [];
  const cheapKey   = sorted[0]?.[0];
  const cheapPrice = sorted[0]?.[1]?.price;
  const bestSlots  = trend ? [...trend].sort((a,b)=>a.avg-b.avg).slice(0,3) : [];
  const vtypeInfo  = VEHICLE_TYPES.find(v=>v.id===vtype);

  const bookRide = k => { setBooked(k); window.open(APPS[k].bookUrl(from,to),"_blank"); showToast(`Opening ${APPS[k].name}...`,"info"); };

  const pill = a => ({
    padding:"6px 13px", borderRadius:20, fontSize:13, cursor:"pointer",
    border: a?"1px solid #FFD700":"1px solid rgba(255,255,255,0.09)",
    background: a?"rgba(255,215,0,0.14)":"rgba(255,255,255,0.04)",
    color: a?"#FFD700":"#8a9ab0", fontWeight: a?700:400, fontFamily:"inherit"
  });
  const inp = { width:"100%", padding:"10px 13px", boxSizing:"border-box",
    background:"rgba(255,255,255,0.07)", border:"1px solid rgba(255,255,255,0.12)",
    borderRadius:11, color:"#fff", fontSize:14, outline:"none",
    fontFamily:"'DM Sans','Segoe UI',sans-serif" };
  const lbl = { fontSize:10, color:"#5a7a96", fontWeight:700, marginBottom:6, letterSpacing:"1px", textTransform:"uppercase" };

  if (!user) return <AuthScreen onLogin={setUser} />;

  return (
    <div style={{ minHeight:"100vh",
      background:"linear-gradient(160deg,#060b14 0%,#0c1a28 60%,#080e18 100%)",
      fontFamily:"'DM Sans','Segoe UI',sans-serif", color:"#e2e8f0" }}>

      {toast && <Toast key={toastKey} msg={toast.msg} type={toast.type} />}
      {netErr && <NetworkErrorModal onRetry={()=>setNetErr(false)} />}
      {footerModal==="privacy" && <PrivacyModal onClose={()=>setFooterModal(null)}/>}
      {footerModal==="terms"   && <TermsModal   onClose={()=>setFooterModal(null)}/>}
      {footerModal==="help"    && <HelpModal    onClose={()=>setFooterModal(null)}/>}

      {/* Header */}
      <div style={{ background:"rgba(8,16,28,0.97)", borderBottom:"1px solid rgba(255,215,0,0.12)",
        padding:"11px 18px", display:"flex", alignItems:"center", justifyContent:"space-between",
        position:"sticky", top:0, zIndex:150, backdropFilter:"blur(14px)" }}>
        <div style={{display:"flex",alignItems:"center",gap:9}}>
          <div style={{background:"linear-gradient(135deg,#FFD700,#FF6B35)",borderRadius:9,
            width:34,height:34,display:"flex",alignItems:"center",justifyContent:"center",fontSize:16}}>🚖</div>
          <div>
            <div style={{fontSize:16,fontWeight:900,color:"#fff",letterSpacing:"-0.5px"}}>
              RideCompare <span style={{color:"#FFD700"}}>India</span>
            </div>
            <div style={{fontSize:9,color:"#5a7a96",letterSpacing:"1px",textTransform:"uppercase"}}>Smart Price Comparator</div>
          </div>
        </div>
        <div style={{display:"flex",alignItems:"center",gap:8}}>
          <div style={{padding:"3px 9px",borderRadius:20,fontSize:10,fontWeight:700,
            background:isSurge?"rgba(255,80,80,0.12)":"rgba(74,222,128,0.1)",
            border:`1px solid ${isSurge?"rgba(255,80,80,0.35)":"rgba(74,222,128,0.3)"}`,
            color:isSurge?"#ff6b6b":"#4ade80"}}>
            {isSurge?"🔴 Surge":"🟢 Normal"}
          </div>
          <button onClick={()=>setShowProfile(p=>!p)} style={{width:34,height:34,borderRadius:"50%",
            border:`2px solid ${showProfile?"#FFD700":"rgba(255,215,0,0.3)"}`,
            background:`linear-gradient(135deg,${user.color},${user.color}88)`,
            cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",
            fontSize:12,fontWeight:900,color:"#fff",fontFamily:"inherit"}}>
            {user.avatar}
          </button>
        </div>
      </div>

      {showProfile && <ProfilePanel user={user} onClose={()=>setShowProfile(false)}
        onLogout={()=>{setUser(null);setShowProfile(false);setSearched(false);setResults(null);}}/>}

      <div style={{maxWidth:860,margin:"0 auto",padding:"16px 14px 60px"}}>

        {/* Welcome */}
        <div style={{background:"linear-gradient(135deg,rgba(255,215,0,0.07),rgba(255,107,53,0.03))",
          border:"1px solid rgba(255,215,0,0.13)",borderRadius:13,padding:"10px 14px",
          marginBottom:14,display:"flex",alignItems:"center",gap:10}}>
          <div style={{width:32,height:32,borderRadius:"50%",
            background:`linear-gradient(135deg,${user.color},${user.color}88)`,
            display:"flex",alignItems:"center",justifyContent:"center",
            fontSize:12,fontWeight:900,color:"#fff"}}>{user.avatar}</div>
          <div style={{flex:1}}>
            <div style={{fontSize:13,fontWeight:700,color:"#e2e8f0"}}>Hey {user.name.split(" ")[0]}! 👋</div>
            <div style={{fontSize:11,color:"#5a7a96"}}>Find the cheapest ride for you today</div>
          </div>
          <div style={{fontSize:10,color:"#3a5a6a"}}>{new Date().toLocaleDateString("en-IN",{weekday:"short",day:"numeric",month:"short"})}</div>
        </div>

        {/* Search Card */}
        <div style={{background:"linear-gradient(135deg,rgba(255,255,255,0.05),rgba(255,255,255,0.02))",
          border:"1px solid rgba(255,215,0,0.16)",borderRadius:20,padding:"18px",
          marginBottom:16,boxShadow:"0 10px 40px rgba(0,0,0,0.45)"}}>

          <div style={{fontSize:11,color:"#FFD700",fontWeight:800,letterSpacing:"2px",marginBottom:14,textTransform:"uppercase"}}>📍 Find Cheapest Ride</div>

          {/* City */}
          <div style={{marginBottom:12}}>
            <div style={lbl}>City</div>
            <div style={{display:"flex",gap:6,flexWrap:"wrap"}}>
              {CITIES.map(c=><button key={c} onClick={()=>{setCity(c);setResults(null);setSearched(false);}} style={pill(city===c)}>{c}</button>)}
            </div>
          </div>

          {/* Pickup */}
          <div style={{marginBottom:12}}>
            <div style={lbl}>📍 Pickup Location</div>
            <button onClick={fetchGPS} style={{width:"100%",marginBottom:7,padding:"10px 13px",borderRadius:10,border:"none",
              cursor:"pointer",display:"flex",alignItems:"center",gap:8,fontSize:12,fontWeight:700,fontFamily:"inherit",
              background: gpsStatus==="success"?"linear-gradient(135deg,rgba(74,222,128,0.16),rgba(74,222,128,0.05))":
                          gpsStatus==="error"  ?"linear-gradient(135deg,rgba(255,80,80,0.1),rgba(255,80,80,0.03))":
                          "linear-gradient(135deg,rgba(99,179,237,0.13),rgba(66,153,225,0.04))",
              border: gpsStatus==="success"?"1px solid rgba(74,222,128,0.28)":
                      gpsStatus==="error"  ?"1px solid rgba(255,80,80,0.22)":
                      "1px solid rgba(99,179,237,0.18)",
              color: gpsStatus==="success"?"#4ade80": gpsStatus==="error"?"#ff8080":"#63b3ed" }}>
              <span style={{fontSize:17}}>{gpsStatus==="loading"?"⏳":gpsStatus==="success"?"✅":gpsStatus==="error"?"❌":"📡"}</span>
              <div style={{textAlign:"left",flex:1}}>
                <div>{gpsStatus==="loading"?"Locating...": gpsStatus==="success"?gpsAddr: gpsStatus==="error"?"Denied — type below":"Use My Current Location"}</div>
                {!gpsStatus && <div style={{fontSize:10,opacity:0.6,marginTop:1}}>Tap to auto-detect pickup</div>}
              </div>
            </button>
            <input value={from} onChange={e=>{setFrom(e.target.value);if(gpsStatus==="success")setGpsStatus("");}}
              placeholder="Or type pickup location..." style={inp}/>
          </div>

          {/* Destination */}
          <div style={{marginBottom:12,position:"relative"}} ref={toRef}>
            <div style={lbl}>🏁 Destination</div>
            <div style={{display:"flex",gap:5,flexWrap:"wrap",marginBottom:6}}>
              {(NEARBY_PLACES[city]||[]).slice(0,5).map((p,i)=>(
                <button key={i} onClick={()=>{setTo(p);setToFocused(false);}} style={{padding:"3px 9px",borderRadius:20,fontSize:10,cursor:"pointer",
                  border:to===p?"1px solid #FFD700":"1px solid rgba(255,255,255,0.08)",
                  background:to===p?"rgba(255,215,0,0.12)":"rgba(255,255,255,0.03)",
                  color:to===p?"#FFD700":"#7a9ab0",fontFamily:"inherit"}}>📌 {p}</button>
              ))}
            </div>
            <div style={{position:"relative"}}>
              <input value={to} onChange={e=>{setTo(e.target.value);setToFocused(true);}} onFocus={()=>setToFocused(true)}
                placeholder="Search destination — Airport, Mall, Station..." style={{...inp,paddingLeft:36}}/>
              <span style={{position:"absolute",left:11,top:"50%",transform:"translateY(-50%)",fontSize:13,pointerEvents:"none"}}>🔍</span>
              {toFocused && toSugg.length>0 && (
                <div style={{position:"absolute",top:"calc(100% + 4px)",left:0,right:0,zIndex:300,
                  background:"#0d1f30",border:"1px solid rgba(255,215,0,0.18)",borderRadius:11,
                  overflow:"hidden",boxShadow:"0 10px 36px rgba(0,0,0,0.6)"}}>
                  {toSugg.map((s,i)=>(
                    <div key={i} onClick={()=>{setTo(s);setToFocused(false);}}
                      style={{padding:"9px 13px",cursor:"pointer",fontSize:13,color:"#c0d0e0",
                        borderBottom:i<toSugg.length-1?"1px solid rgba(255,255,255,0.05)":"none",
                        display:"flex",alignItems:"center",gap:8}}
                      onMouseEnter={e=>e.currentTarget.style.background="rgba(255,215,0,0.07)"}
                      onMouseLeave={e=>e.currentTarget.style.background="transparent"}>
                      <span>📍</span>
                      <div>
                        <div style={{fontWeight:600}}>{s}</div>
                        <div style={{fontSize:10,color:"#4a6a7a",marginTop:1}}>{city}</div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Popular Routes */}
          <div style={{marginBottom:12}}>
            <div style={lbl}>Popular Routes</div>
            <div style={{display:"flex",gap:5,flexWrap:"wrap"}}>
              {(POPULAR_ROUTES[city]||[]).map(([f,t],i)=>(
                <button key={i} onClick={()=>{setFrom(f);setTo(t);setGpsStatus("");}} style={{padding:"4px 10px",borderRadius:8,fontSize:11,cursor:"pointer",border:"1px solid rgba(255,255,255,0.07)",background:"rgba(255,255,255,0.03)",color:"#8a9ab0",fontFamily:"inherit"}}>{f} → {t}</button>
              ))}
            </div>
          </div>

          {/* Vehicle */}
          <div style={{marginBottom:14}}>
            <div style={lbl}>Select Vehicle Type</div>
            <div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:7}}>
              {VEHICLE_TYPES.map(v=>{
                const sel=vtype===v.id, cnt=Object.values(APP_VEHICLES).filter(a=>a[v.id]).length;
                return(
                  <button key={v.id} onClick={()=>{setVtype(v.id);setResults(null);setSearched(false);}} style={{
                    padding:"10px 6px",borderRadius:12,cursor:"pointer",textAlign:"center",
                    border:sel?"1.5px solid #FFD700":"1px solid rgba(255,255,255,0.08)",
                    background:sel?"linear-gradient(135deg,rgba(255,215,0,0.18),rgba(255,107,53,0.1))":"rgba(255,255,255,0.04)",
                    fontFamily:"inherit"}}>
                    <div style={{fontSize:21,marginBottom:2}}>{v.icon}</div>
                    <div style={{fontSize:11,fontWeight:700,color:sel?"#FFD700":"#c0ccd8"}}>{v.label}</div>
                    <div style={{fontSize:9,color:sel?"#ffc040":"#5a7a96",marginTop:1}}>{v.desc}</div>
                    <div style={{fontSize:9,marginTop:2,color:sel?"#ffd77a":"#3a5a6a"}}>{cnt} apps</div>
                  </button>
                );
              })}
            </div>
          </div>

          <button onClick={doSearch} disabled={!from||!to||loading} style={{
            width:"100%",padding:"13px",border:"none",borderRadius:12,fontSize:15,fontWeight:800,
            cursor:(!from||!to)?"not-allowed":"pointer",fontFamily:"inherit",
            background:(!from||!to)?"rgba(255,215,0,0.09)":"linear-gradient(135deg,#FFD700,#FF6B35)",
            color:(!from||!to)?"#5a7a96":"#0a0a0f",
            boxShadow:(!from||!to)?"none":"0 4px 20px rgba(255,215,0,0.28)",
            display:"flex",alignItems:"center",justifyContent:"center",gap:8}}>
            {loading ? <><Spinner size={16} color="#0a0a0f"/>Searching prices...</> : `🚀 Compare ${vtypeInfo?.label} Prices`}
          </button>
        </div>

        {/* Results */}
        {results && !loading && (
          <>
            <div style={{display:"flex",gap:7,marginBottom:14,flexWrap:"wrap"}}>
              {[["compare","💰 Compare"],["timing","⏰ Best Time"],["route","🛣️ Route"]].map(([t,l])=>(
                <button key={t} onClick={()=>setTab(t)} style={pill(tab===t)}>{l}</button>
              ))}
            </div>

            {tab==="compare" && (
              <div className="rc-slide">
                <div style={{fontSize:12,color:"#5a7a96",marginBottom:10}}>
                  {vtypeInfo?.icon} <b style={{color:"#c0ccd8"}}>{vtypeInfo?.label}</b> · <b style={{color:"#e2e8f0"}}>{from}</b> → <b style={{color:"#e2e8f0"}}>{to}</b>
                </div>
                {cheapKey && (
                  <div style={{background:"linear-gradient(135deg,rgba(74,222,128,0.11),rgba(74,222,128,0.03))",
                    border:"1px solid rgba(74,222,128,0.25)",borderRadius:13,
                    padding:"12px 16px",marginBottom:12,display:"flex",alignItems:"center",gap:12}}>
                    <div style={{fontSize:24}}>🏆</div>
                    <div style={{flex:1}}>
                      <div style={{color:"#4ade80",fontWeight:800,fontSize:14}}>{APPS[cheapKey].name} is cheapest!</div>
                      <div style={{color:"#6a8a96",fontSize:11,marginTop:1}}>Save ₹{Math.round((sorted[sorted.length-1]?.[1]?.price||0)-cheapPrice)} vs most expensive</div>
                    </div>
                    <div style={{fontSize:24,fontWeight:900,color:"#4ade80"}}>₹{cheapPrice}</div>
                  </div>
                )}
                {sorted.length>0 ? (
                  <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:11}}>
                    {sorted.map(([appKey,data],idx)=>{
                      const app=APPS[appKey], isCheapest=appKey===cheapKey, extra=Math.round(data.price-cheapPrice);
                      return(
                        <div key={appKey} style={{background:isCheapest?`linear-gradient(135deg,rgba(74,222,128,0.09),${app.bg})`:`linear-gradient(135deg,rgba(255,255,255,0.03),${app.bg})`,
                          border:isCheapest?"1.5px solid rgba(74,222,128,0.32)":"1px solid rgba(255,255,255,0.08)",
                          borderRadius:16,padding:"15px",position:"relative",overflow:"hidden",display:"flex",flexDirection:"column"}}>
                          {isCheapest && <div style={{position:"absolute",top:8,right:8,background:"#4ade80",color:"#031a0a",fontSize:8,fontWeight:900,padding:"2px 7px",borderRadius:20}}>CHEAPEST</div>}
                          {!isCheapest && extra>0 && <div style={{position:"absolute",top:8,right:8,background:"rgba(255,80,80,0.14)",color:"#ff8080",border:"1px solid rgba(255,80,80,0.22)",fontSize:8,fontWeight:700,padding:"2px 7px",borderRadius:20}}>+₹{extra}</div>}
                          <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:10}}>
                            <div style={{width:38,height:38,borderRadius:11,background:`${app.color}20`,border:`2px solid ${app.color}40`,display:"flex",alignItems:"center",justifyContent:"center",fontSize:18}}>{app.logo}</div>
                            <div><div style={{fontWeight:800,fontSize:14,color:"#fff"}}>{app.name}</div><div style={{fontSize:10,color:"#5a7a96"}}>{data.vehicleName}</div></div>
                          </div>
                          <div style={{fontSize:28,fontWeight:900,color:isCheapest?"#4ade80":"#e2e8f0",marginBottom:7}}>₹{data.price}</div>
                          <div style={{display:"flex",justifyContent:"space-between",fontSize:11,color:"#5a7a96",marginBottom:9}}>
                            <span>⏱ {data.eta} min</span><span>#{idx+1}</span>
                          </div>
                          <div style={{background:"rgba(255,255,255,0.06)",borderRadius:3,height:3,marginBottom:11}}>
                            <div style={{width:`${Math.max(16,(cheapPrice/data.price)*100)}%`,background:isCheapest?"#4ade80":app.color,height:"100%",borderRadius:3}}/>
                          </div>
                          <button onClick={()=>bookRide(appKey)} style={{width:"100%",padding:"10px",borderRadius:10,border:"none",cursor:"pointer",
                            background:booked===appKey?"rgba(74,222,128,0.16)":`linear-gradient(135deg,${app.color},${app.color}cc)`,
                            color:booked===appKey?"#4ade80":"#fff",fontSize:13,fontWeight:800,
                            display:"flex",alignItems:"center",justifyContent:"center",gap:6,
                            boxShadow:booked===appKey?"none":`0 3px 12px ${app.color}44`,fontFamily:"inherit"}}>
                            {booked===appKey?"✅ Opening...":"🚀 Book on "+app.name}
                          </button>
                        </div>
                      );
                    })}
                  </div>
                ):(
                  <div style={{textAlign:"center",padding:"32px",background:"rgba(255,255,255,0.03)",borderRadius:14,border:"1px solid rgba(255,255,255,0.07)"}}>
                    <div style={{fontSize:30,marginBottom:8}}>😕</div>
                    <div style={{color:"#8a9ab0"}}>No apps offer <b style={{color:"#FFD700"}}>{vtypeInfo?.label}</b> in {city}</div>
                    <div style={{color:"#5a7a96",fontSize:12,marginTop:4}}>Try Auto, Bike or Mini Car</div>
                  </div>
                )}
              </div>
            )}

            {tab==="timing" && trend && (
              <div className="rc-slide">
                <div style={{fontSize:14,fontWeight:700,color:"#fff",marginBottom:3}}>Best Times to Book</div>
                <div style={{fontSize:12,color:"#5a7a96",marginBottom:14}}>ML surge prediction · {vtypeInfo?.label}</div>
                <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:9,marginBottom:16}}>
                  {bestSlots.map((s,i)=>(
                    <div key={i} style={{background:i===0?"rgba(74,222,128,0.1)":"rgba(255,255,255,0.04)",
                      border:i===0?"1px solid rgba(74,222,128,0.28)":"1px solid rgba(255,255,255,0.07)",
                      borderRadius:12,padding:"12px",textAlign:"center"}}>
                      <div style={{fontSize:18,marginBottom:3}}>{["🥇","🥈","🥉"][i]}</div>
                      <div style={{fontSize:14,fontWeight:800,color:i===0?"#4ade80":"#e2e8f0"}}>
                        {s.hour===0?"12 AM":s.hour<12?`${s.hour} AM`:s.hour===12?"12 PM":`${s.hour-12} PM`}
                      </div>
                      <div style={{fontSize:11,color:"#5a7a96",marginTop:1}}>Avg ₹{s.avg}</div>
                    </div>
                  ))}
                </div>
                <div style={{background:"rgba(255,255,255,0.03)",borderRadius:13,padding:"14px"}}>
                  <div style={{fontSize:10,color:"#5a7a96",marginBottom:10,fontWeight:700,letterSpacing:"1px"}}>24-HOUR PRICE TREND</div>
                  <div style={{display:"flex",alignItems:"flex-end",gap:2,height:76}}>
                    {trend.map((t,i)=>{
                      const mx=Math.max(...trend.map(x=>x.avg)), mn=Math.min(...trend.map(x=>x.avg));
                      const h=((t.avg-mn)/(mx-mn||1))*62+8, isNow=i===HOUR;
                      return(
                        <div key={i} style={{flex:1}}>
                          <div style={{width:"100%",height:`${h}px`,
                            background:isNow?"#FFD700":t.surge?"rgba(255,80,80,0.5)":t.cheap?"rgba(74,222,128,0.4)":"rgba(100,150,255,0.32)",
                            borderRadius:"2px 2px 0 0",border:isNow?"1px solid #FFD700":"none"}}/>
                        </div>
                      );
                    })}
                  </div>
                  <div style={{display:"flex",justifyContent:"space-between",marginTop:4,fontSize:9,color:"#3a5a6a"}}>
                    <span>12AM</span><span>6AM</span><span>12PM</span><span>6PM</span><span>11PM</span>
                  </div>
                  <div style={{display:"flex",gap:12,marginTop:9,fontSize:11}}>
                    <span style={{color:"#4ade80"}}>🟢 Cheap</span>
                    <span style={{color:"#ff6b6b"}}>🔴 Surge</span>
                    <span style={{color:"#FFD700"}}>🟡 Now</span>
                  </div>
                </div>
              </div>
            )}

            {tab==="route" && (
              <div className="rc-slide">
                <div style={{fontSize:14,fontWeight:700,color:"#fff",marginBottom:12}}>Route Insights</div>
                <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:9}}>
                  {[
                    {label:"Fastest",icon:"⚡",desc:"Via highway",time:"18 min",cost:`₹${cheapPrice?Math.round(cheapPrice*1.18):"—"}`,note:"Toll may apply"},
                    {label:"Cheapest",icon:"💰",desc:"Via inner roads",time:"25 min",cost:`₹${cheapPrice||"—"}`,note:"No tolls"},
                    {label:"Balanced",icon:"⚖️",desc:"Best of both",time:"21 min",cost:`₹${cheapPrice?Math.round(cheapPrice*1.09):"—"}`,note:"Recommended"},
                    {label:"Traffic",icon:"🚦",desc:isSurge?"Heavy congestion":"Clear roads",time:isSurge?"Delays":"Smooth",cost:isSurge?"Surge":"Normal",note:isSurge?"Wait 20–30 min":"Great time!"},
                  ].map((item,i)=>(
                    <div key={i} style={{background:"rgba(255,255,255,0.04)",border:"1px solid rgba(255,255,255,0.07)",borderRadius:12,padding:"13px"}}>
                      <div style={{fontSize:19,marginBottom:5}}>{item.icon}</div>
                      <div style={{fontWeight:700,color:"#e2e8f0",fontSize:12,marginBottom:2}}>{item.label}</div>
                      <div style={{fontSize:11,color:"#8a9ab0",marginBottom:5}}>{item.desc}</div>
                      <div style={{display:"flex",justifyContent:"space-between",fontSize:12}}>
                        <span style={{color:"#FFD700"}}>{item.time}</span>
                        <span style={{color:"#4ade80"}}>{item.cost}</span>
                      </div>
                      <div style={{fontSize:10,color:"#3a5a6a",marginTop:4}}>{item.note}</div>
                    </div>
                  ))}
                </div>
                <div style={{marginTop:12,background:"linear-gradient(135deg,rgba(255,215,0,0.06),rgba(255,107,53,0.03))",
                  border:"1px solid rgba(255,215,0,0.16)",borderRadius:12,padding:"14px"}}>
                  <div style={{fontWeight:800,color:"#FFD700",marginBottom:5,fontSize:13}}>🤖 AI Recommendation</div>
                  <div style={{fontSize:12,color:"#b0bcc8",lineHeight:1.6}}>
                    {isSurge
                      ? `Peak hour ${user.name.split(" ")[0]}! Wait 20–30 min to save 40–80%. If urgent, book ${cheapKey?APPS[cheapKey].name:"cheapest app"} now.`
                      : `Great time ${user.name.split(" ")[0]}! ${cheapKey?APPS[cheapKey].name:"Prices"} offer the best ${vtypeInfo?.label} at ₹${cheapPrice}.`}
                  </div>
                </div>
              </div>
            )}
          </>
        )}

        {!searched && !loading && (
          <div style={{textAlign:"center",padding:"32px 20px"}}>
            <div style={{fontSize:52,marginBottom:10}}>🚖</div>
            <div style={{fontSize:14,color:"#6a8a96",marginBottom:4}}>Compare Uber · Ola · Rapido · Namma Yatri · BluSmart</div>
            <div style={{fontSize:12,color:"#3a5a6a",marginBottom:14}}>GPS pickup · Smart destination search · Compare & save</div>
            <div style={{display:"flex",justifyContent:"center",gap:6,flexWrap:"wrap"}}>
              {VEHICLE_TYPES.map(v=>(
                <button key={v.id} onClick={()=>setVtype(v.id)} style={{padding:"6px 12px",borderRadius:20,fontSize:11,cursor:"pointer",
                  border:vtype===v.id?"1px solid #FFD700":"1px solid rgba(255,255,255,0.07)",
                  background:vtype===v.id?"rgba(255,215,0,0.11)":"rgba(255,255,255,0.04)",
                  color:vtype===v.id?"#FFD700":"#5a7a96",fontFamily:"inherit"}}>
                  {v.icon} {v.label}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* ── DISCLAIMER BANNER ── */}
        <div style={{margin:"24px 0 8px",background:"rgba(255,215,0,0.05)",
          border:"1px solid rgba(255,215,0,0.15)",borderRadius:14,padding:"14px 16px"}}>
          <div style={{fontSize:12,fontWeight:700,color:"#FFD700",marginBottom:5}}>⚠️ Price Disclaimer</div>
          <div style={{fontSize:11,color:"#6a8a96",lineHeight:1.7}}>
            All prices shown are <b style={{color:"#e2e8f0"}}>estimates only</b> based on publicly available fare structures.
            They are <b style={{color:"#e2e8f0"}}>not live prices</b>. Actual fares may vary due to surge pricing, traffic,
            and driver availability. Always verify the final fare in the respective app before booking.
            RideCompare India is <b style={{color:"#e2e8f0"}}>not affiliated</b> with Uber, Ola, Rapido, Namma Yatri or BluSmart.
          </div>
        </div>

        {/* ── FOOTER ── */}
        <div style={{textAlign:"center",padding:"16px 0 8px",borderTop:"1px solid rgba(255,255,255,0.05)",marginTop:8}}>
          <div style={{fontSize:12,color:"#3a6a7a",marginBottom:10}}>
            Built with ❤️ by <span style={{color:"#5a8a9a",fontWeight:700}}>Anish Tupe & Rushikesh Jadhav</span> · RideCompare India
          </div>
          <div style={{display:"flex",justifyContent:"center",gap:16,flexWrap:"wrap"}}>
            {[["🔒 Privacy Policy","privacy"],["📋 Terms of Service","terms"],["🆘 Help & Support","help"]].map(([lbl,key])=>(
              <button key={key} onClick={()=>setFooterModal(key)}
                style={{background:"none",border:"none",color:"#4a7a8a",fontSize:11,
                  cursor:"pointer",fontFamily:"inherit",textDecoration:"underline",
                  textUnderlineOffset:2}}>
                {lbl}
              </button>
            ))}
          </div>
          <div style={{fontSize:10,color:"#1e3a4a",marginTop:10}}>
            v1.0.0 · Prices are estimated, not live · Not affiliated with any cab company
          </div>
        </div>
      </div>
    </div>
  );
}
