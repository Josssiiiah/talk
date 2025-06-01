import { useMutation, useQuery } from "convex/react";
import { AudioModule, RecordingOptions, useAudioRecorder } from "expo-audio";
import * as FileSystem from "expo-file-system";
import React, { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Button,
  FlatList,
  SafeAreaView,
  StyleSheet,
  Text,
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

  const startRecording = async () => {
    try {
      await recorder.prepareToRecordAsync();
      recorder.record();
      setIsRecording(true);
    } catch (err) {
      console.error(err);
      Alert.alert("Error", "Failed to start recording");
    }
  };

  const stopRecording = async () => {
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

  const renderItem = ({ item }: { item: VoiceNote }) => (
    <View style={styles.noteItem}>
      <Text style={styles.noteText}>{item.transcript}</Text>
    </View>
  );

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.recordContainer}>
        <Button
          title={isRecording ? "Stop Recording" : "Start Recording"}
          onPress={isRecording ? stopRecording : startRecording}
          color={isRecording ? "#FF3B30" : "#34C759"}
        />
        {isProcessing && (
          <View style={styles.processingOverlay}>
            <ActivityIndicator size="large" color="#000" />
            <Text style={styles.processingText}>Transcribing…</Text>
          </View>
        )}
      </View>

      <FlatList
        data={voiceNotes}
        keyExtractor={(item) => item._id}
        renderItem={renderItem}
        contentContainerStyle={styles.listContent}
        ListEmptyComponent={
          <Text style={styles.empty}>No voice notes yet</Text>
        }
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#F5F5F5",
  },
  recordContainer: {
    padding: 20,
    alignItems: "center",
  },
  processingOverlay: {
    marginTop: 12,
    alignItems: "center",
  },
  processingText: {
    marginTop: 4,
  },
  listContent: {
    padding: 16,
  },
  empty: {
    textAlign: "center",
    marginTop: 20,
    color: "#666",
  },
  noteItem: {
    backgroundColor: "#FFF",
    padding: 16,
    borderRadius: 12,
    marginBottom: 12,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
    elevation: 1,
  },
  noteText: {
    fontSize: 16,
    color: "#333",
  },
});
