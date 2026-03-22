import React, { useState, useRef, useEffect } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, FlatList,
  Platform, StyleSheet, Animated, ScrollView,
  ActivityIndicator, Dimensions, Keyboard
} from 'react-native';
import { useColorScheme } from 'nativewind';
import { X, Send, Sparkles, Brain, BarChart2, TrendingUp, Shield, BookOpen, Flame, Star, ChevronRight } from 'lucide-react-native';
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
    totalPnl: number; winRate: number; profitFactor: number;
    growth: string; todayPnl: number; todayTrades: number;
  };
  guardStatus?: 'normal' | 'loss_limit' | 'profit_goal';
  dailyPnL?: number;
  guardSettings?: { lossLimit: number; profitGoal: number; enabled: boolean };
}

const QUICK_ACTIONS = [
  { id: 'analyst',    label: 'Analisa',       icon: BarChart2,  prompt: '__AI_ANALYST__' },
  { id: 'equity',     label: 'Proyeksi',      icon: TrendingUp, prompt: '__EQUITY_PROJECTION__' },
  { id: 'risk',       label: 'Risk Mgmt',     icon: Shield,     prompt: 'Evaluasi risk management saya berdasarkan data performa saat ini. Sertakan angka konkret dari data trade saya.' },
  { id: 'psychology', label: 'Psikologi',     icon: Brain,      prompt: 'Analisa kondisi psikologi trading saya berdasarkan pola trade yang ada. Apakah ada pola emosi atau perilaku yang perlu diperbaiki?' },
  { id: 'journal',    label: 'Evaluasi Hari', icon: BookOpen,   prompt: 'Evaluasi performa trading saya hari ini. Apa yang berjalan baik dan apa yang perlu diperbaiki?' },
];

export const AIChatScreen: React.FC<AIChatScreenProps> = ({
  visible, onClose, trades = [], stats, guardStatus = 'normal', dailyPnL = 0, guardSettings
}) => {
  const { colorScheme } = useColorScheme();
  const isDark = colorScheme === 'dark';

  const [messages, setMessages] = useState<Message[]>([{
    id: 'welcome', role: 'ai',
    content: 'Halo! Saya **AI Trading Coach** Anda 👋\n\nSaya bisa bantu analisa performa, evaluasi psikologi trading, atau menjawab pertanyaan seputar strategi Anda.',
    timestamp: new Date()
  }]);
  const [inputText, setInputText] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [showQuickActions, setShowQuickActions] = useState(true);
  const conversationHistory = useRef<{ role: string; content: string }[]>([]);
  const flatListRef = useRef<FlatList>(null);
  const { height: SCREEN_HEIGHT } = Dimensions.get('window');
  const slideAnim = useRef(new Animated.Value(SCREEN_HEIGHT)).current;
  const kbAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.spring(slideAnim, { toValue: visible ? 0 : SCREEN_HEIGHT, damping: 24, stiffness: 220, useNativeDriver: true }).start();
    if (!visible) setShowQuickActions(true);
  }, [visible]);

  useEffect(() => {
    const showE = Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow';
    const hideE = Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide';
    const dur = Platform.OS === 'ios' ? 250 : 0;
    const s1 = Keyboard.addListener(showE, e => Animated.timing(kbAnim, { toValue: e.endCoordinates.height, duration: dur, useNativeDriver: false }).start());
    const s2 = Keyboard.addListener(hideE, () => Animated.timing(kbAnim, { toValue: 0, duration: dur, useNativeDriver: false }).start());
    return () => { s1.remove(); s2.remove(); };
  }, []);

  const callAIChat = async (userContent: string): Promise<string> => {
    const token = await AsyncStorage.getItem('userToken');
    // Read Trading Guard from AsyncStorage so it's always fresh
    let guardCtx: any = null;
    try {
      const stored = await AsyncStorage.getItem('trading_guard_settings');
      if (stored) {
        const g = JSON.parse(stored);
        guardCtx = {
          enabled: g.enabled,
          lossLimit: g.lossLimit,
          profitGoal: g.profitGoal,
          dailyPnL,
          status: guardStatus
        };
      }
    } catch { }

    conversationHistory.current.push({ role: 'user', content: userContent });
    const res = await fetch(`${API_URL}/ai/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({
        messages: conversationHistory.current,
        context_type: 'general',
        guard_context: guardCtx
      })
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    const reply = data.success ? data.reply : '⚠️ AI tidak tersedia saat ini.';
    conversationHistory.current.push({ role: 'assistant', content: reply });
    return reply;
  };

  const runAIAnalyst = async () => {
    setShowQuickActions(false);
    const userMsg: Message = { id: Date.now().toString(), role: 'user', content: 'Analisa performa trading saya', timestamp: new Date() };
    const loadingMsg: Message = { id: (Date.now() + 1).toString(), role: 'analyst', content: '', timestamp: new Date(), isLoading: true };
    setMessages(prev => [...prev, userMsg, loadingMsg]);
    setIsTyping(true);
    setTimeout(() => flatListRef.current?.scrollToEnd({ animated: true }), 100);
    try {
      const insight = await callAIChat('Lakukan analisa mendalam terhadap performa trading saya. Berikan Kesimpulan (Performance Verdict), Kekuatan & Kelemahan, Saran Actionable, dan satu Quote Psikologi Trading. Format markdown rapi.');
      setMessages(prev => prev.map(m => m.isLoading ? { ...m, content: insight, isLoading: false } : m));
    } catch {
      setMessages(prev => prev.map(m => m.isLoading ? { ...m, content: '⚠️ Koneksi gagal. Pastikan backend aktif.', isLoading: false } : m));
    } finally {
      setIsTyping(false);
      setTimeout(() => flatListRef.current?.scrollToEnd({ animated: true }), 100);
    }
  };

  const runEquityProjection = async () => {
    setShowQuickActions(false);
    const userMsg: Message = { id: Date.now().toString(), role: 'user', content: 'Proyeksi ekuitas trading saya', timestamp: new Date() };
    const loadingMsg: Message = { id: (Date.now() + 1).toString(), role: 'analyst', content: '', timestamp: new Date(), isLoading: true };
    setMessages(prev => [...prev, userMsg, loadingMsg]);
    setIsTyping(true);
    setTimeout(() => flatListRef.current?.scrollToEnd({ animated: true }), 100);
    try {
      const token = await AsyncStorage.getItem('userToken');
      const res = await fetch(`${API_URL}/ai/equity-projection`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ months: 6 })
      });
      const data = await res.json();
      const projection = data.success ? data.projection : (data.message || '⚠️ Tidak dapat membuat proyeksi.');
      setMessages(prev => prev.map(m => m.isLoading ? { ...m, content: projection, isLoading: false } : m));
    } catch {
      setMessages(prev => prev.map(m => m.isLoading ? { ...m, content: '⚠️ Koneksi gagal.', isLoading: false } : m));
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
    if (content === '__EQUITY_PROJECTION__') { runEquityProjection(); return; }

    const userMsg: Message = { id: Date.now().toString(), role: 'user', content, timestamp: new Date() };
    setMessages(prev => [...prev, userMsg]);
    setInputText('');
    setIsTyping(true);
    setTimeout(() => flatListRef.current?.scrollToEnd({ animated: true }), 100);
    try {
      const reply = await callAIChat(content);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setMessages(prev => [...prev, { id: (Date.now() + 1).toString(), role: 'ai', content: reply, timestamp: new Date() }]);
    } catch {
      setMessages(prev => [...prev, { id: (Date.now() + 1).toString(), role: 'ai', content: '⚠️ Koneksi gagal. Pastikan backend aktif dan coba lagi.', timestamp: new Date() }]);
    } finally {
      setIsTyping(false);
      setTimeout(() => flatListRef.current?.scrollToEnd({ animated: true }), 100);
    }
  };

  const renderMarkdown = (text: string, textColor: string, boldColor: string) =>
    text.split('\n').map((line, idx) => {
      const isHeader = /^#{1,3}\s/.test(line);
      const isBold = line.startsWith('**') || (line.includes('**') && line.trim().endsWith('**'));
      let clean = line.replace(/\*\*/g, '').replace(/^#{1,3}\s/, '').replace(/^- /, '• ');
      if (!clean.trim()) return <View key={idx} style={{ height: 6 }} />;
      return (
        <Text key={idx} style={{
          fontSize: isHeader ? 14 : 13,
          fontWeight: (isBold || isHeader) ? '800' : '500',
          color: (isBold || isHeader) ? boldColor : textColor,
          lineHeight: 21, marginBottom: isHeader ? 6 : 2, marginTop: isHeader ? 8 : 0,
        }}>{clean}</Text>
      );
    });

  const renderMessage = ({ item }: { item: Message }) => {
    const isUser = item.role === 'user';
    const isAnalyst = item.role === 'analyst';
    if (isAnalyst) {
      return (
        <View style={{ marginBottom: 20 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 10 }}>
            <LinearGradient colors={['#6366f1', '#8b5cf6']} style={{ width: 22, height: 22, borderRadius: 7, alignItems: 'center', justifyContent: 'center' }}>
              <BarChart2 size={11} color="#fff" />
            </LinearGradient>
            <Text style={{ fontSize: 10, fontWeight: '800', color: '#818cf8', letterSpacing: 0.8 }}>AI ANALYST REPORT</Text>
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
              {renderMarkdown(item.content, isDark ? '#cbd5e1' : '#475569', isDark ? '#c7d2fe' : '#4f46e5')}
            </View>
          )}
        </View>
      );
    }
    return (
      <View style={[styles.messageWrapper, isUser ? styles.msgUser : styles.msgAI]}>
        {!isUser && (
          <View style={[styles.avatarAI, { backgroundColor: isDark ? '#312e81' : '#e0e7ff' }]}>
            <Sparkles size={12} color={isDark ? '#818cf8' : '#4f46e5'} />
          </View>
        )}
        <View style={[
          styles.bubble,
          isUser ? [styles.bubbleUser, { backgroundColor: isDark ? '#4f46e5' : '#6366f1' }]
                 : [styles.bubbleAI, { backgroundColor: isDark ? '#1e293b' : '#f1f5f9' }]
        ]}>
          {isUser
            ? <Text style={{ fontSize: 15, lineHeight: 22, color: '#fff' }}>{item.content}</Text>
            : renderMarkdown(item.content, isDark ? '#e2e8f0' : '#334155', isDark ? '#c7d2fe' : '#4338ca')
          }
          <Text style={{ fontSize: 10, marginTop: 4, alignSelf: 'flex-end', fontWeight: '500', color: isUser ? 'rgba(255,255,255,0.55)' : (isDark ? '#475569' : '#94a3b8') }}>
            {item.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
          </Text>
        </View>
      </View>
    );
  };

  const bg = isDark ? '#0b0e11' : '#f5f7fa';
  const headerBg = isDark ? '#0f1219' : '#ffffff';
  const borderColor = isDark ? '#1e2130' : '#e8edf5';

  // Guard status pill
  const guardPill = guardStatus !== 'normal' ? (
    <View style={{
      flexDirection: 'row', alignItems: 'center', gap: 5,
      backgroundColor: guardStatus === 'loss_limit' ? 'rgba(239,68,68,0.12)' : 'rgba(16,185,129,0.12)',
      paddingHorizontal: 10, paddingVertical: 4, borderRadius: 20,
      borderWidth: 1, borderColor: guardStatus === 'loss_limit' ? 'rgba(239,68,68,0.25)' : 'rgba(16,185,129,0.25)',
      alignSelf: 'flex-start', marginTop: 4,
    }}>
      {guardStatus === 'loss_limit'
        ? <Flame size={11} color="#ef4444" />
        : <Star size={11} color="#10b981" />
      }
      <Text style={{ fontSize: 10, fontWeight: '800', color: guardStatus === 'loss_limit' ? '#ef4444' : '#10b981', letterSpacing: 0.3 }}>
        {guardStatus === 'loss_limit' ? 'LIMIT HIT' : 'GOAL REACHED'}
      </Text>
    </View>
  ) : null;

  return (
    <Animated.View
      style={{ position: 'absolute', inset: 0, zIndex: 100, backgroundColor: bg, transform: [{ translateY: slideAnim }] }}
      pointerEvents={visible ? 'auto' : 'none'}
    >
      {/* Header */}
      <View style={[styles.header, { backgroundColor: headerBg, borderBottomColor: borderColor }]}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, flex: 1 }}>
          <LinearGradient colors={['#818cf8', '#4f46e5']} style={styles.headerIcon}>
            <Brain size={18} color="#fff" />
          </LinearGradient>
          <View style={{ flex: 1 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <Text style={{ fontSize: 17, fontWeight: '800', letterSpacing: -0.4, color: isDark ? '#f8fafc' : '#0f172a' }}>AI Trading Coach</Text>
              <View style={{ backgroundColor: isDark ? '#1e293b' : '#f1f5f9', paddingHorizontal: 7, paddingVertical: 2, borderRadius: 6 }}>
                <Text style={{ fontSize: 9, fontWeight: '800', color: '#818cf8', letterSpacing: 0.5 }}>AI</Text>
              </View>
            </View>
            {guardPill ?? <Text style={{ fontSize: 11, fontWeight: '600', color: '#818cf8' }}>Powered by AI</Text>}
          </View>
        </View>
        <TouchableOpacity onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); onClose(); }} style={{ padding: 8 }}>
          <X size={22} color={isDark ? '#94a3b8' : '#64748b'} />
        </TouchableOpacity>
      </View>

      {/* Chat + Input */}
      <Animated.View style={{ flex: 1, paddingBottom: kbAnim }}>
        <FlatList
          ref={flatListRef}
          data={messages}
          renderItem={renderMessage}
          keyExtractor={item => item.id}
          contentContainerStyle={styles.chatContainer}
          onContentSizeChange={() => flatListRef.current?.scrollToEnd({ animated: true })}
          keyboardShouldPersistTaps="handled"
          ListFooterComponent={showQuickActions ? (
            <View style={{ marginTop: 8 }}>
              <Text style={{ fontSize: 10, fontWeight: '700', color: isDark ? '#334155' : '#94a3b8', letterSpacing: 0.8, marginBottom: 10 }}>QUICK ACTIONS</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, paddingRight: 16 }}>
                {QUICK_ACTIONS.map(action => (
                  <TouchableOpacity
                    key={action.id}
                    onPress={() => { Haptics.selectionAsync(); handleSend(action.prompt); }}
                    activeOpacity={0.75}
                    style={{
                      alignItems: 'center', gap: 8,
                      backgroundColor: isDark ? '#13161f' : '#ffffff',
                      paddingHorizontal: 14, paddingVertical: 12,
                      borderRadius: 16, borderWidth: 1,
                      borderColor: isDark ? '#1e293b' : '#e8edf5',
                      minWidth: 80,
                    }}
                  >
                    <View style={{ width: 36, height: 36, borderRadius: 12, backgroundColor: isDark ? '#1e2230' : '#ede9fe', alignItems: 'center', justifyContent: 'center' }}>
                      <action.icon size={17} color={isDark ? '#818cf8' : '#6366f1'} />
                    </View>
                    <Text style={{ fontSize: 11, fontWeight: '700', color: isDark ? '#94a3b8' : '#64748b', textAlign: 'center' }}>{action.label}</Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </View>
          ) : null}
        />

        {isTyping && (
          <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20, paddingBottom: 8, gap: 8 }}>
            <View style={[styles.avatarAI, { backgroundColor: isDark ? '#312e81' : '#e0e7ff', marginBottom: 0 }]}>
              <Sparkles size={12} color={isDark ? '#818cf8' : '#4f46e5'} />
            </View>
            <View style={{ flexDirection: 'row', gap: 4, backgroundColor: isDark ? '#1e293b' : '#f1f5f9', paddingHorizontal: 14, paddingVertical: 10, borderRadius: 18, borderBottomLeftRadius: 4 }}>
              {[0, 1, 2].map(i => (
                <View key={i} style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: isDark ? '#6366f1' : '#818cf8', opacity: 0.6 + i * 0.2 }} />
              ))}
            </View>
          </View>
        )}

        {/* Input bar */}
        <View style={[styles.inputContainer, { backgroundColor: isDark ? '#0f1219' : '#ffffff', borderTopColor: borderColor }]}>
          <TextInput
            style={[styles.input, {
              color: isDark ? '#f8fafc' : '#0f172a',
              backgroundColor: isDark ? '#13161f' : '#f8fafc',
              borderColor: isDark ? '#1e2130' : '#e2e8f0'
            }]}
            placeholder="Tanyakan apa saja..."
            placeholderTextColor={isDark ? '#475569' : '#94a3b8'}
            value={inputText}
            onChangeText={setInputText}
            multiline maxLength={500}
            onSubmitEditing={() => handleSend()}
          />
          <TouchableOpacity
            style={[styles.sendButton, { opacity: inputText.trim() && !isTyping ? 1 : 0.35 }]}
            onPress={() => handleSend()}
            disabled={!inputText.trim() || isTyping}
          >
            <LinearGradient colors={['#818cf8', '#4f46e5']} style={styles.sendGradient}>
              <Send size={17} color="#ffffff" />
            </LinearGradient>
          </TouchableOpacity>
        </View>
      </Animated.View>
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 20, paddingTop: 20, paddingBottom: 14, borderBottomWidth: 1,
  },
  headerIcon: { width: 38, height: 38, borderRadius: 13, alignItems: 'center', justifyContent: 'center' },
  chatContainer: { paddingHorizontal: 16, paddingTop: 16, paddingBottom: 8 },
  messageWrapper: { flexDirection: 'row', alignItems: 'flex-end', marginBottom: 12, maxWidth: '86%' },
  msgUser: { alignSelf: 'flex-end', justifyContent: 'flex-end' },
  msgAI: { alignSelf: 'flex-start', gap: 8 },
  avatarAI: { width: 26, height: 26, borderRadius: 13, alignItems: 'center', justifyContent: 'center', marginBottom: 4 },
  bubble: { paddingHorizontal: 14, paddingVertical: 10, borderRadius: 20 },
  bubbleUser: { borderBottomRightRadius: 4 },
  bubbleAI: { borderBottomLeftRadius: 4 },
  inputContainer: {
    flexDirection: 'row', alignItems: 'flex-end',
    paddingHorizontal: 14, paddingVertical: 10,
    paddingBottom: Platform.OS === 'ios' ? 28 : 14,
    borderTopWidth: 1, gap: 10,
  },
  input: {
    flex: 1, minHeight: 44, maxHeight: 120,
    borderWidth: 1, borderRadius: 22,
    paddingHorizontal: 16, paddingTop: 12, paddingBottom: 12, fontSize: 15,
  },
  sendButton: { width: 44, height: 44, borderRadius: 22, overflow: 'hidden' },
  sendGradient: { flex: 1, alignItems: 'center', justifyContent: 'center' },
});
