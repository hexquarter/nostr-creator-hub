import { Image, BarChart3, FileText, Calendar, Crown, Zap, Loader2, X } from "lucide-react";
import { useRef, useState } from "react";
import { toast } from "sonner";
import { AvatarTile } from "./avatar-tile";
import { useUI } from "./modals/ui-provider";
import { useNostr } from "./nostr-provider";
import { isCreatorPassActive, useCreatorPass } from "@/lib/nostr/creator-pass";

export function Composer() {
  const ui = useUI();
  const nostr = useNostr();
  const account = nostr.account;
  // The chip reflects the Crays premium activation: with premium, posting
  // goes straight to the editor; without it, the membership popup opens.
  const premiumActive = isCreatorPassActive(useCreatorPass());
  const [text, setText] = useState("");
  const [images, setImages] = useState<string[]>([]);
  const [uploading, setUploading] = useState(false);
  const [posting, setPosting] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const accountName = account?.profile.displayName || account?.profile.name || account?.npub;

  const pickImages = async (files: FileList | null) => {
    if (!files?.length) return;
    if (!ui.requireAuth("attach media")) return;
    setUploading(true);
    try {
      const uploaded: string[] = [];
      for (const file of Array.from(files).slice(0, 4)) {
        if (!file.type.startsWith("image/")) {
          toast.error(`${file.name} isn't an image.`);
          continue;
        }
        uploaded.push(await nostr.uploadFile(file));
      }
      if (uploaded.length) setImages((all) => [...all, ...uploaded].slice(0, 4));
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Couldn't upload that image.");
    } finally {
      setUploading(false);
    }
  };

  const handlePost = async () => {
    if (!ui.requireAuth("post to Nostr")) return;
    if (!text.trim() && images.length === 0) {
      toast.error("Write something first");
      return;
    }
    setPosting(true);
    try {
      await nostr.publish({ content: text.trim(), images });
      toast.success("Posted to Nostr");
      setText("");
      setImages([]);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Couldn't publish that post.");
    } finally {
      setPosting(false);
    }
  };

  return (
    <section className="rounded-2xl bg-white p-4 shadow-card ring-1 ring-black/5 transition-shadow focus-within:shadow-elevated">
      <div className="flex gap-4">
        {account?.profile.picture ? (
          <img src={account.profile.picture} alt="" className="size-10 rounded-full object-cover" />
        ) : (
          <AvatarTile seed={accountName || "You"} size={40} />
        )}
        <div className="flex-1 space-y-3">
          <textarea
            rows={2}
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => {
              if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
                e.preventDefault();
                void handlePost();
              }
            }}
            placeholder={account ? "What are you thinking?" : "Sign in to post to Nostr"}
            className="w-full resize-none border-none bg-transparent text-[15.5px] leading-snug text-zinc-900 placeholder:text-zinc-400 focus:outline-none"
          />

          {images.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {images.map((url) => (
                <div key={url} className="relative">
                  <img
                    src={url}
                    alt=""
                    className="size-20 rounded-lg object-cover ring-1 ring-black/5"
                  />
                  <button
                    onClick={() => setImages((all) => all.filter((item) => item !== url))}
                    className="absolute -right-1.5 -top-1.5 grid size-5 place-items-center rounded-full bg-zinc-900 text-white shadow"
                    aria-label="Remove image"
                  >
                    <X className="size-3" />
                  </button>
                </div>
              ))}
            </div>
          )}

          <div className="flex items-center justify-between border-t border-zinc-100 pt-3">
            <div className="flex gap-0.5 text-zinc-400">
              <ComposerIcon
                icon={uploading ? Loader2 : Image}
                label="Image"
                spin={uploading}
                onClick={() => {
                  if (!ui.requireAuth("attach media")) return;
                  fileRef.current?.click();
                }}
              />
              <ComposerIcon icon={BarChart3} label="Poll" onClick={ui.openPollBuilder} />
              <ComposerIcon
                icon={FileText}
                label="Article"
                onClick={() => ui.openCompose({ mode: "article" })}
              />
              <input
                ref={fileRef}
                type="file"
                accept="image/*"
                multiple
                className="hidden"
                onChange={(e) => {
                  void pickImages(e.target.files);
                  e.target.value = "";
                }}
              />
            </div>
            <div className="flex items-center gap-1.5">
              <button
                onClick={() => void handlePost()}
                disabled={posting || uploading}
                className="inline-flex items-center gap-2 rounded-lg bg-brand px-4 py-2 text-[12.5px] font-semibold text-white shadow-brand ring-1 ring-brand/80 transition-all hover:bg-brand/90 hover:shadow-elevated active:scale-[0.98] disabled:opacity-60"
              >
                {posting && <Loader2 className="size-3.5 animate-spin" />}
                Post
              </button>
              <button
                onClick={() => (premiumActive ? ui.openPremiumPost() : ui.openUpgrade())}
                title={
                  premiumActive
                    ? "Premium Posting — publish members-only content"
                    : "Activate Crays premium"
                }
                className="inline-flex items-center gap-1.5 rounded-lg bg-gradient-to-r from-amber-300 to-yellow-500 px-3.5 py-2 text-[12.5px] font-bold text-zinc-950 shadow-sm shadow-amber-500/25 transition-all hover:brightness-105 active:scale-[0.98]"
              >
                <Crown className="size-3.5" />
                Premium Posting
              </button>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

function ComposerIcon({
  icon: Icon,
  label,
  onClick,
  spin,
}: {
  icon: React.ComponentType<{ className?: string; strokeWidth?: number }>;
  label: string;
  onClick?: () => void;
  spin?: boolean;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      onClick={onClick}
      className="grid size-9 place-items-center rounded-lg transition-colors hover:bg-zinc-100 hover:text-brand"
    >
      <Icon className={`size-[18px] ${spin ? "animate-spin" : ""}`} strokeWidth={2} />
    </button>
  );
}

// Keep the schedule affordance referenced so lint stays quiet if re-added.
void Calendar;
