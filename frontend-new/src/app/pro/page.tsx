"use client";

import { motion } from "framer-motion";
import { Crown, Check, Zap, Shield, Star } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuthStore } from "@/store";
import { ThemeToggle } from "@/components/theme-toggle";

const plans = [
  {
    name: "Free",
    price: "$0",
    period: "forever",
    features: [
      "Access to all games",
      "Basic save progress",
      "Standard quality",
    ],
    cta: "Current Plan",
    disabled: true,
  },
  {
    name: "PRO",
    price: "$4.99",
    period: "per month",
    features: [
      "Ad-free experience",
      "Cloud save sync",
      "HD quality games",
      "Early access to new games",
      "Exclusive badges",
    ],
    cta: "Coming Soon",
    disabled: true,
    popular: true,
  },
  {
    name: "PRO+",
    price: "$9.99",
    period: "per month",
    features: [
      "Everything in PRO",
      "Priority support",
      "Beta game testing",
      "Custom profile themes",
      "Monthly game credits",
    ],
    cta: "Coming Soon",
    disabled: true,
  },
];

export default function ProPage() {
  const { settings } = useAuthStore();

  return (
    <div className="min-h-screen bg-background pb-24" data-testid="pro-page">
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
            <span className="text-muted-foreground">PRO</span>
          </div>
          <ThemeToggle />
        </div>
      </div>

      <div className="p-6">
        {/* Hero */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center mb-8"
        >
          <div className="w-20 h-20 rounded-full bg-gradient-to-br from-lime/20 to-violet/20 border-2 border-lime flex items-center justify-center mx-auto mb-4">
            <Crown className="w-10 h-10 text-lime" />
          </div>
          <h2 className="font-heading text-3xl text-foreground mb-2">
            Upgrade to PRO
          </h2>
          <p className="text-muted-foreground max-w-md mx-auto">
            Remove ads, unlock exclusive features, and get the ultimate gaming
            experience
          </p>
        </motion.div>

        {/* Plans */}
        <div className="grid md:grid-cols-3 gap-4 max-w-4xl mx-auto">
          {plans.map((plan, index) => (
            <motion.div
              key={plan.name}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.1 }}
              className={`relative bg-card border rounded-2xl p-6 ${
                plan.popular
                  ? "border-lime shadow-lg shadow-lime/10"
                  : "border-border"
              }`}
            >
              {plan.popular && (
                <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                  <span className="bg-lime text-black text-xs font-bold px-3 py-1 rounded-full">
                    POPULAR
                  </span>
                </div>
              )}

              <div className="text-center mb-6">
                <h3 className="font-heading text-xl text-foreground mb-2">
                  {plan.name}
                </h3>
                <div className="flex items-baseline justify-center gap-1">
                  <span className="font-heading text-4xl text-foreground">
                    {plan.price}
                  </span>
                  <span className="text-muted-foreground text-sm">
                    /{plan.period}
                  </span>
                </div>
              </div>

              <ul className="space-y-3 mb-6">
                {plan.features.map((feature) => (
                  <li
                    key={feature}
                    className="flex items-center gap-2 text-sm text-foreground"
                  >
                    <Check className="w-4 h-4 text-lime flex-shrink-0" />
                    {feature}
                  </li>
                ))}
              </ul>

              <Button
                className={`w-full ${
                  plan.popular ? "bg-lime text-black" : "bg-card border border-border"
                }`}
                disabled={plan.disabled}
                variant={plan.popular ? "default" : "outline"}
              >
                {plan.cta}
              </Button>
            </motion.div>
          ))}
        </div>

        {/* Benefits */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.3 }}
          className="mt-12 grid grid-cols-3 gap-4 max-w-2xl mx-auto"
        >
          <div className="text-center">
            <div className="w-12 h-12 rounded-full bg-lime/10 flex items-center justify-center mx-auto mb-2">
              <Zap className="w-6 h-6 text-lime" />
            </div>
            <p className="text-xs text-muted-foreground">No Ads</p>
          </div>
          <div className="text-center">
            <div className="w-12 h-12 rounded-full bg-lime/10 flex items-center justify-center mx-auto mb-2">
              <Shield className="w-6 h-6 text-lime" />
            </div>
            <p className="text-xs text-muted-foreground">Cloud Saves</p>
          </div>
          <div className="text-center">
            <div className="w-12 h-12 rounded-full bg-lime/10 flex items-center justify-center mx-auto mb-2">
              <Star className="w-6 h-6 text-lime" />
            </div>
            <p className="text-xs text-muted-foreground">Early Access</p>
          </div>
        </motion.div>
      </div>
    </div>
  );
}
