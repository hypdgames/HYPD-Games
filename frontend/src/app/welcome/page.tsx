"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { X, Eye, EyeOff, Loader2, User, Mail, Lock } from "lucide-react";
import Image from "next/image";
import { useAuthStore } from "@/store";
import { toast } from "sonner";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "";

type AuthMode = null | "login" | "signup";

const SLIDE_DURATION = 1500;

const slideVariants = {
  enter: { y: "100%", opacity: 0 },
  center: { y: 0, opacity: 1 },
  exit: { y: "-100%", opacity: 0 },
};

const slideTransition = { duration: 0.55, ease: [0.32, 0, 0.67, 0] as const };

function Slideshow({ images }: { images: string[] }) {
  const [index, setIndex] = useState(0);

  useEffect(() => {
    if (images.length < 2) return;
    const id = setInterval(() => setIndex(i => (i + 1) % images.length), SLIDE_DURATION);
    return () => clearInterval(id);
  }, [images.length]);

  if (images.length === 0) {
    return <div className="absolute inset-0 bg-gradient-to-br from-violet-400 to-fuchsia-400" />;
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
          sizes="400px"
          priority={index === 0}
        />
      </motion.div>
    </AnimatePresence>
  );
}

function AuthSheet({ mode, onClose, onSuccess }: { mode: AuthMode; onClose: () => void; onSuccess: () => void }) {
  const { login, register } = useAuthStore();
  const [loading, setLoading] = useState(false);
  const [showPw, setShowPw] = useState(false);
  const [form, setForm] = useState({ username: "", email: "", password: "", confirm: "" });

  const update = (k: string) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm(prev => ({ ...prev, [k]: e.target.value }));

  const handleSubmit = async (e: React.FormEvent) => {
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
        toast.success("Account created! Welcome to HYPD!");
      }
      onSuccess();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setLoading(false);
    }
  };

  return (
    <AnimatePresence>
      {mode && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm"
          />
          <motion.div
            initial={{ y: "100%" }}
            animate={{ y: 0 }}
            exit={{ y: "100%" }}
            transition={{ type: "spring", damping: 32, stiffness: 320 }}
            className="fixed bottom-0 left-0 right-0 z-50 mx-auto max-w-[540px] bg-background rounded-t-3xl px-6 pt-4 pb-8 shadow-2xl"
            data-testid="auth-sheet"
          >
            <div className="flex justify-center mb-5">
              <div className="w-10 h-1 rounded-full bg-foreground/15" />
            </div>
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-extrabold">
                {mode === "login" ? "Welcome back" : "Create account"}
              </h2>
              <button onClick={onClose} className="w-8 h-8 rounded-full bg-muted flex items-center justify-center">
                <X className="w-4 h-4" />
              </button>
            </div>
            <form onSubmit={handleSubmit} className="space-y-3.5">
              {mode === "signup" && (
                <div className="relative">
                  <User className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <input
                    type="text"
                    placeholder="Username"
                    value={form.username}
                    onChange={update("username")}
                    required
                    className="w-full bg-muted rounded-2xl pl-11 pr-4 py-3.5 text-sm outline-none placeholder:text-muted-foreground"
                    data-testid="signup-username"
                  />
                </div>
              )}
              <div className="relative">
                <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <input
                  type="email"
                  placeholder="Email"
                  value={form.email}
                  onChange={update("email")}
                  required
                  className="w-full bg-muted rounded-2xl pl-11 pr-4 py-3.5 text-sm outline-none placeholder:text-muted-foreground"
                  data-testid={`${mode}-email`}
                />
              </div>
              <div className="relative">
                <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <input
                  type={showPw ? "text" : "password"}
                  placeholder="Password"
                  value={form.password}
                  onChange={update("password")}
                  required
                  className="w-full bg-muted rounded-2xl pl-11 pr-12 py-3.5 text-sm outline-none placeholder:text-muted-foreground"
                  data-testid={`${mode}-password`}
                />
                <button type="button" onClick={() => setShowPw(v => !v)}
                  className="absolute right-4 top-1/2 -translate-y-1/2 text-muted-foreground">
                  {showPw ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
              {mode === "signup" && (
                <div className="relative">
                  <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <input
                    type={showPw ? "text" : "password"}
                    placeholder="Confirm password"
                    value={form.confirm}
                    onChange={update("confirm")}
                    required
                    className="w-full bg-muted rounded-2xl pl-11 pr-4 py-3.5 text-sm outline-none placeholder:text-muted-foreground"
                    data-testid="signup-confirm"
                  />
                </div>
              )}
              <motion.button
                whileTap={{ scale: 0.97 }}
                type="submit"
                disabled={loading}
                className="w-full bg-lime text-black font-bold py-4 rounded-2xl flex items-center justify-center gap-2 mt-2 disabled:opacity-60"
                data-testid="auth-submit-btn"
              >
                {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : (mode === "login" ? "Login" : "Create Account")}
              </motion.button>
            </form>
            <p className="text-center text-xs text-muted-foreground mt-4">
              {mode === "login" ? "Don't have an account? " : "Already have an account? "}
              <button
                onClick={() => {
                  onClose();
                  // slight delay so close animation finishes
                  setTimeout(() => {
                    document.getElementById(`open-${mode === "login" ? "signup" : "login"}`)?.click();
                  }, 300);
                }}
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

export default function WelcomePage() {
  const router = useRouter();
  const { user, loading } = useAuthStore();
  const [images, setImages] = useState<string[]>([]);
  const [slideIndex, setSlideIndex] = useState(0);
  const [authMode, setAuthMode] = useState<AuthMode>(null);

  // Redirect if already logged in
  useEffect(() => {
    if (!loading && user) router.replace("/");
  }, [user, loading, router]);

  // Fetch game images for slideshow
  useEffect(() => {
    fetch(`${API_URL}/api/games`)
      .then(r => r.json())
      .then((data: Array<{ thumbnail_url?: string; icon_url?: string }>) => {
        const imgs = data
          .map(g => g.thumbnail_url || g.icon_url || "")
          .filter(Boolean);
        // shuffle
        for (let i = imgs.length - 1; i > 0; i--) {
          const j = Math.floor(Math.random() * (i + 1));
          [imgs[i], imgs[j]] = [imgs[j], imgs[i]];
        }
        setImages(imgs.slice(0, 12));
      })
      .catch(() => {});
  }, []);

  // Progress dots tracking
  useEffect(() => {
    if (images.length < 2) return;
    const id = setInterval(() => setSlideIndex(i => (i + 1) % images.length), SLIDE_DURATION);
    return () => clearInterval(id);
  }, [images.length]);

  const playAsGuest = () => {
    sessionStorage.setItem("hypd:guest", "1");
    router.push("/");
  };

  const onAuthSuccess = () => router.replace("/");

  if (loading && !user) {
    return (
      <div className="min-h-screen hook-gradient-bg flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-foreground/40" />
      </div>
    );
  }

  const dotCount = Math.min(images.length, 6);

  return (
    <div className="min-h-screen hook-gradient-bg flex flex-col items-center px-6 pt-12 pb-8 relative overflow-hidden">

      {/* Logo */}
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="mb-8"
      >
        <h1 className="text-5xl font-black tracking-tight text-foreground" style={{ letterSpacing: "-0.03em" }}>
          hypd
        </h1>
      </motion.div>

      {/* Slideshow card */}
      <motion.div
        initial={{ opacity: 0, scale: 0.94 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.5, delay: 0.1 }}
        className="w-full max-w-[320px] rounded-[28px] overflow-hidden shadow-2xl flex-shrink-0"
        style={{ aspectRatio: "3/4" }}
      >
        <div className="relative w-full h-full">
          <Slideshow images={images} />
          {/* Overlay gradient so bottom of image doesn't look abrupt */}
          <div className="absolute inset-0 bg-gradient-to-t from-black/30 to-transparent pointer-events-none" />
        </div>
      </motion.div>

      {/* Progress dots */}
      {dotCount > 1 && (
        <div className="flex items-center gap-1.5 mt-5">
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

      {/* Tagline */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.25, duration: 0.45 }}
        className="text-center mt-5 mb-8"
      >
        <p className="text-2xl font-extrabold text-foreground leading-tight">
          Discover &amp; play<br />instant games
        </p>
        <p className="text-sm text-muted-foreground mt-1.5">No downloads. Just play.</p>
      </motion.div>

      {/* Action buttons */}
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.35, duration: 0.45 }}
        className="w-full max-w-[360px] space-y-3"
      >
        <motion.button
          whileTap={{ scale: 0.97 }}
          onClick={() => setAuthMode("login")}
          className="w-full bg-foreground text-background font-bold py-4 rounded-2xl text-base"
          data-testid="welcome-login-btn"
          id="open-login"
        >
          Login
        </motion.button>

        <motion.button
          whileTap={{ scale: 0.97 }}
          onClick={() => setAuthMode("signup")}
          className="w-full bg-lime text-black font-bold py-4 rounded-2xl text-base"
          data-testid="welcome-signup-btn"
          id="open-signup"
        >
          Sign Up
        </motion.button>

        <motion.button
          whileTap={{ scale: 0.97 }}
          onClick={playAsGuest}
          className="w-full bg-card/60 border border-border text-foreground font-semibold py-4 rounded-2xl text-base backdrop-blur-sm"
          data-testid="welcome-guest-btn"
        >
          Play as Guest
        </motion.button>
      </motion.div>

      {/* Terms */}
      <p className="text-center text-[11px] text-muted-foreground mt-6 max-w-[280px] leading-relaxed">
        By signing up, you agree to HYPD&apos;s{" "}
        <span className="font-semibold text-foreground/60">Terms of Use</span> &amp;{" "}
        <span className="font-semibold text-foreground/60">Privacy Policy</span>
      </p>

      {/* Auth sheets */}
      <AuthSheet mode={authMode} onClose={() => setAuthMode(null)} onSuccess={onAuthSuccess} />
    </div>
  );
}
