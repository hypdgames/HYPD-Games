import { motion } from "framer-motion";
import { Crown, Zap, Shield, Star, Check, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/App";
import ThemeToggle from "@/components/ThemeToggle";

const features = [
  {
    icon: Zap,
    title: "Ad-Free Gaming",
    description: "Play without any interruptions or ads"
  },
  {
    icon: Shield,
    title: "Exclusive Games",
    description: "Access PRO-only titles before anyone else"
  },
  {
    icon: Star,
    title: "Priority Support",
    description: "Get help faster with dedicated support"
  },
  {
    icon: Sparkles,
    title: "Custom Themes",
    description: "Personalize your gaming experience"
  }
];

const plans = [
  {
    name: "Monthly",
    price: "$4.99",
    period: "/month",
    popular: false
  },
  {
    name: "Yearly",
    price: "$39.99",
    period: "/year",
    popular: true,
    savings: "Save 33%"
  }
];

export default function Pro() {
  const { settings } = useAuth();

  const handleSubscribe = (plan) => {
    alert(`Subscription to ${plan} plan coming soon!`);
  };

  return (
    <div className="min-h-screen bg-background pb-24 overflow-hidden" data-testid="pro-page">
      {/* Header */}
      <div className="glass p-4 border-b border-border sticky top-0 z-30">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            {settings?.logo_url ? (
              <img src={settings.logo_url} alt="Logo" className="h-8" />
            ) : (
              <h1 className="font-heading text-xl text-lime tracking-tight">HYPD</h1>
            )}
            <span className="text-muted-foreground">PRO</span>
          </div>
          <ThemeToggle />
        </div>
      </div>

      {/* Hero Section */}
      <div className="relative">
        {/* Background Glow */}
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-violet/30 via-background to-background" />
        
        {/* Content */}
        <div className="relative px-6 pt-8 pb-8 text-center">
          {/* Crown Icon */}
          <motion.div
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ type: "spring", duration: 0.6 }}
            className="inline-flex items-center justify-center w-20 h-20 rounded-full bg-gradient-to-br from-lime/20 to-violet/20 border border-lime/30 mb-6"
          >
            <Crown className="w-10 h-10 text-lime" />
          </motion.div>

          <motion.h1
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="font-heading text-4xl md:text-5xl text-foreground mb-4"
          >
            GO <span className="text-lime neon-text">PRO</span>
          </motion.h1>

          <motion.p
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
            className="text-muted-foreground max-w-md mx-auto"
          >
            Unlock the ultimate gaming experience with no ads, exclusive games, and premium features.
          </motion.p>
        </div>
      </div>

      {/* Features */}
      <div className="px-6 py-8">
        <h2 className="text-lg font-bold text-foreground mb-6 text-center">What You Get</h2>
        <div className="grid grid-cols-2 gap-4 max-w-md mx-auto">
          {features.map((feature, index) => {
            const Icon = feature.icon;
            return (
              <motion.div
                key={feature.title}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.4 + index * 0.1 }}
                className="bg-card border border-border rounded-2xl p-4 text-center"
              >
                <div className="w-12 h-12 rounded-xl bg-lime/10 flex items-center justify-center mx-auto mb-3">
                  <Icon className="w-6 h-6 text-lime" />
                </div>
                <h3 className="font-bold text-foreground text-sm mb-1">{feature.title}</h3>
                <p className="text-xs text-muted-foreground">{feature.description}</p>
              </motion.div>
            );
          })}
        </div>
      </div>

      {/* Pricing Plans */}
      <div className="px-6 py-8">
        <h2 className="text-lg font-bold text-foreground mb-6 text-center">Choose Your Plan</h2>
        <div className="flex flex-col md:flex-row gap-4 max-w-md mx-auto">
          {plans.map((plan, index) => (
            <motion.div
              key={plan.name}
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: 0.6 + index * 0.1 }}
              className={`flex-1 relative bg-card border rounded-2xl p-6 ${
                plan.popular 
                  ? "border-lime ring-2 ring-lime/20" 
                  : "border-border"
              }`}
              data-testid={`plan-${plan.name.toLowerCase()}`}
            >
              {plan.popular && (
                <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                  <span className="px-4 py-1 bg-lime text-black text-xs font-bold rounded-full">
                    BEST VALUE
                  </span>
                </div>
              )}
              
              <div className="text-center mb-6">
                <h3 className="text-foreground font-bold mb-2">{plan.name}</h3>
                <div className="flex items-baseline justify-center gap-1">
                  <span className="text-3xl font-heading text-foreground">{plan.price}</span>
                  <span className="text-muted-foreground text-sm">{plan.period}</span>
                </div>
                {plan.savings && (
                  <span className="text-lime text-xs font-medium">{plan.savings}</span>
                )}
              </div>

              <ul className="space-y-3 mb-6">
                {features.map(f => (
                  <li key={f.title} className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Check className="w-4 h-4 text-lime flex-shrink-0" />
                    {f.title}
                  </li>
                ))}
              </ul>

              <Button
                onClick={() => handleSubscribe(plan.name)}
                className={`w-full py-6 font-bold rounded-full transition-all ${
                  plan.popular
                    ? "bg-lime text-black hover:bg-lime/90 glow-lime"
                    : "bg-muted text-foreground hover:bg-muted/80"
                }`}
                data-testid={`subscribe-${plan.name.toLowerCase()}`}
              >
                Subscribe
              </Button>
            </motion.div>
          ))}
        </div>
      </div>

      {/* Disclaimer */}
      <p className="text-center text-xs text-muted-foreground px-6 mt-4">
        Cancel anytime. No hidden fees. PRO membership auto-renews.
      </p>
    </div>
  );
}
