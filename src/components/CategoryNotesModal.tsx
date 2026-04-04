"use client";

import { useState, useRef, useCallback, useEffect, useMemo } from "react";
import { createPortal } from "react-dom";
import {
  X,
  Plus,
  Trash2,
  CheckCircle2,
  Circle,
  StickyNote,
  Loader2,
  Pencil,
  Check,
} from "lucide-react";
import DynamicIcon from "@/components/DynamicIcon";
import type { CategoryNote, UserCategory } from "@/lib/logs";
import { useCategoriesContext } from "@/components/CategoriesProvider";
import TextareaAutosize from "react-textarea-autosize";

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
  const [inputValue, setInputValue] = useState("");
  const [adding, setAdding] = useState(false);
  const [editingNoteId, setEditingNoteId] = useState<string | null>(null);
  const [editingValue, setEditingValue] = useState("");
  const [savingEdit, setSavingEdit] = useState(false);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const backdropRef = useRef<HTMLDivElement>(null);
  const { updateCategory, refreshCategories } = useCategoriesContext();

  // Ensure categoryId is always a plain string
  const categoryId = category._id ? String(category._id) : null;
  const notes = useMemo(() => category.notes || [], [category.notes]);

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
      updateCategory(categoryId, (currentCategory) => ({
        ...currentCategory,
        notes: [...(currentCategory.notes || []), newNote as CategoryNote],
      }));
      setInputValue("");
      inputRef.current?.focus();
    } catch (err) {
      console.error("[NOTES_ADD_FAILED]", err);
      refreshCategories();
    } finally {
      setAdding(false);
    }
  }, [inputValue, adding, categoryId, updateCategory, refreshCategories]);

  const handleToggle = useCallback(
    async (noteId: string, done: boolean) => {
      if (!categoryId) return;
      const previousNotes = notes;
      updateCategory(categoryId, (currentCategory) => ({
        ...currentCategory,
        notes: (currentCategory.notes || []).map((note) =>
          note._id === noteId ? { ...note, done } : note
        ),
      }));
      try {
        const res = await fetch("/api/categories/notes", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ categoryId, noteId, done }),
        });
        if (!res.ok) throw new Error();
      } catch {
        updateCategory(categoryId, (currentCategory) => ({
          ...currentCategory,
          notes: previousNotes,
        }));
        refreshCategories();
      }
    },
    [categoryId, notes, refreshCategories, updateCategory]
  );

  const handleDelete = useCallback(
    async (noteId: string) => {
      if (!categoryId) return;
      const previousNotes = notes;
      updateCategory(categoryId, (currentCategory) => ({
        ...currentCategory,
        notes: (currentCategory.notes || []).filter((note) => note._id !== noteId),
      }));
      try {
        const res = await fetch("/api/categories/notes", {
          method: "DELETE",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ categoryId, noteId }),
        });
        if (!res.ok) throw new Error();
      } catch {
        updateCategory(categoryId, (currentCategory) => ({
          ...currentCategory,
          notes: previousNotes,
        }));
        refreshCategories();
      }
    },
    [categoryId, notes, refreshCategories, updateCategory]
  );

  const startEditing = useCallback((note: CategoryNote) => {
    setEditingNoteId(note._id || null);
    setEditingValue(note.text);
  }, []);

  const cancelEditing = useCallback(() => {
    setEditingNoteId(null);
    setEditingValue("");
    setSavingEdit(false);
  }, []);

  const handleSaveEdit = useCallback(
    async (noteId: string) => {
      if (!categoryId) return;

      const nextText = editingValue.trim();
      const previousNotes = notes;

      if (!nextText) {
        cancelEditing();
        return;
      }

      const existingNote = notes.find((note) => note._id === noteId);
      if (!existingNote || existingNote.text === nextText) {
        cancelEditing();
        return;
      }

      setSavingEdit(true);
      updateCategory(categoryId, (currentCategory) => ({
        ...currentCategory,
        notes: (currentCategory.notes || []).map((note) =>
          note._id === noteId ? { ...note, text: nextText } : note
        ),
      }));

      try {
        const res = await fetch("/api/categories/notes", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ categoryId, noteId, text: nextText }),
        });

        if (!res.ok) throw new Error();
        cancelEditing();
      } catch {
        updateCategory(categoryId, (currentCategory) => ({
          ...currentCategory,
          notes: previousNotes,
        }));
        setSavingEdit(false);
        refreshCategories();
      }
    },
    [
      cancelEditing,
      categoryId,
      editingValue,
      notes,
      refreshCategories,
      updateCategory,
    ]
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
                  className={`catnotes-modal-item ${note.done ? "done" : ""} ${editingNoteId === note._id ? "editing" : ""}`}
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
                  {editingNoteId === note._id ? (
                    <TextareaAutosize
                      value={editingValue}
                      onChange={(e) => setEditingValue(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" && !e.shiftKey) {
                          e.preventDefault();
                          void handleSaveEdit(note._id!);
                        }
                        if (e.key === "Escape") {
                          cancelEditing();
                        }
                      }}
                      minRows={1}
                      maxRows={5}
                      className="catnotes-modal-input flex-1 min-w-0 custom-scrollbar"
                      style={{ resize: "none", overflowY: "auto" }}
                      disabled={savingEdit}
                    />
                  ) : (
                    <span
                      className={`catnotes-modal-text ${note.done ? "done" : ""}`}
                    >
                      {note.text}
                    </span>
                  )}
                  {editingNoteId === note._id ? (
                    <button
                      className="catnotes-modal-delete"
                      onClick={() => void handleSaveEdit(note._id!)}
                      disabled={savingEdit}
                      aria-label="Save note"
                      title="Save note"
                    >
                      {savingEdit ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        <Check className="w-4 h-4" />
                      )}
                    </button>
                  ) : (
                    <button
                      className="catnotes-modal-delete"
                      onClick={() => startEditing(note)}
                      aria-label="Edit note"
                      title="Edit note"
                    >
                      <Pencil className="w-4 h-4" />
                    </button>
                  )}
                  <button
                    className="catnotes-modal-delete"
                    onClick={() => handleDelete(note._id!)}
                    disabled={editingNoteId === note._id && savingEdit}
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Add Input */}
        <div className="catnotes-modal-footer">
          <TextareaAutosize
            ref={inputRef}
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                handleAdd();
              }
            }}
            minRows={1}
            maxRows={5}
            placeholder="Add a next step…"
            className="catnotes-modal-input custom-scrollbar"
            style={{ resize: "none", overflowY: "auto" }}
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
