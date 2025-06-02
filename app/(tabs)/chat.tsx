// Chat screen for recording voice notes and showing latest categorized result

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
} from "@/components/ui/card";
import { Text } from "@/components/ui/text";
import { useAction, useMutation, useQuery } from "convex/react";
import { AudioModule, RecordingOptions, useAudioRecorder } from "expo-audio";
import * as FileSystem from "expo-file-system";
import { Loader2, Mic } from "lucide-react-native";
import React, { useEffect, useMemo, useState } from "react";
import { Alert, Pressable, SafeAreaView, View } from "react-native";
import { api } from "../../convex/_generated/api";
import { Id } from "../../convex/_generated/dataModel";

// Same recording options used elsewhere for consistency
const WAV_RECORDING_OPTIONS = {
  extension: ".wav",
  sampleRate: 16000,
  numberOfChannels: 1,
  bitRate: 64000,
  android: {
    outputFormat: "wav" as any,
    audioEncoder: "aac" as any,
  },
  web: {
    mimeType: "audio/wav",
    bitsPerSecond: 128000,
  },
} as RecordingOptions;

interface VoiceNote {
  _id: Id<"voiceNotes">;
  content: string;
  folderId?: Id<"folders">;
  createdAt: number;
}
interface Todo {
  _id: Id<"todos">;
  text: string;
  done: boolean;
  createdAt: number;
}

export default function ChatScreen() {
  // Recording state
  const recorder = useAudioRecorder(WAV_RECORDING_OPTIONS);
  const [isRecording, setIsRecording] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);

  // Convex hooks
  const voiceNotes = (useQuery(api.voiceNotes.list) ?? []) as VoiceNote[];
  const todos = (useQuery(api.todos.list) ?? []) as Todo[];
  const addPlaceholder = useMutation(api.voiceNotes.addPlaceholder);
  const processTranscript = useAction(api.agent.processTranscript);

  /** Request mic permission on mount */
  useEffect(() => {
    (async () => {
      const status = await AudioModule.requestRecordingPermissionsAsync();
      if (!status.granted) {
        Alert.alert(
          "Permission required",
          "Microphone permission is needed to record audio"
        );
      }
    })();
  }, []);

  // Helper: compute latest entry across tables
  const latestEntry = useMemo(() => {
    const combined: Array<{ type: "voiceNote" | "todo"; item: any }> = [
      ...voiceNotes.map((n) => ({ type: "voiceNote" as const, item: n })),
      ...todos.map((t) => ({ type: "todo" as const, item: t })),
    ];
    if (combined.length === 0) return null;
    combined.sort((a, b) => a.item.createdAt - b.item.createdAt);
    return combined[combined.length - 1];
  }, [voiceNotes, todos]);

  const getCategoryLabel = (
    entry: { type: "voiceNote" | "todo"; item: any } | null
  ) => {
    if (!entry) return "";
    if (entry.type === "todo") return "To-Do";
    // voiceNote
    const note: VoiceNote = entry.item;
    if (note.folderId) return "Folder Note";
    return "Quick Note";
  };

  const toggleRecording = async () => {
    if (isRecording) {
      try {
        await recorder.stop();
        setIsRecording(false);
        if (!recorder.uri) {
          throw new Error("Recording URI is undefined");
        }
        await handleTranscription(recorder.uri);
      } catch (err) {
        console.error(err);
        Alert.alert("Error", "Failed to stop recording");
      }
    } else {
      try {
        await recorder.prepareToRecordAsync();
        recorder.record();
        setIsRecording(true);
      } catch (err) {
        console.error(err);
        Alert.alert("Error", "Failed to start recording");
      }
    }
  };

  const handleTranscription = async (uri: string) => {
    setIsProcessing(true);
    try {
      const noteId = await addPlaceholder();
      const base64Audio = await FileSystem.readAsStringAsync(uri, {
        encoding: FileSystem.EncodingType.Base64,
      });
      await processTranscript({ noteId, audioBase64: base64Audio });
      // Clean up local file async
      setTimeout(() => {
        FileSystem.deleteAsync(uri).catch(console.error);
      }, 1000);
    } catch (error: any) {
      console.error(error);
      Alert.alert("Processing Error", error?.message ?? "Unknown error");
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <View className="flex-1 bg-background">
      <SafeAreaView className="flex-1 px-6 pt-6">
        {/* Latest note display */}
        {latestEntry && !isProcessing && (
          <Card className="mb-6 shadow-sm">
            <CardHeader className="pb-2">
              <CardDescription>{getCategoryLabel(latestEntry)}</CardDescription>
            </CardHeader>
            <CardContent>
              <Text className="text-base leading-relaxed text-foreground">
                {latestEntry.type === "todo"
                  ? latestEntry.item.text
                  : latestEntry.item.content}
              </Text>
            </CardContent>
          </Card>
        )}

        {/* Record Button */}
        <View className="flex-1 items-center justify-end pb-36">
          {isProcessing && (
            <View className="mb-4 flex-row items-center bg-card px-4 py-3 rounded-full shadow-lg">
              <Loader2 size={20} color="#000" />
              <Text className="text-sm font-medium text-foreground ml-2">
                Processing...
              </Text>
            </View>
          )}

          <Pressable
            onPress={toggleRecording}
            disabled={isProcessing}
            className={`w-20 h-20 rounded-full items-center justify-center shadow-xl ${
              isRecording
                ? "bg-destructive"
                : isProcessing
                  ? "bg-muted"
                  : "bg-primary"
            }`}
            style={{ transform: [{ scale: isRecording ? 1.1 : 1 }] }}
          >
            {isRecording ? (
              <View className="w-6 h-6 bg-white rounded-sm" />
            ) : (
              <Mic size={32} color="white" />
            )}
          </Pressable>
          {isRecording && (
            <Text className="text-sm font-medium text-destructive mt-4 animate-pulse">
              Recording... Tap to stop
            </Text>
          )}
        </View>
      </SafeAreaView>
    </View>
  );
}
