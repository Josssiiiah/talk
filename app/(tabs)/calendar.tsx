import { Text } from "@/components/ui/text";
import { useQuery } from "convex/react";
import React, { useEffect, useRef, useState } from "react";
import {
  Animated,
  Pressable,
  SafeAreaView,
  ScrollView,
  View,
} from "react-native";
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

export default function CalendarScreen() {
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [currentMonth, setCurrentMonth] = useState(new Date());

  // Animation values
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const selectedDotScale = useRef(new Animated.Value(1)).current;

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

  // Check if a date has any notes or todos
  const hasDataForDate = (date: Date) => {
    const startOfDay = new Date(date);
    startOfDay.setHours(0, 0, 0, 0);
    const endOfDay = new Date(date);
    endOfDay.setHours(23, 59, 59, 999);

    const hasNotes = noteOnly.some((note) => {
      const noteDate = new Date(note.createdAt);
      return noteDate >= startOfDay && noteDate <= endOfDay;
    });

    const hasTodos = todos.some((todo) => {
      const todoDate = new Date(todo.createdAt);
      return todoDate >= startOfDay && todoDate <= endOfDay;
    });

    return hasNotes || hasTodos;
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
      .sort((a, b) => a.createdAt - b.createdAt); // Sort by earliest to latest

    const dayTodos = todos
      .filter((todo) => {
        const todoDate = new Date(todo.createdAt);
        return todoDate >= startOfDay && todoDate <= endOfDay;
      })
      .sort((a, b) => a.createdAt - b.createdAt); // Sort by earliest to latest

    return { notes: dayNotes, todos: dayTodos };
  };

  // Animation on mount
  useEffect(() => {
    Animated.timing(fadeAnim, {
      toValue: 1,
      duration: 500,
      useNativeDriver: true,
    }).start();
  }, []);

  // Animation for selected date
  useEffect(() => {
    if (selectedDate) {
      Animated.sequence([
        Animated.timing(selectedDotScale, {
          toValue: 0.8,
          duration: 100,
          useNativeDriver: true,
        }),
        Animated.spring(selectedDotScale, {
          toValue: 1,
          tension: 50,
          friction: 7,
          useNativeDriver: true,
        }),
      ]).start();
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

  const selectedItems = selectedDate ? getItemsForDate(selectedDate) : null;

  return (
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
          {/* Header */}
          <View className="px-6 pt-6 pb-4">
            <Text className="text-2xl font-bold text-foreground text-center">
              {currentMonth.toLocaleDateString("en-US", {
                month: "long",
                year: "numeric",
              })}
            </Text>
          </View>

          {/* Calendar Grid - Higher Position */}
          <View className="px-6 pt-8">
            <View className="w-full max-w-sm mx-auto">
              {/* Days of week header */}
              <View className="flex-row mb-4">
                {["S", "M", "T", "W", "T", "F", "S"].map((day, index) => (
                  <View key={index} className="flex-1 items-center">
                    <Text className="text-xs text-muted-foreground font-medium">
                      {day}
                    </Text>
                  </View>
                ))}
              </View>

              {/* Calendar dots grid */}
              <View className="flex-row flex-wrap">
                {/* Empty cells for start of month */}
                {Array.from({ length: startingDayOfWeek }).map((_, index) => (
                  <View key={`empty-${index}`} className="w-[14.28%] h-12" />
                ))}

                {/* Days of month */}
                {Array.from({ length: daysInMonth }).map((_, index) => {
                  const day = index + 1;
                  const date = new Date(
                    currentMonth.getFullYear(),
                    currentMonth.getMonth(),
                    day
                  );
                  const hasData = hasDataForDate(date);
                  const selected = isSelected(day);
                  const today = isToday(day);

                  return (
                    <Pressable
                      key={day}
                      onPress={() => setSelectedDate(date)}
                      className="w-[14.28%] h-12 items-center justify-center"
                    >
                      <Animated.View
                        style={{
                          transform: selected
                            ? [{ scale: selectedDotScale }]
                            : [],
                        }}
                        className={`
                          w-8 h-8 rounded-full items-center justify-center
                          ${selected ? "bg-foreground" : ""}
                          ${today && !selected ? "border border-foreground" : ""}
                        `}
                      >
                        {hasData && !selected ? (
                          <View className="w-1.5 h-1.5 bg-foreground rounded-full" />
                        ) : (
                          <Text
                            className={`
                              text-sm font-medium
                              ${selected ? "text-background" : "text-muted-foreground"}
                              ${today && !selected ? "text-foreground" : ""}
                            `}
                          >
                            {day}
                          </Text>
                        )}
                      </Animated.View>
                    </Pressable>
                  );
                })}
              </View>
            </View>
          </View>

          {/* Selected date items - Higher Position */}
          {selectedDate && selectedItems && (
            <View className="px-6 pt-8 pb-6 max-h-[45%]">
              <View className="bg-card border border-border/20 rounded-3xl p-6">
                <Text className="text-sm font-medium text-muted-foreground mb-4">
                  {formatDate(selectedDate)}
                </Text>

                <ScrollView showsVerticalScrollIndicator={false}>
                  {selectedItems.notes.length === 0 &&
                  selectedItems.todos.length === 0 ? (
                    <Text className="text-muted-foreground/50 text-center py-4">
                      No items for this day
                    </Text>
                  ) : (
                    <>
                      {/* Notes */}
                      {selectedItems.notes.map((note) => (
                        <View key={note._id} className="mb-4">
                          <Text className="text-xs text-muted-foreground/50 mb-1">
                            {formatTime(note.createdAt)}
                          </Text>
                          <Text className="text-sm text-foreground">
                            {note.content}
                          </Text>
                        </View>
                      ))}

                      {/* Todos */}
                      {selectedItems.todos.map((todo) => (
                        <View
                          key={todo._id}
                          className="mb-4 flex-row items-start"
                        >
                          <View className="w-4 h-4 rounded-full border border-muted-foreground/30 mr-3 mt-0.5">
                            {todo.done && (
                              <View className="w-full h-full bg-foreground rounded-full scale-75" />
                            )}
                          </View>
                          <View className="flex-1">
                            <Text className="text-xs text-muted-foreground/50 mb-1">
                              {formatTime(todo.createdAt)}
                            </Text>
                            <Text
                              className={`text-sm ${
                                todo.done
                                  ? "text-muted-foreground/50 line-through"
                                  : "text-foreground"
                              }`}
                            >
                              {todo.text}
                            </Text>
                          </View>
                        </View>
                      ))}
                    </>
                  )}
                </ScrollView>
              </View>
            </View>
          )}
        </Animated.View>
      </SafeAreaView>
    </View>
  );
}
