"use client";

import { useRef, useState } from "react";
import { Upload, Image as ImageIcon, Trash2, Globe, Check, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "";

interface SettingsTabProps {
  token: string | null;
  initialLogoUrl: string;
  initialLogoHeight: number;
  initialSiteName: string;
  initialFaviconUrl: string;
  initialPrimaryColor: string;
  onSettingsSaved: () => void;
}

export function SettingsTab({
  token,
  initialLogoUrl,
  initialLogoHeight,
  initialSiteName,
  initialFaviconUrl,
  initialPrimaryColor,
  onSettingsSaved,
}: SettingsTabProps) {
  const [logoUrl, setLogoUrl] = useState(initialLogoUrl);
  const [logoHeight, setLogoHeight] = useState(initialLogoHeight);
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [logoPreview, setLogoPreview] = useState(initialLogoUrl);
  const [siteName, setSiteName] = useState(initialSiteName);
  const [faviconUrl, setFaviconUrl] = useState(initialFaviconUrl);
  const [faviconFile, setFaviconFile] = useState<File | null>(null);
  const [faviconPreview, setFaviconPreview] = useState(initialFaviconUrl);
  const [primaryColor, setPrimaryColor] = useState(initialPrimaryColor);
  const [saving, setSaving] = useState(false);

  const logoFileRef = useRef<HTMLInputElement>(null);
  const faviconFileRef = useRef<HTMLInputElement>(null);

  const handleLogoFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setLogoFile(file);
      const reader = new FileReader();
      reader.onload = (e) => {
        setLogoPreview(e.target?.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleFaviconFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setFaviconFile(file);
      const reader = new FileReader();
      reader.onload = (e) => {
        setFaviconPreview(e.target?.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const saveSettings = async () => {
    setSaving(true);
    try {
      let finalLogoUrl = logoUrl;
      let finalFaviconUrl = faviconUrl;

      if (logoFile) {
        const formData = new FormData();
        formData.append("file", logoFile);
        
        const uploadRes = await fetch(`${API_URL}/api/admin/upload-logo`, {
          method: "POST",
          headers: { Authorization: `Bearer ${token}` },
          body: formData,
        });
        
        if (uploadRes.ok) {
          const uploadData = await uploadRes.json();
          finalLogoUrl = uploadData.url;
          setLogoUrl(finalLogoUrl);
        } else {
          const errorData = await uploadRes.text();
          console.error("Logo upload failed:", uploadRes.status, errorData);
          toast.error(`Failed to upload logo: ${uploadRes.status}`);
          setSaving(false);
          return;
        }
      }

      if (faviconFile) {
        const formData = new FormData();
        formData.append("file", faviconFile);
        
        const uploadRes = await fetch(`${API_URL}/api/admin/upload-favicon`, {
          method: "POST",
          headers: { Authorization: `Bearer ${token}` },
          body: formData,
        });
        
        if (uploadRes.ok) {
          const uploadData = await uploadRes.json();
          finalFaviconUrl = uploadData.url;
          setFaviconUrl(finalFaviconUrl);
        } else {
          toast.error("Failed to upload favicon");
          setSaving(false);
          return;
        }
      }

      const res = await fetch(`${API_URL}/api/admin/settings`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          logo_url: finalLogoUrl,
          logo_height: String(logoHeight),
          site_name: siteName,
          favicon_url: finalFaviconUrl,
          primary_color: primaryColor,
        }),
      });

      if (res.ok) {
        toast.success("Settings saved!");
        setLogoFile(null);
        setFaviconFile(null);
        onSettingsSaved();
      } else {
        toast.error("Failed to save settings");
      }
    } catch (error) {
      console.error("Error saving settings:", error);
      toast.error("Failed to save settings");
    }
    setSaving(false);
  };

  const removeLogo = async () => {
    setSaving(true);
    try {
      const res = await fetch(`${API_URL}/api/admin/settings`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          logo_url: "",
          logo_height: "32",
        }),
      });

      if (res.ok) {
        setLogoUrl("");
        setLogoPreview("");
        setLogoFile(null);
        setLogoHeight(32);
        toast.success("Logo removed!");
      } else {
        toast.error("Failed to remove logo");
      }
    } catch (error) {
      console.error("Error removing logo:", error);
      toast.error("Failed to remove logo");
    }
    setSaving(false);
  };

  const removeFavicon = async () => {
    setSaving(true);
    try {
      const res = await fetch(`${API_URL}/api/admin/settings`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          favicon_url: "",
        }),
      });

      if (res.ok) {
        setFaviconUrl("");
        setFaviconPreview("");
        setFaviconFile(null);
        toast.success("Favicon removed!");
      } else {
        toast.error("Failed to remove favicon");
      }
    } catch (error) {
      console.error("Error removing favicon:", error);
      toast.error("Failed to remove favicon");
    }
    setSaving(false);
  };

  const resetPrimaryColor = () => {
    setPrimaryColor("#CCFF00");
  };

  return (
    <div className="space-y-6">
      <h2 className="text-lg font-bold text-foreground">Site Settings</h2>
      
      {/* Site Name */}
      <div className="bg-card border border-border rounded-xl p-6">
        <h3 className="font-semibold text-foreground mb-4 flex items-center gap-2">
          <Globe className="w-5 h-5 text-lime" />
          Site Name
        </h3>
        <Input
          value={siteName}
          onChange={(e) => setSiteName(e.target.value)}
          placeholder="Enter site name"
          className="max-w-md"
          data-testid="site-name-input"
        />
        <p className="text-xs text-muted-foreground mt-2">
          This appears in the browser tab and as fallback when no logo is set
        </p>
      </div>

      {/* Logo Settings */}
      <div className="bg-card border border-border rounded-xl p-6">
        <h3 className="font-semibold text-foreground mb-4 flex items-center gap-2">
          <ImageIcon className="w-5 h-5 text-lime" />
          Header Logo
        </h3>
        
        <div className="mb-4">
          <label className="text-sm text-muted-foreground mb-2 block">Preview</label>
          <div className="bg-background border border-border rounded-lg p-4 flex items-center justify-center min-h-[100px]">
            {logoPreview ? (
              <img 
                src={logoPreview} 
                alt="Logo preview" 
                style={{ height: `${logoHeight}px` }}
                className="object-contain max-w-full"
              />
            ) : (
              <div className="text-muted-foreground text-sm">
                No logo set - showing default &quot;{siteName}&quot; text
              </div>
            )}
          </div>
        </div>

        <div className="mb-4">
          <label className="text-sm text-muted-foreground mb-2 block">Upload Logo Image</label>
          <input
            type="file"
            ref={logoFileRef}
            onChange={handleLogoFileChange}
            accept="image/*"
            className="hidden"
          />
          <div className="flex gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => logoFileRef.current?.click()}
              className="flex-1"
              data-testid="upload-logo-button"
            >
              <Upload className="w-4 h-4 mr-2" />
              {logoFile ? logoFile.name : "Choose Image"}
            </Button>
            {(logoPreview || logoUrl) && (
              <Button
                type="button"
                variant="outline"
                onClick={removeLogo}
                className="text-red-500 hover:text-red-600"
                disabled={saving}
              >
                <Trash2 className="w-4 h-4" />
              </Button>
            )}
          </div>
          <p className="text-xs text-muted-foreground mt-1">
            Recommended: PNG or SVG with transparent background
          </p>
        </div>

        <div>
          <label className="text-sm text-muted-foreground mb-2 block">
            Logo Height: <span className="font-mono" style={{ color: primaryColor }}>{logoHeight}px</span>
          </label>
          <input
            type="range"
            min="20"
            max="80"
            value={logoHeight}
            onChange={(e) => setLogoHeight(parseInt(e.target.value))}
            className="w-full h-2 bg-background rounded-lg appearance-none cursor-pointer"
            style={{ accentColor: primaryColor }}
            data-testid="logo-height-slider"
          />
          <div className="flex justify-between text-xs text-muted-foreground mt-1">
            <span>20px</span>
            <span>80px</span>
          </div>
        </div>
      </div>

      {/* Favicon Settings */}
      <div className="bg-card border border-border rounded-xl p-6">
        <h3 className="font-semibold text-foreground mb-4 flex items-center gap-2">
          <ImageIcon className="w-5 h-5 text-lime" />
          Favicon
        </h3>
        
        <div className="mb-4">
          <label className="text-sm text-muted-foreground mb-2 block">Preview</label>
          <div className="bg-background border border-border rounded-lg p-4 flex items-center gap-4">
            <div className="w-8 h-8 rounded border border-border flex items-center justify-center overflow-hidden">
              {faviconPreview ? (
                <img 
                  src={faviconPreview} 
                  alt="Favicon preview" 
                  className="w-full h-full object-contain"
                />
              ) : (
                <span className="text-xs text-muted-foreground">16x</span>
              )}
            </div>
            <div className="w-12 h-12 rounded border border-border flex items-center justify-center overflow-hidden">
              {faviconPreview ? (
                <img 
                  src={faviconPreview} 
                  alt="Favicon preview" 
                  className="w-full h-full object-contain"
                />
              ) : (
                <span className="text-xs text-muted-foreground">32x</span>
              )}
            </div>
            <span className="text-sm text-muted-foreground">
              {faviconPreview ? "Browser tab icon" : "No favicon set"}
            </span>
          </div>
        </div>

        <div>
          <label className="text-sm text-muted-foreground mb-2 block">Upload Favicon</label>
          <input
            type="file"
            ref={faviconFileRef}
            onChange={handleFaviconFileChange}
            accept="image/png,image/x-icon,image/svg+xml"
            className="hidden"
          />
          <div className="flex gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => faviconFileRef.current?.click()}
              className="flex-1"
              data-testid="upload-favicon-button"
            >
              <Upload className="w-4 h-4 mr-2" />
              {faviconFile ? faviconFile.name : "Choose Icon"}
            </Button>
            {(faviconPreview || faviconUrl) && (
              <Button
                type="button"
                variant="outline"
                onClick={removeFavicon}
                className="text-red-500 hover:text-red-600"
                disabled={saving}
              >
                <Trash2 className="w-4 h-4" />
              </Button>
            )}
          </div>
          <p className="text-xs text-muted-foreground mt-1">
            Recommended: 32x32 or 64x64 PNG, ICO, or SVG
          </p>
        </div>
      </div>

      {/* Color Settings */}
      <div className="bg-card border border-border rounded-xl p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-semibold text-foreground flex items-center gap-2">
            <div className="w-5 h-5 rounded-full" style={{ backgroundColor: primaryColor }} />
            Brand Color
          </h3>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={resetPrimaryColor}
            className="text-xs text-muted-foreground hover:text-foreground"
          >
            Reset to Default
          </Button>
        </div>
        
        <div>
          <label className="text-sm text-muted-foreground mb-2 block">Primary Color</label>
          <div className="flex items-center gap-2 max-w-xs">
            <input
              type="color"
              value={primaryColor}
              onChange={(e) => setPrimaryColor(e.target.value)}
              className="w-12 h-10 rounded cursor-pointer border-0"
              data-testid="primary-color-picker"
            />
            <Input
              value={primaryColor}
              onChange={(e) => setPrimaryColor(e.target.value)}
              className="font-mono text-sm flex-1"
              placeholder="#CCFF00"
            />
          </div>
          <p className="text-xs text-muted-foreground mt-2">
            Used for buttons, accents, and highlights. Light/dark mode backgrounds are automatic.
          </p>
        </div>

        <div className="mt-4 p-4 rounded-lg border border-border bg-background">
          <div className="flex items-center gap-3 flex-wrap">
            <button 
              className="px-4 py-2 rounded-lg font-semibold text-sm"
              style={{ backgroundColor: primaryColor, color: '#000' }}
            >
              Primary Button
            </button>
            <span style={{ color: primaryColor }} className="text-sm font-semibold">
              Highlighted Text
            </span>
          </div>
        </div>
      </div>

      {/* Save Button */}
      <Button
        onClick={saveSettings}
        disabled={saving}
        className="w-full text-black hover:opacity-90"
        style={{ backgroundColor: primaryColor }}
        data-testid="save-settings-button"
      >
        {saving ? (
          <>
            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
            Saving...
          </>
        ) : (
          <>
            <Check className="w-4 h-4 mr-2" />
            Save All Settings
          </>
        )}
      </Button>
    </div>
  );
}
