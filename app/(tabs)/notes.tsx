import { Text } from "@/components/ui/text";
import { useMutation, useQuery } from "convex/react";
import {
  ChevronRight,
  Circle,
  FolderIcon,
  Search,
  Trash2,
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
  const searchFocusAnim = useRef(new Animated.Value(0)).current;

  // Convex hooks
  const notes = (useQuery(api.voiceNotes.list) ?? []) as VoiceNote[];
  const todos = (useQuery(api.todos.list) ?? []) as Todo[];
  const folders = (useQuery(api.folders.list) ?? []) as FolderType[];

  const deleteVoiceNote = useMutation(api.voiceNotes.deleteVoiceNote);
  const toggleTodo = useMutation(api.todos.toggleTodo);
  const deleteTodo = useMutation(api.todos.deleteTodo);

  // Animations on mount
  useEffect(() => {
    Animated.spring(fadeAnim, {
      toValue: 1,
      tension: 20,
      friction: 7,
      useNativeDriver: true,
    }).start();
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

    if (diffMins < 1) return "Just now";
    if (diffMins < 60) return `${diffMins} min ago`;
    if (diffHours < 24)
      return `${diffHours} hour${diffHours > 1 ? "s" : ""} ago`;
    if (diffDays < 7) return `${diffDays} day${diffDays > 1 ? "s" : ""} ago`;

    return date.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: date.getFullYear() !== now.getFullYear() ? "numeric" : undefined,
    });
  };

  const onRefresh = React.useCallback(() => {
    setRefreshing(true);
    setTimeout(() => setRefreshing(false), 1000);
  }, []);

  const handleTabChange = (tab: TabType) => {
    LayoutAnimation.configureNext({
      duration: 300,
      create: {
        type: LayoutAnimation.Types.easeInEaseOut,
        property: LayoutAnimation.Properties.opacity,
      },
      update: {
        type: LayoutAnimation.Types.easeInEaseOut,
      },
    });
    setActiveTab(tab);
  };

  const toggleFolder = (folderId: string) => {
    LayoutAnimation.configureNext({
      duration: 200,
      create: {
        type: LayoutAnimation.Types.easeInEaseOut,
        property: LayoutAnimation.Properties.opacity,
      },
      update: {
        type: LayoutAnimation.Types.easeInEaseOut,
      },
    });
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

  // Clean Tab Bar
  const TabBar = () => (
    <View className="px-6 mb-6">
      <View className="flex-row bg-muted/30 rounded-full p-1">
        {[
          { id: "all", label: "All" },
          { id: "notes", label: "Notes" },
          { id: "todos", label: "Tasks" },
          { id: "folders", label: "Folders" },
        ].map((tab) => (
          <TouchableOpacity
            key={tab.id}
            onPress={() => handleTabChange(tab.id as TabType)}
            className={`flex-1 py-2.5 rounded-full ${
              activeTab === tab.id ? "bg-foreground" : ""
            }`}
          >
            <Text
              className={`text-center text-sm font-medium ${
                activeTab === tab.id
                  ? "text-background"
                  : "text-muted-foreground"
              }`}
            >
              {tab.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>
    </View>
  );

  // Refined Note Item
  const NoteItem = ({ note, index }: { note: VoiceNote; index: number }) => {
    const itemAnim = useRef(new Animated.Value(0)).current;
    const pressAnim = useRef(new Animated.Value(1)).current;

    useEffect(() => {
      Animated.spring(itemAnim, {
        toValue: 1,
        tension: 50,
        friction: 10,
        delay: index * 30,
        useNativeDriver: true,
      }).start();
    }, [index]);

    const handlePressIn = () => {
      Animated.spring(pressAnim, {
        toValue: 0.98,
        useNativeDriver: true,
      }).start();
    };

    const handlePressOut = () => {
      Animated.spring(pressAnim, {
        toValue: 1,
        useNativeDriver: true,
      }).start();
    };

    const renderRightActions = () => (
      <View className="flex-row items-center pl-3">
        <TouchableOpacity
          onPress={() => deleteVoiceNote({ id: note._id })}
          className="bg-red-500 w-20 h-full justify-center items-center rounded-3xl"
        >
          <Trash2 size={18} color="white" />
        </TouchableOpacity>
      </View>
    );

    return (
      <Animated.View
        style={{
          opacity: itemAnim,
          transform: [
            { scale: pressAnim },
            {
              translateY: itemAnim.interpolate({
                inputRange: [0, 1],
                outputRange: [10, 0],
              }),
            },
          ],
        }}
        className="mb-4"
      >
        <Swipeable renderRightActions={renderRightActions}>
          <Pressable onPressIn={handlePressIn} onPressOut={handlePressOut}>
            <View className="bg-card border border-border/20 rounded-3xl p-6 shadow-sm">
              <Text className="text-[15px] text-foreground leading-relaxed mb-4">
                {note.content}
              </Text>
              <Text className="text-xs text-muted-foreground/50 font-medium">
                {formatDate(note.createdAt)}
              </Text>
            </View>
          </Pressable>
        </Swipeable>
      </Animated.View>
    );
  };

  // Minimal Todo Item
  const TodoItem = ({ todo, index }: { todo: Todo; index: number }) => {
    const scaleAnim = useRef(new Animated.Value(1)).current;
    const itemAnim = useRef(new Animated.Value(0)).current;
    const checkAnim = useRef(new Animated.Value(todo.done ? 1 : 0)).current;

    useEffect(() => {
      Animated.spring(itemAnim, {
        toValue: 1,
        tension: 50,
        friction: 10,
        delay: index * 30,
        useNativeDriver: true,
      }).start();
    }, [index]);

    useEffect(() => {
      Animated.spring(checkAnim, {
        toValue: todo.done ? 1 : 0,
        tension: 50,
        friction: 7,
        useNativeDriver: true,
      }).start();
    }, [todo.done]);

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
      <View className="flex-row items-center pl-3">
        <TouchableOpacity
          onPress={() => deleteTodo({ id: todo._id })}
          className="bg-red-500 w-20 h-full justify-center items-center rounded-3xl"
        >
          <Trash2 size={18} color="white" />
        </TouchableOpacity>
      </View>
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
                outputRange: [10, 0],
              }),
            },
          ],
        }}
        className="mb-4"
      >
        <Swipeable renderRightActions={renderRightActions}>
          <Pressable onPress={handleToggle}>
            <View className="bg-card border border-border/20 rounded-3xl p-6 flex-row items-center shadow-sm">
              <View className="mr-4">
                <Animated.View
                  style={{
                    transform: [{ scale: checkAnim }],
                    opacity: checkAnim,
                  }}
                  className="absolute"
                >
                  <View className="w-6 h-6 bg-foreground rounded-full items-center justify-center">
                    <View className="w-2 h-2 bg-background rounded-full" />
                  </View>
                </Animated.View>
                <Animated.View
                  style={{
                    transform: [
                      {
                        scale: checkAnim.interpolate({
                          inputRange: [0, 1],
                          outputRange: [1, 0.8],
                        }),
                      },
                    ],
                    opacity: checkAnim.interpolate({
                      inputRange: [0, 1],
                      outputRange: [1, 0],
                    }),
                  }}
                >
                  <Circle size={24} color="#E5E5E7" strokeWidth={1.5} />
                </Animated.View>
              </View>
              <Text
                className={`text-[15px] flex-1 ${
                  todo.done
                    ? "text-muted-foreground/50 line-through"
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

  // Elegant Folder Item
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
      Animated.spring(rotateAnim, {
        toValue: isExpanded ? 1 : 0,
        tension: 100,
        friction: 10,
        useNativeDriver: true,
      }).start();
    }, [isExpanded]);

    return (
      <View className="mb-4">
        <TouchableOpacity
          onPress={() => toggleFolder(folder._id)}
          className="flex-row items-center justify-between py-3"
        >
          <View className="flex-row items-center flex-1">
            <FolderIcon size={20} color="#3B82F6" />
            <Text className="text-lg font-medium text-foreground ml-3">
              {folder.name}
            </Text>
          </View>
          <View className="flex-row items-center">
            <View className="bg-muted/40 px-2.5 py-1 rounded-full mr-3">
              <Text className="text-xs font-medium text-muted-foreground">
                {notes.length}
              </Text>
            </View>
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
              <ChevronRight size={18} color="#71717A" />
            </Animated.View>
          </View>
        </TouchableOpacity>

        {isExpanded && (
          <View className="mt-2">
            {notes.map((note, index) => (
              <NoteItem key={note._id} note={note} index={index} />
            ))}
          </View>
        )}
      </View>
    );
  };

  // Beautiful Empty State
  const EmptyState = () => (
    <View className="flex-1 items-center justify-center py-32">
      <View className="items-center">
        <View className="w-20 h-20 bg-muted/20 rounded-full items-center justify-center mb-6">
          <View className="w-3 h-3 bg-muted-foreground/30 rounded-full" />
        </View>
        <Text className="text-2xl font-semibold text-foreground mb-2">
          {activeTab === "todos"
            ? "No tasks yet"
            : activeTab === "folders"
              ? "No folders yet"
              : "No notes yet"}
        </Text>
        <Text className="text-sm text-muted-foreground/60 text-center px-12">
          {activeTab === "todos"
            ? "Create your first task to get organized"
            : activeTab === "folders"
              ? "Organize your notes into folders"
              : "Start recording to capture your thoughts"}
        </Text>
      </View>
    </View>
  );

  // Minimal Search Bar
  const SearchBar = () => {
    const [isFocused, setIsFocused] = useState(false);

    return (
      <View className="px-6 mb-6">
        <Animated.View
          style={{
            transform: [
              {
                scale: searchFocusAnim.interpolate({
                  inputRange: [0, 1],
                  outputRange: [1, 0.98],
                }),
              },
            ],
          }}
          className="bg-muted/20 rounded-2xl flex-row items-center px-4 py-3.5"
        >
          <Search size={18} color="#A1A1AA" />
          <TextInput
            value={searchQuery}
            onChangeText={setSearchQuery}
            onFocus={() => {
              setIsFocused(true);
              Animated.spring(searchFocusAnim, {
                toValue: 1,
                useNativeDriver: true,
              }).start();
            }}
            onBlur={() => {
              setIsFocused(false);
              Animated.spring(searchFocusAnim, {
                toValue: 0,
                useNativeDriver: true,
              }).start();
            }}
            placeholder="Search"
            placeholderTextColor="#A1A1AA"
            className="flex-1 ml-3 text-[15px] text-foreground"
          />
        </Animated.View>
      </View>
    );
  };

  // Main content renderer
  const renderContent = () => {
    const showNotes = activeTab === "notes" || activeTab === "all";
    const showTodos = activeTab === "todos" || activeTab === "all";
    const showFolders = activeTab === "folders";

    const hasNotes =
      filteredNotes.length > 0 || folderedNotes.some((f) => f.notes.length > 0);
    const hasTodos = filteredTodos.length > 0;
    const hasFolders = folders.length > 0;

    // Handle folders tab specifically
    if (showFolders) {
      if (!hasFolders) {
        return <EmptyState />;
      }
      return (
        <View>
          {folderedNotes.map(({ folder, notes }) => (
            <FolderItem key={folder._id} folder={folder} notes={notes} />
          ))}
        </View>
      );
    }

    if (!hasNotes && !hasTodos) {
      return <EmptyState />;
    }

    return (
      <View>
        {showNotes && filteredNotes.length > 0 && (
          <View className="mb-8">
            {activeTab === "all" && (
              <Text className="text-xs font-semibold text-muted-foreground/50 uppercase tracking-wider mb-4">
                Recent Notes
              </Text>
            )}
            {filteredNotes.map((note, index) => (
              <NoteItem key={note._id} note={note} index={index} />
            ))}
          </View>
        )}

        {showNotes && folderedNotes.some((f) => f.notes.length > 0) && (
          <View className="mb-8">
            {(activeTab === "all" || activeTab === "notes") && (
              <Text className="text-xs font-semibold text-muted-foreground/50 uppercase tracking-wider mb-4">
                Collections
              </Text>
            )}
            {folderedNotes
              .filter((f) => f.notes.length > 0)
              .map(({ folder, notes }) => (
                <FolderItem key={folder._id} folder={folder} notes={notes} />
              ))}
          </View>
        )}

        {showTodos && filteredTodos.length > 0 && (
          <View>
            {activeTab === "all" && (
              <Text className="text-xs font-semibold text-muted-foreground/50 uppercase tracking-wider mb-4">
                Tasks
              </Text>
            )}
            {filteredTodos.map((todo, index) => (
              <TodoItem key={todo._id} todo={todo} index={index} />
            ))}
          </View>
        )}
      </View>
    );
  };

  return (
    <GestureHandlerRootView className="flex-1">
      <View className="flex-1 bg-background">
        <SafeAreaView className="flex-1">
          <Animated.View
            style={{
              opacity: fadeAnim,
              transform: [
                {
                  translateY: fadeAnim.interpolate({
                    inputRange: [0, 1],
                    outputRange: [20, 0],
                  }),
                },
              ],
            }}
            className="flex-1"
          >
            {/* Clean Header */}
            <View className="px-6 pt-6 pb-8">
              <Text className="text-[34px] font-bold text-foreground tracking-tight">
                Library
              </Text>
            </View>

            {/* Search Bar */}
            <SearchBar />

            {/* Tab Bar */}
            <TabBar />

            {/* Content */}
            <ScrollView
              contentContainerStyle={{
                paddingHorizontal: 24,
                paddingBottom: 120,
              }}
              showsVerticalScrollIndicator={false}
              refreshControl={
                <RefreshControl
                  refreshing={refreshing}
                  onRefresh={onRefresh}
                  tintColor="#71717A"
                />
              }
            >
              {renderContent()}
            </ScrollView>
          </Animated.View>
        </SafeAreaView>
      </View>
    </GestureHandlerRootView>
  );
}
