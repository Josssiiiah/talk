// Chat screen for recording voice notes and showing latest categorized result

import { Text } from "@/components/ui/text";
import { useAction, useMutation, useQuery } from "convex/react";
import { AudioModule, RecordingOptions, useAudioRecorder } from "expo-audio";
import * as FileSystem from "expo-file-system";
import * as Haptics from "expo-haptics";
import { Check, Loader2, Mic, Trash2 } from "lucide-react-native";
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
              useNativeDriver: false,
            }),
            Animated.timing(textGlow, {
              toValue: 0,
              duration: 2000,
              easing: Easing.inOut(Easing.ease),
              useNativeDriver: false,
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
          <View className="absolute inset-0 items-center justify-center bg-background/90 z-20">
            {/* Large tap area - covers most of the screen center */}
            <Pressable
              onPress={handleCenterTap}
              onPressIn={handlePressIn}
              onPressOut={handlePressOut}
              className="absolute w-80 h-80 items-center justify-center"
              style={{
                borderRadius: 160,
                backgroundColor: isPressed
                  ? "rgba(239, 68, 68, 0.1)"
                  : "transparent",
              }}
            >
              {/* Visual tap indicator ring */}
              <Animated.View
                style={{
                  opacity: recordingPulse.interpolate({
                    inputRange: [1, 1.6],
                    outputRange: [0.3, 0.6],
                  }),
                  transform: [
                    {
                      scale: recordingPulse.interpolate({
                        inputRange: [1, 1.6],
                        outputRange: [1, 1.1],
                      }),
                    },
                  ],
                }}
                className="absolute w-72 h-72 rounded-full border-2 border-red-300/40 border-dashed"
              />

              {/* Secondary tap indicator */}
              <Animated.View
                style={{
                  opacity: energyPulse.interpolate({
                    inputRange: [0, 1],
                    outputRange: [0.2, 0.5],
                  }),
                }}
                className="absolute w-60 h-60 rounded-full border border-orange-300/30"
              />

              {/* Recording ring with scale animation */}
              <Animated.View
                style={{
                  transform: [
                    {
                      scale: isPressed
                        ? recordingRingScale.interpolate({
                            inputRange: [0, 1],
                            outputRange: [0, 0.95], // Slightly smaller when pressed
                          })
                        : recordingRingScale,
                    },
                    {
                      rotate: outerRingRotation.interpolate({
                        inputRange: [0, 1],
                        outputRange: ["0deg", "360deg"],
                      }),
                    },
                  ],
                }}
                className="absolute w-64 h-64 rounded-full border-2 border-red-500/40"
              >
                {/* Recording dots */}
                {Array.from({ length: 8 }).map((_, i) => (
                  <Animated.View
                    key={i}
                    style={{
                      opacity: energyPulse.interpolate({
                        inputRange: [0, 1],
                        outputRange: [0.3, 1],
                      }),
                    }}
                  >
                    <View
                      className="absolute w-3 h-3 bg-red-400 rounded-full shadow-lg"
                      style={{
                        top: -6,
                        left: "50%",
                        marginLeft: -6,
                        transform: [{ rotate: `${i * 45}deg` }],
                        transformOrigin: "6px 132px",
                      }}
                    />
                  </Animated.View>
                ))}
              </Animated.View>

              {/* Central recording core */}
              <Animated.View
                style={{
                  transform: [
                    {
                      scale: isPressed
                        ? recordingPulse.interpolate({
                            inputRange: [1, 1.6],
                            outputRange: [0.9, 1.4], // More dramatic scale when pressed
                          })
                        : recordingPulse,
                    },
                  ],
                }}
                className="w-16 h-16 rounded-full bg-gradient-to-br from-red-600 via-orange-500 to-yellow-500 items-center justify-center shadow-2xl"
              >
                <View className="w-12 h-12 rounded-full bg-gradient-to-br from-white/30 to-transparent items-center justify-center">
                  <View className="w-4 h-4 bg-white rounded-sm" />
                </View>
              </Animated.View>
            </Pressable>

            {/* Waveform visualization - outside the pressable */}
            <View className="absolute w-80 h-20 items-center justify-center top-1/3">
              <View className="flex-row items-end space-x-1">
                {Array.from({ length: 12 }).map((_, i) => (
                  <Animated.View
                    key={i}
                    style={{
                      height: 20 + Math.random() * 40,
                      animationDelay: `${i * 50}ms`,
                      transform: [
                        {
                          scaleY: waveformScale.interpolate({
                            inputRange: [0, 1],
                            outputRange: [0.2, Math.random() * 2 + 0.5],
                          }),
                        },
                      ],
                    }}
                    className="w-2 bg-gradient-to-t from-red-500 to-orange-400 rounded-full"
                  />
                ))}
              </View>
            </View>

            {/* Energy rings - outside pressable for visual effect */}
            <Animated.View
              style={{
                opacity: energyPulse,
                transform: [
                  {
                    scale: energyPulse.interpolate({
                      inputRange: [0, 1],
                      outputRange: [0.8, 1.4],
                    }),
                  },
                ],
              }}
              className="absolute w-32 h-32 rounded-full border border-orange-400/50 pointer-events-none"
            />
            <Animated.View
              style={{
                opacity: energyPulse.interpolate({
                  inputRange: [0, 1],
                  outputRange: [0, 0.7],
                }),
                transform: [
                  {
                    scale: energyPulse.interpolate({
                      inputRange: [0, 1],
                      outputRange: [1, 1.8],
                    }),
                  },
                ],
              }}
              className="absolute w-48 h-48 rounded-full border border-red-400/30 pointer-events-none"
            />

            {/* Recording text */}
            <View className="absolute bottom-1/3 items-center pointer-events-none">
              <Animated.View
                style={{
                  opacity: recordingPulse.interpolate({
                    inputRange: [1, 1.6],
                    outputRange: [0.7, 1],
                  }),
                }}
              >
                <Text className="text-xl font-bold text-red-400 mb-2 tracking-wider">
                  RECORDING
                </Text>
                <View className="flex-row space-x-1 justify-center">
                  {Array.from({ length: 3 }).map((_, i) => (
                    <Animated.View
                      key={i}
                      style={{
                        opacity: pulseAnim.interpolate({
                          inputRange: [1, 1.3],
                          outputRange: [0.3, 1],
                        }),
                        transform: [
                          {
                            scale: pulseAnim.interpolate({
                              inputRange: [1, 1.3],
                              outputRange: [0.8, 1.2],
                            }),
                          },
                        ],
                      }}
                    >
                      <View
                        className="w-2 h-2 bg-orange-400 rounded-full"
                        style={{ animationDelay: `${i * 200}ms` }}
                      />
                    </Animated.View>
                  ))}
                </View>
                <Text className="text-lg text-orange-300 mt-3 font-mono tracking-widest text-center">
                  TAP ANYWHERE TO STOP
                </Text>
                <Text className="text-sm text-orange-200/70 mt-1 font-mono text-center">
                  Large tap area active
                </Text>
              </Animated.View>
            </View>
          </View>
        )}

        {/* 🚀 Futuristic processing overlay */}
        {isProcessing && (
          <View className="absolute inset-0 items-center justify-center bg-background/95 z-20">
            {/* Background hologram grid */}
            <Animated.View
              style={{ opacity: hologramOpacity }}
              className="absolute inset-0"
            >
              <View className="absolute inset-0 opacity-20">
                {/* Horizontal lines */}
                {Array.from({ length: 20 }).map((_, i) => (
                  <View
                    key={`h-${i}`}
                    className="absolute h-px bg-cyan-400"
                    style={{
                      width: "100%",
                      top: i * 40,
                    }}
                  />
                ))}
                {/* Vertical lines */}
                {Array.from({ length: 10 }).map((_, i) => (
                  <View
                    key={`v-${i}`}
                    className="absolute w-px bg-cyan-400"
                    style={{
                      height: "100%",
                      left: i * 40,
                    }}
                  />
                ))}
              </View>
            </Animated.View>

            {/* Outer ring */}
            <Animated.View
              style={{
                transform: [
                  {
                    rotate: outerRingRotation.interpolate({
                      inputRange: [0, 1],
                      outputRange: ["0deg", "360deg"],
                    }),
                  },
                ],
                borderColor: "rgba(168, 85, 247, 0.3)", // purple
              }}
              className="absolute w-80 h-80 rounded-full border-2"
            >
              {/* Outer ring dots */}
              {Array.from({ length: 12 }).map((_, i) => (
                <Animated.View
                  key={i}
                  style={{
                    backgroundColor: "rgb(196, 181, 253)", // purple
                    top: -4,
                    left: "50%",
                    marginLeft: -4,
                    transform: [{ rotate: `${i * 30}deg` }],
                    transformOrigin: "4px 160px",
                  }}
                  className="absolute w-2 h-2 rounded-full"
                />
              ))}
            </Animated.View>

            {/* Middle ring */}
            <Animated.View
              style={{
                transform: [
                  {
                    rotate: middleRingRotation.interpolate({
                      inputRange: [0, 1],
                      outputRange: ["360deg", "0deg"], // Counter-clockwise
                    }),
                  },
                ],
                borderColor: "rgba(34, 211, 238, 0.5)", // cyan
              }}
              className="absolute w-60 h-60 rounded-full border-2"
            >
              {/* Middle ring segments */}
              {Array.from({ length: 8 }).map((_, i) => (
                <Animated.View
                  key={i}
                  style={{
                    backgroundColor: "rgb(34, 211, 238)", // cyan
                    top: -16,
                    left: "50%",
                    marginLeft: -2,
                    transform: [{ rotate: `${i * 45}deg` }],
                    transformOrigin: "2px 136px",
                  }}
                  className="absolute w-1 h-8"
                />
              ))}
            </Animated.View>

            {/* Inner ring */}
            <Animated.View
              style={{
                transform: [
                  {
                    rotate: innerRingRotation.interpolate({
                      inputRange: [0, 1],
                      outputRange: ["0deg", "360deg"],
                    }),
                  },
                ],
                borderColor: "rgba(236, 72, 153, 0.6)", // pink
              }}
              className="absolute w-40 h-40 rounded-full border-4"
            />

            {/* Floating particles */}
            <Animated.View style={{ opacity: particleOpacity }}>
              {particleAnims.map((particle, index) => (
                <Animated.View
                  key={index}
                  style={{
                    position: "absolute",
                    transform: [
                      {
                        rotate: particle.rotation.interpolate({
                          inputRange: [0, 1],
                          outputRange: ["0deg", "360deg"],
                        }),
                      },
                      { scale: particle.scale },
                    ],
                    opacity: particle.opacity,
                  }}
                >
                  <Animated.View
                    style={{
                      width: 12,
                      height: 12,
                      borderRadius: 6,
                      backgroundColor: "rgb(251, 191, 36)", // yellow-orange
                      transform: [
                        {
                          translateX:
                            Math.cos((index * 45 * Math.PI) / 180) * 100,
                        },
                        {
                          translateY:
                            Math.sin((index * 45 * Math.PI) / 180) * 100,
                        },
                      ],
                      shadowColor: "rgb(251, 191, 36)",
                      shadowOpacity: 0.8,
                      shadowRadius: 4,
                    }}
                  />
                </Animated.View>
              ))}
            </Animated.View>

            {/* Central core */}
            <Animated.View
              style={{
                transform: [{ scale: coreScale }],
                backgroundColor: "rgb(147, 51, 234)", // purple
              }}
              className="w-20 h-20 rounded-full items-center justify-center shadow-2xl"
            >
              <View className="w-16 h-16 rounded-full bg-gradient-to-br from-white/20 to-transparent items-center justify-center">
                <Loader2 size={32} color="#fff" className="animate-spin" />
              </View>
            </Animated.View>

            {/* Glowing text */}
            <Animated.View
              style={{
                shadowColor: "rgb(34, 211, 238)", // cyan
                shadowOpacity: textGlow.interpolate({
                  inputRange: [0, 1],
                  outputRange: [0.5, 1],
                }),
                shadowRadius: textGlow.interpolate({
                  inputRange: [0, 1],
                  outputRange: [10, 20],
                }),
              }}
              className="absolute top-2/3 items-center"
            >
              <Animated.Text
                style={{
                  color: "rgb(255, 255, 255)", // white
                }}
                className="text-2xl font-bold mb-2 tracking-wider"
              >
                TRANSCRIBING
              </Animated.Text>
              <View className="flex-row space-x-1">
                {Array.from({ length: 3 }).map((_, i) => (
                  <Animated.View
                    key={i}
                    style={{
                      opacity: pulseAnim.interpolate({
                        inputRange: [1, 1.3],
                        outputRange: [0.3, 1],
                      }),
                      transform: [
                        {
                          scale: pulseAnim.interpolate({
                            inputRange: [1, 1.3],
                            outputRange: [0.8, 1.2],
                          }),
                        },
                      ],
                      backgroundColor: "rgb(34, 211, 238)", // cyan
                    }}
                    className="w-2 h-2 rounded-full"
                  />
                ))}
              </View>
              <Animated.Text
                style={{
                  color: "rgb(103, 232, 249)", // light cyan
                }}
                className="text-sm mt-2 font-mono tracking-widest"
              >
                NEURAL PROCESSING
              </Animated.Text>
            </Animated.View>
          </View>
        )}

        {/* Review sheet */}
        {reviewItem && !isProcessing && (
          <View className="absolute pb-12 left-0 right-0 p-6 bg-card rounded-t-3xl shadow-2xl z-10">
            <Text className="text-sm uppercase font-semibold text-muted-foreground mb-2">
              {reviewItem.type === "todo" ? "To-Do" : "Voice Note"}
            </Text>
            <Text className="text-base text-foreground mb-6">
              {reviewItem.type === "todo"
                ? (reviewItem.item as Todo).text
                : (reviewItem.item as VoiceNote).content}
            </Text>
            <View className="flex-row justify-between">
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
                className="flex-1 mr-2 h-12 rounded-full bg-destructive items-center justify-center flex-row"
              >
                <Trash2 size={20} color="#fff" />
                <Text className="text-white font-medium ml-2">Discard</Text>
              </Pressable>
              <Pressable
                onPress={() => setReviewItem(null)}
                className="flex-1 ml-2 h-12 rounded-full bg-primary items-center justify-center flex-row"
              >
                <Check size={20} color="#fff" />
                <Text className="text-white font-medium ml-2">Keep</Text>
              </Pressable>
            </View>
          </View>
        )}

        {/* Record button */}
        <Animated.View
          style={{
            transform: [{ scale: pulseAnim }],
            opacity: isProcessing ? 0.3 : 1,
          }}
        >
          <Pressable
            onPress={toggleRecording}
            disabled={isProcessing}
            className={`w-24 h-24 rounded-full items-center justify-center shadow-2xl ${
              isRecording ? "bg-destructive" : "bg-primary"
            }`}
          >
            {isRecording ? (
              <View className="w-6 h-6 bg-white rounded-sm" />
            ) : (
              <Mic size={40} color="white" />
            )}
          </Pressable>
        </Animated.View>
      </SafeAreaView>
    </View>
  );
}
