"use client";

import { useState } from "react";
import { User, Mail, Lock, Eye, EyeOff, Loader2 } from "lucide-react";
import { ThemeToggle } from "@/components/theme-toggle";
import { toast } from "sonner";

interface AuthViewProps {
  onLogin: (form: { email: string; password: string }) => Promise<unknown>;
  onRegister: (form: { username: string; email: string; password: string }) => Promise<unknown>;
}

export function AuthView({ onLogin, onRegister }: AuthViewProps) {
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<"login" | "register">("login");
  const [loginForm, setLoginForm] = useState({ email: "", password: "" });
  const [registerForm, setRegisterForm] = useState({ username: "", email: "", password: "", confirmPassword: "" });

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      await onLogin(loginForm);
      toast.success("Welcome back!");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Login failed");
    }
    setLoading(false);
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    if (registerForm.password !== registerForm.confirmPassword) { toast.error("Passwords don't match"); return; }
    if (registerForm.password.length < 6) { toast.error("Password must be at least 6 characters"); return; }
    setLoading(true);
    try {
      await onRegister(registerForm);
      toast.success("Account created!");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Registration failed");
    }
    setLoading(false);
  };

  return (
    <div className="min-h-screen hook-gradient-bg pb-28" data-testid="profile-page">
      {/* Centered title */}
      <div className="pt-5 pb-2 text-center relative">
        <h1 className="text-2xl font-extrabold text-foreground">Profile</h1>
        <div className="absolute right-5 top-5"><ThemeToggle /></div>
      </div>

      <div className="px-5 pt-6 max-w-md mx-auto">
        {/* Avatar */}
        <div className="text-center mb-8">
          <div className="w-24 h-24 rounded-3xl bg-muted flex items-center justify-center mx-auto mb-5 shadow-md">
            <User className="w-12 h-12 text-muted-foreground" />
          </div>
          <h2 className="font-extrabold text-2xl mb-2">Join HYPD</h2>
          <p className="text-muted-foreground text-[15px]">Save games and keep your account synced</p>
        </div>

        {/* Filter pills for Login/Register (Hook-style) */}
        <div className="flex gap-2.5 justify-center mb-7">
          <button
            onClick={() => setActiveTab("login")}
            className={`filter-pill ${activeTab === "login" ? "filter-pill-active" : ""}`}
            data-testid="login-tab"
          >
            Login
          </button>
          <button
            onClick={() => setActiveTab("register")}
            className={`filter-pill ${activeTab === "register" ? "filter-pill-active" : ""}`}
            data-testid="register-tab"
          >
            Sign Up
          </button>
        </div>

        {activeTab === "login" ? (
          <form onSubmit={handleLogin} className="space-y-4">
            <div className="relative">
              <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
              <input type="email" placeholder="Email address" value={loginForm.email}
                onChange={e => setLoginForm({ ...loginForm, email: e.target.value })}
                className="search-bar !pl-12" required data-testid="login-email" />
            </div>
            <div className="relative">
              <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
              <input type={showPassword ? "text" : "password"} placeholder="Password" value={loginForm.password}
                onChange={e => setLoginForm({ ...loginForm, password: e.target.value })}
                className="search-bar !pl-12 !pr-12" required data-testid="login-password" />
              <button type="button" onClick={() => setShowPassword(!showPassword)}
                className="absolute right-4 top-1/2 -translate-y-1/2 text-muted-foreground">
                {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
              </button>
            </div>
            <button type="submit" disabled={loading}
              className="w-full h-14 rounded-pill bg-violet text-white font-bold text-base center-btn-glow active:scale-[0.98] disabled:opacity-60 transition-transform"
              data-testid="login-submit">
              {loading ? <Loader2 className="w-5 h-5 animate-spin mx-auto" /> : "Login"}
            </button>
          </form>
        ) : (
          <form onSubmit={handleRegister} className="space-y-4">
            <div className="relative">
              <User className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
              <input type="text" placeholder="Username" value={registerForm.username}
                onChange={e => setRegisterForm({ ...registerForm, username: e.target.value })}
                className="search-bar !pl-12" required data-testid="register-username" />
            </div>
            <div className="relative">
              <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
              <input type="email" placeholder="Email address" value={registerForm.email}
                onChange={e => setRegisterForm({ ...registerForm, email: e.target.value })}
                className="search-bar !pl-12" required data-testid="register-email" />
            </div>
            <div className="relative">
              <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
              <input type={showPassword ? "text" : "password"} placeholder="Password" value={registerForm.password}
                onChange={e => setRegisterForm({ ...registerForm, password: e.target.value })}
                className="search-bar !pl-12 !pr-12" required data-testid="register-password" />
              <button type="button" onClick={() => setShowPassword(!showPassword)}
                className="absolute right-4 top-1/2 -translate-y-1/2 text-muted-foreground">
                {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
              </button>
            </div>
            <div className="relative">
              <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
              <input type={showPassword ? "text" : "password"} placeholder="Confirm password" value={registerForm.confirmPassword}
                onChange={e => setRegisterForm({ ...registerForm, confirmPassword: e.target.value })}
                className="search-bar !pl-12" required data-testid="register-confirm-password" />
            </div>
            <button type="submit" disabled={loading}
              className="w-full h-14 rounded-pill bg-violet text-white font-bold text-base center-btn-glow active:scale-[0.98] disabled:opacity-60 transition-transform"
              data-testid="register-submit">
              {loading ? <Loader2 className="w-5 h-5 animate-spin mx-auto" /> : "Create Account"}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
