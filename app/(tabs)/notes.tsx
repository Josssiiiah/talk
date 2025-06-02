import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
} from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Text } from "@/components/ui/text";
import { useMutation, useQuery } from "convex/react";
import {
  Check,
  ChevronDown,
  ChevronRight,
  Circle,
  Folder,
  Trash2,
} from "lucide-react-native";
import React, { useState } from "react";
import { SafeAreaView, ScrollView, TouchableOpacity, View } from "react-native";
import { api } from "../../convex/_generated/api";
import { Id } from "../../convex/_generated/dataModel";

interface VoiceNote {
  _id: Id<"voiceNotes">;
  content: string;
  folderId?: Id<"folders">;
  createdAt: number;
  type: string;
}

interface Todo {
  _id: Id<"todos">;
  text: string;
  done: boolean;
  createdAt: number;
}

interface FolderType {
  _id: Id<"folders">;
  name: string;
  createdAt: number;
}

export default function NotesScreen() {
  const [expandedFolders, setExpandedFolders] = useState<Set<string>>(
    new Set()
  );

  // Convex hooks
  const notes = (useQuery(api.voiceNotes.list) ?? []) as VoiceNote[];
  const todos = (useQuery(api.todos.list) ?? []) as Todo[];
  const folders = (useQuery(api.folders.list) ?? []) as FolderType[];

  const deleteVoiceNote = useMutation(api.voiceNotes.deleteVoiceNote);
  const toggleTodo = useMutation(api.todos.toggleTodo);
  const deleteTodo = useMutation(api.todos.deleteTodo);

  // Only treat items stored in voiceNotes that are real "notes"
  const noteOnly = notes.filter((n) => n.type === "note");

  // Group notes by folder
  const quickNotes = noteOnly.filter((n) => !n.folderId);
  const folderedNotes = folders.map((folder) => ({
    folder,
    notes: noteOnly.filter((n) => n.folderId === folder._id),
  }));

  const toggleFolder = (folderId: string) => {
    setExpandedFolders((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(folderId)) {
        newSet.delete(folderId);
      } else {
        newSet.add(folderId);
      }
      return newSet;
    });
  };

  const formatDate = (timestamp: number) => {
    const date = new Date(timestamp);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return "Just now";
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;

    return date.toLocaleDateString();
  };

  const NoteCard = ({ note }: { note: VoiceNote }) => (
    <Card className="mb-3 shadow-sm">
      <CardHeader className="pb-3 flex-row justify-between items-start">
        <CardDescription className="flex-1">
          {formatDate(note.createdAt)}
        </CardDescription>
        <TouchableOpacity
          onPress={() => deleteVoiceNote({ id: note._id })}
          className="ml-3 p-1"
        >
          <Trash2 size={16} color="#EF4444" />
        </TouchableOpacity>
      </CardHeader>
      <CardContent>
        <Text className="text-base leading-relaxed text-foreground">
          {note.content}
        </Text>
      </CardContent>
    </Card>
  );

  const TodoRow = ({ todo }: { todo: Todo }) => (
    <Card className="mb-3 shadow-sm">
      <TouchableOpacity onPress={() => toggleTodo({ id: todo._id })}>
        <CardContent className="flex-row items-center py-4">
          {todo.done ? (
            <Check size={20} color="#22C55E" />
          ) : (
            <Circle size={20} color="#71717A" />
          )}
          <Text
            className={`text-base ml-3 flex-1 ${
              todo.done
                ? "line-through text-muted-foreground"
                : "text-foreground"
            }`}
          >
            {todo.text}
          </Text>
          <TouchableOpacity
            onPress={() => deleteTodo({ id: todo._id })}
            className="ml-3 p-1"
          >
            <Trash2 size={16} color="#EF4444" />
          </TouchableOpacity>
        </CardContent>
      </TouchableOpacity>
    </Card>
  );

  const FolderSection = ({
    folder,
    notes,
  }: {
    folder: FolderType;
    notes: VoiceNote[];
  }) => {
    const isExpanded = expandedFolders.has(folder._id);

    return (
      <View className="mb-4">
        <TouchableOpacity
          onPress={() => toggleFolder(folder._id)}
          className="flex-row items-center mb-2"
        >
          {isExpanded ? (
            <ChevronDown size={20} color="#71717A" />
          ) : (
            <ChevronRight size={20} color="#71717A" />
          )}
          <Folder size={20} color="#71717A" className="ml-1 mr-2" />
          <Text className="text-lg font-semibold text-foreground flex-1">
            {folder.name}
          </Text>
          <Text className="text-sm text-muted-foreground">
            {notes.length} notes
          </Text>
        </TouchableOpacity>

        {isExpanded && (
          <View className="ml-8">
            {notes.map((note) => (
              <NoteCard key={note._id} note={note} />
            ))}
          </View>
        )}
      </View>
    );
  };

  return (
    <View className="flex-1 bg-background">
      <SafeAreaView className="flex-1">
        {/* Header */}
        <View className="px-6 pt-6 pb-4">
          <Text className="text-3xl font-bold text-foreground">Notes</Text>
          <Text className="text-base text-muted-foreground mt-1">
            Your voice notes, organized
          </Text>
        </View>

        <Separator className="mb-4" />

        <ScrollView
          contentContainerStyle={{ paddingHorizontal: 24, paddingBottom: 200 }}
          showsVerticalScrollIndicator={false}
        >
          {/* Quick Notes Section */}
          {quickNotes.length > 0 && (
            <View className="mb-6">
              <Text className="text-xl font-semibold text-foreground mb-3">
                Quick Notes
              </Text>
              {quickNotes.map((note) => (
                <NoteCard key={note._id} note={note} />
              ))}
            </View>
          )}

          {/* To-Dos Section */}
          {todos.length > 0 && (
            <View className="mb-6">
              <Text className="text-xl font-semibold text-foreground mb-3">
                To-Dos
              </Text>
              {todos.map((todo) => (
                <TodoRow key={todo._id} todo={todo} />
              ))}
            </View>
          )}

          {/* Folders Section */}
          {folderedNotes.length > 0 && (
            <View className="mb-6">
              <Text className="text-xl font-semibold text-foreground mb-3">
                Folders
              </Text>
              {folderedNotes.map(({ folder, notes }) => (
                <FolderSection key={folder._id} folder={folder} notes={notes} />
              ))}
            </View>
          )}

          {/* Empty state */}
          {quickNotes.length === 0 &&
            todos.length === 0 &&
            folderedNotes.length === 0 && (
              <View className="flex-1 items-center justify-center mt-20">
                <Text className="text-lg text-muted-foreground text-center">
                  No notes yet
                </Text>
                <Text className="text-sm text-muted-foreground text-center mt-2">
                  Tap the button below to start recording
                </Text>
              </View>
            )}
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}
