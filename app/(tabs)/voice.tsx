import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
} from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Text } from "@/components/ui/text";
import { useMutation, useQuery } from "convex/react";
import { AudioModule, RecordingOptions, useAudioRecorder } from "expo-audio";
import * as FileSystem from "expo-file-system";
import { Loader2, Mic, MicOff, Trash2 } from "lucide-react-native";
import React, { useEffect, useState } from "react";
import {
  Alert,
  FlatList,
  Pressable,
  SafeAreaView,
  TouchableOpacity,
  View,
} from "react-native";
import { api } from "../../convex/_generated/api";

interface VoiceNote {
  _id: string;
  transcript: string;
  audioUri: string;
  createdAt: number;
}

// We cast to `RecordingOptions` at the end to preserve type-safety while
// allowing custom values that aren't present in the published typings (e.g. "wav").
const WAV_RECORDING_OPTIONS = {
  extension: ".wav",
  sampleRate: 44100,
  numberOfChannels: 1,
  bitRate: 256000,
  android: {
    // "wav" isn't included in the enum exposed by expo-audio's typings, but it
    // works correctly at runtime. Casting to `any` silences the mismatch while
    // retaining the desired behaviour.
    outputFormat: "wav" as any,
    audioEncoder: "aac" as any,
  },
  web: {
    mimeType: "audio/wav",
    bitsPerSecond: 128000,
  },
} as RecordingOptions;

export default function VoiceScreen() {
  const recorder = useAudioRecorder(WAV_RECORDING_OPTIONS);
  const [isRecording, setIsRecording] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);

  const voiceNotes = (useQuery(api.voiceNotes.getVoiceNotes) ??
    []) as VoiceNote[];
  const addVoiceNote = useMutation(api.voiceNotes.addVoiceNote);
  const deleteVoiceNote = useMutation(api.voiceNotes.deleteVoiceNote);

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

  const toggleRecording = async () => {
    if (isRecording) {
      // Stop recording
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
      // Start recording
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
      const transcript = await transcribeWithOpenAI(uri);
      await addVoiceNote({ transcript, audioUri: uri });

      // Clean up the local file after successful processing
      await FileSystem.deleteAsync(uri);
    } catch (error: any) {
      console.error(error);
      Alert.alert("Transcription Error", error?.message ?? "Unknown error");
    } finally {
      setIsProcessing(false);
    }
  };

  /**
   * Upload the local audio file to OpenAI to obtain a transcript.
   */
  const transcribeWithOpenAI = async (uri: string): Promise<string> => {
    const apiKey = process.env.EXPO_PUBLIC_OPENAI_API_KEY;
    if (!apiKey) {
      throw new Error("Missing OpenAI API key");
    }

    const fileInfo = await FileSystem.getInfoAsync(uri);
    if (!fileInfo.exists) {
      throw new Error("File does not exist at path: " + uri);
    }

    const formData = new FormData();
    formData.append("model", "gpt-4o-transcribe");
    formData.append("file", {
      uri,
      name: "audio.wav",
      type: "audio/wav",
    } as any);

    const response = await fetch(
      "https://api.openai.com/v1/audio/transcriptions",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          // NOTE: Do NOT set Content-Type manually; let fetch set the correct boundary for multipart
        },
        body: formData,
      }
    );

    if (!response.ok) {
      const errText = await response.text();
      throw new Error("OpenAI API error: " + errText);
    }

    const data = (await response.json()) as { text: string };
    return data.text;
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

  const handleDeleteVoiceNote = (id: string, transcript: string) => {
    const previewText =
      transcript.length > 50 ? transcript.substring(0, 50) + "..." : transcript;

    Alert.alert(
      "Delete Voice Note",
      `Are you sure you want to delete "${previewText}"?`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: async () => {
            try {
              await deleteVoiceNote({ id: id as any });
            } catch (error) {
              Alert.alert("Error", "Failed to delete voice note");
            }
          },
        },
      ]
    );
  };

  const renderItem = ({ item }: { item: VoiceNote }) => (
    <Card className="mb-4 shadow-sm">
      <CardHeader className="pb-3 flex-row justify-between items-start">
        <CardDescription className="flex-1">
          {formatDate(item.createdAt)}
        </CardDescription>
        <TouchableOpacity
          onPress={() => handleDeleteVoiceNote(item._id, item.transcript)}
          className="ml-3 p-1"
        >
          <Trash2 size={16} color="#EF4444" />
        </TouchableOpacity>
      </CardHeader>
      <CardContent>
        <Text className="text-base leading-relaxed text-foreground">
          {item.transcript}
        </Text>
      </CardContent>
    </Card>
  );

  return (
    <View className="flex-1 bg-background">
      <SafeAreaView className="flex-1">
        {/* Header */}
        <View className="px-6 pt-6 pb-4">
          <Text className="text-3xl font-bold text-foreground">
            Voice Notes
          </Text>
          <Text className="text-base text-muted-foreground mt-1">
            Tap to start/stop recording
          </Text>
        </View>

        <Separator className="mb-4" />

        {/* Voice Notes List */}
        <FlatList
          data={voiceNotes}
          keyExtractor={(item) => item._id}
          renderItem={renderItem}
          contentContainerStyle={{ paddingHorizontal: 24, paddingBottom: 200 }}
          showsVerticalScrollIndicator={false}
          ListEmptyComponent={
            <View className="flex-1 items-center justify-center mt-20">
              <MicOff size={48} color="#71717A" />
              <Text className="text-lg text-muted-foreground text-center mt-4">
                No voice notes yet
              </Text>
              <Text className="text-sm text-muted-foreground text-center mt-2">
                Tap the button below to start recording
              </Text>
            </View>
          }
        />

        {/* Floating Record Button */}
        <View className="absolute bottom-0 left-0 right-0 pb-36 px-6">
          <View className="items-center">
            {isProcessing && (
              <View className="mb-4 flex-row items-center bg-card px-4 py-3 rounded-full shadow-lg">
                <Loader2 size={20} color="#000" />
                <Text className="text-sm font-medium text-foreground ml-2">
                  Transcribing...
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
              style={{
                transform: [{ scale: isRecording ? 1.1 : 1 }],
              }}
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
        </View>
      </SafeAreaView>
    </View>
  );
}
