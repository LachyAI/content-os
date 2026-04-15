'use client'

import { useState, useRef, useCallback, useEffect } from "react";
import { Bold, Highlighter, Italic, MessageSquare, Timer, X } from "lucide-react";
import { Button } from "@/components/ui/button";

interface ScriptEditorProps {
  value: string;
  onChange: (value: string) => void;
  fullscreen?: boolean;
  placeholder?: string;
}

function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
}

export function ScriptEditor({ value, onChange, fullscreen, placeholder }: ScriptEditorProps) {
  const editorRef = useRef<HTMLDivElement>(null);
  const [timerSeconds, setTimerSeconds] = useState(0);
  const [timerRunning, setTimerRunning] = useState(false);
  const [timerFlash, setTimerFlash] = useState(false);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const isInternalUpdate = useRef(false);

  // Sync value → editor (only when value changes externally)
  useEffect(() => {
    if (isInternalUpdate.current) {
      isInternalUpdate.current = false;
      return;
    }
    const el = editorRef.current;
    if (el && el.innerHTML !== value) {
      el.innerHTML = value;
    }
  }, [value]);

  // Timer countdown
  useEffect(() => {
    if (timerRunning && timerSeconds > 0) {
      timerRef.current = setInterval(() => {
        setTimerSeconds((prev) => {
          if (prev <= 1) {
            setTimerRunning(false);
            setTimerFlash(true);
            setTimeout(() => setTimerFlash(false), 3000);
            if (timerRef.current) clearInterval(timerRef.current);
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
      return () => {
        if (timerRef.current) clearInterval(timerRef.current);
      };
    }
  }, [timerRunning, timerSeconds]);

  const handleInput = useCallback(() => {
    const el = editorRef.current;
    if (el) {
      isInternalUpdate.current = true;
      onChange(el.innerHTML);
    }
  }, [onChange]);

  function execFormat(command: string, value?: string) {
    document.execCommand(command, false, value);
    editorRef.current?.focus();
    handleInput();
  }

  function handleBold() {
    execFormat("bold");
  }

  function handleItalic() {
    execFormat("italic");
  }

  function findParentSpanWithBg(node: Node | null, bgColor: string): HTMLSpanElement | null {
    let current = node;
    while (current && current !== editorRef.current) {
      if (current instanceof HTMLSpanElement && current.style.background === bgColor) {
        return current;
      }
      current = current.parentNode;
    }
    return null;
  }

  function toggleWrap(bgColor: string, styles: Record<string, string>, fallbackText?: string) {
    const selection = window.getSelection();
    if (!selection || selection.rangeCount === 0) return;

    const range = selection.getRangeAt(0);
    const selectedText = range.toString();

    // Check if cursor/selection is inside an existing span with this bg
    const existingSpan = findParentSpanWithBg(range.startContainer, bgColor);
    if (existingSpan) {
      // Unwrap — replace span with its text content
      const text = document.createTextNode(existingSpan.textContent || "");
      existingSpan.parentNode?.replaceChild(text, existingSpan);
      editorRef.current?.focus();
      handleInput();
      return;
    }

    if (!selectedText && fallbackText) {
      const html = `<span style="${Object.entries(styles).map(([k, v]) => `${k}:${v}`).join(";")}">${fallbackText}</span>&nbsp;`;
      execFormat("insertHTML", html);
      return;
    }

    if (!selectedText) return;

    const span = document.createElement("span");
    Object.entries(styles).forEach(([k, v]) => { span.style.setProperty(k, v); });
    span.textContent = selectedText;
    range.deleteContents();
    range.insertNode(span);

    const newRange = document.createRange();
    newRange.setStartAfter(span);
    newRange.collapse(true);
    selection.removeAllRanges();
    selection.addRange(newRange);

    editorRef.current?.focus();
    handleInput();
  }

  function handleComment() {
    toggleWrap("#1f2937", {
      color: "#6b7280",
      background: "#1f2937",
      padding: "1px 4px",
      "border-radius": "3px",
      "font-style": "italic",
    }, "// note");
  }

  function handleHighlight() {
    toggleWrap("#854d0e", {
      background: "#854d0e",
      color: "#fef08a",
      padding: "1px 4px",
      "border-radius": "3px",
    });
  }

  // Keyboard shortcuts
  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.ctrlKey || e.metaKey) {
      switch (e.key.toLowerCase()) {
        case "h":
          e.preventDefault();
          handleHighlight();
          break;
        case "j":
          e.preventDefault();
          handleComment();
          break;
      }
    }
  }

  function startTimer(minutes: number) {
    if (timerRef.current) clearInterval(timerRef.current);
    setTimerSeconds(minutes * 60);
    setTimerRunning(true);
    setTimerFlash(false);
  }

  function stopTimer() {
    if (timerRef.current) clearInterval(timerRef.current);
    setTimerRunning(false);
    setTimerSeconds(0);
    setTimerFlash(false);
  }

  // Handle paste — strip formatting to keep it clean
  function handlePaste(e: React.ClipboardEvent) {
    e.preventDefault();
    const text = e.clipboardData.getData("text/plain");
    document.execCommand("insertText", false, text);
    handleInput();
  }

  const wordCount = editorRef.current?.textContent?.split(/\s+/).filter(Boolean).length ?? 0;
  const charCount = editorRef.current?.textContent?.length ?? 0;

  return (
    <div className="space-y-0">
      {/* Toolbar */}
      <div className="flex items-center justify-between gap-2 border border-border border-b-0 rounded-t-md bg-secondary/30 px-2 py-1.5">
        {/* Format buttons */}
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={handleBold}
            title="Bold (Ctrl+B)"
            className="p-1.5 rounded hover:bg-secondary text-muted-foreground hover:text-foreground transition-colors"
          >
            <Bold size={14} />
          </button>
          <button
            type="button"
            onClick={handleItalic}
            title="Italic (Ctrl+I)"
            className="p-1.5 rounded hover:bg-secondary text-muted-foreground hover:text-foreground transition-colors"
          >
            <Italic size={14} />
          </button>
          <button
            type="button"
            onClick={handleComment}
            title="Comment — grey out selected text (Ctrl+J)"
            className="p-1.5 rounded hover:bg-secondary text-muted-foreground hover:text-foreground transition-colors"
          >
            <MessageSquare size={14} />
          </button>
          <button
            type="button"
            onClick={handleHighlight}
            title="Highlight selected text (Ctrl+H)"
            className="p-1.5 rounded hover:bg-secondary text-muted-foreground hover:text-yellow-400 transition-colors"
          >
            <Highlighter size={14} />
          </button>
          <div className="w-px h-4 bg-border mx-1" />
          <span className="text-[10px] text-muted-foreground/60">{charCount} chars · {wordCount} words</span>
        </div>

        {/* Timer */}
        <div className="flex items-center gap-1.5">
          {timerRunning || timerSeconds > 0 ? (
            <>
              <span className={`text-sm font-mono tabular-nums ${timerFlash ? "text-destructive animate-pulse font-bold" : timerSeconds <= 60 ? "text-orange-400" : "text-primary"}`}>
                <Timer size={12} className="inline mr-1 -mt-0.5" />
                {formatTime(timerSeconds)}
              </span>
              <button
                type="button"
                onClick={stopTimer}
                className="p-1 rounded hover:bg-secondary text-muted-foreground hover:text-destructive transition-colors"
                title="Stop timer"
              >
                <X size={12} />
              </button>
            </>
          ) : (
            <>
              <Timer size={12} className="text-muted-foreground/50" />
              {[5, 10, 15, 25].map((m) => (
                <button
                  key={m}
                  type="button"
                  onClick={() => startTimer(m)}
                  className="text-[10px] px-1.5 py-0.5 rounded bg-secondary/50 text-muted-foreground hover:text-primary hover:bg-secondary transition-colors"
                >
                  {m}m
                </button>
              ))}
            </>
          )}
        </div>
      </div>

      {/* Editor */}
      <div
        ref={editorRef}
        contentEditable
        suppressContentEditableWarning
        onInput={handleInput}
        onPaste={handlePaste}
        onKeyDown={handleKeyDown}
        data-placeholder={placeholder || "Start writing your script..."}
        className={`
          border border-border rounded-b-md bg-input px-3 py-2
          font-mono text-[13px] leading-relaxed
          focus:outline-none focus:ring-1 focus:ring-primary/30
          overflow-y-auto whitespace-pre-wrap
          empty:before:content-[attr(data-placeholder)] empty:before:text-muted-foreground/40
          ${fullscreen ? "min-h-[calc(96vh-440px)]" : "min-h-[300px] max-h-[500px]"}
        `}
      />

      {/* Timer done flash */}
      {timerFlash && (
        <div className="text-xs text-center text-destructive font-medium py-1 animate-pulse">
          Time's up!
        </div>
      )}
    </div>
  );
}
