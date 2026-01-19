"use client";

import { useState, useEffect, useCallback } from "react";
import { motion } from "framer-motion";
import { 
  Crown, Check, Zap, Shield, Star, Target, Trophy, 
  Calendar, Clock, Users, Loader2, ChevronRight 
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Progress } from "@/components/ui/progress";
import { useAuthStore } from "@/store";
import { ThemeToggle } from "@/components/theme-toggle";
import BottomNav from "@/components/bottom-nav";
import { toast } from "sonner";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "";

interface Challenge {
  id: string;
  title: string;
  description: string;
  challenge_type: string;
  target_type: string;
  target_value: number;
  game_id?: string;
  reward_points: number;
  reward_badge?: string;
  ends_at?: string;
  joined: boolean;
  progress: number;
  completed: boolean;
}

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
  const { token, settings } = useAuthStore();
  const [challenges, setChallenges] = useState<Challenge[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (token) {
      fetchChallenges();
    }
  }, [token]);

  const fetchChallenges = async () => {
    setLoading(true);
    try {
      const res = await fetch(`${API_URL}/api/challenges`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        setChallenges(data.challenges || []);
      }
    } catch (error) {
      console.error("Error fetching challenges:", error);
    }
    setLoading(false);
  };

  const joinChallenge = async (challengeId: string) => {
    try {
      const res = await fetch(`${API_URL}/api/challenges/join/${challengeId}`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        toast.success("Joined challenge!");
        fetchChallenges();
      } else {
        const error = await res.json();
        toast.error(error.detail || "Failed to join challenge");
      }
    } catch {
      toast.error("Failed to join challenge");
    }
  };

  const getChallengeIcon = (type: string) => {
    switch (type) {
      case "daily":
        return <Calendar className="w-5 h-5 text-lime" />;
      case "weekly":
        return <Trophy className="w-5 h-5 text-yellow-400" />;
      case "friend":
        return <Users className="w-5 h-5 text-blue-400" />;
      default:
        return <Target className="w-5 h-5 text-lime" />;
    }
  };

  const getTimeRemaining = (endsAt: string) => {
    const end = new Date(endsAt);
    const now = new Date();
    const diff = end.getTime() - now.getTime();
    
    if (diff <= 0) return "Expired";
    
    const hours = Math.floor(diff / (1000 * 60 * 60));
    const mins = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
    
    if (hours > 24) {
      const days = Math.floor(hours / 24);
      return `${days}d ${hours % 24}h left`;
    }
    return `${hours}h ${mins}m left`;
  };

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

      <div className="p-4">
        <Tabs defaultValue="challenges" className="w-full">
          <TabsList className="grid w-full grid-cols-2 mb-6">
            <TabsTrigger value="challenges" className="flex items-center gap-2">
              <Target className="w-4 h-4" />
              Challenges
            </TabsTrigger>
            <TabsTrigger value="upgrade" className="flex items-center gap-2">
              <Crown className="w-4 h-4" />
              Upgrade
            </TabsTrigger>
          </TabsList>

          {/* Challenges Tab */}
          <TabsContent value="challenges">
            {!token ? (
              <div className="text-center py-12">
                <Target className="w-16 h-16 text-muted-foreground mx-auto mb-4 opacity-50" />
                <h3 className="text-xl font-bold text-foreground mb-2">Login to Join Challenges</h3>
                <p className="text-muted-foreground mb-4">Complete challenges to earn rewards!</p>
                <Button 
                  onClick={() => window.location.href = "/profile"}
                  className="bg-lime text-black hover:bg-lime/90"
                >
                  Login Now
                </Button>
              </div>
            ) : loading ? (
              <div className="flex justify-center py-12">
                <Loader2 className="w-8 h-8 text-lime animate-spin" />
              </div>
            ) : challenges.length === 0 ? (
              <div className="text-center py-12">
                <Target className="w-16 h-16 text-muted-foreground mx-auto mb-4 opacity-50" />
                <h3 className="text-xl font-bold text-foreground mb-2">No Active Challenges</h3>
                <p className="text-muted-foreground">Check back soon for new challenges!</p>
              </div>
            ) : (
              <div className="space-y-4">
                {challenges.map((challenge, index) => (
                  <motion.div
                    key={challenge.id}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: index * 0.1 }}
                    className={`bg-card border rounded-xl p-4 ${
                      challenge.completed ? "border-lime/50 bg-lime/5" : "border-border"
                    }`}
                  >
                    <div className="flex items-start gap-4">
                      <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${
                        challenge.completed ? "bg-lime/20" : "bg-muted"
                      }`}>
                        {challenge.completed ? (
                          <Check className="w-6 h-6 text-lime" />
                        ) : (
                          getChallengeIcon(challenge.challenge_type)
                        )}
                      </div>
                      
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <h3 className="font-bold text-foreground">{challenge.title}</h3>
                          <span className={`text-xs px-2 py-0.5 rounded-full ${
                            challenge.challenge_type === "daily" 
                              ? "bg-lime/20 text-lime" 
                              : challenge.challenge_type === "weekly"
                              ? "bg-yellow-400/20 text-yellow-400"
                              : "bg-blue-400/20 text-blue-400"
                          }`}>
                            {challenge.challenge_type}
                          </span>
                        </div>
                        
                        <p className="text-sm text-muted-foreground mb-3">
                          {challenge.description}
                        </p>
                        
                        {challenge.joined && !challenge.completed && (
                          <div className="mb-3">
                            <div className="flex justify-between text-xs mb-1">
                              <span className="text-muted-foreground">Progress</span>
                              <span className="text-foreground font-bold">
                                {challenge.progress} / {challenge.target_value}
                              </span>
                            </div>
                            <Progress 
                              value={(challenge.progress / challenge.target_value) * 100} 
                              className="h-2"
                            />
                          </div>
                        )}
                        
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-3 text-xs text-muted-foreground">
                            {challenge.ends_at && (
                              <span className="flex items-center gap-1">
                                <Clock className="w-3 h-3" />
                                {getTimeRemaining(challenge.ends_at)}
                              </span>
                            )}
                            {challenge.reward_points > 0 && (
                              <span className="flex items-center gap-1 text-lime">
                                <Star className="w-3 h-3" />
                                +{challenge.reward_points} pts
                              </span>
                            )}
                          </div>
                          
                          {!challenge.joined && !challenge.completed && (
                            <Button
                              size="sm"
                              onClick={() => joinChallenge(challenge.id)}
                              className="bg-lime text-black hover:bg-lime/90"
                            >
                              Join
                              <ChevronRight className="w-4 h-4 ml-1" />
                            </Button>
                          )}
                          
                          {challenge.completed && (
                            <span className="text-lime font-bold text-sm flex items-center gap-1">
                              <Check className="w-4 h-4" />
                              Completed!
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  </motion.div>
                ))}
              </div>
            )}
          </TabsContent>

          {/* Upgrade Tab */}
          <TabsContent value="upgrade">
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
            <div className="space-y-4">
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

                  <div className="flex items-center justify-between mb-4">
                    <div>
                      <h3 className="font-heading text-xl text-foreground">
                        {plan.name}
                      </h3>
                      <div className="flex items-baseline gap-1">
                        <span className="font-heading text-2xl text-foreground">
                          {plan.price}
                        </span>
                        <span className="text-muted-foreground text-sm">
                          /{plan.period}
                        </span>
                      </div>
                    </div>
                    <Button
                      className={`${
                        plan.popular ? "bg-lime text-black" : "bg-card border border-border"
                      }`}
                      disabled={plan.disabled}
                      variant={plan.popular ? "default" : "outline"}
                    >
                      {plan.cta}
                    </Button>
                  </div>

                  <ul className="grid grid-cols-2 gap-2">
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
                </motion.div>
              ))}
            </div>

            {/* Benefits */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.3 }}
              className="mt-8 grid grid-cols-3 gap-4"
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
          </TabsContent>
        </Tabs>
      </div>

      <BottomNav />
    </div>
  );
}
