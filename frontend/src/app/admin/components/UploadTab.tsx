"use client";

import { useRef, useState } from "react";
import { motion } from "framer-motion";
import { Upload, Image as ImageIcon, Video, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { CATEGORIES } from "./types";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "";

interface UploadTabProps {
  token: string | null;
  onGameCreated: () => void;
}

export function UploadTab({ token, onGameCreated }: UploadTabProps) {
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  
  const gameFileRef = useRef<HTMLInputElement>(null);
  const thumbnailRef = useRef<HTMLInputElement>(null);
  const videoPreviewRef = useRef<HTMLInputElement>(null);

  const [newGame, setNewGame] = useState({
    title: "",
    description: "",
    category: "Action",
    preview_type: "image" as "video" | "gif" | "image",
  });
  const [thumbnailFile, setThumbnailFile] = useState<File | null>(null);
  const [gameFile, setGameFile] = useState<File | null>(null);
  const [videoPreviewFile, setVideoPreviewFile] = useState<File | null>(null);

  const handleCreateGame = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!thumbnailFile || !gameFile) {
      toast.error("Please select thumbnail and game file");
      return;
    }

    setUploading(true);
    setUploadProgress(0);

    const formData = new FormData();
    formData.append("title", newGame.title);
    formData.append("description", newGame.description);
    formData.append("category", newGame.category);
    formData.append("preview_type", newGame.preview_type);
    formData.append("thumbnail", thumbnailFile);
    formData.append("game_zip", gameFile);
    if (videoPreviewFile) {
      formData.append("video_preview", videoPreviewFile);
    }

    try {
      const xhr = new XMLHttpRequest();
      
      xhr.upload.addEventListener("progress", (e) => {
        if (e.lengthComputable) {
          const progress = Math.round((e.loaded / e.total) * 100);
          setUploadProgress(progress);
        }
      });

      xhr.addEventListener("load", () => {
        if (xhr.status >= 200 && xhr.status < 300) {
          toast.success("Game created successfully!");
          setNewGame({
            title: "",
            description: "",
            category: "Action",
            preview_type: "image",
          });
          setThumbnailFile(null);
          setGameFile(null);
          setVideoPreviewFile(null);
          onGameCreated();
        } else {
          const error = JSON.parse(xhr.responseText);
          toast.error(error.detail || "Failed to create game");
        }
        setUploading(false);
        setUploadProgress(0);
      });

      xhr.addEventListener("error", () => {
        toast.error("Upload failed");
        setUploading(false);
        setUploadProgress(0);
      });

      xhr.open("POST", `${API_URL}/api/admin/games/create-with-files`);
      xhr.setRequestHeader("Authorization", `Bearer ${token}`);
      xhr.send(formData);
    } catch (e) {
      console.error("Upload error:", e);
      toast.error("Failed to upload game");
      setUploading(false);
      setUploadProgress(0);
    }
  };

  return (
    <form onSubmit={handleCreateGame} className="space-y-6">
      <div className="space-y-4">
        <div className="space-y-2">
          <Label>Game Title</Label>
          <Input
            value={newGame.title}
            onChange={(e) => setNewGame({ ...newGame, title: e.target.value })}
            placeholder="Enter game title"
            required
            data-testid="game-title-input"
          />
        </div>

        <div className="space-y-2">
          <Label>Description</Label>
          <Input
            value={newGame.description}
            onChange={(e) => setNewGame({ ...newGame, description: e.target.value })}
            placeholder="Enter game description"
            required
            data-testid="game-description-input"
          />
        </div>

        <div className="space-y-2">
          <Label>Category</Label>
          <select
            value={newGame.category}
            onChange={(e) => setNewGame({ ...newGame, category: e.target.value })}
            className="w-full h-12 px-4 rounded-xl bg-card border border-border text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
            data-testid="game-category-select"
          >
            {CATEGORIES.map((cat) => (
              <option key={cat} value={cat}>
                {cat}
              </option>
            ))}
          </select>
        </div>

        <div className="space-y-2">
          <Label>Preview Type</Label>
          <div className="grid grid-cols-3 gap-2">
            {(["image", "gif", "video"] as const).map((type) => (
              <button
                key={type}
                type="button"
                onClick={() => setNewGame({ ...newGame, preview_type: type })}
                className={`p-3 rounded-xl border text-sm font-medium transition-all ${
                  newGame.preview_type === type
                    ? "bg-lime text-black border-lime"
                    : "bg-card border-border text-foreground hover:border-lime/50"
                }`}
              >
                {type === "image" && <ImageIcon className="w-4 h-4 mx-auto mb-1" />}
                {type === "video" && <Video className="w-4 h-4 mx-auto mb-1" />}
                {type === "gif" && <ImageIcon className="w-4 h-4 mx-auto mb-1" />}
                {type.charAt(0).toUpperCase() + type.slice(1)}
              </button>
            ))}
          </div>
        </div>

        <div className="space-y-4 pt-4 border-t border-border">
          <div className="space-y-2">
            <Label>Thumbnail Image</Label>
            <div
              onClick={() => thumbnailRef.current?.click()}
              className="border-2 border-dashed border-border rounded-xl p-6 text-center cursor-pointer hover:border-lime/50 transition-colors"
            >
              <ImageIcon className="w-8 h-8 text-muted-foreground mx-auto mb-2" />
              <p className="text-sm text-muted-foreground">
                {thumbnailFile ? thumbnailFile.name : "Click to upload thumbnail"}
              </p>
            </div>
            <input
              ref={thumbnailRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => setThumbnailFile(e.target.files?.[0] || null)}
            />
          </div>

          {newGame.preview_type === "video" && (
            <div className="space-y-2">
              <Label>Video Preview (optional)</Label>
              <div
                onClick={() => videoPreviewRef.current?.click()}
                className="border-2 border-dashed border-border rounded-xl p-6 text-center cursor-pointer hover:border-lime/50 transition-colors"
              >
                <Video className="w-8 h-8 text-muted-foreground mx-auto mb-2" />
                <p className="text-sm text-muted-foreground">
                  {videoPreviewFile ? videoPreviewFile.name : "Click to upload video preview"}
                </p>
              </div>
              <input
                ref={videoPreviewRef}
                type="file"
                accept="video/*"
                className="hidden"
                onChange={(e) => setVideoPreviewFile(e.target.files?.[0] || null)}
              />
            </div>
          )}

          <div className="space-y-2">
            <Label>Game File (.zip)</Label>
            <div
              onClick={() => gameFileRef.current?.click()}
              className="border-2 border-dashed border-border rounded-xl p-6 text-center cursor-pointer hover:border-lime/50 transition-colors"
            >
              <Upload className="w-8 h-8 text-muted-foreground mx-auto mb-2" />
              <p className="text-sm text-muted-foreground">
                {gameFile ? gameFile.name : "Click to upload game zip file"}
              </p>
            </div>
            <input
              ref={gameFileRef}
              type="file"
              accept=".zip"
              className="hidden"
              onChange={(e) => setGameFile(e.target.files?.[0] || null)}
            />
          </div>
        </div>
      </div>

      {uploading && (
        <div className="space-y-2">
          <div className="h-2 bg-card rounded-full overflow-hidden">
            <motion.div
              className="h-full bg-lime"
              initial={{ width: 0 }}
              animate={{ width: `${uploadProgress}%` }}
            />
          </div>
          <p className="text-sm text-muted-foreground text-center">
            Uploading... {uploadProgress}%
          </p>
        </div>
      )}

      <Button
        type="submit"
        disabled={uploading}
        className="w-full"
        data-testid="upload-game-button"
      >
        {uploading ? <Loader2 className="w-5 h-5 animate-spin" /> : "Upload Game"}
      </Button>
    </form>
  );
}
