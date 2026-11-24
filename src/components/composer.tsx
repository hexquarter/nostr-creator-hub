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
  // The gold button reflects the Crays premium activation: with premium,
  // Premium Posting opens the premium composer; without it, the membership
  // popup opens.
  const premiumActive = isCreatorPassActive(useCreatorPass());
  const [text, setText] = useState("");
  // Uploaded visual media (images and videos), published as a NIP-68
  // picture/video event (kinds 20/21/22) when present.
  const [media, setMedia] = useState<
    { url: string; mime: string; dim?: string; poster?: string }[]
  >([]);
  const [uploading, setUploading] = useState(false);
  const [posting, setPosting] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const accountName = account?.profile.displayName || account?.profile.name || account?.npub;

  /** Read a video's dimensions and capture a first-frame poster image. */
  const probeVideo = (file: File): Promise<{ dim?: string; poster?: Blob | null }> => {
    return new Promise((resolve) => {
      const url = URL.createObjectURL(file);
      const video = document.createElement("video");
      video.preload = "auto";
      video.muted = true;
      video.src = url;
      let settled = false;
      const done = (result: { dim?: string; poster?: Blob | null }) => {
        if (settled) return;
        settled = true;
        URL.revokeObjectURL(url);
        resolve(result);
      };
      video.onerror = () => done({});
      video.onloadeddata = () => {
        const dim = `${video.videoWidth}x${video.videoHeight}`;
        const canvas = document.createElement("canvas");
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
        const ctx = canvas.getContext("2d");
        video.currentTime = Math.min(1, (video.duration || 2) / 3);
        video.onseeked = () => {
          try {
            ctx?.drawImage(video, 0, 0, canvas.width, canvas.height);
            canvas.toBlob((blob) => done({ dim, poster: blob }), "image/jpeg", 0.8);
          } catch {
            done({ dim });
          }
        };
        video.onerror = () => done({ dim });
      };
      // Give up after 8s — a slow probe must never block posting.
      window.setTimeout(() => done({}), 8000);
    });
  };

  const pickMedia = async (files: FileList | null) => {
    if (!files?.length) return;
    if (!ui.requireAuth("attach media")) return;
    setUploading(true);
    try {
      const uploaded: { url: string; mime: string; dim?: string; poster?: string }[] = [];
      for (const file of Array.from(files).slice(0, 4)) {
        const isVideo = file.type.startsWith("video/");
        if (!file.type.startsWith("image/") && !isVideo) {
          toast.error(`${file.name} isn't an image or video.`);
          continue;
        }
        const url = await nostr.uploadFile(file);
        if (isVideo) {
          const { dim, poster: posterBlob } = await probeVideo(file);
          let poster: string | undefined;
          if (posterBlob) {
            try {
              poster = await nostr.uploadFile(
                new File([posterBlob], "poster.jpg", { type: "image/jpeg" }),
              );
            } catch {
              // A missing poster only costs a thumbnail; the video still plays.
            }
          }
          uploaded.push({ url, mime: file.type || "video/mp4", dim, poster });
        } else {
          uploaded.push({ url, mime: file.type || "image/jpeg" });
        }
      }
      if (uploaded.length) setMedia((all) => [...all, ...uploaded].slice(0, 4));
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Couldn't upload that media.");
    } finally {
      setUploading(false);
    }
  };

  const handlePost = async () => {
    if (!ui.requireAuth("post to Nostr")) return;
    if (!text.trim() && media.length === 0) {
      toast.error("Write something first");
      return;
    }
    setPosting(true);
    try {
      if (media.length > 0) {
        // Visual posts publish as NIP-68 picture/video events (kind 20/21/22).
        await nostr.publishPicture({ caption: text.trim(), media });
      } else {
        await nostr.publish({ content: text.trim() });
      }
      toast.success("Posted to Nostr");
      setText("");
      setMedia([]);
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

          {media.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {media.map((item) => (
                <div key={item.url} className="relative">
                  {item.mime.startsWith("video/") ? (
                    <video
                      src={item.url}
                      muted
                      preload="metadata"
                      className="size-20 rounded-lg object-cover ring-1 ring-black/5"
                    />
                  ) : (
                    <img
                      src={item.url}
                      alt=""
                      className="size-20 rounded-lg object-cover ring-1 ring-black/5"
                    />
                  )}
                  <button
                    onClick={() => setMedia((all) => all.filter((m) => m.url !== item.url))}
                    className="absolute -right-1.5 -top-1.5 grid size-5 place-items-center rounded-full bg-zinc-900 text-white shadow"
                    aria-label="Remove media"
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
                label="Image or video"
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
                accept="image/*,video/*"
                multiple
                className="hidden"
                onChange={(e) => {
                  void pickMedia(e.target.files);
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
