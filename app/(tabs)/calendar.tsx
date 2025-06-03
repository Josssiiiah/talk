import { Text } from "@/components/ui/text";
import { useQuery } from "convex/react";
import * as Haptics from "expo-haptics";
import { ChevronLeft, ChevronRight, Circle } from "lucide-react-native";
import React, { useEffect, useRef, useState } from "react";
import {
  Animated,
  Easing,
  LayoutAnimation,
  Platform,
  Pressable,
  SafeAreaView,
  ScrollView,
  UIManager,
  View,
} from "react-native";
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

export default function CalendarScreen() {
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [currentMonth, setCurrentMonth] = useState(new Date());

  // Enhanced animation values
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const selectedDotScale = useRef(new Animated.Value(1)).current;
  const monthTransition = useRef(new Animated.Value(0)).current;
  const contentScale = useRef(new Animated.Value(0.95)).current;
  const headerGlow = useRef(new Animated.Value(0)).current;

  // Calendar grid animations
  const gridFade = useRef(new Animated.Value(0)).current;
  const selectedCardSlide = useRef(new Animated.Value(100)).current;
  const selectedCardOpacity = useRef(new Animated.Value(0)).current;

  // Convex hooks
  const notes = (useQuery(api.voiceNotes.list) ?? []) as VoiceNote[];
  const todos = (useQuery(api.todos.list) ?? []) as Todo[];

  // Filter notes (exclude non-note types)
  const noteOnly = notes.filter((n) => n.type === "note");

  // Get calendar data
  const getDaysInMonth = (date: Date) => {
    const year = date.getFullYear();
    const month = date.getMonth();
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const daysInMonth = lastDay.getDate();
    const startingDayOfWeek = firstDay.getDay();

    return { daysInMonth, startingDayOfWeek };
  };

  const { daysInMonth, startingDayOfWeek } = getDaysInMonth(currentMonth);

  // Check if a date has any notes or todos with priority levels
  const hasDataForDate = (date: Date) => {
    const startOfDay = new Date(date);
    startOfDay.setHours(0, 0, 0, 0);
    const endOfDay = new Date(date);
    endOfDay.setHours(23, 59, 59, 999);

    const dayNotes = noteOnly.filter((note) => {
      const noteDate = new Date(note.createdAt);
      return noteDate >= startOfDay && noteDate <= endOfDay;
    });

    const dayTodos = todos.filter((todo) => {
      const todoDate = new Date(todo.createdAt);
      return todoDate >= startOfDay && todoDate <= endOfDay;
    });

    const totalItems = dayNotes.length + dayTodos.length;

    return {
      hasData: totalItems > 0,
      intensity: Math.min(totalItems / 3, 1), // 0-1 scale for visual intensity
      itemCount: totalItems,
    };
  };

  // Get items for selected date
  const getItemsForDate = (date: Date) => {
    const startOfDay = new Date(date);
    startOfDay.setHours(0, 0, 0, 0);
    const endOfDay = new Date(date);
    endOfDay.setHours(23, 59, 59, 999);

    const dayNotes = noteOnly
      .filter((note) => {
        const noteDate = new Date(note.createdAt);
        return noteDate >= startOfDay && noteDate <= endOfDay;
      })
      .sort((a, b) => a.createdAt - b.createdAt);

    const dayTodos = todos
      .filter((todo) => {
        const todoDate = new Date(todo.createdAt);
        return todoDate >= startOfDay && todoDate <= endOfDay;
      })
      .sort((a, b) => a.createdAt - b.createdAt);

    return { notes: dayNotes, todos: dayTodos };
  };

  // Enhanced month navigation
  const navigateMonth = (direction: "prev" | "next") => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

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

    // Animate month transition
    Animated.sequence([
      Animated.timing(monthTransition, {
        toValue: direction === "next" ? -50 : 50,
        duration: 150,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
      Animated.timing(monthTransition, {
        toValue: 0,
        duration: 200,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
    ]).start();

    const newMonth = new Date(currentMonth);
    if (direction === "next") {
      newMonth.setMonth(newMonth.getMonth() + 1);
    } else {
      newMonth.setMonth(newMonth.getMonth() - 1);
    }
    setCurrentMonth(newMonth);
    setSelectedDate(null);
  };

  // Enhanced date selection
  const handleDateSelect = (date: Date) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

    // Animate selection
    Animated.sequence([
      Animated.timing(selectedDotScale, {
        toValue: 0.85,
        duration: 100,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
      Animated.spring(selectedDotScale, {
        toValue: 1,
        tension: 300,
        friction: 20,
        useNativeDriver: true,
      }),
    ]).start();

    setSelectedDate(date);
  };

  // Refined animations on mount
  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 600,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
      Animated.timing(contentScale, {
        toValue: 1,
        duration: 600,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
      Animated.timing(gridFade, {
        toValue: 1,
        duration: 800,
        delay: 200,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
    ]).start();

    // Subtle header glow animation
    Animated.loop(
      Animated.sequence([
        Animated.timing(headerGlow, {
          toValue: 1,
          duration: 4000,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
        Animated.timing(headerGlow, {
          toValue: 0,
          duration: 4000,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
      ])
    ).start();
  }, []);

  // Animate selected card
  useEffect(() => {
    if (selectedDate) {
      Animated.parallel([
        Animated.spring(selectedCardSlide, {
          toValue: 0,
          tension: 280,
          friction: 30,
          useNativeDriver: true,
        }),
        Animated.timing(selectedCardOpacity, {
          toValue: 1,
          duration: 400,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true,
        }),
      ]).start();
    } else {
      selectedCardSlide.setValue(100);
      selectedCardOpacity.setValue(0);
    }
  }, [selectedDate]);

  const isToday = (day: number) => {
    const today = new Date();
    return (
      day === today.getDate() &&
      currentMonth.getMonth() === today.getMonth() &&
      currentMonth.getFullYear() === today.getFullYear()
    );
  };

  const isSelected = (day: number) => {
    if (!selectedDate) return false;
    return (
      day === selectedDate.getDate() &&
      currentMonth.getMonth() === selectedDate.getMonth() &&
      currentMonth.getFullYear() === selectedDate.getFullYear()
    );
  };

  const formatDate = (date: Date) => {
    return date.toLocaleDateString("en-US", {
      weekday: "long",
      year: "numeric",
      month: "long",
      day: "numeric",
    });
  };

  const formatTime = (timestamp: number) => {
    return new Date(timestamp).toLocaleTimeString("en-US", {
      hour: "numeric",
      minute: "2-digit",
    });
  };

  const getRelativeDate = (date: Date) => {
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);

    if (date.toDateString() === today.toDateString()) return "Today";
    if (date.toDateString() === yesterday.toDateString()) return "Yesterday";
    return formatDate(date);
  };

  const selectedItems = selectedDate ? getItemsForDate(selectedDate) : null;

  return (
    <View className="flex-1 bg-background">
      <SafeAreaView className="flex-1">
        <Animated.View
          style={{
            opacity: fadeAnim,
            transform: [
              { scale: contentScale },
              {
                translateY: fadeAnim.interpolate({
                  inputRange: [0, 1],
                  outputRange: [30, 0],
                }),
              },
            ],
          }}
          className="flex-1"
        >
          {/* Enhanced Header with Navigation */}
          <Animated.View
            style={{
              transform: [{ translateX: monthTransition }],
            }}
            className="px-6 pt-4 pb-6"
          >
            <View className="flex-row items-center justify-between mb-2">
              <Pressable
                onPress={() => navigateMonth("prev")}
                className="w-11 h-11 rounded-full bg-muted/30 items-center justify-center"
                style={{
                  shadowColor: "#000",
                  shadowOffset: { width: 0, height: 1 },
                  shadowOpacity: 0.05,
                  shadowRadius: 2,
                  elevation: 1,
                }}
              >
                <ChevronLeft size={20} color="rgba(0, 0, 0, 0.6)" />
              </Pressable>

              <Animated.View
                style={{
                  opacity: headerGlow.interpolate({
                    inputRange: [0, 1],
                    outputRange: [0.9, 1],
                  }),
                }}
              >
                <Text className="text-[28px] font-bold text-foreground tracking-tight">
                  {currentMonth.toLocaleDateString("en-US", { month: "long" })}
                </Text>
                <Text className="text-lg font-medium text-muted-foreground/70 text-center">
                  {currentMonth.getFullYear()}
                </Text>
              </Animated.View>

              <Pressable
                onPress={() => navigateMonth("next")}
                className="w-11 h-11 rounded-full bg-muted/30 items-center justify-center"
                style={{
                  shadowColor: "#000",
                  shadowOffset: { width: 0, height: 1 },
                  shadowOpacity: 0.05,
                  shadowRadius: 2,
                  elevation: 1,
                }}
              >
                <ChevronRight size={20} color="rgba(0, 0, 0, 0.6)" />
              </Pressable>
            </View>
          </Animated.View>

          {/* Refined Calendar Grid */}
          <Animated.View
            style={{
              opacity: gridFade,
              transform: [{ translateX: monthTransition }],
            }}
            className="px-8"
          >
            <View className="w-full max-w-sm mx-auto">
              {/* Enhanced Days Header */}
              <View className="flex-row mb-6 px-1">
                {["S", "M", "T", "W", "T", "F", "S"].map((day, index) => (
                  <View key={index} className="flex-1 items-center">
                    <Text className="text-[13px] text-muted-foreground/60 font-semibold tracking-wide">
                      {day}
                    </Text>
                  </View>
                ))}
              </View>

              {/* Enhanced Calendar Grid */}
              <View className="flex-row flex-wrap">
                {/* Empty cells for start of month */}
                {Array.from({ length: startingDayOfWeek }).map((_, index) => (
                  <View key={`empty-${index}`} className="w-[14.28%] h-14" />
                ))}

                {/* Days of month with enhanced states */}
                {Array.from({ length: daysInMonth }).map((_, index) => {
                  const day = index + 1;
                  const date = new Date(
                    currentMonth.getFullYear(),
                    currentMonth.getMonth(),
                    day
                  );
                  const dataInfo = hasDataForDate(date);
                  const selected = isSelected(day);
                  const today = isToday(day);

                  return (
                    <Pressable
                      key={day}
                      onPress={() => handleDateSelect(date)}
                      className="w-[14.28%] h-14 items-center justify-center"
                    >
                      <Animated.View
                        style={{
                          transform: selected
                            ? [{ scale: selectedDotScale }]
                            : [],
                          shadowColor: selected ? "#000" : "transparent",
                          shadowOffset: { width: 0, height: 2 },
                          shadowOpacity: selected ? 0.1 : 0,
                          shadowRadius: selected ? 4 : 0,
                          elevation: selected ? 2 : 0,
                        }}
                        className={`
                          w-10 h-10 rounded-full items-center justify-center relative
                          ${selected ? "bg-foreground" : ""}
                          ${today && !selected ? "bg-muted/40" : ""}
                        `}
                      >
                        {/* Data indicator with intensity-based sizing */}
                        {dataInfo.hasData && !selected && (
                          <View
                            className="absolute top-0 right-0 bg-blue-500 rounded-full"
                            style={{
                              width: 4 + dataInfo.intensity * 2,
                              height: 4 + dataInfo.intensity * 2,
                              opacity: 0.7 + dataInfo.intensity * 0.3,
                            }}
                          />
                        )}

                        {/* Day number */}
                        <Text
                          className={`
                            font-medium
                            ${selected ? "text-background text-[15px]" : "text-[14px]"}
                            ${today && !selected ? "text-foreground font-semibold" : "text-muted-foreground"}
                            ${dataInfo.hasData && !selected && !today ? "text-foreground" : ""}
                          `}
                        >
                          {day}
                        </Text>
                      </Animated.View>
                    </Pressable>
                  );
                })}
              </View>
            </View>
          </Animated.View>

          {/* Enhanced Selected Date Content */}
          {selectedDate && selectedItems && (
            <Animated.View
              style={{
                opacity: selectedCardOpacity,
                transform: [{ translateY: selectedCardSlide }],
              }}
              className="flex-1 px-6 pt-8 pb-6"
            >
              <View
                className="bg-card border border-border/10 rounded-[24px] p-6 flex-1"
                style={{
                  shadowColor: "#000",
                  shadowOffset: { width: 0, height: 4 },
                  shadowOpacity: 0.08,
                  shadowRadius: 16,
                  elevation: 4,
                }}
              >
                {/* Enhanced Date Header */}
                <View className="flex-row items-center justify-between mb-6">
                  <View>
                    <Text className="text-[17px] font-semibold text-foreground mb-1">
                      {getRelativeDate(selectedDate)}
                    </Text>
                    <Text className="text-[13px] text-muted-foreground/60 font-medium">
                      {selectedItems.notes.length + selectedItems.todos.length}{" "}
                      items
                    </Text>
                  </View>

                  {/* Quick stats */}
                  <View className="flex-row space-x-3">
                    {selectedItems.notes.length > 0 && (
                      <View className="bg-blue-50 px-3 py-1.5 rounded-full">
                        <Text className="text-[12px] font-medium text-blue-600">
                          {selectedItems.notes.length} note
                          {selectedItems.notes.length !== 1 ? "s" : ""}
                        </Text>
                      </View>
                    )}
                    {selectedItems.todos.length > 0 && (
                      <View className="bg-green-50 px-3 py-1.5 rounded-full">
                        <Text className="text-[12px] font-medium text-green-600">
                          {selectedItems.todos.length} task
                          {selectedItems.todos.length !== 1 ? "s" : ""}
                        </Text>
                      </View>
                    )}
                  </View>
                </View>

                {/* Enhanced Content List */}
                <ScrollView
                  showsVerticalScrollIndicator={false}
                  className="flex-1"
                  contentContainerStyle={{ paddingBottom: 8 }}
                >
                  {selectedItems.notes.length === 0 &&
                  selectedItems.todos.length === 0 ? (
                    <View className="flex-1 items-center justify-center py-12">
                      <View className="w-16 h-16 bg-muted/20 rounded-full items-center justify-center mb-4">
                        <Circle size={24} color="rgba(0, 0, 0, 0.2)" />
                      </View>
                      <Text className="text-muted-foreground/60 text-center text-[15px] font-medium">
                        No items for this day
                      </Text>
                      <Text className="text-muted-foreground/40 text-center text-[13px] mt-1">
                        Voice notes and tasks will appear here
                      </Text>
                    </View>
                  ) : (
                    <>
                      {/* Enhanced Notes */}
                      {selectedItems.notes.map((note, index) => (
                        <View
                          key={note._id}
                          className="mb-5 p-4 bg-blue-50/50 rounded-2xl border border-blue-100/50"
                        >
                          <View className="flex-row items-center mb-2">
                            <View className="w-2 h-2 bg-blue-400 rounded-full mr-3" />
                            <Text className="text-[12px] text-blue-600/70 font-medium">
                              {formatTime(note.createdAt)}
                            </Text>
                          </View>
                          <Text className="text-[15px] text-foreground leading-relaxed pl-5">
                            {note.content}
                          </Text>
                        </View>
                      ))}

                      {/* Enhanced Todos */}
                      {selectedItems.todos.map((todo, index) => (
                        <View
                          key={todo._id}
                          className="mb-5 p-4 bg-green-50/50 rounded-2xl border border-green-100/50"
                        >
                          <View className="flex-row items-start">
                            <View className="mr-4 mt-0.5">
                              <View
                                className={`w-5 h-5 rounded-full border-2 items-center justify-center ${
                                  todo.done
                                    ? "bg-green-500 border-green-500"
                                    : "border-green-300"
                                }`}
                              >
                                {todo.done && (
                                  <View className="w-2 h-2 bg-white rounded-full" />
                                )}
                              </View>
                            </View>
                            <View className="flex-1">
                              <Text className="text-[12px] text-green-600/70 font-medium mb-1">
                                {formatTime(todo.createdAt)}
                              </Text>
                              <Text
                                className={`text-[15px] leading-relaxed ${
                                  todo.done
                                    ? "text-muted-foreground/60 line-through"
                                    : "text-foreground"
                                }`}
                              >
                                {todo.text}
                              </Text>
                            </View>
                          </View>
                        </View>
                      ))}
                    </>
                  )}
                </ScrollView>
              </View>
            </Animated.View>
          )}
        </Animated.View>
      </SafeAreaView>
    </View>
  );
}
