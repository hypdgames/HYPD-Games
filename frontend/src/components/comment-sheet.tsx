"use client";

import { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, MessageCircle, Send, Loader2, Trash2, Heart } from "lucide-react";
import { useAuthStore } from "@/store";
import { toast } from "sonner";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "";

interface Comment {
  id: string;
  user_id: string;
  username: string;
  avatar_url?: string;
  content: string;
  created_at: string;
  like_count: number;
  liked_by_me: boolean;
}

interface CommentSheetProps {
  gameId: string;
  gameTitle: string;
  isOpen: boolean;
  onClose: () => void;
  onCommentPosted?: () => void;
}

function timeAgo(iso: string) {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h`;
  return `${Math.floor(hours / 24)}d`;
}

export function CommentSheet({ gameId, gameTitle, isOpen, onClose, onCommentPosted }: CommentSheetProps) {
  const { user, token } = useAuthStore();
  const [comments, setComments] = useState<Comment[]>([]);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [text, setText] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isOpen) return;
    setLoading(true);
    fetch(`${API_URL}/api/games/${gameId}/comments`, {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    })
      .then(r => r.json())
      .then(d => setComments(d.comments || []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [isOpen, gameId]);

  useEffect(() => {
    if (isOpen) setTimeout(() => inputRef.current?.focus(), 400);
  }, [isOpen]);

  const submit = async () => {
    if (!text.trim()) return;
    if (!user) { toast.error("Please sign in to comment"); return; }
    setSubmitting(true);
    try {
      const res = await fetch(`${API_URL}/api/games/${gameId}/comments`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ content: text.trim() }),
      });
      if (res.ok) {
        const newComment = await res.json();
        setComments(prev => [{ ...newComment, like_count: 0, liked_by_me: false }, ...prev]);
        setText("");
        onCommentPosted?.();
      } else {
        toast.error("Failed to post comment");
      }
    } catch {
      toast.error("Network error");
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (commentId: string) => {
    try {
      const res = await fetch(`${API_URL}/api/games/${gameId}/comments/${commentId}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) setComments(prev => prev.filter(c => c.id !== commentId));
    } catch {}
  };

  const handleLike = async (commentId: string) => {
    if (!user) { toast.error("Sign in to like comments"); return; }
    const target = comments.find(c => c.id === commentId);
    if (!target) return;
    const wasLiked = target.liked_by_me;
    // Optimistic update
    setComments(prev => prev.map(c =>
      c.id === commentId
        ? { ...c, liked_by_me: !wasLiked, like_count: c.like_count + (wasLiked ? -1 : 1) }
        : c
    ));
    try {
      const res = await fetch(`${API_URL}/api/games/${gameId}/comments/${commentId}/like`, {
        method: wasLiked ? "DELETE" : "POST",
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error();
    } catch {
      // Revert on failure
      setComments(prev => prev.map(c =>
        c.id === commentId
          ? { ...c, liked_by_me: wasLiked, like_count: c.like_count + (wasLiked ? 1 : -1) }
          : c
      ));
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 z-[500] bg-black/60 backdrop-blur-sm"
            data-testid="comment-backdrop"
          />
          <motion.div
            initial={{ y: "100%" }}
            animate={{ y: 0 }}
            exit={{ y: "100%" }}
            transition={{ type: "spring", damping: 32, stiffness: 320 }}
            className="fixed bottom-0 left-0 right-0 z-[500] mx-auto max-w-[540px] bg-background rounded-t-3xl flex flex-col shadow-2xl"
            style={{ maxHeight: "82dvh" }}
            data-testid="comment-sheet"
          >
            {/* Drag handle */}
            <div className="flex justify-center pt-3 pb-1 flex-shrink-0">
              <div className="w-10 h-1 rounded-full bg-foreground/15" />
            </div>

            {/* Header */}
            <div className="flex items-center justify-between px-5 py-3 flex-shrink-0 border-b border-border/60">
              <div>
                <h3 className="font-bold text-base" data-testid="comment-sheet-title">
                  Comments {comments.length > 0 && <span className="text-muted-foreground font-normal text-sm">({comments.length})</span>}
                </h3>
                <p className="text-xs text-muted-foreground line-clamp-1">{gameTitle}</p>
              </div>
              <button
                onClick={onClose}
                className="w-8 h-8 rounded-full bg-muted flex items-center justify-center"
                data-testid="comment-close-btn"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Comments list */}
            <div ref={listRef} className="flex-1 overflow-y-auto px-5 py-4 space-y-5 min-h-0">
              {loading ? (
                <div className="flex justify-center py-10">
                  <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
                </div>
              ) : comments.length === 0 ? (
                <div className="flex flex-col items-center py-10 text-center">
                  <MessageCircle className="w-12 h-12 text-muted-foreground/30 mb-3" />
                  <p className="font-semibold text-sm text-foreground">No comments yet</p>
                  <p className="text-xs text-muted-foreground mt-1">Be the first to comment!</p>
                </div>
              ) : (
                comments.map(c => (
                  <motion.div
                    key={c.id}
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="flex gap-3 group"
                    data-testid={`comment-${c.id}`}
                  >
                    <div className="w-8 h-8 rounded-full bg-violet/20 flex items-center justify-center flex-shrink-0">
                      {c.avatar_url ? (
                        <img src={c.avatar_url} alt={c.username} className="w-full h-full rounded-full object-cover" />
                      ) : (
                        <span className="text-xs font-bold text-violet uppercase">{c.username[0]}</span>
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-bold text-foreground">{c.username}</span>
                        <span className="text-[10px] text-muted-foreground">{timeAgo(c.created_at)}</span>
                        {(user?.id === c.user_id || user?.is_admin) && (
                          <button
                            onClick={() => handleDelete(c.id)}
                            className="ml-auto opacity-0 group-hover:opacity-100 transition-opacity p-1"
                          >
                            <Trash2 className="w-3 h-3 text-red-400" />
                          </button>
                        )}
                      </div>
                      <p className="text-sm text-foreground/85 mt-0.5 break-words leading-relaxed">{c.content}</p>
                      <div className="flex items-center mt-1.5">
                        <motion.button
                          whileTap={{ scale: 0.85 }}
                          onClick={() => handleLike(c.id)}
                          className={`flex items-center gap-1 text-xs transition-colors ${c.liked_by_me ? "text-red-500" : "text-muted-foreground hover:text-foreground"}`}
                          data-testid={`like-comment-${c.id}`}
                        >
                          <Heart className={`w-3.5 h-3.5 ${c.liked_by_me ? "fill-red-500" : ""}`} />
                          {c.like_count > 0 && <span className="font-medium">{c.like_count}</span>}
                        </motion.button>
                      </div>
                    </div>                  </motion.div>
                ))
              )}
            </div>

            {/* Input area */}
            <div className="flex-shrink-0 border-t border-border/60" style={{ paddingBottom: "calc(80px + max(0px, env(safe-area-inset-bottom)))" }}>
              {user ? (
                <div className="flex items-center gap-2.5 px-4 py-3">
                  <div className="w-8 h-8 rounded-full bg-violet/20 flex items-center justify-center flex-shrink-0">
                    <span className="text-xs font-bold text-violet uppercase">{user.username[0]}</span>
                  </div>
                  <input
                    ref={inputRef}
                    value={text}
                    onChange={e => setText(e.target.value)}
                    onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); submit(); } }}
                    placeholder="Add a comment..."
                    maxLength={500}
                    className="flex-1 bg-muted rounded-full px-4 py-2.5 text-sm outline-none placeholder:text-muted-foreground"
                    data-testid="comment-input"
                  />
                  <motion.button
                    whileTap={{ scale: 0.85 }}
                    onClick={submit}
                    disabled={!text.trim() || submitting}
                    className="w-9 h-9 rounded-full bg-lime flex items-center justify-center disabled:opacity-40 flex-shrink-0"
                    data-testid="comment-submit-btn"
                  >
                    {submitting
                      ? <Loader2 className="w-4 h-4 animate-spin text-black" />
                      : <Send className="w-4 h-4 text-black" />
                    }
                  </motion.button>
                </div>
              ) : (
                <div className="flex flex-col items-center gap-3 px-5 py-4">
                  <p className="text-sm font-semibold text-foreground">Join the conversation</p>
                  <p className="text-xs text-muted-foreground -mt-1">Login or create an account to comment</p>
                  <div className="flex gap-2.5 w-full">
                    <motion.a
                      whileTap={{ scale: 0.96 }}
                      href="/welcome"
                      className="flex-1 bg-foreground text-background font-bold text-sm py-2.5 rounded-2xl text-center"
                      data-testid="comment-login-btn"
                    >
                      Login
                    </motion.a>
                    <motion.a
                      whileTap={{ scale: 0.96 }}
                      href="/welcome"
                      className="flex-1 bg-lime text-black font-bold text-sm py-2.5 rounded-2xl text-center"
                      data-testid="comment-signup-btn"
                    >
                      Sign Up
                    </motion.a>
                  </div>
                </div>
              )}
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
