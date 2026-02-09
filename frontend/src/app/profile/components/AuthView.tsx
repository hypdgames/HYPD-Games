"use client";

import { useState } from "react";
import {
  User,
  Mail,
  Lock,
  Eye,
  EyeOff,
  Loader2,
  Crown,
  Check,
  Zap,
  Shield,
  Star,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ThemeToggle } from "@/components/theme-toggle";
import BottomNav from "@/components/bottom-nav";
import { toast } from "sonner";
import type { AppSettings } from "@/types";

interface AuthViewProps {
  settings: AppSettings | null;
  onLogin: (form: { email: string; password: string }) => Promise<unknown>;
  onRegister: (form: {
    username: string;
    email: string;
    password: string;
  }) => Promise<unknown>;
}

export function AuthView({ settings, onLogin, onRegister }: AuthViewProps) {
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [loginForm, setLoginForm] = useState({ email: "", password: "" });
  const [registerForm, setRegisterForm] = useState({
    username: "",
    email: "",
    password: "",
    confirmPassword: "",
  });

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
    if (registerForm.password !== registerForm.confirmPassword) {
      toast.error("Passwords don't match");
      return;
    }
    if (registerForm.password.length < 6) {
      toast.error("Password must be at least 6 characters");
      return;
    }
    setLoading(true);
    try {
      await onRegister(registerForm);
      toast.success("Account created successfully!");
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Registration failed"
      );
    }
    setLoading(false);
  };

  return (
    <div className="min-h-screen bg-background pb-24" data-testid="profile-page">
      {/* Header */}
      <div className="glass p-4 border-b border-border">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            {settings?.logo_url ? (
              <img src={settings.logo_url} alt="Logo" className="h-8" />
            ) : (
              <h1 className="font-heading text-xl text-lime tracking-tight">
                HYPD
              </h1>
            )}
            <span className="text-muted-foreground">Profile</span>
          </div>
          <ThemeToggle />
        </div>
      </div>

      <div className="p-6 max-w-md mx-auto">
        <Tabs defaultValue="auth" className="w-full">
          <TabsList className="grid w-full grid-cols-2 mb-6">
            <TabsTrigger value="auth" className="flex items-center gap-2">
              <User className="w-4 h-4" />
              Account
            </TabsTrigger>
            <TabsTrigger value="pro" className="flex items-center gap-2">
              <Crown className="w-4 h-4" />
              PRO
            </TabsTrigger>
          </TabsList>

          {/* Auth Tab */}
          <TabsContent value="auth">
            <div className="text-center mb-8">
              <div className="w-20 h-20 rounded-full bg-card border border-border flex items-center justify-center mx-auto mb-4">
                <User className="w-10 h-10 text-muted-foreground" />
              </div>
              <h2 className="font-heading text-2xl text-foreground mb-2">
                Join HYPD
              </h2>
              <p className="text-muted-foreground text-sm">
                Save your progress, track high scores, and more
              </p>
            </div>

            <Tabs defaultValue="login" className="w-full">
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="login" data-testid="login-tab">
                  Login
                </TabsTrigger>
                <TabsTrigger value="register" data-testid="register-tab">
                  Sign Up
                </TabsTrigger>
              </TabsList>

              {/* Login Form */}
              <TabsContent value="login" className="mt-6">
                <form onSubmit={handleLogin} className="space-y-4">
                  <div className="space-y-2">
                    <Label>Email</Label>
                    <div className="relative">
                      <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
                      <Input
                        type="email"
                        placeholder="you@example.com"
                        value={loginForm.email}
                        onChange={(e) =>
                          setLoginForm({ ...loginForm, email: e.target.value })
                        }
                        className="pl-12"
                        required
                        data-testid="login-email"
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label>Password</Label>
                    <div className="relative">
                      <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
                      <Input
                        type={showPassword ? "text" : "password"}
                        placeholder="••••••••"
                        value={loginForm.password}
                        onChange={(e) =>
                          setLoginForm({
                            ...loginForm,
                            password: e.target.value,
                          })
                        }
                        className="pl-12 pr-12"
                        required
                        data-testid="login-password"
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute right-4 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                      >
                        {showPassword ? (
                          <EyeOff className="w-5 h-5" />
                        ) : (
                          <Eye className="w-5 h-5" />
                        )}
                      </button>
                    </div>
                  </div>

                  <Button
                    type="submit"
                    disabled={loading}
                    className="w-full"
                    data-testid="login-submit"
                  >
                    {loading ? (
                      <Loader2 className="w-5 h-5 animate-spin" />
                    ) : (
                      "Login"
                    )}
                  </Button>
                </form>
              </TabsContent>

              {/* Register Form */}
              <TabsContent value="register" className="mt-6">
                <form onSubmit={handleRegister} className="space-y-4">
                  <div className="space-y-2">
                    <Label>Username</Label>
                    <div className="relative">
                      <User className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
                      <Input
                        type="text"
                        placeholder="gamer123"
                        value={registerForm.username}
                        onChange={(e) =>
                          setRegisterForm({
                            ...registerForm,
                            username: e.target.value,
                          })
                        }
                        className="pl-12"
                        required
                        data-testid="register-username"
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label>Email</Label>
                    <div className="relative">
                      <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
                      <Input
                        type="email"
                        placeholder="you@example.com"
                        value={registerForm.email}
                        onChange={(e) =>
                          setRegisterForm({
                            ...registerForm,
                            email: e.target.value,
                          })
                        }
                        className="pl-12"
                        required
                        data-testid="register-email"
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label>Password</Label>
                    <div className="relative">
                      <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
                      <Input
                        type={showPassword ? "text" : "password"}
                        placeholder="••••••••"
                        value={registerForm.password}
                        onChange={(e) =>
                          setRegisterForm({
                            ...registerForm,
                            password: e.target.value,
                          })
                        }
                        className="pl-12 pr-12"
                        required
                        data-testid="register-password"
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute right-4 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                      >
                        {showPassword ? (
                          <EyeOff className="w-5 h-5" />
                        ) : (
                          <Eye className="w-5 h-5" />
                        )}
                      </button>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label>Confirm Password</Label>
                    <div className="relative">
                      <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
                      <Input
                        type={showPassword ? "text" : "password"}
                        placeholder="••••••••"
                        value={registerForm.confirmPassword}
                        onChange={(e) =>
                          setRegisterForm({
                            ...registerForm,
                            confirmPassword: e.target.value,
                          })
                        }
                        className="pl-12"
                        required
                        data-testid="register-confirm-password"
                      />
                    </div>
                  </div>

                  <Button
                    type="submit"
                    disabled={loading}
                    className="w-full"
                    data-testid="register-submit"
                  >
                    {loading ? (
                      <Loader2 className="w-5 h-5 animate-spin" />
                    ) : (
                      "Create Account"
                    )}
                  </Button>
                </form>
              </TabsContent>
            </Tabs>
          </TabsContent>

          {/* PRO Tab for logged out users */}
          <TabsContent value="pro">
            <ProPlansDisplay />
          </TabsContent>
        </Tabs>
      </div>
      <BottomNav />
    </div>
  );
}

export function ProPlansDisplay() {
  return (
    <>
      {/* Hero */}
      <div className="text-center mb-6">
        <div className="w-16 h-16 rounded-full bg-gradient-to-br from-lime/20 to-violet/20 border-2 border-lime flex items-center justify-center mx-auto mb-3">
          <Crown className="w-8 h-8 text-lime" />
        </div>
        <h2 className="font-heading text-2xl text-foreground mb-1">
          Upgrade to PRO
        </h2>
        <p className="text-sm text-muted-foreground">
          Remove ads and unlock exclusive features
        </p>
      </div>

      {/* Plans */}
      <div className="space-y-3">
        {/* Free Plan */}
        <div className="bg-card border border-border rounded-xl p-4">
          <div className="flex items-center justify-between mb-3">
            <div>
              <h3 className="font-heading text-lg text-foreground">Free</h3>
              <p className="text-muted-foreground text-sm">$0/forever</p>
            </div>
            <span className="text-xs bg-muted text-muted-foreground px-3 py-1 rounded-full">
              Current Plan
            </span>
          </div>
          <ul className="space-y-2">
            {["Access to all games", "Basic save progress", "Standard quality"].map(
              (f) => (
                <li
                  key={f}
                  className="flex items-center gap-2 text-sm text-foreground"
                >
                  <Check className="w-4 h-4 text-lime flex-shrink-0" />
                  {f}
                </li>
              )
            )}
          </ul>
        </div>

        {/* PRO Plan */}
        <div className="relative bg-card border-2 border-lime rounded-xl p-4">
          <div className="absolute -top-2.5 left-4">
            <span className="bg-lime text-black text-xs font-bold px-2 py-0.5 rounded-full">
              POPULAR
            </span>
          </div>
          <div className="flex items-center justify-between mb-3">
            <div>
              <h3 className="font-heading text-lg text-foreground">PRO</h3>
              <p className="text-lime text-sm font-bold">$4.99/month</p>
            </div>
            <Button disabled className="bg-lime/50 text-black">
              Coming Soon
            </Button>
          </div>
          <ul className="grid grid-cols-2 gap-2">
            {[
              "Ad-free experience",
              "Cloud save sync",
              "HD quality games",
              "Early access",
              "Exclusive badges",
            ].map((f) => (
              <li
                key={f}
                className="flex items-center gap-2 text-sm text-foreground"
              >
                <Check className="w-4 h-4 text-lime flex-shrink-0" />
                {f}
              </li>
            ))}
          </ul>
        </div>

        {/* PRO+ Plan */}
        <div className="bg-card border border-border rounded-xl p-4">
          <div className="flex items-center justify-between mb-3">
            <div>
              <h3 className="font-heading text-lg text-foreground">PRO+</h3>
              <p className="text-muted-foreground text-sm">$9.99/month</p>
            </div>
            <Button variant="outline" disabled>
              Coming Soon
            </Button>
          </div>
          <ul className="grid grid-cols-2 gap-2">
            {[
              "Everything in PRO",
              "Priority support",
              "Beta testing",
              "Custom themes",
              "Monthly credits",
            ].map((f) => (
              <li
                key={f}
                className="flex items-center gap-2 text-sm text-foreground"
              >
                <Check className="w-4 h-4 text-lime flex-shrink-0" />
                {f}
              </li>
            ))}
          </ul>
        </div>
      </div>

      {/* Benefits */}
      <div className="mt-6 grid grid-cols-3 gap-3">
        <div className="text-center">
          <div className="w-10 h-10 rounded-full bg-lime/10 flex items-center justify-center mx-auto mb-2">
            <Zap className="w-5 h-5 text-lime" />
          </div>
          <p className="text-xs text-muted-foreground">No Ads</p>
        </div>
        <div className="text-center">
          <div className="w-10 h-10 rounded-full bg-lime/10 flex items-center justify-center mx-auto mb-2">
            <Shield className="w-5 h-5 text-lime" />
          </div>
          <p className="text-xs text-muted-foreground">Cloud Saves</p>
        </div>
        <div className="text-center">
          <div className="w-10 h-10 rounded-full bg-lime/10 flex items-center justify-center mx-auto mb-2">
            <Star className="w-5 h-5 text-lime" />
          </div>
          <p className="text-xs text-muted-foreground">Early Access</p>
        </div>
      </div>
    </>
  );
}
