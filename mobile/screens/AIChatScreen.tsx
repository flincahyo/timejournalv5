import React, { useState, useRef, useEffect } from 'react';
import { 
  View, Text, TextInput, TouchableOpacity, FlatList, 
  Platform, StyleSheet, Animated, ScrollView,
  ActivityIndicator, Dimensions, Keyboard
} from 'react-native';
import { useColorScheme } from 'nativewind';
import { X, Send, Sparkles, Brain, BarChart2, RefreshCw, Zap } from 'lucide-react-native';
import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { API_URL } from '../Constants';
import { AILoadingAnimation } from '../components/AILoadingAnimation';

interface Message {
  id: string;
  role: 'user' | 'ai' | 'analyst';
  content: string;
  timestamp: Date;
  isLoading?: boolean;
}

interface AIChatScreenProps {
  visible: boolean;
  onClose: () => void;
  trades?: any[];
  stats?: {
    totalPnl: number;
    winRate: number;
    profitFactor: number;
    growth: string;
    todayPnl: number;
    todayTrades: number;
  };
}

const QUICK_ACTIONS = [
  { id: 'analyst', label: '📊 Analisa Performa', icon: BarChart2, prompt: '__AI_ANALYST__' },
  { id: 'risk', label: '⚖️ Risk Management', icon: Zap, prompt: 'Berikan saran risk management untuk trading saya berdasarkan data performa saat ini.' },
  { id: 'psychology', label: '🧠 Psikologi Trading', icon: Brain, prompt: 'Bagaimana kondisi psikologi trading saya? Apakah ada pola yang perlu diperbaiki?' },
];

export const AIChatScreen: React.FC<AIChatScreenProps> = ({ visible, onClose, trades = [], stats }) => {
  const { colorScheme } = useColorScheme();
  const isDark = colorScheme === 'dark';
  
  const [messages, setMessages] = useState<Message[]>([
    {
      id: 'welcome',
      role: 'ai',
      content: 'Halo! Saya **AI Trading Coach** Anda 👋\n\nSaya bisa bantu analisa performa, evaluasi psikologi trading, atau menjawab pertanyaan seputar strategi Anda.',
      timestamp: new Date()
    }
  ]);
  const [inputText, setInputText] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [showQuickActions, setShowQuickActions] = useState(true);
  // Keeps the full conversation for multi-turn context
  const conversationHistory = useRef<{ role: string; content: string }[]>([]);
  const flatListRef = useRef<FlatList>(null);
  const { height: SCREEN_HEIGHT } = Dimensions.get('window');
  const slideAnim = useRef(new Animated.Value(SCREEN_HEIGHT)).current;
  const kbAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.spring(slideAnim, {
      toValue: visible ? 0 : SCREEN_HEIGHT,
      damping: 24,
      stiffness: 220,
      useNativeDriver: true
    }).start();
    if (!visible) {
      // reset on close
      setShowQuickActions(true);
    }
  }, [visible]);

  useEffect(() => {
    const showEvent = Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow';
    const hideEvent = Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide';
    const showDuration = Platform.OS === 'ios' ? 250 : 0;
    const hideDuration = Platform.OS === 'ios' ? 200 : 0;

    const showSub = Keyboard.addListener(showEvent, (e) => {
      Animated.timing(kbAnim, { toValue: e.endCoordinates.height, duration: showDuration, useNativeDriver: false }).start();
    });
    const hideSub = Keyboard.addListener(hideEvent, () => {
      Animated.timing(kbAnim, { toValue: 0, duration: hideDuration, useNativeDriver: false }).start();
    });
    return () => { showSub.remove(); hideSub.remove(); };
  }, []);

  const callAIChat = async (userContent: string, displayContent?: string): Promise<string> => {
    const token = await AsyncStorage.getItem('userToken');
    // Add to conversation history
    conversationHistory.current.push({ role: 'user', content: userContent });
    const res = await fetch(`${API_URL}/ai/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ messages: conversationHistory.current, context_type: 'general' })
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    const reply = data.success ? data.reply : '⚠️ AI tidak tersedia saat ini.';
    // Add AI response to history for multi-turn
    conversationHistory.current.push({ role: 'assistant', content: reply });
    return reply;
  };

  const runAIAnalyst = async () => {
    setShowQuickActions(false);
    const userMsg: Message = {
      id: Date.now().toString(),
      role: 'user',
      content: '📊 Analisa performa trading saya',
      timestamp: new Date()
    };
    const loadingMsg: Message = {
      id: (Date.now() + 1).toString(),
      role: 'analyst',
      content: '',
      timestamp: new Date(),
      isLoading: true
    };
    setMessages(prev => [...prev, userMsg, loadingMsg]);
    setIsTyping(true);
    setTimeout(() => flatListRef.current?.scrollToEnd({ animated: true }), 100);

    try {
      // Use the chat API so AI has full trade context from DB
      const insight = await callAIChat(
        'Lakukan analisa mendalam terhadap performa trading saya. Berikan Kesimpulan (Performance Verdict), Kekuatan & Kelemahan, Saran Actionable, dan satu Quote Psikologi Trading. Format dengan markdown rapi.',
        '📊 Analisa performa trading saya'
      );
      setMessages(prev => prev.map(m => m.isLoading
        ? { ...m, content: insight, isLoading: false }
        : m
      ));
    } catch {
      setMessages(prev => prev.map(m => m.isLoading
        ? { ...m, content: '⚠️ Koneksi gagal. Pastikan backend aktif dan coba lagi.', isLoading: false }
        : m
      ));
    } finally {
      setIsTyping(false);
      setTimeout(() => flatListRef.current?.scrollToEnd({ animated: true }), 100);
    }
  };

  const handleSend = async (text?: string) => {
    const content = (text ?? inputText).trim();
    if (!content) return;
    Haptics.selectionAsync();
    setShowQuickActions(false);

    if (content === '__AI_ANALYST__') { runAIAnalyst(); return; }

    const userMsg: Message = { id: Date.now().toString(), role: 'user', content, timestamp: new Date() };
    setMessages(prev => [...prev, userMsg]);
    setInputText('');
    setIsTyping(true);
    setTimeout(() => flatListRef.current?.scrollToEnd({ animated: true }), 100);

    try {
      const reply = await callAIChat(content);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setMessages(prev => [...prev, {
        id: (Date.now() + 1).toString(),
        role: 'ai',
        content: reply,
        timestamp: new Date()
      }]);
    } catch {
      setMessages(prev => [...prev, {
        id: (Date.now() + 1).toString(),
        role: 'ai',
        content: '⚠️ Koneksi gagal. Pastikan backend aktif dan coba lagi.',
        timestamp: new Date()
      }]);
    } finally {
      setIsTyping(false);
      setTimeout(() => flatListRef.current?.scrollToEnd({ animated: true }), 100);
    }
  };

  const renderMarkdown = (text: string, textColor: string) => {
    return text.split('\n').map((line, idx) => {
      const isBold = line.startsWith('**') || (line.includes('**') && line.trim().endsWith('**'));
      const isHeader = line.startsWith('###') || line.startsWith('##') || line.startsWith('#');
      const isBullet = line.startsWith('- ') || line.startsWith('• ');
      let clean = line.replace(/\*\*/g, '').replace(/^#{1,3}\s/, '').replace(/^- /, '• ');
      if (!clean.trim()) return <View key={idx} style={{ height: 6 }} />;
      return (
        <Text key={idx} style={{
          fontSize: isHeader ? 14 : 13,
          fontWeight: (isBold || isHeader) ? '800' : '500',
          color: textColor,
          lineHeight: 21,
          marginBottom: (isBold || isHeader) ? 4 : 2,
          marginTop: isHeader ? 8 : 0,
        }}>{clean}</Text>
      );
    });
  };

  const renderMessage = ({ item }: { item: Message }) => {
    const isUser = item.role === 'user';
    const isAnalyst = item.role === 'analyst';

    if (isAnalyst) {
      return (
        <View style={{ marginBottom: 16 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 10 }}>
            <LinearGradient colors={['#6366f1', '#8b5cf6']} style={{ width: 24, height: 24, borderRadius: 8, alignItems: 'center', justifyContent: 'center' }}>
              <BarChart2 size={12} color="#fff" />
            </LinearGradient>
            <Text style={{ fontSize: 11, fontWeight: '800', color: isDark ? '#818cf8' : '#6366f1', letterSpacing: 0.5 }}>AI ANALYST REPORT</Text>
          </View>
          {item.isLoading ? (
            <AILoadingAnimation isDark={isDark} message="Dissecting Performance..." subMessage="Evaluating win rate, drawdown, and psychological streaks." />
          ) : (
            <View style={{
              backgroundColor: isDark ? '#13161f' : '#ffffff',
              borderRadius: 20, padding: 18,
              borderLeftWidth: 3, borderLeftColor: '#6366f1',
              borderWidth: 1, borderColor: isDark ? '#1e293b' : '#e8edf5',
            }}>
              {renderMarkdown(item.content, isDark ? '#cbd5e1' : '#475569')}
            </View>
          )}
        </View>
      );
    }

    return (
      <View style={[styles.messageWrapper, isUser ? styles.messageWrapperUser : styles.messageWrapperAI]}>
        {!isUser && (
          <View style={[styles.avatarAI, { backgroundColor: isDark ? '#312e81' : '#e0e7ff' }]}>
            <Sparkles size={13} color={isDark ? '#818cf8' : '#4f46e5'} />
          </View>
        )}
        <View style={[
          styles.messageBubble,
          isUser
            ? [styles.bubbleUser, { backgroundColor: isDark ? '#4f46e5' : '#6366f1' }]
            : [styles.bubbleAI, { backgroundColor: isDark ? '#1e293b' : '#f1f5f9' }]
        ]}>
          {isUser
            ? <Text style={[styles.messageText, { color: '#ffffff' }]}>{item.content}</Text>
            : renderMarkdown(item.content, isDark ? '#f8fafc' : '#334155')
          }
          <Text style={[styles.timeText, { color: isUser ? 'rgba(255,255,255,0.6)' : (isDark ? '#64748b' : '#94a3b8') }]}>
            {item.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
          </Text>
        </View>
      </View>
    );
  };

  const bg = isDark ? '#0b0e11' : '#f5f7fa';
  const headerBg = isDark ? '#13161f' : '#ffffff';
  const borderColor = isDark ? '#1e293b' : '#e8edf5';

  return (
    <Animated.View
      style={{ position: 'absolute', inset: 0, zIndex: 100, backgroundColor: bg, transform: [{ translateY: slideAnim }] }}
      pointerEvents={visible ? 'auto' : 'none'}
    >
      {/* Header */}
      <View style={[styles.header, { backgroundColor: headerBg, borderBottomColor: borderColor }]}>
        <View style={styles.headerLeft}>
          <LinearGradient colors={['#818cf8', '#4f46e5']} style={styles.headerIcon}>
            <Brain size={18} color="#fff" />
          </LinearGradient>
          <View>
            <Text style={[styles.headerTitle, { color: isDark ? '#f8fafc' : '#0f172a' }]}>AI Trading Coach</Text>
            <Text style={styles.headerSubtitle}>Powered by Gemini</Text>
          </View>
        </View>
        <TouchableOpacity onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); onClose(); }} style={styles.closeBtn}>
          <X size={22} color={isDark ? '#94a3b8' : '#64748b'} />
        </TouchableOpacity>
      </View>

      {/* Chat + Input lift together when keyboard appears */}
      <Animated.View style={{ flex: 1, paddingBottom: kbAnim }}>
        <FlatList
          ref={flatListRef}
          data={messages}
          renderItem={renderMessage}
          keyExtractor={item => item.id}
          contentContainerStyle={styles.chatContainer}
          onContentSizeChange={() => flatListRef.current?.scrollToEnd({ animated: true })}
          keyboardShouldPersistTaps="handled"
          ListFooterComponent={
            showQuickActions ? (
              <View style={{ marginTop: 8, gap: 8 }}>
                <Text style={{ fontSize: 11, fontWeight: '700', color: isDark ? '#475569' : '#94a3b8', letterSpacing: 0.5, marginBottom: 4 }}>QUICK ACTIONS</Text>
                {QUICK_ACTIONS.map(action => (
                  <TouchableOpacity
                    key={action.id}
                    onPress={() => { Haptics.selectionAsync(); handleSend(action.prompt); }}
                    activeOpacity={0.75}
                    style={{
                      flexDirection: 'row', alignItems: 'center', gap: 10,
                      backgroundColor: isDark ? '#13161f' : '#ffffff',
                      paddingHorizontal: 16, paddingVertical: 13,
                      borderRadius: 16, borderWidth: 1,
                      borderColor: isDark ? '#1e293b' : '#e8edf5',
                    }}
                  >
                    <action.icon size={16} color={isDark ? '#818cf8' : '#6366f1'} />
                    <Text style={{ fontSize: 14, fontWeight: '600', color: isDark ? '#e2e8f0' : '#1e293b', flex: 1 }}>{action.label}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            ) : null
          }
        />

        {/* Typing indicator */}
        {isTyping && (
          <View style={styles.typingContainer}>
            <ActivityIndicator size="small" color="#6366f1" />
            <Text style={[styles.typingText, { color: isDark ? '#94a3b8' : '#64748b' }]}>AI is thinking...</Text>
          </View>
        )}

        {/* Input */}
        <View style={[styles.inputContainer, { backgroundColor: isDark ? '#13161f' : '#ffffff', borderTopColor: borderColor }]}>
          <TextInput
            style={[styles.input, {
              color: isDark ? '#f8fafc' : '#0f172a',
              backgroundColor: isDark ? '#0f172a' : '#f8fafc',
              borderColor: isDark ? '#334155' : '#e2e8f0'
            }]}
            placeholder="Tanyakan apa saja..."
            placeholderTextColor={isDark ? '#64748b' : '#94a3b8'}
            value={inputText}
            onChangeText={setInputText}
            multiline
            maxLength={500}
            onSubmitEditing={() => handleSend()}
          />
          <TouchableOpacity
            style={[styles.sendButton, { opacity: inputText.trim() ? 1 : 0.4 }]}
            onPress={() => handleSend()}
            disabled={!inputText.trim() || isTyping}
          >
            <LinearGradient colors={['#6366f1', '#4f46e5']} style={styles.sendButtonGradient}>
              <Send size={18} color="#ffffff" />
            </LinearGradient>
          </TouchableOpacity>
        </View>
      </Animated.View>
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 14,
    borderBottomWidth: 1,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  headerIcon: {
    width: 36,
    height: 36,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    fontSize: 17,
    fontWeight: '800',
    letterSpacing: -0.4,
  },
  headerSubtitle: {
    fontSize: 11,
    fontWeight: '600',
    color: '#818cf8',
  },
  closeBtn: { padding: 8 },
  chatContainer: {
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 8,
  },
  messageWrapper: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    marginBottom: 14,
    maxWidth: '85%',
  },
  messageWrapperUser: { alignSelf: 'flex-end', justifyContent: 'flex-end' },
  messageWrapperAI: { alignSelf: 'flex-start', gap: 8 },
  avatarAI: {
    width: 26,
    height: 26,
    borderRadius: 13,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
  },
  messageBubble: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 18,
  },
  bubbleUser: { borderBottomRightRadius: 4 },
  bubbleAI: { borderBottomLeftRadius: 4 },
  messageText: {
    fontSize: 15,
    lineHeight: 22,
  },
  timeText: {
    fontSize: 10,
    marginTop: 5,
    alignSelf: 'flex-end',
    fontWeight: '500',
  },
  typingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingBottom: 8,
    gap: 8,
  },
  typingText: {
    fontSize: 12,
    fontWeight: '500',
    fontStyle: 'italic',
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    paddingHorizontal: 14,
    paddingVertical: 10,
    paddingBottom: Platform.OS === 'ios' ? 28 : 14,
    borderTopWidth: 1,
    gap: 10,
  },
  input: {
    flex: 1,
    minHeight: 42,
    maxHeight: 120,
    borderWidth: 1,
    borderRadius: 21,
    paddingHorizontal: 16,
    paddingTop: 11,
    paddingBottom: 11,
    fontSize: 15,
  },
  sendButton: {
    width: 42,
    height: 42,
    borderRadius: 21,
    overflow: 'hidden',
  },
  sendButtonGradient: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
