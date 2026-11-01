import "dotenv/config";
import express from "express";
import session from "express-session";
import bcrypt from "bcryptjs";
import helmet from "helmet";
import cron from "node-cron";
import fs from "node:fs/promises";
import path from "node:path";
const app=express(), PORT=process.env.PORT||3000, DATA_FILE=process.env.DATA_FILE||"./dashboard-data.json";
app.use(helmet({contentSecurityPolicy:{directives:{defaultSrc:["'self'"],styleSrc:["'self'","'unsafe-inline'"],scriptSrc:["'self'"],imgSrc:["'self'","data:"]}}}));
app.use(express.urlencoded({extended:false,limit:"10kb"})); app.use(express.json({limit:"50kb"}));
app.use(session({secret:process.env.SESSION_SECRET||"dev-only-change-me",resave:false,saveUninitialized:false,cookie:{httpOnly:true,secure:process.env.NODE_ENV==="production",sameSite:"strict",maxAge:8*60*60*1000}}));
const auth=(req,res,next)=>req.session?.authenticated?next():res.redirect("/login");
async function snapshot(){try{return JSON.parse(await fs.readFile(DATA_FILE,"utf8"))}catch{return {lastUpdated:null,sources:{salla:{status:"not_connected"},ga4:{status:"not_connected"},googleAds:{status:"not_connected"},tiktok:{status:"not_connected"},snapchat:{status:"not_connected"}},note:"لم يتم ربط مصادر البيانات بعد. لا توجد أرقام مباشرة معروضة."}}}
async function refreshData(){const d=await snapshot();d.refreshAttemptAt=new Date().toISOString();d.refreshStatus="awaiting_provider_configuration";await fs.writeFile(DATA_FILE,JSON.stringify(d,null,2),{mode:0o600});}
app.get("/health",(_,res)=>res.json({ok:true}));
app.get("/login",(_,res)=>res.sendFile(path.resolve("public/login.html")));
app.post("/login",async(req,res)=>{const h=process.env.VIEWER_PASSWORD_HASH;if(!h||!req.body.password)return res.status(503).send("لم يتم إعداد كلمة المرور بعد.");if(!await bcrypt.compare(req.body.password,h))return res.status(401).send("كلمة المرور غير صحيحة. <a href='/login'>حاول مجددًا</a>");req.session.authenticated=true;res.redirect("/")});
app.post("/logout",(req,res)=>req.session.destroy(()=>res.redirect("/login")));
app.get("/",auth,(_,res)=>res.sendFile(path.resolve("public/index.html")));
app.get("/api/dashboard",auth,async(_,res)=>{res.set("Cache-Control","no-store");res.json(await snapshot())});
app.post("/api/refresh",auth,(_,res)=>res.status(202).json({accepted:true,message:"موصلات البيانات تحتاج إلى الإعداد أولًا."}));
const schedule=process.env.DATA_REFRESH_CRON||"0 5 * * *";if(cron.validate(schedule))cron.schedule(schedule,()=>refreshData().catch(()=>{}));
app.listen(PORT,()=>console.log("Dashboard listening on "+PORT));
