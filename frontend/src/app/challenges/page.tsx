"use client";

import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { 
  Target, Trophy, Calendar, Clock, Users, 
  Loader2, ChevronRight, Check, Star, Flame
} from "lucide-react";
import { Button } from "@/components/ui/button";
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

export default function ChallengesPage() {
  const { token, settings } = useAuthStore();
  const [challenges, setChallenges] = useState<Challenge[]>([]);
  const [loading, setLoading] = useState(false);
  const [filter, setFilter] = useState<"all" | "daily" | "weekly">("all");

  useEffect(() => {
    if (token) {
      fetchChallenges();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
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

  const filteredChallenges = challenges.filter(c => {
    if (filter === "all") return true;
    return c.challenge_type === filter;
  });

  const completedCount = challenges.filter(c => c.completed).length;
  const activeCount = challenges.filter(c => c.joined && !c.completed).length;

  return (
    <div className="min-h-screen bg-background pb-24" data-testid="challenges-page">
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
            <span className="text-muted-foreground">Challenges</span>
          </div>
          <ThemeToggle />
        </div>
      </div>

      <div className="p-4">
        {!token ? (
          <div className="text-center py-16">
            <div className="w-24 h-24 rounded-full bg-gradient-to-br from-lime/20 to-violet/20 flex items-center justify-center mx-auto mb-6">
              <Target className="w-12 h-12 text-lime" />
            </div>
            <h2 className="text-2xl font-heading text-foreground mb-3">
              Join Challenges
            </h2>
            <p className="text-muted-foreground mb-6 max-w-sm mx-auto">
              Complete daily and weekly challenges to earn points, badges, and climb the leaderboard!
            </p>
            <Button 
              onClick={() => window.location.href = "/profile"}
              className="bg-lime text-black hover:bg-lime/90"
              size="lg"
            >
              Login to Start
            </Button>
          </div>
        ) : (
          <>
            {/* Stats Cards */}
            <div className="grid grid-cols-3 gap-3 mb-6">
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="bg-card border border-border rounded-xl p-3 text-center"
              >
                <Flame className="w-5 h-5 text-orange-400 mx-auto mb-1" />
                <p className="text-xl font-heading text-foreground">{activeCount}</p>
                <p className="text-[10px] text-muted-foreground">Active</p>
              </motion.div>
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.05 }}
                className="bg-card border border-border rounded-xl p-3 text-center"
              >
                <Check className="w-5 h-5 text-lime mx-auto mb-1" />
                <p className="text-xl font-heading text-foreground">{completedCount}</p>
                <p className="text-[10px] text-muted-foreground">Completed</p>
              </motion.div>
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.1 }}
                className="bg-card border border-border rounded-xl p-3 text-center"
              >
                <Star className="w-5 h-5 text-yellow-400 mx-auto mb-1" />
                <p className="text-xl font-heading text-foreground">
                  {challenges.reduce((acc, c) => acc + (c.completed ? c.reward_points : 0), 0)}
                </p>
                <p className="text-[10px] text-muted-foreground">Points</p>
              </motion.div>
            </div>

            {/* Filter Tabs */}
            <div className="flex gap-2 mb-6 overflow-x-auto pb-2">
              {[
                { key: "all", label: "All", icon: Target },
                { key: "daily", label: "Daily", icon: Calendar },
                { key: "weekly", label: "Weekly", icon: Trophy },
              ].map(({ key, label, icon: Icon }) => (
                <button
                  key={key}
                  onClick={() => setFilter(key as typeof filter)}
                  className={`flex items-center gap-2 px-4 py-2 rounded-full text-sm font-medium whitespace-nowrap transition-all ${
                    filter === key
                      ? "bg-lime text-black"
                      : "bg-card border border-border text-foreground hover:border-lime/50"
                  }`}
                >
                  <Icon className="w-4 h-4" />
                  {label}
                </button>
              ))}
            </div>

            {/* Challenges List */}
            {loading ? (
              <div className="flex justify-center py-12">
                <Loader2 className="w-8 h-8 text-lime animate-spin" />
              </div>
            ) : filteredChallenges.length === 0 ? (
              <div className="text-center py-12">
                <Target className="w-16 h-16 text-muted-foreground mx-auto mb-4 opacity-50" />
                <h3 className="text-xl font-bold text-foreground mb-2">No Challenges Available</h3>
                <p className="text-muted-foreground">Check back soon for new challenges!</p>
              </div>
            ) : (
              <div className="space-y-4">
                {filteredChallenges.map((challenge, index) => (
                  <motion.div
                    key={challenge.id}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: index * 0.05 }}
                    className={`bg-card border rounded-xl p-4 ${
                      challenge.completed 
                        ? "border-lime/50 bg-lime/5" 
                        : challenge.joined 
                        ? "border-violet/50" 
                        : "border-border"
                    }`}
                    data-testid={`challenge-${challenge.id}`}
                  >
                    <div className="flex items-start gap-4">
                      <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${
                        challenge.completed 
                          ? "bg-lime/20" 
                          : challenge.joined 
                          ? "bg-violet/20" 
                          : "bg-muted"
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
                          
                          {challenge.joined && !challenge.completed && (
                            <span className="text-violet text-sm font-medium">
                              In Progress
                            </span>
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
          </>
        )}
      </div>

      <BottomNav />
    </div>
  );
}
