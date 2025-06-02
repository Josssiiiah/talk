// Chat screen for recording voice notes and showing latest categorized result

import { Text } from "@/components/ui/text";
import { useAction, useMutation, useQuery } from "convex/react";
import { AudioModule, RecordingOptions, useAudioRecorder } from "expo-audio";
import * as FileSystem from "expo-file-system";
import * as Haptics from "expo-haptics";
import { Check, Mic, Trash2 } from "lucide-react-native";
import React, { useEffect, useRef, useState } from "react";
import {
  Alert,
  Animated,
  Easing,
  Pressable,
  SafeAreaView,
  View,
} from "react-native";
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
  const [isPressed, setIsPressed] = useState(false);

  // Keep track of the placeholder note id so we can review it later
  const pendingNoteId = useRef<Id<"voiceNotes"> | null>(null);

  // Baseline IDs before a new recording – helps us identify new todos created by the backend
  const baselineTodoIds = useRef<Array<Id<"todos">>>([]);

  // Review state – populated once processing finishes
  const [reviewItem, setReviewItem] = useState<
    { type: "voiceNote"; item: VoiceNote } | { type: "todo"; item: Todo } | null
  >(null);

  // Convex hooks
  const voiceNotes = (useQuery(api.voiceNotes.list) ?? []) as VoiceNote[];
  const todos = (useQuery(api.todos.list) ?? []) as Todo[];
  const addPlaceholder = useMutation(api.voiceNotes.addPlaceholder);
  const deleteVoiceNote = useMutation(api.voiceNotes.deleteVoiceNote);
  const deleteTodo = useMutation(api.todos.deleteTodo);
  const processTranscript = useAction(api.agent.processTranscript);

  // 🎨 Futuristic animation values
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const outerRingRotation = useRef(new Animated.Value(0)).current;
  const middleRingRotation = useRef(new Animated.Value(0)).current;
  const innerRingRotation = useRef(new Animated.Value(0)).current;
  const particleOpacity = useRef(new Animated.Value(0)).current;
  const coreScale = useRef(new Animated.Value(1)).current;
  const textGlow = useRef(new Animated.Value(0)).current;
  const hologramOpacity = useRef(new Animated.Value(0)).current;

  // Recording-specific animations
  const recordingPulse = useRef(new Animated.Value(1)).current;
  const waveformScale = useRef(new Animated.Value(0)).current;
  const recordingRingScale = useRef(new Animated.Value(0)).current;
  const energyPulse = useRef(new Animated.Value(0)).current;

  // Simplified transition - just fade between states
  const overlayOpacity = useRef(new Animated.Value(0)).current;

  // Particle animation values (8 particles)
  const particleAnims = useRef(
    Array.from({ length: 8 }, () => ({
      rotation: new Animated.Value(0),
      scale: new Animated.Value(0.5),
      opacity: new Animated.Value(0),
    }))
  ).current;

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
      baselineTodoIds.current = todos.map((t) => t._id);

      pendingNoteId.current = await addPlaceholder();
      const base64Audio = await FileSystem.readAsStringAsync(uri, {
        encoding: FileSystem.EncodingType.Base64,
      });
      await processTranscript({
        noteId: pendingNoteId.current,
        audioBase64: base64Audio,
      });
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

  /* 🔄 When processing finishes, decide if there's something to review */
  useEffect(() => {
    if (isProcessing) return; // Only run when processing just finished
    if (!pendingNoteId.current) return;

    // Check if the placeholder still exists (note flow)
    const updatedVoiceNote = voiceNotes.find(
      (n) => n._id === pendingNoteId.current
    );

    if (updatedVoiceNote) {
      setReviewItem({ type: "voiceNote", item: updatedVoiceNote });
      pendingNoteId.current = null;
      return;
    }

    // Otherwise, look for a new todo that wasn't there before
    const newTodo = todos.find((t) => !baselineTodoIds.current.includes(t._id));

    if (newTodo) {
      setReviewItem({ type: "todo", item: newTodo });
      pendingNoteId.current = null;
      return;
    }
  }, [isProcessing, voiceNotes, todos]);

  /* 🎨 Pulse animation for record button */
  useEffect(() => {
    let loop: any = null;
    if (isRecording) {
      loop = Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, {
            toValue: 1.3,
            duration: 700,
            easing: Easing.inOut(Easing.ease),
            useNativeDriver: true,
          }),
          Animated.timing(pulseAnim, {
            toValue: 1,
            duration: 700,
            easing: Easing.inOut(Easing.ease),
            useNativeDriver: true,
          }),
        ])
      );
      loop.start();
    } else {
      pulseAnim.setValue(1);
      loop?.stop();
    }
    return () => {
      loop?.stop();
    };
  }, [isRecording]);

  /* 🎤 Recording state animations */
  useEffect(() => {
    if (isRecording) {
      // Start recording animations
      const recordingAnimations = [
        // Recording pulse (faster than button)
        Animated.loop(
          Animated.sequence([
            Animated.timing(recordingPulse, {
              toValue: 1.6,
              duration: 400,
              easing: Easing.inOut(Easing.ease),
              useNativeDriver: true,
            }),
            Animated.timing(recordingPulse, {
              toValue: 1,
              duration: 400,
              easing: Easing.inOut(Easing.ease),
              useNativeDriver: true,
            }),
          ])
        ),

        // Waveform effect
        Animated.loop(
          Animated.sequence([
            Animated.timing(waveformScale, {
              toValue: 1,
              duration: 300,
              easing: Easing.inOut(Easing.ease),
              useNativeDriver: true,
            }),
            Animated.timing(waveformScale, {
              toValue: 0.3,
              duration: 300,
              easing: Easing.inOut(Easing.ease),
              useNativeDriver: true,
            }),
          ])
        ),

        // Energy pulse
        Animated.loop(
          Animated.sequence([
            Animated.timing(energyPulse, {
              toValue: 1,
              duration: 800,
              easing: Easing.inOut(Easing.ease),
              useNativeDriver: true,
            }),
            Animated.timing(energyPulse, {
              toValue: 0,
              duration: 800,
              easing: Easing.inOut(Easing.ease),
              useNativeDriver: true,
            }),
          ])
        ),
      ];

      // Scale in recording ring
      Animated.timing(recordingRingScale, {
        toValue: 1,
        duration: 500,
        easing: Easing.out(Easing.back(1.1)),
        useNativeDriver: true,
      }).start();

      // Start simple rotation for recording
      Animated.loop(
        Animated.timing(outerRingRotation, {
          toValue: 1,
          duration: 12000,
          easing: Easing.linear,
          useNativeDriver: true,
        })
      ).start();

      recordingAnimations.forEach((anim) => anim.start());
    } else {
      // Reset recording animations
      recordingPulse.setValue(1);
      waveformScale.setValue(0);
      recordingRingScale.setValue(0);
      energyPulse.setValue(0);
    }
  }, [isRecording]);

  /* 🔄 Smooth transition from recording to transcribing */
  useEffect(() => {
    if (isProcessing) {
      // Simple fade transition
      Animated.timing(overlayOpacity, {
        toValue: 1,
        duration: 500,
        easing: Easing.inOut(Easing.ease),
        useNativeDriver: true,
      }).start();
    } else {
      overlayOpacity.setValue(0);
    }
  }, [isProcessing, isRecording]);

  /* 🚀 Futuristic processing animations */
  useEffect(() => {
    if (isProcessing) {
      // Start all animations
      const animations = [
        // Outer ring - slow clockwise
        Animated.loop(
          Animated.timing(outerRingRotation, {
            toValue: 1,
            duration: 8000,
            easing: Easing.linear,
            useNativeDriver: true,
          })
        ),

        // Middle ring - medium counter-clockwise
        Animated.loop(
          Animated.timing(middleRingRotation, {
            toValue: 1,
            duration: 5000,
            easing: Easing.linear,
            useNativeDriver: true,
          })
        ),

        // Inner ring - fast clockwise
        Animated.loop(
          Animated.timing(innerRingRotation, {
            toValue: 1,
            duration: 3000,
            easing: Easing.linear,
            useNativeDriver: true,
          })
        ),

        // Core pulsing
        Animated.loop(
          Animated.sequence([
            Animated.timing(coreScale, {
              toValue: 1.4,
              duration: 1500,
              easing: Easing.inOut(Easing.ease),
              useNativeDriver: true,
            }),
            Animated.timing(coreScale, {
              toValue: 1,
              duration: 1500,
              easing: Easing.inOut(Easing.ease),
              useNativeDriver: true,
            }),
          ])
        ),

        // Text glow effect
        Animated.loop(
          Animated.sequence([
            Animated.timing(textGlow, {
              toValue: 1,
              duration: 2000,
              easing: Easing.inOut(Easing.ease),
              useNativeDriver: true,
            }),
            Animated.timing(textGlow, {
              toValue: 0,
              duration: 2000,
              easing: Easing.inOut(Easing.ease),
              useNativeDriver: true,
            }),
          ])
        ),

        // Hologram effect
        Animated.loop(
          Animated.sequence([
            Animated.timing(hologramOpacity, {
              toValue: 0.8,
              duration: 1000,
              easing: Easing.inOut(Easing.ease),
              useNativeDriver: true,
            }),
            Animated.timing(hologramOpacity, {
              toValue: 0.2,
              duration: 1000,
              easing: Easing.inOut(Easing.ease),
              useNativeDriver: true,
            }),
          ])
        ),
      ];

      // Particle animations with staggered start
      particleAnims.forEach((particle, index) => {
        setTimeout(() => {
          // Rotation
          Animated.loop(
            Animated.timing(particle.rotation, {
              toValue: 1,
              duration: 4000 + index * 500,
              easing: Easing.linear,
              useNativeDriver: true,
            })
          ).start();

          // Scale pulsing
          Animated.loop(
            Animated.sequence([
              Animated.timing(particle.scale, {
                toValue: 1,
                duration: 800,
                easing: Easing.inOut(Easing.ease),
                useNativeDriver: true,
              }),
              Animated.timing(particle.scale, {
                toValue: 0.3,
                duration: 800,
                easing: Easing.inOut(Easing.ease),
                useNativeDriver: true,
              }),
            ])
          ).start();

          // Opacity
          Animated.timing(particle.opacity, {
            toValue: 1,
            duration: 500,
            useNativeDriver: true,
          }).start();
        }, index * 100);
      });

      // Start main animations
      animations.forEach((anim) => anim.start());

      // Fade in particles
      Animated.timing(particleOpacity, {
        toValue: 1,
        duration: 1000,
        useNativeDriver: true,
      }).start();
    } else {
      // Reset all animations
      outerRingRotation.setValue(0);
      middleRingRotation.setValue(0);
      innerRingRotation.setValue(0);
      coreScale.setValue(1);
      textGlow.setValue(0);
      hologramOpacity.setValue(0);
      particleOpacity.setValue(0);

      particleAnims.forEach((particle) => {
        particle.rotation.setValue(0);
        particle.scale.setValue(0.5);
        particle.opacity.setValue(0);
      });
    }
  }, [isProcessing]);

  // Add function to handle center tap during recording
  const handleCenterTap = async () => {
    if (isRecording) {
      try {
        // Haptic feedback for user confirmation
        await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

        await recorder.stop();
        setIsRecording(false);
        if (recorder.uri) {
          await handleTranscription(recorder.uri);
        }
      } catch (err) {
        console.error(err);
        Alert.alert("Error", "Failed to stop recording");
      }
    }
  };

  const handlePressIn = () => {
    if (isRecording) {
      setIsPressed(true);
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
  };

  const handlePressOut = () => {
    setIsPressed(false);
  };

  return (
    <View className="flex-1 bg-background">
      <SafeAreaView className="flex-1 items-center justify-center">
        {/* 🎤 Recording overlay */}
        {isRecording && (
          <View className="absolute inset-0 items-center justify-center bg-background/95 z-20">
            {/* Expanded recording background animation */}
            <View className="absolute inset-0">
              {/* Extended radial lines */}
              {Array.from({ length: 16 }).map((_, i) => (
                <Animated.View
                  key={`line-${i}`}
                  style={{
                    position: "absolute",
                    top: "50%",
                    left: "50%",
                    width: 1,
                    height: 300 + (i % 3) * 100, // Varying lengths
                    marginTop: -(150 + (i % 3) * 50),
                    marginLeft: -0.5,
                    backgroundColor: `rgba(0, 0, 0, ${0.03 - (i % 3) * 0.005})`,
                    transform: [
                      { rotate: `${i * 22.5}deg` },
                      {
                        scaleY: energyPulse.interpolate({
                          inputRange: [0, 1],
                          outputRange: [0.7, 1.2],
                        }),
                      },
                    ],
                    opacity: energyPulse.interpolate({
                      inputRange: [0, 1],
                      outputRange: [0.5, 1],
                    }),
                  }}
                />
              ))}

              {/* Outer expanding waves */}
              {Array.from({ length: 3 }).map((_, i) => (
                <Animated.View
                  key={`wave-${i}`}
                  style={{
                    position: "absolute",
                    top: "50%",
                    left: "50%",
                    width: 600 + i * 300,
                    height: 600 + i * 300,
                    marginTop: -(300 + i * 150),
                    marginLeft: -(300 + i * 150),
                    borderRadius: 300 + i * 150,
                    borderWidth: 0.5,
                    borderColor: "rgba(0, 0, 0, 0.015)",
                    opacity: recordingPulse.interpolate({
                      inputRange: [1, 1.6],
                      outputRange: [0.2 - i * 0.05, 0.4 - i * 0.1],
                    }),
                    transform: [
                      {
                        scale: recordingPulse.interpolate({
                          inputRange: [1, 1.6],
                          outputRange: [0.9, 1.3 + i * 0.1],
                        }),
                      },
                    ],
                  }}
                />
              ))}

              {/* Particle dots in radial pattern - similar to transcribing effect */}
              {Array.from({ length: 8 }).map((_, i) => (
                <Animated.View
                  key={`recording-dot-${i}`}
                  style={{
                    position: "absolute",
                    top: "50%",
                    left: "50%",
                    width: 4,
                    height: 4,
                    marginTop: -2,
                    marginLeft: -2,
                    borderRadius: 2,
                    backgroundColor: "rgba(0, 0, 0, 0.08)",
                    opacity: recordingPulse.interpolate({
                      inputRange: [1, 1.6],
                      outputRange: [0.4, 0.9],
                    }),
                    transform: [
                      {
                        translateX: energyPulse.interpolate({
                          inputRange: [0, 1],
                          outputRange: [
                            Math.cos((i * 45 * Math.PI) / 180) * 70,
                            Math.cos((i * 45 * Math.PI) / 180) * 110,
                          ],
                        }),
                      },
                      {
                        translateY: energyPulse.interpolate({
                          inputRange: [0, 1],
                          outputRange: [
                            Math.sin((i * 45 * Math.PI) / 180) * 70,
                            Math.sin((i * 45 * Math.PI) / 180) * 110,
                          ],
                        }),
                      },
                      {
                        scale: recordingPulse.interpolate({
                          inputRange: [1, 1.6],
                          outputRange: [0.6, 1.3],
                        }),
                      },
                    ],
                  }}
                />
              ))}
            </View>

            {/* Large tap area - covers most of the screen center */}
            <Pressable
              onPress={handleCenterTap}
              onPressIn={handlePressIn}
              onPressOut={handlePressOut}
              className="absolute w-80 h-80 items-center justify-center"
              style={{
                borderRadius: 160,
                backgroundColor: isPressed ? "transparent" : "transparent",
              }}
            ></Pressable>

            {/* Refined recording text */}
            <View className="absolute inset-0 items-center justify-center pointer-events-none px-8">
              <Animated.View
                style={{
                  opacity: recordingPulse.interpolate({
                    inputRange: [1, 1.6],
                    outputRange: [0.6, 1],
                  }),
                }}
                className="items-center"
              >
                <Text
                  style={{
                    color: "rgba(0, 0, 0, 0.5)",
                  }}
                  className="text-xl font-medium mb-4 tracking-wide text-center"
                >
                  Recording
                </Text>
                <View className="flex-row space-x-1.5 justify-center mb-4">
                  {Array.from({ length: 3 }).map((_, i) => (
                    <Animated.View
                      key={i}
                      style={{
                        opacity: recordingPulse.interpolate({
                          inputRange: [1, 1.6],
                          outputRange: [0.4, 0.8],
                        }),
                        transform: [
                          {
                            scale: recordingPulse.interpolate({
                              inputRange: [1, 1.6],
                              outputRange: [0.8, 1.2],
                            }),
                          },
                        ],
                        backgroundColor: "rgba(0, 0, 0, 0.12)",
                      }}
                      className="w-2 h-2 rounded-full"
                    />
                  ))}
                </View>
                <Text
                  style={{
                    color: "rgba(0, 0, 0, 0.35)",
                  }}
                  className="text-base font-medium text-center"
                >
                  Tap anywhere to stop
                </Text>
              </Animated.View>
            </View>
          </View>
        )}

        {/* 🚀 Refined processing overlay */}
        {isProcessing && (
          <View className="absolute inset-0 items-center justify-center bg-background/96 z-20">
            {/* Radial geometric transcription background animation */}
            <View className="absolute inset-0">
              {/* Radial lines for processing - similar to recording but different timing */}
              {Array.from({ length: 12 }).map((_, i) => (
                <Animated.View
                  key={`process-line-${i}`}
                  style={{
                    position: "absolute",
                    top: "50%",
                    left: "50%",
                    width: 1.5,
                    height: 250 + (i % 4) * 75, // Varying lengths
                    marginTop: -(125 + (i % 4) * 37.5),
                    marginLeft: -0.75,
                    backgroundColor: `rgba(0, 0, 0, ${0.04 - (i % 4) * 0.008})`,
                    transform: [
                      { rotate: `${i * 30}deg` },
                      {
                        scaleY: coreScale.interpolate({
                          inputRange: [1, 1.4],
                          outputRange: [0.6, 1.3],
                        }),
                      },
                      {
                        rotateZ: outerRingRotation.interpolate({
                          inputRange: [0, 1],
                          outputRange: [`${i * 30}deg`, `${i * 30 + 360}deg`],
                        }),
                      },
                    ],
                    opacity: textGlow.interpolate({
                      inputRange: [0, 1],
                      outputRange: [0.3, 0.8],
                    }),
                  }}
                />
              ))}

              {/* Geometric dots in radial pattern */}
              {Array.from({ length: 8 }).map((_, i) => (
                <Animated.View
                  key={`process-dot-${i}`}
                  style={{
                    position: "absolute",
                    top: "50%",
                    left: "50%",
                    width: 4,
                    height: 4,
                    marginTop: -2,
                    marginLeft: -2,
                    borderRadius: 2,
                    backgroundColor: "rgba(0, 0, 0, 0.06)",
                    opacity: particleOpacity.interpolate({
                      inputRange: [0, 1],
                      outputRange: [0.3, 0.8],
                    }),
                    transform: [
                      {
                        translateX: hologramOpacity.interpolate({
                          inputRange: [0.2, 0.8],
                          outputRange: [
                            Math.cos((i * 45 * Math.PI) / 180) * 80,
                            Math.cos((i * 45 * Math.PI) / 180) * 120,
                          ],
                        }),
                      },
                      {
                        translateY: hologramOpacity.interpolate({
                          inputRange: [0.2, 0.8],
                          outputRange: [
                            Math.sin((i * 45 * Math.PI) / 180) * 80,
                            Math.sin((i * 45 * Math.PI) / 180) * 120,
                          ],
                        }),
                      },
                      {
                        scale: textGlow.interpolate({
                          inputRange: [0, 1],
                          outputRange: [0.5, 1.2],
                        }),
                      },
                    ],
                  }}
                />
              ))}
            </View>

            {/* Refined text */}
            <View className="absolute inset-0 items-center justify-center px-8">
              <Animated.View
                style={{
                  opacity: textGlow.interpolate({
                    inputRange: [0, 1],
                    outputRange: [0.6, 1],
                  }),
                }}
                className="items-center"
              >
                <Text
                  style={{
                    color: "rgba(0, 0, 0, 0.5)",
                  }}
                  className="text-xl font-medium mb-4 tracking-wide text-center"
                >
                  Transcribing
                </Text>
                <View className="flex-row space-x-1.5 justify-center mb-4">
                  {Array.from({ length: 3 }).map((_, i) => (
                    <Animated.View
                      key={i}
                      style={{
                        opacity: recordingPulse.interpolate({
                          inputRange: [1, 1.6],
                          outputRange: [0.4, 0.8],
                        }),
                        transform: [
                          {
                            scale: recordingPulse.interpolate({
                              inputRange: [1, 1.6],
                              outputRange: [0.8, 1.2],
                            }),
                          },
                        ],
                        backgroundColor: "rgba(0, 0, 0, 0.12)",
                      }}
                      className="w-2 h-2 rounded-full"
                    />
                  ))}
                </View>

                <Text
                  style={{
                    color: "rgba(0, 0, 0, 0.35)",
                  }}
                  className="text-base font-medium text-center"
                >
                  Processing audio...
                </Text>
              </Animated.View>
            </View>
          </View>
        )}

        {/* Review sheet */}
        {reviewItem && !isProcessing && (
          <View className="absolute inset-0 items-center justify-center bg-background/98 z-30 px-8">
            <View
              style={{
                backgroundColor: "rgba(255, 255, 255, 0.95)",
                borderRadius: 24,
                borderWidth: 1,
                borderColor: "rgba(0, 0, 0, 0.06)",
                shadowColor: "#000",
                shadowOffset: { width: 0, height: 4 },
                shadowOpacity: 0.05,
                shadowRadius: 20,
                elevation: 5,
              }}
              className="p-8 w-full max-w-sm"
            >
              {/* Content */}
              <View className="items-center mb-8">
                <Text
                  style={{ color: "rgba(0, 0, 0, 0.4)" }}
                  className="text-sm font-medium mb-4 tracking-wide"
                >
                  {reviewItem.type === "todo" ? "New Task" : "Voice Note"}
                </Text>
                <Text
                  style={{ color: "rgba(0, 0, 0, 0.7)" }}
                  className="text-base font-medium text-center leading-relaxed"
                >
                  {reviewItem.type === "todo"
                    ? (reviewItem.item as Todo).text
                    : (reviewItem.item as VoiceNote).content}
                </Text>
              </View>

              {/* Actions */}
              <View className="flex-row justify-center space-x-4">
                <Pressable
                  onPress={() => setReviewItem(null)}
                  style={{
                    backgroundColor: "rgba(0, 0, 0, 0.08)",
                    borderRadius: 20,
                  }}
                  className="flex-1 max-w-[130px] h-11 items-center justify-center flex-row"
                >
                  <Check size={18} color="rgba(0, 0, 0, 0.6)" />
                  <Text
                    style={{ color: "rgba(0, 0, 0, 0.6)" }}
                    className="font-medium ml-2"
                  >
                    Keep
                  </Text>
                </Pressable>

                <Pressable
                  onPress={async () => {
                    if (reviewItem.type === "voiceNote") {
                      await deleteVoiceNote({
                        id: (reviewItem.item as VoiceNote)._id,
                      });
                    } else {
                      await deleteTodo({ id: (reviewItem.item as Todo)._id });
                    }
                    setReviewItem(null);
                  }}
                  style={{
                    backgroundColor: "rgba(0, 0, 0, 0.06)",
                    borderRadius: 20,
                  }}
                  className="flex-1 max-w-[130px] h-11 items-center justify-center flex-row"
                >
                  <Trash2 size={18} color="rgba(0, 0, 0, 0.5)" />
                  <Text
                    style={{ color: "rgba(0, 0, 0, 0.5)" }}
                    className="font-medium ml-2"
                  >
                    Discard
                  </Text>
                </Pressable>
              </View>
            </View>
          </View>
        )}

        {/* Refined record button */}
        {!isProcessing && !reviewItem && (
          <View className="flex-1 items-center justify-center">
            <Animated.View
              style={{
                transform: [{ scale: pulseAnim }],
                opacity: isRecording ? 0.3 : 1,
              }}
            >
              <Pressable
                onPress={toggleRecording}
                disabled={isRecording}
                style={{
                  backgroundColor: isRecording
                    ? "rgba(0, 0, 0, 0.1)"
                    : "rgba(0, 0, 0, 0.08)",
                }}
                className="w-20 h-20 rounded-full items-center justify-center"
              >
                {isRecording ? (
                  <></>
                ) : (
                  <Mic size={24} color="rgba(0, 0, 0, 0.5)" />
                )}
              </Pressable>
            </Animated.View>
          </View>
        )}
      </SafeAreaView>
    </View>
  );
}
