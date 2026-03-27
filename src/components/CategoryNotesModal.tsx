"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import { createPortal } from "react-dom";
import {
  X,
  Plus,
  Trash2,
  CheckCircle2,
  Circle,
  StickyNote,
  Loader2,
} from "lucide-react";
import DynamicIcon from "@/components/DynamicIcon";
import type { CategoryNote, UserCategory } from "@/lib/logs";

interface CategoryNotesModalProps {
  category: UserCategory;
  theme: {
    accent: string;
    textPrimary: string;
    textSecondary: string;
    textMuted: string;
    surfaceRaised: string;
    border: string;
    borderRadius: string;
  };
  onClose: () => void;
}

export default function CategoryNotesModal({
  category,
  theme,
  onClose,
}: CategoryNotesModalProps) {
  const [notes, setNotes] = useState<CategoryNote[]>(category.notes || []);
  const [inputValue, setInputValue] = useState("");
  const [adding, setAdding] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const backdropRef = useRef<HTMLDivElement>(null);

  // Ensure categoryId is always a plain string
  const categoryId = category._id ? String(category._id) : null;

  // Focus input on mount
  useEffect(() => {
    const timer = setTimeout(() => inputRef.current?.focus(), 100);
    return () => clearTimeout(timer);
  }, []);

  // Close on Escape
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [onClose]);

  // Lock body scroll while modal is open
  useEffect(() => {
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = "";
    };
  }, []);

  const handleAdd = useCallback(async () => {
    if (!inputValue.trim() || adding || !categoryId) return;
    setAdding(true);
    try {
      const res = await fetch("/api/categories/notes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ categoryId, text: inputValue.trim() }),
      });
      if (!res.ok) {
        const errText = await res.text();
        console.error("[NOTES_ADD_ERROR]", res.status, errText);
        throw new Error(errText);
      }
      const newNote = await res.json();
      setNotes((prev) => [...prev, newNote]);
      setInputValue("");
      inputRef.current?.focus();
    } catch (err) {
      console.error("[NOTES_ADD_FAILED]", err);
    } finally {
      setAdding(false);
    }
  }, [inputValue, adding, categoryId]);

  const handleToggle = useCallback(
    async (noteId: string, done: boolean) => {
      if (!categoryId) return;
      setNotes((prev) =>
        prev.map((n) => (n._id === noteId ? { ...n, done } : n))
      );
      try {
        const res = await fetch("/api/categories/notes", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ categoryId, noteId, done }),
        });
        if (!res.ok) throw new Error();
      } catch {
        setNotes((prev) =>
          prev.map((n) => (n._id === noteId ? { ...n, done: !done } : n))
        );
      }
    },
    [categoryId]
  );

  const handleDelete = useCallback(
    async (noteId: string) => {
      if (!categoryId) return;
      const prev = notes;
      setNotes((old) => old.filter((n) => n._id !== noteId));
      try {
        const res = await fetch("/api/categories/notes", {
          method: "DELETE",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ categoryId, noteId }),
        });
        if (!res.ok) throw new Error();
      } catch {
        setNotes(prev);
      }
    },
    [categoryId, notes]
  );

  const pendingNotes = notes.filter((n) => !n.done);
  const doneNotes = notes.filter((n) => n.done);
  const sortedNotes = [...pendingNotes, ...doneNotes];

  const modalContent = (
    <div
      ref={backdropRef}
      className="catnotes-modal-backdrop"
      onClick={(e) => {
        if (e.target === backdropRef.current) onClose();
      }}
    >
      <div
        className="catnotes-modal"
        style={{
          borderColor: theme.border,
          borderRadius: theme.borderRadius,
        }}
      >
        {/* Header */}
        <div className="catnotes-modal-header">
          <div className="catnotes-modal-title-row">
            <div
              className="catnotes-modal-icon"
              style={{ color: theme.accent }}
            >
              <DynamicIcon
                name={category.icon || "CircleDashed"}
                className="w-4.5 h-4.5"
              />
            </div>
            <div>
              <h3
                className="catnotes-modal-title"
                style={{ color: theme.textPrimary }}
              >
                {category.name}
              </h3>
              <p className="catnotes-modal-subtitle">
                {pendingNotes.length} pending
                {doneNotes.length > 0 && ` · ${doneNotes.length} done`}
              </p>
            </div>
          </div>
          <button className="catnotes-modal-close" onClick={onClose}>
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Notes List */}
        <div className="catnotes-modal-body">
          {sortedNotes.length === 0 ? (
            <div className="catnotes-modal-empty">
              <StickyNote
                className="w-5 h-5"
                style={{ color: "var(--v2-text-muted)", opacity: 0.5 }}
              />
              <p>No notes yet — add your first one below</p>
            </div>
          ) : (
            <div className="catnotes-modal-list">
              {sortedNotes.map((note) => (
                <div
                  key={note._id}
                  className={`catnotes-modal-item ${note.done ? "done" : ""}`}
                >
                  <button
                    className="catnotes-checkbox"
                    onClick={() => handleToggle(note._id!, !note.done)}
                  >
                    {note.done ? (
                      <CheckCircle2
                        className="w-4 h-4"
                        style={{ color: theme.accent }}
                      />
                    ) : (
                      <Circle
                        className="w-4 h-4"
                        style={{ color: "var(--v2-text-muted)" }}
                      />
                    )}
                  </button>
                  <span
                    className={`catnotes-modal-text ${note.done ? "done" : ""}`}
                  >
                    {note.text}
                  </span>
                  <button
                    className="catnotes-modal-delete"
                    onClick={() => handleDelete(note._id!)}
                  >
                    <Trash2 className="w-3 h-3" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Add Input */}
        <div className="catnotes-modal-footer">
          <input
            ref={inputRef}
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleAdd()}
            placeholder="Add a next step…"
            className="catnotes-modal-input"
            disabled={adding}
          />
          <button
            onClick={handleAdd}
            disabled={!inputValue.trim() || adding}
            className="catnotes-modal-add-btn"
            style={{
              background: inputValue.trim()
                ? `linear-gradient(135deg, ${theme.accent}, color-mix(in oklch, ${theme.accent} 80%, black))`
                : undefined,
            }}
          >
            {adding ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <Plus className="w-3.5 h-3.5" />
            )}
          </button>
        </div>
      </div>
    </div>
  );

  // Render via portal to escape any ancestor overflow/transform constraints
  return createPortal(modalContent, document.body);
}
