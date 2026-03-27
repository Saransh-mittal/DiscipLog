import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import connectToDatabase from "@/lib/mongoose";
import User from "@/models/User";
import mongoose from "mongoose";

// POST — Add a note to a category
export async function POST(req: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return new NextResponse("Unauthorized", { status: 401 });
    }

    const userId = (session.user as { id: string }).id;
    const { categoryId, text } = await req.json();

    if (!categoryId || !text?.trim()) {
      return new NextResponse("categoryId and text are required", { status: 400 });
    }

    await connectToDatabase();

    const noteId = new mongoose.Types.ObjectId();
    const user = await User.findOneAndUpdate(
      { _id: userId, "categories._id": categoryId },
      {
        $push: {
          "categories.$.notes": {
            _id: noteId,
            text: text.trim(),
            done: false,
            createdAt: new Date(),
          },
        },
      },
      { returnDocument: "after" }
    );

    if (!user) {
      return new NextResponse("User or category not found", { status: 404 });
    }

    const category = user.categories.find(
      (c: { _id?: { toString(): string } }) => c._id?.toString() === categoryId
    );
    const newNote = category?.notes?.find(
      (n: { _id?: { toString(): string } }) => n._id?.toString() === noteId.toString()
    );

    return NextResponse.json(newNote || { _id: noteId.toString(), text: text.trim(), done: false });
  } catch (error) {
    console.error("[NOTES_POST_ERROR]", error);
    return new NextResponse("Failed to add note", { status: 500 });
  }
}

// PATCH — Toggle done or edit text of a note
export async function PATCH(req: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return new NextResponse("Unauthorized", { status: 401 });
    }

    const userId = (session.user as { id: string }).id;
    const { categoryId, noteId, done, text } = await req.json();

    if (!categoryId || !noteId) {
      return new NextResponse("categoryId and noteId are required", { status: 400 });
    }

    await connectToDatabase();

    // Build update fields dynamically
    const setFields: Record<string, unknown> = {};
    if (typeof done === "boolean") {
      setFields["categories.$[cat].notes.$[note].done"] = done;
    }
    if (typeof text === "string" && text.trim()) {
      setFields["categories.$[cat].notes.$[note].text"] = text.trim();
    }

    if (Object.keys(setFields).length === 0) {
      return new NextResponse("Nothing to update", { status: 400 });
    }

    const user = await User.findOneAndUpdate(
      { _id: userId },
      { $set: setFields },
      {
        arrayFilters: [
          { "cat._id": new mongoose.Types.ObjectId(categoryId) },
          { "note._id": new mongoose.Types.ObjectId(noteId) },
        ],
        returnDocument: "after",
      }
    );

    if (!user) {
      return new NextResponse("User not found", { status: 404 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("[NOTES_PATCH_ERROR]", error);
    return new NextResponse("Failed to update note", { status: 500 });
  }
}

// DELETE — Remove a note from a category
export async function DELETE(req: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return new NextResponse("Unauthorized", { status: 401 });
    }

    const userId = (session.user as { id: string }).id;
    const { categoryId, noteId } = await req.json();

    if (!categoryId || !noteId) {
      return new NextResponse("categoryId and noteId are required", { status: 400 });
    }

    await connectToDatabase();

    const user = await User.findOneAndUpdate(
      { _id: userId, "categories._id": categoryId },
      {
        $pull: {
          "categories.$.notes": { _id: new mongoose.Types.ObjectId(noteId) },
        },
      },
      { returnDocument: "after" }
    );

    if (!user) {
      return new NextResponse("User or category not found", { status: 404 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("[NOTES_DELETE_ERROR]", error);
    return new NextResponse("Failed to delete note", { status: 500 });
  }
}
