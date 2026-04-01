"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { X, Eye, EyeOff, Loader2, User, Mail, Lock } from "lucide-react";
import Image from "next/image";
import { useAuthStore } from "@/store";
import { toast } from "sonner";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "";
const SLIDE_INTERVAL = 2000;

type AuthMode = null | "login" | "signup";

const slideVariants = {
  enter: { y: "105%", opacity: 0 },
  center: { y: 0, opacity: 1 },
  exit: { y: "-105%", opacity: 0 },
};
const slideTransition = { duration: 0.5, ease: [0.32, 0, 0.67, 0] as const };

/* ── Slideshow ───────────────────────────────── */
function Slideshow({ images }: { images: string[] }) {
  const [index, setIndex] = useState(0);

  useEffect(() => {
    if (images.length < 2) return;
    const id = setInterval(() => setIndex(i => (i + 1) % images.length), SLIDE_INTERVAL);
    return () => clearInterval(id);
  }, [images.length]);

  if (images.length === 0) {
    return <div className="absolute inset-0 bg-gradient-to-br from-violet-400 to-fuchsia-500" />;
  }

  return (
    <AnimatePresence mode="popLayout" initial={false}>
      <motion.div
        key={index}
        variants={slideVariants}
        initial="enter"
        animate="center"
        exit="exit"
        transition={slideTransition}
        className="absolute inset-0"
      >
        <Image
          src={images[index]}
          alt="game preview"
          fill
          className="object-cover"
          sizes="300px"
          priority={index === 0}
        />
      </motion.div>
    </AnimatePresence>
  );
}

/* ── Auth bottom sheet ───────────────────────── */
function AuthSheet({
  mode, onClose, onSuccess,
}: { mode: AuthMode; onClose: () => void; onSuccess: () => void }) {
  const { login, register } = useAuthStore();
  const [loading, setLoading] = useState(false);
  const [showPw, setShowPw] = useState(false);
  const [form, setForm] = useState({ username: "", email: "", password: "", confirm: "" });

  const field = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm(prev => ({ ...prev, [k]: e.target.value }));

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (mode === "signup" && form.password !== form.confirm) {
      toast.error("Passwords don't match"); return;
    }
    if (form.password.length < 6) {
      toast.error("Password must be at least 6 characters"); return;
    }
    setLoading(true);
    try {
      if (mode === "login") {
        await login({ email: form.email, password: form.password });
        toast.success("Welcome back!");
      } else {
        await register({ username: form.username, email: form.email, password: form.password });
        toast.success("Welcome to HYPD!");
      }
      onSuccess();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setLoading(false);
    }
  };

  const inputCls = "w-full bg-muted rounded-2xl pl-11 pr-4 py-3.5 text-sm outline-none placeholder:text-muted-foreground";

  return (
    <AnimatePresence>
      {mode && (
        <>
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm"
            data-testid="auth-backdrop"
          />
          <motion.div
            initial={{ y: "100%" }} animate={{ y: 0 }} exit={{ y: "100%" }}
            transition={{ type: "spring", damping: 32, stiffness: 320 }}
            className="fixed bottom-0 left-0 right-0 z-50 mx-auto max-w-[540px] bg-background rounded-t-3xl px-6 pt-4 pb-8 shadow-2xl"
            data-testid="auth-sheet"
          >
            <div className="flex justify-center mb-5">
              <div className="w-10 h-1 rounded-full bg-foreground/15" />
            </div>
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-xl font-extrabold">
                {mode === "login" ? "Welcome back" : "Create account"}
              </h2>
              <button onClick={onClose} className="w-8 h-8 rounded-full bg-muted flex items-center justify-center">
                <X className="w-4 h-4" />
              </button>
            </div>
            <form onSubmit={submit} className="space-y-3">
              {mode === "signup" && (
                <div className="relative">
                  <User className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <input type="text" placeholder="Username" value={form.username}
                    onChange={field("username")} required className={inputCls} data-testid="signup-username" />
                </div>
              )}
              <div className="relative">
                <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <input type="email" placeholder="Email" value={form.email}
                  onChange={field("email")} required className={inputCls} data-testid={`${mode}-email`} />
              </div>
              <div className="relative">
                <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <input type={showPw ? "text" : "password"} placeholder="Password" value={form.password}
                  onChange={field("password")} required className={`${inputCls} pr-12`} data-testid={`${mode}-password`} />
                <button type="button" onClick={() => setShowPw(v => !v)}
                  className="absolute right-4 top-1/2 -translate-y-1/2 text-muted-foreground">
                  {showPw ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
              {mode === "signup" && (
                <div className="relative">
                  <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <input type={showPw ? "text" : "password"} placeholder="Confirm password" value={form.confirm}
                    onChange={field("confirm")} required className={inputCls} data-testid="signup-confirm" />
                </div>
              )}
              <motion.button whileTap={{ scale: 0.97 }} type="submit" disabled={loading}
                className="w-full bg-lime text-black font-bold py-4 rounded-2xl flex items-center justify-center gap-2 !mt-5 disabled:opacity-60"
                data-testid="auth-submit-btn">
                {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : (mode === "login" ? "Login" : "Create Account")}
              </motion.button>
            </form>
            <p className="text-center text-xs text-muted-foreground mt-4">
              {mode === "login" ? "Don't have an account? " : "Already have an account? "}
              <button
                onClick={() => { onClose(); setTimeout(() => { document.getElementById(`open-${mode === "login" ? "signup" : "login"}`)?.click(); }, 300); }}
                className="font-bold text-foreground underline"
              >
                {mode === "login" ? "Sign up" : "Login"}
              </button>
            </p>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}

/* ── Main page ───────────────────────────────── */
export default function WelcomePage() {
  const router = useRouter();
  const { user, loading: authLoading, settings } = useAuthStore();
  const [images, setImages] = useState<string[]>([]);
  const [slideIndex, setSlideIndex] = useState(0);
  const [authMode, setAuthMode] = useState<AuthMode>(null);

  // Redirect if already logged in
  useEffect(() => {
    if (!authLoading && user) router.replace("/");
  }, [user, authLoading, router]);

  // Fetch game images for slideshow
  useEffect(() => {
    fetch(`${API_URL}/api/games`)
      .then(r => r.json())
      .then((data: Array<{ thumbnail_url?: string; icon_url?: string }>) => {
        const imgs = data.map(g => g.thumbnail_url || g.icon_url || "").filter(Boolean);
        for (let i = imgs.length - 1; i > 0; i--) {
          const j = Math.floor(Math.random() * (i + 1));
          [imgs[i], imgs[j]] = [imgs[j], imgs[i]];
        }
        setImages(imgs.slice(0, 12));
      })
      .catch(() => {});
  }, []);

  // Mirror the slideshow index for dots
  useEffect(() => {
    if (images.length < 2) return;
    const id = setInterval(() => setSlideIndex(i => (i + 1) % images.length), SLIDE_INTERVAL);
    return () => clearInterval(id);
  }, [images.length]);

  const playAsGuest = () => {
    sessionStorage.setItem("hypd:guest", "1");
    router.push("/");
  };

  if (authLoading && !user) {
    return (
      <div className="h-dvh hook-gradient-bg flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-foreground/40" />
      </div>
    );
  }

  const logoUrl = settings?.logo_url as string | undefined;
  const dotCount = Math.min(images.length, 6);

  return (
    <div
      className="h-dvh hook-gradient-bg flex flex-col overflow-hidden"
      style={{ padding: "0 24px" }}
      data-testid="welcome-page"
    >
      {/* ── Logo ─────────────────────────────── */}
      <motion.div
        initial={{ opacity: 0, y: -16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.45 }}
        className="flex-shrink-0 flex justify-center items-center pt-10 pb-4"
      >
        {logoUrl ? (
          <Image
            src={logoUrl}
            alt="HYPD Games"
            width={140}
            height={44}
            className="object-contain"
            style={{ height: "44px", width: "auto" }}
            priority
          />
        ) : (
          <span className="text-4xl font-black tracking-tight text-foreground" style={{ letterSpacing: "-0.03em" }}>
            hypd
          </span>
        )}
      </motion.div>

      {/* ── Slideshow card + stickers ──────── */}
      <motion.div
        initial={{ opacity: 0, scale: 0.93 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.45, delay: 0.08 }}
        className="flex-1 min-h-0 flex items-center justify-center py-2"
        style={{ overflow: "visible" }}
      >
        {/* Relative wrapper — card + stickers positioned inside, overflow allowed */}
        <div
          className="relative"
          style={{ width: "min(78%, 300px)", height: "min(100%, min(360px, 42dvh))" }}
        >
          {/* Slideshow card */}
          <div className="absolute inset-0 rounded-[28px] overflow-hidden shadow-2xl">
            <Slideshow images={images} />
            <div className="absolute inset-0 bg-gradient-to-t from-black/25 to-transparent pointer-events-none" />
          </div>

          {/* Game controller sticker — overhangs left */}
          <motion.div
            initial={{ scale: 0, rotate: -40 }}
            animate={{ scale: 1, rotate: -18 }}
            transition={{ delay: 0.35, type: "spring", stiffness: 200, damping: 14 }}
            className="absolute z-20 pointer-events-none"
            style={{ left: "-52px", top: "26%" }}
          >
            <div className="relative" style={{ filter: "drop-shadow(2px 4px 8px rgba(0,0,0,0.45))" }}>
              {/* Sparkles */}
              <span className="absolute -top-4 right-1 text-white font-black leading-none" style={{ fontSize: 17, textShadow: "0 1px 4px rgba(0,0,0,0.5)" }}>✦</span>
              <span className="absolute top-1 -left-3 text-white font-black leading-none" style={{ fontSize: 11, textShadow: "0 1px 4px rgba(0,0,0,0.5)" }}>✦</span>
              <span className="absolute -bottom-1 right-3 text-white font-black leading-none" style={{ fontSize: 8, textShadow: "0 1px 4px rgba(0,0,0,0.5)" }}>✦</span>

              {/* Custom SVG controller — cartoon sticker style */}
              <svg width="78" height="62" viewBox="0 0 78 62" fill="none" xmlns="http://www.w3.org/2000/svg">
                {/* Left grip */}
                <ellipse cx="15" cy="46" rx="13" ry="13" fill="#7C3AED" stroke="#111" strokeWidth="3.5"/>
                {/* Right grip */}
                <ellipse cx="63" cy="46" rx="13" ry="13" fill="#7C3AED" stroke="#111" strokeWidth="3.5"/>
                {/* Body */}
                <rect x="8" y="10" width="62" height="40" rx="13" fill="#8B5CF6" stroke="#111" strokeWidth="3.5"/>
                {/* Left shoulder bumper */}
                <rect x="9" y="4" width="22" height="10" rx="5" fill="#6D28D9" stroke="#111" strokeWidth="3"/>
                {/* Right shoulder bumper */}
                <rect x="47" y="4" width="22" height="10" rx="5" fill="#6D28D9" stroke="#111" strokeWidth="3"/>
                {/* D-pad horizontal bar */}
                <rect x="18" y="25" width="16" height="6" rx="3" fill="#1C1C1E"/>
                {/* D-pad vertical bar */}
                <rect x="23" y="20" width="6" height="16" rx="3" fill="#1C1C1E"/>
                {/* Face button — top (Y/green) */}
                <circle cx="54" cy="21" r="5" fill="#22C55E" stroke="#111" strokeWidth="2.5"/>
                {/* Face button — right (B/red) */}
                <circle cx="63" cy="30" r="5" fill="#EF4444" stroke="#111" strokeWidth="2.5"/>
                {/* Face button — left (X/blue) */}
                <circle cx="45" cy="30" r="5" fill="#3B82F6" stroke="#111" strokeWidth="2.5"/>
                {/* Face button — bottom (A/yellow) */}
                <circle cx="54" cy="39" r="5" fill="#F59E0B" stroke="#111" strokeWidth="2.5"/>
                {/* Centre/Home button */}
                <circle cx="39" cy="30" r="6" fill="#1C1C1E" stroke="#111" strokeWidth="2"/>
                <circle cx="39" cy="30" r="3.5" fill="#8B5CF6"/>
                {/* Left analog stick */}
                <circle cx="24" cy="44" r="7" fill="#5B21B6" stroke="#111" strokeWidth="2.5"/>
                <circle cx="24" cy="44" r="3" fill="#1C1C1E"/>
                {/* Right analog stick */}
                <circle cx="52" cy="44" r="7" fill="#5B21B6" stroke="#111" strokeWidth="2.5"/>
                <circle cx="52" cy="44" r="3" fill="#1C1C1E"/>
              </svg>

              {/* Rainbow stripe */}
              <div
                className="absolute rounded-full"
                style={{
                  bottom: "-11px", left: "50%", transform: "translateX(-50%)",
                  width: "85%", height: "9px",
                  background: "linear-gradient(90deg,#ff3366,#ff8c00,#ffff00,#00cc44,#0099ff,#9933ff)",
                }}
              />
            </div>
          </motion.div>

          {/* "New games daily 🔥" badge — overhangs right */}
          <motion.div
            initial={{ scale: 0, rotate: 20 }}
            animate={{ scale: 1, rotate: 8 }}
            transition={{ delay: 0.45, type: "spring", stiffness: 200, damping: 14 }}
            className="absolute z-20 pointer-events-none"
            style={{ right: "-22px", top: "18%" }}
          >
            <div
              className="px-3.5 py-1.5 rounded-full font-bold text-black text-xs whitespace-nowrap"
              style={{ background: "#AAFF00", boxShadow: "3px 3px 0 rgba(0,0,0,0.18)" }}
            >
              New games daily 🔥
            </div>
          </motion.div>
        </div>
      </motion.div>

      {/* ── Progress dots ────────────────────── */}
      {dotCount > 1 && (
        <div className="flex-shrink-0 flex items-center justify-center gap-1.5 pt-3 pb-2">
          {Array.from({ length: dotCount }).map((_, i) => (
            <div
              key={i}
              className={`rounded-full transition-all duration-300 ${
                i === slideIndex % dotCount
                  ? "w-5 h-1.5 bg-foreground"
                  : "w-1.5 h-1.5 bg-foreground/25"
              }`}
            />
          ))}
        </div>
      )}

      {/* ── Tagline ──────────────────────────── */}
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2, duration: 0.4 }}
        className="flex-shrink-0 text-center py-3"
      >
        <p className="text-xl font-extrabold text-foreground leading-snug">
          Discover &amp; play instant games
        </p>
        <p className="text-xs text-muted-foreground mt-1">No downloads. Just play.</p>
      </motion.div>

      {/* ── Buttons ──────────────────────────── */}
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.3, duration: 0.4 }}
        className="flex-shrink-0 w-full space-y-2.5 py-2"
      >
        <motion.button
          whileTap={{ scale: 0.97 }}
          onClick={() => setAuthMode("login")}
          className="w-full bg-foreground text-background font-bold py-3.5 rounded-2xl text-[15px]"
          data-testid="welcome-login-btn"
          id="open-login"
        >
          Login
        </motion.button>
        <motion.button
          whileTap={{ scale: 0.97 }}
          onClick={() => setAuthMode("signup")}
          className="w-full bg-lime text-black font-bold py-3.5 rounded-2xl text-[15px]"
          data-testid="welcome-signup-btn"
          id="open-signup"
        >
          Sign Up
        </motion.button>
        <motion.button
          whileTap={{ scale: 0.97 }}
          onClick={playAsGuest}
          className="w-full bg-card/60 border border-border text-foreground font-semibold py-3.5 rounded-2xl text-[15px] backdrop-blur-sm"
          data-testid="welcome-guest-btn"
        >
          Play as Guest
        </motion.button>
      </motion.div>

      {/* ── Terms ────────────────────────────── */}
      <p className="flex-shrink-0 text-center text-[10px] text-muted-foreground pt-2 pb-6 leading-relaxed">
        By signing up, you agree to HYPD&apos;s{" "}
        <span className="font-semibold text-foreground/60">Terms of Use</span>{" "}
        &amp;{" "}
        <span className="font-semibold text-foreground/60">Privacy Policy</span>
      </p>

      {/* ── Auth sheets ──────────────────────── */}
      <AuthSheet mode={authMode} onClose={() => setAuthMode(null)} onSuccess={() => router.replace("/")} />
    </div>
  );
}
