"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import { createPortal } from "react-dom";
import { Circle, Crop, Droplet, Highlighter, Minus, Pencil, RectangleHorizontal, RotateCcw, Type, Undo2, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { cn } from "@/lib/utils";

type Tool = "pen" | "highlight" | "line" | "rect" | "circle" | "text" | "blur" | "crop";

type Point = { x: number; y: number };

type StrokeShape = {
  type: "stroke";
  tool: "pen" | "highlight";
  color: string;
  width: number;
  points: Point[];
};

type GeometricShape = {
  type: "line" | "rect" | "circle";
  color: string;
  width: number;
  start: Point;
  end: Point;
};

type TextShape = {
  type: "text";
  color: string;
  fontSize: number;
  at: Point;
  text: string;
};

type BlurShape = {
  type: "blur";
  start: Point;
  end: Point;
};

type Shape = StrokeShape | GeometricShape | TextShape | BlurShape;

type CropShape = {
  start: Point;
  end: Point;
};

type ImageAttachmentEditorModalProps = {
  open: boolean;
  file: File | null;
  captionText: string;
  onCaptionTextChange: (value: string) => void;
  onCancel: () => void;
  onApply: (file: File) => void | Promise<void>;
};

function toCanvasPoint(canvas: HTMLCanvasElement, clientX: number, clientY: number): Point {
  const rect = canvas.getBoundingClientRect();
  const scaleX = canvas.width / rect.width;
  const scaleY = canvas.height / rect.height;
  return {
    x: (clientX - rect.left) * scaleX,
    y: (clientY - rect.top) * scaleY
  };
}

function normalizeRect(start: Point, end: Point): { x: number; y: number; w: number; h: number } {
  const x = Math.min(start.x, end.x);
  const y = Math.min(start.y, end.y);
  const w = Math.abs(end.x - start.x);
  const h = Math.abs(end.y - start.y);
  return { x, y, w, h };
}

function drawShape(ctx: CanvasRenderingContext2D, shape: Shape) {
  if (shape.type === "stroke") {
    const alpha = shape.tool === "highlight" ? 0.35 : 1;
    const width = shape.tool === "highlight" ? Math.max(shape.width, 16) : shape.width;
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.strokeStyle = shape.color;
    ctx.lineWidth = width;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    if (shape.points.length > 1) {
      ctx.beginPath();
      ctx.moveTo(shape.points[0]!.x, shape.points[0]!.y);
      for (let i = 1; i < shape.points.length; i += 1) {
        ctx.lineTo(shape.points[i]!.x, shape.points[i]!.y);
      }
      ctx.stroke();
    }
    ctx.restore();
    return;
  }

  if (shape.type === "text") {
    ctx.save();
    ctx.fillStyle = shape.color;
    ctx.font = `600 ${shape.fontSize}px ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Arial`;
    ctx.textBaseline = "top";
    const lines = shape.text.split(/\r?\n/);
    lines.forEach((line, index) => {
      ctx.fillText(line, shape.at.x, shape.at.y + index * (shape.fontSize + 4));
    });
    ctx.restore();
    return;
  }

  if (shape.type === "blur") {
    return;
  }

  ctx.save();
  ctx.strokeStyle = shape.color;
  ctx.lineWidth = shape.width;
  if (shape.type === "line") {
    ctx.beginPath();
    ctx.moveTo(shape.start.x, shape.start.y);
    ctx.lineTo(shape.end.x, shape.end.y);
    ctx.stroke();
  } else if (shape.type === "rect") {
    const rect = normalizeRect(shape.start, shape.end);
    ctx.strokeRect(rect.x, rect.y, rect.w, rect.h);
  } else if (shape.type === "circle") {
    const centerX = (shape.start.x + shape.end.x) / 2;
    const centerY = (shape.start.y + shape.end.y) / 2;
    const radiusX = Math.abs(shape.end.x - shape.start.x) / 2;
    const radiusY = Math.abs(shape.end.y - shape.start.y) / 2;
    ctx.beginPath();
    ctx.ellipse(centerX, centerY, radiusX, radiusY, 0, 0, Math.PI * 2);
    ctx.stroke();
  }
  ctx.restore();
}

export function ImageAttachmentEditorModal({
  open,
  file,
  captionText,
  onCaptionTextChange,
  onCancel,
  onApply
}: ImageAttachmentEditorModalProps) {
  const isClient = typeof window !== "undefined";
  const [tool, setTool] = useState<Tool>("pen");
  const [color, setColor] = useState("#f43f5e");
  const [lineWidth, setLineWidth] = useState(4);
  const [sourceUrl, setSourceUrl] = useState<string | null>(null);
  const [imageElement, setImageElement] = useState<HTMLImageElement | null>(null);
  const [shapes, setShapes] = useState<Shape[]>([]);
  const [draftShape, setDraftShape] = useState<Shape | null>(null);
  const [cropDraft, setCropDraft] = useState<CropShape | null>(null);
  const [isPointerDown, setIsPointerDown] = useState(false);
  const [draggingTextShapeIndex, setDraggingTextShapeIndex] = useState<number | null>(null);
  const [draggingTextOffset, setDraggingTextOffset] = useState<Point | null>(null);
  const [editingTextShapeIndex, setEditingTextShapeIndex] = useState<number | null>(null);
  const [editingTextValue, setEditingTextValue] = useState("");
  const [isExporting, setIsExporting] = useState(false);
  const canvasContainerRef = useRef<HTMLDivElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const originalName = file?.name ?? "image.png";

  const toolbarTools = useMemo(
    () =>
      [
        { id: "pen", label: "Pena", icon: Pencil },
        { id: "highlight", label: "Stabilo", icon: Highlighter },
        { id: "line", label: "Garis", icon: Minus },
        { id: "rect", label: "Kotak", icon: RectangleHorizontal },
        { id: "circle", label: "Lingkaran", icon: Circle },
        { id: "text", label: "Teks", icon: Type },
        { id: "blur", label: "Blur", icon: Droplet },
        { id: "crop", label: "Crop", icon: Crop }
      ] satisfies Array<{ id: Tool; label: string; icon: typeof Pencil }>,
    []
  );

  const findTextShapeIndexAtPoint = useCallback((point: Point): number => {
    const canvas = canvasRef.current;
    if (!canvas) {
      return -1;
    }
    const ctx = canvas.getContext("2d");
    if (!ctx) {
      return -1;
    }

    for (let i = shapes.length - 1; i >= 0; i -= 1) {
      const shape = shapes[i];
      if (!shape || shape.type !== "text") {
        continue;
      }
      ctx.font = `600 ${shape.fontSize}px ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Arial`;
      const lines = shape.text.split(/\r?\n/);
      const maxLineWidth = lines.reduce((acc, line) => Math.max(acc, ctx.measureText(line).width), 0);
      const textHeight = lines.length * (shape.fontSize + 4);
      const padding = 8;
      if (
        point.x >= shape.at.x - padding &&
        point.x <= shape.at.x + maxLineWidth + padding &&
        point.y >= shape.at.y - padding &&
        point.y <= shape.at.y + textHeight + padding
      ) {
        return i;
      }
    }

    return -1;
  }, [shapes]);

  const getEditingTextboxStyle = useCallback((): CSSProperties | null => {
    if (editingTextShapeIndex === null) {
      return null;
    }
    const container = canvasContainerRef.current;
    const canvas = canvasRef.current;
    const shape = shapes[editingTextShapeIndex];
    if (!container || !canvas || !shape || shape.type !== "text") {
      return null;
    }

    const scaleX = canvas.clientWidth / canvas.width;
    const scaleY = canvas.clientHeight / canvas.height;
    const left = shape.at.x * scaleX;
    const top = shape.at.y * scaleY;
    const width = Math.min(Math.max(canvas.clientWidth - left - 16, 200), canvas.clientWidth - 32);

    return {
      position: "absolute",
      left: left - 2,
      top: top - 2,
      width,
      color: shape.color,
      fontSize: `${shape.fontSize * scaleY}px`,
      lineHeight: 1.25,
      fontFamily: "ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, Segoe UI, Roboto, sans-serif",
      fontWeight: 600,
      background: "transparent",
      outline: "none",
      border: "1px dashed rgba(255,255,255,0.6)",
      padding: 0,
      minHeight: `${shape.fontSize * scaleY * 1.5}px`,
      resize: "none",
      overflow: "hidden",
      whiteSpace: "pre-wrap"
    };
  }, [editingTextShapeIndex, shapes]);

  const commitEditingText = useCallback(() => {
    if (editingTextShapeIndex === null) {
      return;
    }
    const trimmed = editingTextValue.trim();
    if (!trimmed) {
      setShapes((previous) => previous.filter((_, index) => index !== editingTextShapeIndex));
    } else {
      setShapes((previous) =>
        previous.map((shape, index) => {
          if (index !== editingTextShapeIndex || shape.type !== "text") {
            return shape;
          }
          return {
            ...shape,
            text: trimmed
          };
        })
      );
    }
    setEditingTextShapeIndex(null);
    setEditingTextValue("");
  }, [editingTextShapeIndex, editingTextValue]);

  const cancelEditingText = useCallback(() => {
    setEditingTextShapeIndex(null);
    setEditingTextValue("");
  }, []);

  useEffect(() => {
    if (!open || !file) {
      setSourceUrl(null);
      setImageElement(null);
      setShapes([]);
      setDraftShape(null);
      setCropDraft(null);
      setEditingTextShapeIndex(null);
      setEditingTextValue("");
      return;
    }

    const url = URL.createObjectURL(file);
    setSourceUrl(url);
    setShapes([]);
    setDraftShape(null);
    setCropDraft(null);
    setEditingTextShapeIndex(null);
    setEditingTextValue("");
    return () => {
      URL.revokeObjectURL(url);
    };
  }, [file, open]);

  useEffect(() => {
    if (!sourceUrl) {
      setImageElement(null);
      return;
    }

    const image = new Image();
    image.onload = () => setImageElement(image);
    image.src = sourceUrl;
  }, [sourceUrl]);

  const redraw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas || !imageElement) {
      return;
    }
    const ctx = canvas.getContext("2d");
    if (!ctx) {
      return;
    }

    const maxW = 1600;
    const maxH = 1200;
    const scale = Math.min(maxW / imageElement.naturalWidth, maxH / imageElement.naturalHeight, 1);
    const width = Math.max(1, Math.round(imageElement.naturalWidth * scale));
    const height = Math.max(1, Math.round(imageElement.naturalHeight * scale));
    if (canvas.width !== width || canvas.height !== height) {
      canvas.width = width;
      canvas.height = height;
    }

    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(imageElement, 0, 0, canvas.width, canvas.height);
    const nonBlurShapes = shapes.filter((shape) => shape.type !== "blur");
    const blurShapes = shapes.filter((shape): shape is BlurShape => shape.type === "blur");

    for (const shape of nonBlurShapes) {
      drawShape(ctx, shape);
    }
    if (draftShape && draftShape.type !== "blur") {
      drawShape(ctx, draftShape);
    }

    if (blurShapes.length > 0 || draftShape?.type === "blur") {
      const workBuffer = document.createElement("canvas");
      workBuffer.width = canvas.width;
      workBuffer.height = canvas.height;
      const workCtx = workBuffer.getContext("2d");
      if (workCtx) {
        workCtx.drawImage(canvas, 0, 0);
        const allBlurs: BlurShape[] = [...blurShapes, ...(draftShape?.type === "blur" ? [draftShape] : [])];
        for (const blur of allBlurs) {
          const rect = normalizeRect(blur.start, blur.end);
          if (rect.w < 2 || rect.h < 2) {
            continue;
          }
          ctx.save();
          ctx.beginPath();
          ctx.rect(rect.x, rect.y, rect.w, rect.h);
          ctx.clip();
          ctx.filter = "blur(9px)";
          ctx.drawImage(workBuffer, 0, 0);
          ctx.restore();

          workCtx.clearRect(0, 0, workBuffer.width, workBuffer.height);
          workCtx.drawImage(canvas, 0, 0);
        }
      }
    }
    if (cropDraft) {
      const rect = normalizeRect(cropDraft.start, cropDraft.end);
      ctx.save();
      // Darken outside the crop area without erasing underlying image pixels.
      ctx.fillStyle = "rgba(0,0,0,0.42)";
      ctx.beginPath();
      ctx.rect(0, 0, canvas.width, canvas.height);
      ctx.rect(rect.x, rect.y, rect.w, rect.h);
      ctx.fill("evenodd");
      ctx.strokeStyle = "#10b981";
      ctx.setLineDash([8, 5]);
      ctx.lineWidth = 2;
      ctx.strokeRect(rect.x, rect.y, rect.w, rect.h);
      ctx.restore();
    }
  }, [cropDraft, draftShape, imageElement, shapes]);

  useEffect(() => {
    redraw();
  }, [redraw]);

  const startDraw = useCallback(
    (point: Point) => {
      if (tool === "crop") {
        setCropDraft({ start: point, end: point });
        return;
      }
      if (tool === "text") {
        return; // Handled directly in onPointerDown for spawning text
      }
      if (tool === "pen" || tool === "highlight") {
        setDraftShape({
          type: "stroke",
          tool,
          color: tool === "highlight" ? "#fde047" : color,
          width: lineWidth,
          points: [point]
        });
        return;
      }
      if (tool === "blur") {
        setDraftShape({
          type: "blur",
          start: point,
          end: point
        });
        return;
      }
      setDraftShape({
        type: tool,
        color,
        width: lineWidth,
        start: point,
        end: point
      });
    },
    [color, lineWidth, tool]
  );

  const moveDraw = useCallback(
    (point: Point) => {
      if (tool === "crop") {
        setCropDraft((current) => (current ? { ...current, end: point } : current));
        return;
      }
      setDraftShape((current) => {
        if (!current) {
          return current;
        }
        if (current.type === "stroke") {
          return {
            ...current,
            points: [...current.points, point]
          };
        }
        return {
          ...current,
          end: point
        };
      });
    },
    [tool]
  );

  const endDraw = useCallback(() => {
    setDraftShape((current) => {
      if (!current) {
        return null;
      }
      setShapes((previous) => [...previous, current]);
      return null;
    });
    setDraggingTextShapeIndex(null);
    setDraggingTextOffset(null);
  }, []);

  const handleApplyCrop = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas || !cropDraft) {
      return;
    }
    const rect = normalizeRect(cropDraft.start, cropDraft.end);
    if (rect.w < 8 || rect.h < 8) {
      return;
    }

    const temp = document.createElement("canvas");
    temp.width = Math.round(rect.w);
    temp.height = Math.round(rect.h);
    const tempCtx = temp.getContext("2d");
    if (!tempCtx) {
      return;
    }
    tempCtx.drawImage(canvas, rect.x, rect.y, rect.w, rect.h, 0, 0, temp.width, temp.height);

    const nextUrl = temp.toDataURL("image/png");
    setSourceUrl(nextUrl);
    setShapes([]);
    setDraftShape(null);
    setCropDraft(null);
  }, [cropDraft]);

  const exportEditedImage = useCallback(async () => {
    const canvas = canvasRef.current;
    if (!canvas || !file) {
      return;
    }
    setIsExporting(true);
    try {
      const mimeType = file.type && file.type.startsWith("image/") ? file.type : "image/png";
      const blob = await new Promise<Blob | null>((resolve) => {
        canvas.toBlob((value) => resolve(value), mimeType, 0.95);
      });
      if (!blob) {
        return;
      }
      const editedFile = new File([blob], originalName, { type: blob.type || mimeType, lastModified: Date.now() });
      await onApply(editedFile);
    } finally {
      setIsExporting(false);
    }
  }, [file, onApply, originalName]);

  if (!open || !file || !isClient) {
    return null;
  }
  const editingTextboxStyle = getEditingTextboxStyle();

  return createPortal(
    <div className="fixed inset-0 z-[220] flex h-screen w-screen flex-col bg-black/90 backdrop-blur-sm">
      <div className="border-b border-white/10">
        <div className="mx-auto flex w-full max-w-5xl items-center justify-between px-5 py-2 text-white md:px-6">
          <div className="min-w-0">
            <p className="truncate text-sm font-medium">{originalName}</p>
            <p className="text-xs text-white/70">Edit gambar sebelum kirim</p>
          </div>
          <Button type="button" variant="ghost" size="icon" className="h-8 w-8 text-white hover:bg-white/10" onClick={onCancel} aria-label="Tutup">
            <X className="h-4 w-4" />
          </Button>
        </div>
      </div>

      <div className="border-b border-white/10 bg-black/40">
        <div className="mx-auto flex w-full max-w-5xl items-center justify-between px-4 py-2.5 md:px-6">
          <div className="flex flex-1 items-center gap-1 overflow-x-auto" style={{ scrollbarWidth: "none", msOverflowStyle: "none" }}>
            {toolbarTools.map((entry) => {
              const Icon = entry.icon;
              const active = tool === entry.id;
              return (
                <Button
                  key={entry.id}
                  type="button"
                  variant="ghost"
                  size="sm"
                  className={cn(
                    "h-8 shrink-0 rounded-xl px-2.5 text-[11px] font-medium transition-all",
                    active ? "bg-emerald-500/20 text-emerald-400" : "text-white/70 hover:bg-white/10 hover:text-white"
                  )}
                  onClick={() => setTool(entry.id)}
                >
                  <Icon className="mr-1.5 h-3.5 w-3.5" />
                  {entry.label}
                </Button>
              );
            })}
          </div>
          
          <div className="ml-4 flex shrink-0 items-center gap-3 border-l border-white/10 pl-4">
            <div className="flex items-center gap-2">
              <div className="relative h-6 w-6 shrink-0 overflow-hidden rounded-full border-[1.5px] border-white/20 shadow-sm transition-transform hover:scale-110">
                <input
                  type="color"
                  value={color}
                  onChange={(event) => {
                    const c = event.target.value;
                    setColor(c);
                    if (editingTextShapeIndex !== null) {
                      setShapes(prev => prev.map((s, i) => i === editingTextShapeIndex && s.type === "text" ? { ...s, color: c } : s));
                    }
                  }}
                  className="absolute -inset-2 h-10 w-10 cursor-pointer appearance-none border-none bg-transparent"
                  title="Warna"
                />
              </div>
              <div className="flex w-24 shrink-0 items-center px-2">
                <Slider
                  min={1}
                  max={24}
                  step={1}
                  value={[lineWidth]}
                  onValueChange={([val]) => {
                    setLineWidth(val);
                    if (editingTextShapeIndex !== null) {
                      setShapes(prev => prev.map((s, i) => i === editingTextShapeIndex && s.type === "text" ? { ...s, fontSize: Math.max(14, val * 4) } : s));
                    }
                  }}
                  className="w-full [&_[role=slider]]:border-emerald-500 [&_[role=slider]]:bg-emerald-500 [&>span:first-child]:bg-white/20 [&_[data-orientation=horizontal]>span]:bg-emerald-500"
                  title="Ketebalan coretan / Ukuran teks"
                />
              </div>
            </div>

            <div className="flex items-center gap-1 border-l border-white/10 pl-3">
              <Button type="button" variant="ghost" size="icon" className="h-8 w-8 rounded-lg text-white/70 hover:bg-white/10 hover:text-white" title="Undo" onClick={() => setShapes((current) => current.slice(0, -1))}>
                <Undo2 className="h-4 w-4" />
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="h-8 w-8 rounded-lg text-white/70 hover:bg-white/10 hover:text-white"
                title="Reset"
                onClick={() => {
                  setShapes([]);
                  setDraftShape(null);
                  setCropDraft(null);
                  setEditingTextShapeIndex(null);
                  setEditingTextValue("");
                }}
              >
                <RotateCcw className="h-4 w-4" />
              </Button>
              {tool === "crop" ? (
                <Button
                  type="button"
                  size="sm"
                  className="ml-1 h-8 rounded-lg bg-emerald-600 px-3 text-[11px] font-medium text-white hover:bg-emerald-500"
                  onClick={handleApplyCrop}
                >
                  Terapkan Crop
                </Button>
              ) : null}
            </div>
          </div>
        </div>
      </div>

      <div ref={canvasContainerRef} className="relative mx-auto flex h-full w-full max-w-5xl min-h-0 flex-1 items-center justify-center px-5 py-3 md:px-6">
        <canvas
          ref={canvasRef}
          className="max-h-full max-w-full rounded-lg bg-black object-contain shadow-2xl"
          onPointerDown={(event) => {
            if (editingTextShapeIndex !== null) {
              return;
            }
            const canvas = canvasRef.current;
            if (!canvas) {
              return;
            }
            const point = toCanvasPoint(canvas, event.clientX, event.clientY);
            if (tool === "text") {
              const index = findTextShapeIndexAtPoint(point);
              if (index >= 0) {
                const textShape = shapes[index];
                if (textShape && textShape.type === "text") {
                  setDraggingTextShapeIndex(index);
                  setDraggingTextOffset({
                    x: point.x - textShape.at.x,
                    y: point.y - textShape.at.y
                  });
                  setIsPointerDown(true);
                  return;
                }
              } else {
                const newShape: TextShape = {
                  type: "text",
                  color,
                  fontSize: Math.max(14, lineWidth * 4),
                  at: point,
                  text: ""
                };
                setShapes((prev) => [...prev, newShape]);
                setEditingTextShapeIndex(shapes.length);
                setEditingTextValue("");
                return;
              }
            }
            startDraw(point);
            setIsPointerDown(true);
          }}
          onDoubleClick={(event) => {
            const canvas = canvasRef.current;
            if (!canvas) {
              return;
            }
            const point = toCanvasPoint(canvas, event.clientX, event.clientY);
            const index = findTextShapeIndexAtPoint(point);
            if (index < 0) {
              return;
            }
            const shape = shapes[index];
            if (!shape || shape.type !== "text") {
              return;
            }
            setEditingTextShapeIndex(index);
            setEditingTextValue(shape.text);
          }}
          onPointerMove={(event) => {
            if (!isPointerDown) {
              return;
            }
            const canvas = canvasRef.current;
            if (!canvas) {
              return;
            }
            const point = toCanvasPoint(canvas, event.clientX, event.clientY);
            if (draggingTextShapeIndex !== null && draggingTextOffset) {
              setShapes((previous) =>
                previous.map((shape, index) => {
                  if (index !== draggingTextShapeIndex || shape.type !== "text") {
                    return shape;
                  }
                  return {
                    ...shape,
                    at: {
                      x: point.x - draggingTextOffset.x,
                      y: point.y - draggingTextOffset.y
                    }
                  };
                })
              );
              return;
            }
            moveDraw(point);
          }}
          onPointerUp={() => {
            if (!isPointerDown) {
              return;
            }
            setIsPointerDown(false);
            endDraw();
          }}
          onPointerLeave={() => {
            if (!isPointerDown) {
              return;
            }
            setIsPointerDown(false);
            endDraw();
          }}
        />
        {editingTextShapeIndex !== null && editingTextboxStyle ? (
          <textarea
            autoFocus
            value={editingTextValue}
            onChange={(event) => setEditingTextValue(event.target.value)}
            onBlur={commitEditingText}
            onKeyDown={(event) => {
              if (event.key === "Escape") {
                event.preventDefault();
                cancelEditingText();
                return;
              }
              if (event.key === "Enter" && !event.shiftKey) {
                event.preventDefault();
                commitEditingText();
              }
            }}
            style={editingTextboxStyle}
            className="z-10 focus:ring-0"
          />
        ) : null}
      </div>

      <div className="border-t border-white/10">
        <div className="mx-auto w-full max-w-5xl space-y-2 px-5 py-3 md:px-6">
          <p className="text-xs font-medium text-white/75">Pesan untuk media (caption)</p>
          <textarea
            value={captionText}
            onChange={(event) => onCaptionTextChange(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter" && !event.shiftKey) {
                event.preventDefault();
                if (!isExporting) {
                  void exportEditedImage();
                }
              }
            }}
            rows={2}
            placeholder="Tulis pesan yang ikut dikirim bersama media..."
            className="w-full resize-none rounded-xl border border-white/15 bg-white/5 px-3 py-2 text-sm text-white outline-none placeholder:text-white/45 focus:border-emerald-500/80"
          />
          <div className="flex items-center justify-end gap-2">
            <Button type="button" variant="ghost" className="text-white/90 hover:bg-white/10 hover:text-white" onClick={onCancel}>
              Batal
            </Button>
            <Button type="button" className="bg-emerald-600 text-white hover:bg-emerald-500" onClick={() => void exportEditedImage()} disabled={isExporting}>
              {isExporting ? "Mengirim..." : "Kirim"}
            </Button>
          </div>
        </div>
      </div>
    </div>
    ,
    window.document.body
  );
}
