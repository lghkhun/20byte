"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Scissors, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { cn } from "@/lib/utils";

type VideoAttachmentEditorModalProps = {
  open: boolean;
  file: File | null;
  captionText: string;
  onCaptionTextChange: (value: string) => void;
  onCancel: () => void;
  onApply: (file: File) => void | Promise<void>;
};

function formatSeconds(value: number): string {
  const safe = Number.isFinite(value) ? Math.max(0, Math.floor(value)) : 0;
  const minutes = Math.floor(safe / 60);
  const seconds = safe % 60;
  return `${minutes}:${seconds.toString().padStart(2, "0")}`;
}

function pickRecorderMimeType(): string | null {
  if (typeof MediaRecorder === "undefined") {
    return null;
  }
  const candidates = [
    "video/webm;codecs=vp9,opus",
    "video/webm;codecs=vp8,opus",
    "video/webm"
  ];
  for (const mimeType of candidates) {
    if (MediaRecorder.isTypeSupported(mimeType)) {
      return mimeType;
    }
  }
  return null;
}

function buildTrimmedFileName(originalName: string): string {
  const dotIndex = originalName.lastIndexOf(".");
  const base = dotIndex > 0 ? originalName.slice(0, dotIndex) : originalName;
  return `${base || "video"}-trimmed.webm`;
}

export function VideoAttachmentEditorModal({
  open,
  file,
  captionText,
  onCaptionTextChange,
  onCancel,
  onApply
}: VideoAttachmentEditorModalProps) {
  const isClient = typeof window !== "undefined";
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const [durationSec, setDurationSec] = useState(0);
  const [trimStartSec, setTrimStartSec] = useState(0);
  const [trimEndSec, setTrimEndSec] = useState(0);
  const [isExporting, setIsExporting] = useState(false);
  const [trimError, setTrimError] = useState<string | null>(null);
  
  // Thumbnails state
  const [thumbnails, setThumbnails] = useState<string[]>(Array(10).fill(""));
  
  const objectUrl = useMemo(() => {
    if (!file) {
      return null;
    }
    return URL.createObjectURL(file);
  }, [file]);

  useEffect(() => {
    return () => {
      if (objectUrl) {
        URL.revokeObjectURL(objectUrl);
      }
    };
  }, [objectUrl]);

  useEffect(() => {
    if (!open || !file) {
      setDurationSec(0);
      setTrimStartSec(0);
      setTrimEndSec(0);
      setTrimError(null);
      setIsExporting(false);
      setThumbnails(Array(10).fill(""));
    }
  }, [file, open]);

  // Constrain playback to trimmed area
  useEffect(() => {
    const video = videoRef.current;
    if (!video || durationSec <= 0 || trimEndSec <= 0) return;

    const onTimeUpdate = () => {
      if (video.currentTime >= trimEndSec) {
        video.pause();
        video.currentTime = trimStartSec;
      } else if (video.currentTime < trimStartSec) {
        video.currentTime = trimStartSec;
      }
    };

    video.addEventListener("timeupdate", onTimeUpdate);
    return () => {
      video.removeEventListener("timeupdate", onTimeUpdate);
    };
  }, [trimStartSec, trimEndSec, durationSec]);

  // Generate Thumbnails when duration is available
  useEffect(() => {
    if (!open || !objectUrl || durationSec <= 0) return;
    
    let isMounted = true;
    
    const generateThumbnails = async () => {
      const count = 10;
      const video = document.createElement("video");
      video.src = objectUrl;
      video.muted = true;
      video.playsInline = true;

      await new Promise((resolve) => {
        video.onloadedmetadata = resolve;
        video.onerror = resolve;
      });

      if (!isMounted) return;

      if (video.duration <= 0 || !Number.isFinite(video.duration)) {
        return;
      }

      const interval = video.duration / count;
      const thumbs: string[] = [];
      const canvas = document.createElement("canvas");
      const ctx = canvas.getContext("2d", { willReadFrequently: true });
      canvas.width = 160;
      canvas.height = 90;

      for (let i = 0; i < count; i++) {
        if (!isMounted) return;
        const targetTime = interval * i + interval / 2;
        video.currentTime = targetTime;
        
        await new Promise((resolve) => {
           video.onseeked = resolve;
           video.onerror = resolve;
           setTimeout(resolve, 1000); // Safety fallback
        });

        if (ctx) {
          ctx.fillStyle = "black";
          ctx.fillRect(0, 0, canvas.width, canvas.height);
          const videoRatio = video.videoWidth / video.videoHeight || 16/9;
          const canvasRatio = canvas.width / canvas.height;
          let drawWidth = canvas.width;
          let drawHeight = canvas.height;
          let offsetX = 0;
          let offsetY = 0;
          if (videoRatio > canvasRatio) {
            drawHeight = canvas.width / videoRatio;
            offsetY = (canvas.height - drawHeight) / 2;
          } else {
            drawWidth = canvas.height * videoRatio;
            offsetX = (canvas.width - drawWidth) / 2;
          }
          ctx.drawImage(video, offsetX, offsetY, drawWidth, drawHeight);
          thumbs.push(canvas.toDataURL("image/jpeg", 0.5));
        } else {
          thumbs.push("");
        }
      }

      if (isMounted) {
        setThumbnails(thumbs);
      }
    };

    void generateThumbnails();

    return () => {
      isMounted = false;
    };
  }, [open, objectUrl, durationSec]);

  async function exportTrimmedVideo() {
    if (!file) {
      return;
    }
    const video = videoRef.current;
    if (!video) {
      return;
    }

    setTrimError(null);
    const hasValidDuration = Number.isFinite(durationSec) && durationSec > 0;
    const startSec = hasValidDuration ? Math.max(0, Math.min(trimStartSec, durationSec)) : 0;
    const endSec = hasValidDuration ? Math.max(startSec + 0.1, Math.min(trimEndSec, durationSec)) : 0;
    const noTrimNeeded = !hasValidDuration || (startSec <= 0.05 && endSec >= durationSec - 0.05);
    if (noTrimNeeded) {
      await onApply(file);
      return;
    }

    const mediaSource = video as HTMLVideoElement & { captureStream?: () => MediaStream };
    const captureStreamSupported = typeof mediaSource.captureStream === "function";
    const recorderMimeType = pickRecorderMimeType();
    if (!captureStreamSupported || !recorderMimeType) {
      setTrimError("Browser belum mendukung trim video otomatis. Kirim tanpa trim atau pakai browser Chrome terbaru.");
      return;
    }

    setIsExporting(true);
    try {
      video.pause();
      video.currentTime = startSec;

      const stream = mediaSource.captureStream!();
      const chunks: BlobPart[] = [];
      const recorder = new MediaRecorder(stream, { mimeType: recorderMimeType });

      const trimmedBlob = await new Promise<Blob>((resolve, reject) => {
        let stopping = false;
        const stopRecorder = () => {
          if (stopping) {
            return;
          }
          stopping = true;
          try {
            video.pause();
            recorder.stop();
          } catch (error) {
            reject(error);
          }
        };

        const onTimeUpdate = () => {
          if (video.currentTime >= endSec) {
            stopRecorder();
          }
        };

        const stopTimer = window.setTimeout(() => {
          stopRecorder();
        }, Math.max(1000, Math.ceil((endSec - startSec) * 1000) + 1200));

        recorder.ondataavailable = (event) => {
          if (event.data && event.data.size > 0) {
            chunks.push(event.data);
          }
        };
        recorder.onerror = () => {
          clearTimeout(stopTimer);
          video.removeEventListener("timeupdate", onTimeUpdate);
          reject(new Error("Failed to record trimmed video."));
        };
        recorder.onstop = () => {
          clearTimeout(stopTimer);
          video.removeEventListener("timeupdate", onTimeUpdate);
          if (!chunks.length) {
            reject(new Error("No recorded video data."));
            return;
          }
          resolve(new Blob(chunks, { type: recorderMimeType }));
        };

        video.addEventListener("timeupdate", onTimeUpdate);
        try {
          recorder.start(150);
          void video.play().catch(reject);
        } catch (error) {
          clearTimeout(stopTimer);
          video.removeEventListener("timeupdate", onTimeUpdate);
          reject(error);
        }
      });

      const trimmedFile = new File([trimmedBlob], buildTrimmedFileName(file.name), {
        type: trimmedBlob.type || "video/webm",
        lastModified: Date.now()
      });
      await onApply(trimmedFile);
    } catch {
      setTrimError("Gagal memproses trim video. Coba lagi atau kirim tanpa trim.");
    } finally {
      setIsExporting(false);
    }
  }

  if (!open || !file || !isClient || !objectUrl) {
    return null;
  }

  return createPortal(
    <div className="fixed inset-0 z-[220] flex h-screen w-screen flex-col bg-black/90 backdrop-blur-sm">
      <div className="border-b border-white/10">
        <div className="mx-auto flex w-full max-w-5xl items-center justify-between px-5 py-2 text-white md:px-6">
          <div className="min-w-0">
            <p className="truncate text-sm font-medium">{file.name}</p>
            <p className="text-xs text-white/70">Trim video sebelum kirim</p>
          </div>
          <Button type="button" variant="ghost" size="icon" className="h-8 w-8 text-white hover:bg-white/10" onClick={onCancel} aria-label="Tutup">
            <X className="h-4 w-4" />
          </Button>
        </div>
      </div>

      <div className="relative mx-auto flex h-full w-full max-w-5xl min-h-0 flex-1 items-center justify-center px-5 py-3 md:px-6">
        <div className="w-full max-w-[540px] rounded-2xl border border-white/10 bg-black p-2 shadow-2xl">
          <video
            ref={videoRef}
            src={objectUrl}
            preload="metadata"
            onClick={(e) => {
              if (e.currentTarget.paused) {
                void e.currentTarget.play();
              } else {
                e.currentTarget.pause();
              }
            }}
            onLoadedMetadata={(event) => {
              const nextDuration = Number.isFinite(event.currentTarget.duration) ? event.currentTarget.duration : 0;
              setDurationSec(nextDuration);
              setTrimStartSec(0);
              setTrimEndSec(nextDuration);
            }}
            className="mx-auto h-[56vh] max-h-[620px] w-auto max-w-full rounded-xl bg-black object-contain"
          />
        </div>
      </div>

      <div className="border-t border-white/10">
        <div className="mx-auto w-full max-w-5xl space-y-3 px-5 py-3 md:px-6">
          <div className="rounded-xl border border-white/10 bg-white/5 p-4">
            <div className="mb-3 flex items-center gap-2 text-sm font-medium text-white/90">
              <Scissors className="h-4 w-4" />
              Trim Video
            </div>
            
            <div className="space-y-3">
              <div className="flex items-center justify-between text-xs text-white/70">
                <span>{formatSeconds(trimStartSec)}</span>
                <span className="font-medium text-white/90">{Math.max(0, trimEndSec - trimStartSec).toFixed(1)} s</span>
                <span>{formatSeconds(trimEndSec)}</span>
              </div>
              
              <div className="relative mt-1 h-14 w-full select-none overflow-hidden rounded-lg bg-black/40">
                {/* Filmstrip Background */}
                <div className="absolute inset-0 flex h-full w-full opacity-80">
                  {thumbnails.map((thumb, i) => (
                    <div key={i} className="flex-1 h-full overflow-hidden border-r border-white/5 last:border-r-0 bg-black/50">
                      {thumb ? <img src={thumb} className="h-full w-full object-cover" alt="" /> : null}
                    </div>
                  ))}
                </div>

                {/* Dark dimming overlays (left and right) */}
                <div className="absolute inset-y-0 left-0 bg-black/70 backdrop-blur-[0.5px] pointer-events-none" style={{ width: durationSec > 0 ? `${(trimStartSec / durationSec) * 100}%` : '0%' }} />
                <div className="absolute inset-y-0 right-0 bg-black/70 backdrop-blur-[0.5px] pointer-events-none" style={{ width: durationSec > 0 ? `${100 - (trimEndSec / durationSec) * 100}%` : '0%' }} />

                {/* The Slider on top */}
                <Slider
                  min={0}
                  max={Math.max(0, durationSec)}
                  step={Math.max(0.01, durationSec / 1000)} // smooth scrub
                  value={[trimStartSec, trimEndSec]}
                  onValueChange={([start, end]) => {
                    const startChanged = start !== trimStartSec;
                    const endChanged = end !== trimEndSec;
                    setTrimStartSec(start);
                    setTrimEndSec(end);
                    
                    if (videoRef.current) {
                      videoRef.current.pause();
                      if (startChanged) {
                        videoRef.current.currentTime = start;
                      } else if (endChanged) {
                        videoRef.current.currentTime = end;
                      }
                    }
                  }}
                  className={cn(
                    "absolute inset-0 h-full w-full cursor-pointer",
                    // Track overrides (invisible)
                    "[&>span:first-child]:!h-full [&>span:first-child]:!rounded-none [&>span:first-child]:!bg-transparent",
                    // Range overrides (yellow borders)
                    "[&_[data-orientation=horizontal]>span]:!h-full [&_[data-orientation=horizontal]>span]:!border-y-[3px] [&_[data-orientation=horizontal]>span]:!border-yellow-400 [&_[data-orientation=horizontal]>span]:!bg-transparent",
                    // Thumb overrides (yellow handles)
                    "[&_[role=slider]]:!h-full [&_[role=slider]]:!w-3.5 [&_[role=slider]]:!rounded-sm [&_[role=slider]]:!border-none [&_[role=slider]]:!bg-yellow-400 [&_[role=slider]]:hover:!bg-yellow-300 [&_[role=slider]]:after:absolute [&_[role=slider]]:after:top-1/2 [&_[role=slider]]:after:left-1/2 [&_[role=slider]]:after:-translate-x-1/2 [&_[role=slider]]:after:-translate-y-1/2 [&_[role=slider]]:after:h-4 [&_[role=slider]]:after:w-0.5 [&_[role=slider]]:after:rounded-full [&_[role=slider]]:after:bg-black/40"
                  )}
                  disabled={durationSec <= 0}
                  minStepsBetweenThumbs={Math.max(0.1, durationSec * 0.01)}
                />
              </div>
            </div>
          </div>

          <div>
            <p className="mb-1 text-xs font-medium text-white/75">Pesan untuk media (caption)</p>
            <textarea
              value={captionText}
              onChange={(event) => onCaptionTextChange(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter" && !event.shiftKey) {
                  event.preventDefault();
                  if (!isExporting) {
                    void exportTrimmedVideo();
                  }
                }
              }}
              rows={2}
              placeholder="Ketik pesan"
              className="w-full resize-none rounded-xl border border-white/15 bg-white/5 px-3 py-2 text-sm text-white outline-none placeholder:text-white/45 focus:border-emerald-500/80"
            />
          </div>
          {trimError ? <p className="text-xs text-rose-300">{trimError}</p> : null}
          <div className="flex items-center justify-end gap-2">
            <Button type="button" variant="ghost" className="text-white/90 hover:bg-white/10 hover:text-white" onClick={onCancel}>
              Batal
            </Button>
            <Button type="button" className="bg-emerald-600 text-white hover:bg-emerald-500" onClick={() => void exportTrimmedVideo()} disabled={isExporting}>
              {isExporting ? "Mengirim..." : "Kirim"}
            </Button>
          </div>
        </div>
      </div>
    </div>,
    window.document.body
  );
}
