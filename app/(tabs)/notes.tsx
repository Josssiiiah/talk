import { Text } from "@/components/ui/text";
import { useMutation, useQuery } from "convex/react";
import {
  Archive,
  CheckCircle2,
  Circle,
  FileText,
  FolderIcon,
  Plus,
  Search,
} from "lucide-react-native";
import React, { useEffect, useRef, useState } from "react";
import {
  Animated,
  LayoutAnimation,
  Platform,
  Pressable,
  RefreshControl,
  SafeAreaView,
  ScrollView,
  TextInput,
  TouchableOpacity,
  UIManager,
  View,
} from "react-native";
import {
  GestureHandlerRootView,
  Swipeable,
} from "react-native-gesture-handler";
import { api } from "../../convex/_generated/api";
import { Id } from "../../convex/_generated/dataModel";

// Enable LayoutAnimation on Android
if (
  Platform.OS === "android" &&
  UIManager.setLayoutAnimationEnabledExperimental
) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

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

type TabType = "all" | "notes" | "todos" | "folders";

export default function NotesScreen() {
  const [activeTab, setActiveTab] = useState<TabType>("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [refreshing, setRefreshing] = useState(false);
  const [expandedFolders, setExpandedFolders] = useState<Set<string>>(
    new Set()
  );

  // Animation values
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(50)).current;

  // Convex hooks
  const notes = (useQuery(api.voiceNotes.list) ?? []) as VoiceNote[];
  const todos = (useQuery(api.todos.list) ?? []) as Todo[];
  const folders = (useQuery(api.folders.list) ?? []) as FolderType[];

  const deleteVoiceNote = useMutation(api.voiceNotes.deleteVoiceNote);
  const toggleTodo = useMutation(api.todos.toggleTodo);
  const deleteTodo = useMutation(api.todos.deleteTodo);

  // Animations on mount
  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 600,
        useNativeDriver: true,
      }),
      Animated.timing(slideAnim, {
        toValue: 0,
        duration: 500,
        useNativeDriver: true,
      }),
    ]).start();
  }, []);

  // Filter notes
  const noteOnly = notes.filter((n) => n.type === "note");
  const quickNotes = noteOnly.filter((n) => !n.folderId);
  const folderedNotes = folders.map((folder) => ({
    folder,
    notes: noteOnly.filter((n) => n.folderId === folder._id),
  }));

  // Search filter
  const filteredNotes = quickNotes.filter((note) =>
    note.content.toLowerCase().includes(searchQuery.toLowerCase())
  );
  const filteredTodos = todos.filter((todo) =>
    todo.text.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const formatDate = (timestamp: number) => {
    const date = new Date(timestamp);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return "now";
    if (diffMins < 60) return `${diffMins}m`;
    if (diffHours < 24) return `${diffHours}h`;
    if (diffDays < 7) return `${diffDays}d`;
    if (diffDays < 30) return `${Math.floor(diffDays / 7)}w`;

    return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
  };

  const onRefresh = React.useCallback(() => {
    setRefreshing(true);
    setTimeout(() => setRefreshing(false), 1000);
  }, []);

  const handleTabChange = (tab: TabType) => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setActiveTab(tab);
  };

  const toggleFolder = (folderId: string) => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
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

  // Tab Bar Component
  const TabBar = () => (
    <View className="flex-row px-5 mb-4">
      {[
        { id: "all", label: "All" },
        { id: "notes", label: "Notes" },
        { id: "todos", label: "Tasks" },
        { id: "folders", label: "Folders" },
      ].map((tab) => (
        <TouchableOpacity
          key={tab.id}
          onPress={() => handleTabChange(tab.id as TabType)}
          className={`mr-4 pb-2 ${
            activeTab === tab.id ? "border-b-2 border-foreground" : ""
          }`}
        >
          <Text
            className={`text-base font-medium ${
              activeTab === tab.id ? "text-foreground" : "text-muted-foreground"
            }`}
          >
            {tab.label}
          </Text>
        </TouchableOpacity>
      ))}
    </View>
  );

  // Note Item with Swipe
  const NoteItem = ({ note, index }: { note: VoiceNote; index: number }) => {
    const itemAnim = useRef(new Animated.Value(0)).current;

    useEffect(() => {
      Animated.timing(itemAnim, {
        toValue: 1,
        duration: 300,
        delay: index * 50,
        useNativeDriver: true,
      }).start();
    }, [index]);

    const renderRightActions = () => (
      <TouchableOpacity
        onPress={() => deleteVoiceNote({ id: note._id })}
        className="bg-red-500 justify-center items-center px-6 rounded-r-2xl"
      >
        <Archive size={24} color="white" />
      </TouchableOpacity>
    );

    return (
      <Animated.View
        style={{
          opacity: itemAnim,
          transform: [
            {
              translateY: itemAnim.interpolate({
                inputRange: [0, 1],
                outputRange: [20, 0],
              }),
            },
          ],
        }}
        className="mb-3"
      >
        <Swipeable renderRightActions={renderRightActions}>
          <View className="bg-card rounded-2xl p-4 shadow-sm">
            <View className="flex-row justify-between items-start mb-2">
              <View className="flex-row items-center">
                <FileText size={14} color="#71717A" />
                <Text className="text-xs text-muted-foreground ml-1">
                  {formatDate(note.createdAt)}
                </Text>
              </View>
            </View>
            <Text className="text-base text-foreground leading-relaxed">
              {note.content}
            </Text>
          </View>
        </Swipeable>
      </Animated.View>
    );
  };

  // Todo Item with Animation
  const TodoItem = ({ todo, index }: { todo: Todo; index: number }) => {
    const scaleAnim = useRef(new Animated.Value(1)).current;
    const itemAnim = useRef(new Animated.Value(0)).current;

    useEffect(() => {
      Animated.timing(itemAnim, {
        toValue: 1,
        duration: 300,
        delay: index * 50,
        useNativeDriver: true,
      }).start();
    }, [index]);

    const handleToggle = () => {
      Animated.sequence([
        Animated.timing(scaleAnim, {
          toValue: 0.95,
          duration: 100,
          useNativeDriver: true,
        }),
        Animated.timing(scaleAnim, {
          toValue: 1,
          duration: 100,
          useNativeDriver: true,
        }),
      ]).start(() => {
        toggleTodo({ id: todo._id });
      });
    };

    const renderRightActions = () => (
      <TouchableOpacity
        onPress={() => deleteTodo({ id: todo._id })}
        className="bg-red-500 justify-center items-center px-6 rounded-r-2xl"
      >
        <Archive size={24} color="white" />
      </TouchableOpacity>
    );

    return (
      <Animated.View
        style={{
          opacity: itemAnim,
          transform: [
            { scale: scaleAnim },
            {
              translateY: itemAnim.interpolate({
                inputRange: [0, 1],
                outputRange: [20, 0],
              }),
            },
          ],
        }}
        className="mb-3"
      >
        <Swipeable renderRightActions={renderRightActions}>
          <Pressable onPress={handleToggle}>
            <View className="bg-card rounded-2xl p-4 shadow-sm flex-row items-center">
              {todo.done ? (
                <CheckCircle2 size={22} color="#22C55E" />
              ) : (
                <Circle size={22} color="#E5E5E7" strokeWidth={2} />
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
            </View>
          </Pressable>
        </Swipeable>
      </Animated.View>
    );
  };

  // Folder Item
  const FolderItem = ({
    folder,
    notes,
  }: {
    folder: FolderType;
    notes: VoiceNote[];
  }) => {
    const isExpanded = expandedFolders.has(folder._id);
    const rotateAnim = useRef(new Animated.Value(0)).current;

    useEffect(() => {
      Animated.timing(rotateAnim, {
        toValue: isExpanded ? 1 : 0,
        duration: 200,
        useNativeDriver: true,
      }).start();
    }, [isExpanded]);

    return (
      <View className="mb-4">
        <TouchableOpacity
          onPress={() => toggleFolder(folder._id)}
          className="bg-card rounded-2xl p-4 shadow-sm"
        >
          <View className="flex-row items-center justify-between">
            <View className="flex-row items-center flex-1">
              <FolderIcon size={20} color="#3B82F6" />
              <Text className="text-lg font-medium text-foreground ml-3">
                {folder.name}
              </Text>
            </View>
            <View className="flex-row items-center">
              <Text className="text-sm text-muted-foreground mr-3">
                {notes.length}
              </Text>
              <Animated.View
                style={{
                  transform: [
                    {
                      rotate: rotateAnim.interpolate({
                        inputRange: [0, 1],
                        outputRange: ["0deg", "90deg"],
                      }),
                    },
                  ],
                }}
              >
                <Plus size={20} color="#71717A" />
              </Animated.View>
            </View>
          </View>
        </TouchableOpacity>

        {isExpanded && (
          <View className="mt-3 ml-4">
            {notes.map((note, index) => (
              <NoteItem key={note._id} note={note} index={index} />
            ))}
          </View>
        )}
      </View>
    );
  };

  // Empty State
  const EmptyState = () => (
    <View className="flex-1 items-center justify-center py-20">
      <View className="w-24 h-24 bg-muted rounded-3xl items-center justify-center mb-4">
        <FileText size={40} color="#71717A" />
      </View>
      <Text className="text-xl font-medium text-foreground mb-2">
        No {activeTab === "all" ? "content" : activeTab} yet
      </Text>
      <Text className="text-base text-muted-foreground text-center px-8">
        {activeTab === "todos"
          ? "Create your first task to get started"
          : "Start recording to create your first note"}
      </Text>
    </View>
  );

  // Search Bar
  const SearchBar = () => (
    <View className="px-5 mb-4">
      <View className="bg-muted/50 rounded-2xl flex-row items-center px-4 py-3">
        <Search size={20} color="#71717A" />
        <TextInput
          value={searchQuery}
          onChangeText={setSearchQuery}
          placeholder="Search notes and tasks..."
          placeholderTextColor="#71717A"
          className="flex-1 ml-3 text-base text-foreground"
        />
      </View>
    </View>
  );

  // Main content renderer
  const renderContent = () => {
    if (
      activeTab === "notes" ||
      (activeTab === "all" && filteredNotes.length > 0)
    ) {
      return filteredNotes.map((note, index) => (
        <NoteItem key={note._id} note={note} index={index} />
      ));
    }

    if (
      activeTab === "todos" ||
      (activeTab === "all" && filteredTodos.length > 0)
    ) {
      return filteredTodos.map((todo, index) => (
        <TodoItem key={todo._id} todo={todo} index={index} />
      ));
    }

    if (activeTab === "folders") {
      return folderedNotes.map(({ folder, notes }) => (
        <FolderItem key={folder._id} folder={folder} notes={notes} />
      ));
    }

    if (activeTab === "all") {
      return (
        <>
          {filteredNotes.length > 0 && (
            <View className="mb-6">
              <Text className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-3 px-1">
                Notes
              </Text>
              {filteredNotes.map((note, index) => (
                <NoteItem key={note._id} note={note} index={index} />
              ))}
            </View>
          )}

          {filteredTodos.length > 0 && (
            <View className="mb-6">
              <Text className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-3 px-1">
                Tasks
              </Text>
              {filteredTodos.map((todo, index) => (
                <TodoItem key={todo._id} todo={todo} index={index} />
              ))}
            </View>
          )}
        </>
      );
    }

    return null;
  };

  const hasContent =
    filteredNotes.length > 0 || filteredTodos.length > 0 || folders.length > 0;

  return (
    <GestureHandlerRootView className="flex-1">
      <View className="flex-1 bg-background">
        <SafeAreaView className="flex-1">
          <Animated.View
            style={{
              opacity: fadeAnim,
              transform: [{ translateY: slideAnim }],
            }}
            className="flex-1"
          >
            {/* Header */}
            <View className="px-5 pt-4 pb-6">
              <Text className="text-4xl font-bold text-foreground tracking-tight">
                Notes
              </Text>
            </View>

            {/* Search Bar */}
            <SearchBar />

            {/* Tab Bar */}
            <TabBar />

            {/* Content */}
            <ScrollView
              contentContainerStyle={{
                paddingHorizontal: 20,
                paddingBottom: 100,
              }}
              showsVerticalScrollIndicator={false}
              refreshControl={
                <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
              }
            >
              {hasContent ? renderContent() : <EmptyState />}
            </ScrollView>
          </Animated.View>
        </SafeAreaView>
      </View>
    </GestureHandlerRootView>
  );
}
