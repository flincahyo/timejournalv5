import React, {
  useState, useEffect, useRef, useCallback, useTransition
} from 'react';
import {
  View, Text, TouchableOpacity, ScrollView, Animated, Easing,
  TextInput, KeyboardAvoidingView, Platform, Dimensions
} from 'react-native';
import { useColorScheme } from 'nativewind';
import {
  ArrowLeft, TrendingUp, TrendingDown, Newspaper, Bell,
  ChevronDown, ChevronUp, BarChart2, Radio, Link2,
  RefreshCw, Settings, Zap, AlertTriangle, CheckCircle,
  XCircle, Activity, Info, Shield
} from 'lucide-react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { API_URL } from '../Constants';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

// ── Color Tokens ───────────────────────────────────────────────────────────────
const C = {
  accent:   '#6366f1',
  green:    '#10b981',
  red:      '#ef4444',
  amber:    '#f59e0b',
  bg:       { dark: '#0b0e11', light: '#f5f7fa' },
  surface:  { dark: '#13161f', light: '#ffffff' },
  surface2: { dark: '#1c2030', light: '#f1f5f9' },
  border:   { dark: '#1e293b', light: '#e8edf5' },
  text:     { dark: '#f1f5f9', light: '#0f172a' },
  text2:    { dark: '#94a3b8', light: '#64748b' },
  text3:    { dark: '#475569', light: '#94a3b8' },
};

const MAX_ITEMS = 20;
const SETUP_OPTIONS   = ['Breakout', 'Retest', 'Reversal', 'Trend Follow', 'Range', 'News Play', 'Scalp', 'Other'];
const EMOTION_OPTIONS = ['Confident', 'Greedy', 'Fear', 'Neutral', 'Excited', 'Frustrated', 'Disciplined', 'Focused'];

// ── Utilities ──────────────────────────────────────────────────────────────────
function formatTime(ds: string): string {
  if (!ds) return '';
  try {
    let n = ds.includes(' ') && !ds.includes('T') ? ds.replace(' ', 'T') : ds;
    // If no timezone suffix, treat as UTC (backend sends naive UTC). 
    // Check for suffix 'Z', '+' offset, or '-' offset after the date part (index 10).
    const hasTZ = n.includes('Z') || n.includes('+', 10) || (n.includes('-', 11)); 
    if (n && !hasTZ) {
      n += 'Z';
    }
    return new Date(n).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false });
  } catch { return ''; }
}

function formatDate(ds: string): string {
  if (!ds) return '';
  try {
    let n = ds.includes(' ') && !ds.includes('T') ? ds.replace(' ', 'T') : ds;
    // If no timezone suffix, treat as UTC (backend sends naive UTC).
    const hasTZ = n.includes('Z') || n.includes('+', 10) || (n.includes('-', 11)); 
    if (n && !hasTZ) {
      n += 'Z';
    }
    const d = new Date(n);
    const today = new Date();
    const yest  = new Date(); yest.setDate(yest.getDate() - 1);
    if (d.toDateString() === today.toDateString()) return 'Today';
    if (d.toDateString() === yest.toDateString())  return 'Yesterday';
    return d.toLocaleDateString('en-US', { day: 'numeric', month: 'short', year: 'numeric' });
  } catch { return ''; }
}

function groupByDate<T extends { dateStr: string }>(items: T[]): { date: string; items: T[] }[] {
  const map: Record<string, T[]> = {};
  items.forEach(item => {
    const key = formatDate(item.dateStr);
    if (!map[key]) map[key] = [];
    map[key].push(item);
  });
  return Object.entries(map).map(([date, items]) => ({ date, items }));
}

// ── Result Overlay ─────────────────────────────────────────────────────────────
function ResultOverlay({ visible, type, amount, onDone }: {
  visible: boolean; type: 'profit' | 'loss'; amount: number; onDone: () => void;
}) {
  const opacity = useRef(new Animated.Value(0)).current;
  const scale   = useRef(new Animated.Value(0.7)).current;
  const shakeX  = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (!visible) return;
    opacity.setValue(0); scale.setValue(0.7); shakeX.setValue(0);
    if (type === 'loss') {
      Animated.sequence([
        Animated.parallel([
          Animated.timing(opacity, { toValue: 1, duration: 320, useNativeDriver: true }),
          Animated.spring(scale, { toValue: 1, damping: 12, stiffness: 180, useNativeDriver: true }),
        ]),
        Animated.sequence([
          Animated.timing(shakeX, { toValue: 12,  duration: 60, useNativeDriver: true }),
          Animated.timing(shakeX, { toValue: -12, duration: 60, useNativeDriver: true }),
          Animated.timing(shakeX, { toValue: 10,  duration: 60, useNativeDriver: true }),
          Animated.timing(shakeX, { toValue: -10, duration: 60, useNativeDriver: true }),
          Animated.timing(shakeX, { toValue: 6,   duration: 60, useNativeDriver: true }),
          Animated.timing(shakeX, { toValue: 0,   duration: 60, useNativeDriver: true }),
        ]),
        Animated.delay(1600),
        Animated.timing(opacity, { toValue: 0, duration: 500, useNativeDriver: true }),
      ]).start(() => onDone());
    } else {
      Animated.sequence([
        Animated.parallel([
          Animated.timing(opacity, { toValue: 1, duration: 350, useNativeDriver: true }),
          Animated.spring(scale, { toValue: 1, damping: 10, stiffness: 160, useNativeDriver: true }),
        ]),
        Animated.delay(2000),
        Animated.timing(opacity, { toValue: 0, duration: 600, useNativeDriver: true }),
      ]).start(() => onDone());
    }
  }, [visible]);

  if (!visible) return null;
  const isProfit = type === 'profit';

  return (
    <Animated.View style={{
      position: 'absolute', inset: 0, zIndex: 999,
      backgroundColor: isProfit ? 'rgba(16,185,129,0.96)' : 'rgba(239,68,68,0.96)',
      alignItems: 'center', justifyContent: 'center', opacity, padding: 40,
    }}>
      <Animated.View style={{ transform: [{ scale }, { translateX: shakeX }], alignItems: 'center' }}>
        <View style={{
          width: 80, height: 80, borderRadius: 40,
          backgroundColor: 'rgba(255,255,255,0.18)',
          alignItems: 'center', justifyContent: 'center', marginBottom: 24,
        }}>
          {isProfit
            ? <CheckCircle size={44} color="#fff" strokeWidth={2} />
            : <XCircle   size={44} color="#fff" strokeWidth={2} />}
        </View>
        <Text style={{ fontSize: 26, fontWeight: '900', color: '#fff', letterSpacing: -0.5, marginBottom: 8, textAlign: 'center' }}>
          {isProfit ? 'Trade Closed Profitably' : 'Stay Disciplined'}
        </Text>
        <Text style={{ fontSize: 15, fontWeight: '600', color: 'rgba(255,255,255,0.8)', textAlign: 'center', lineHeight: 22 }}>
          {isProfit
            ? `+$${Math.abs(amount).toFixed(2)} profit recorded`
            : `-$${Math.abs(amount).toFixed(2)} — Review your setup & risk`}
        </Text>
        {!isProfit && (
          <View style={{
            marginTop: 24, flexDirection: 'row', alignItems: 'center', gap: 8,
            backgroundColor: 'rgba(255,255,255,0.15)', paddingHorizontal: 16, paddingVertical: 10, borderRadius: 12,
          }}>
            <Shield size={16} color="#fff" />
            <Text style={{ fontSize: 13, fontWeight: '700', color: '#fff' }}>Risk management is the foundation</Text>
          </View>
        )}
      </Animated.View>
    </Animated.View>
  );
}

// ── Trade Detail Expander ──────────────────────────────────────────────────────
function TradeDetailExpander({ trade, isDark, recapSettings, onSave, onUpdateSettings }: {
  trade: any;
  isDark: boolean;
  recapSettings: { emotion_choices: string[], setup_choices: string[] };
  onSave: (d: { setup: string; emotion: string; note: string }) => void;
  onUpdateSettings: (newSettings: any) => void;
}) {
  const pnl      = Number(trade.profit || 0) + Number(trade.swap || 0) + Number(trade.commission || 0);
  const isProfit = pnl >= 0;
  const [setup,   setSetup]   = useState(trade.setup   || '');
  const [emotion, setEmotion] = useState(trade.emotion || '');
  const [note,    setNote]    = useState(trade.note || trade.notes || '');

  const [isEditingOptions, setIsEditingOptions] = useState(false);
  const [addingOption, setAddingOption] = useState<{ type: 'emotion' | 'setup', val: string } | null>(null);

  const s2 = isDark ? C.surface2.dark : C.surface2.light;
  const t  = isDark ? C.text.dark     : C.text.light;
  const t2 = isDark ? C.text2.dark    : C.text2.light;
  const b  = isDark ? C.border.dark   : C.border.light;

  return (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
      <View style={{
        marginTop: 2, padding: 16, borderRadius: 16,
        backgroundColor: isDark ? '#12151e' : '#f8fafc',
        borderWidth: 1, borderColor: isDark ? 'rgba(99,102,241,0.18)' : 'rgba(99,102,241,0.1)',
      }}>

        {/* Outcome — read-only from actual MT5 P&L */}
        <View style={{
          flexDirection: 'row', alignItems: 'center', gap: 10,
          backgroundColor: isProfit ? 'rgba(16,185,129,0.10)' : 'rgba(239,68,68,0.10)',
          borderRadius: 12, paddingHorizontal: 14, paddingVertical: 10, marginBottom: 16,
          borderWidth: 1, borderColor: isProfit ? 'rgba(16,185,129,0.2)' : 'rgba(239,68,68,0.2)',
        }}>
          {isProfit
            ? <TrendingUp   size={16} color={C.green} />
            : <TrendingDown size={16} color={C.red}   />}
          <Text style={{ fontSize: 14, fontWeight: '900', color: isProfit ? C.green : C.red }}>
            {isProfit ? '+' : '-'}${Math.abs(pnl).toFixed(2)}
          </Text>
        </View>

        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: 8 }}>
          <Text style={{ fontSize: 10, fontWeight: '900', color: t2, letterSpacing: 1.2 }}>SETUP</Text>
          <TouchableOpacity onPress={() => setIsEditingOptions(!isEditingOptions)}>
            <Text style={{ fontSize: 9, fontWeight: '900', color: isEditingOptions ? C.accent : t2 }}>
              {isEditingOptions ? 'DONE' : 'CUSTOMIZE'}
            </Text>
          </TouchableOpacity>
        </View>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 6, marginBottom: 16 }}>
          {recapSettings.setup_choices.map((opt, i) => (
            <View key={`setup-${i}`} style={{ flexDirection: 'row', alignItems: 'center' }}>
              <TouchableOpacity
                onPress={() => setSetup(setup === opt ? '' : opt)}
                disabled={isEditingOptions}
                style={{
                  paddingHorizontal: 12, paddingVertical: 7, borderRadius: 10,
                  backgroundColor: setup === opt ? C.accent : s2,
                  borderWidth: 1, borderColor: setup === opt ? 'transparent' : b,
                  opacity: isEditingOptions ? 0.7 : 1,
                }}
              >
                <Text style={{ fontSize: 11, fontWeight: '700', color: setup === opt ? '#fff' : t2 }}>{opt}</Text>
              </TouchableOpacity>
              {isEditingOptions && (
                 <TouchableOpacity 
                   onPress={() => {
                     const newList = [...recapSettings.setup_choices];
                     newList.splice(i, 1);
                     onUpdateSettings({ ...recapSettings, setup_choices: newList });
                   }}
                   style={{ width: 22, height: 22, borderRadius: 11, backgroundColor: 'rgba(239,68,68,0.1)', alignItems: 'center', justifyContent: 'center', marginLeft: -8, marginTop: -16 }}
                 >
                   <XCircle size={12} color={C.red} />
                 </TouchableOpacity>
              )}
            </View>
          ))}
          {isEditingOptions && (
            addingOption?.type === 'setup' ? (
              <TextInput
                autoFocus
                value={addingOption.val}
                onChangeText={v => setAddingOption({ type: 'setup', val: v })}
                onSubmitEditing={() => {
                  if (addingOption.val.trim()) {
                     const newList = [...recapSettings.setup_choices, addingOption.val.trim()];
                     onUpdateSettings({ ...recapSettings, setup_choices: newList });
                  }
                  setAddingOption(null);
                }}
                onBlur={() => setAddingOption(null)}
                style={{ backgroundColor: s2, borderWidth: 1, borderColor: C.accent, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 4, minWidth: 80, color: t, fontSize: 11, fontWeight: '700' }}
              />
            ) : (
              <TouchableOpacity
                onPress={() => setAddingOption({ type: 'setup', val: '' })}
                style={{ paddingHorizontal: 10, paddingVertical: 7, borderRadius: 10, backgroundColor: 'transparent', borderWidth: 1, borderColor: b, borderStyle: 'dashed' }}
              >
                <Text style={{ fontSize: 11, fontWeight: '700', color: t2 }}>+ Add</Text>
              </TouchableOpacity>
            )
          )}
        </ScrollView>

        {/* Emotion */}
        <Text style={{ fontSize: 10, fontWeight: '900', color: t2, letterSpacing: 1.2, marginBottom: 8 }}>EMOTION</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 6, marginBottom: 16 }}>
          {recapSettings.emotion_choices.map((opt, i) => (
            <View key={`emotion-${i}`} style={{ flexDirection: 'row', alignItems: 'center' }}>
              <TouchableOpacity
                onPress={() => setEmotion(emotion === opt ? '' : opt)}
                disabled={isEditingOptions}
                style={{
                  paddingHorizontal: 12, paddingVertical: 7, borderRadius: 10,
                  backgroundColor: emotion === opt ? '#8b5cf6' : s2,
                  borderWidth: 1, borderColor: emotion === opt ? 'transparent' : b,
                  opacity: isEditingOptions ? 0.7 : 1,
                }}
              >
                <Text style={{ fontSize: 11, fontWeight: '700', color: emotion === opt ? '#fff' : t2 }}>{opt}</Text>
              </TouchableOpacity>
              {isEditingOptions && (
                 <TouchableOpacity 
                   onPress={() => {
                     const newList = [...recapSettings.emotion_choices];
                     newList.splice(i, 1);
                     onUpdateSettings({ ...recapSettings, emotion_choices: newList });
                   }}
                   style={{ width: 22, height: 22, borderRadius: 11, backgroundColor: 'rgba(239,68,68,0.1)', alignItems: 'center', justifyContent: 'center', marginLeft: -8, marginTop: -16 }}
                 >
                   <XCircle size={12} color={C.red} />
                 </TouchableOpacity>
              )}
            </View>
          ))}
          {isEditingOptions && (
            addingOption?.type === 'emotion' ? (
              <TextInput
                autoFocus
                value={addingOption.val}
                onChangeText={v => setAddingOption({ type: 'emotion', val: v })}
                onSubmitEditing={() => {
                  if (addingOption.val.trim()) {
                     const newList = [...recapSettings.emotion_choices, addingOption.val.trim()];
                     onUpdateSettings({ ...recapSettings, emotion_choices: newList });
                  }
                  setAddingOption(null);
                }}
                onBlur={() => setAddingOption(null)}
                style={{ backgroundColor: s2, borderWidth: 1, borderColor: '#8b5cf6', borderRadius: 10, paddingHorizontal: 12, paddingVertical: 4, minWidth: 80, color: t, fontSize: 11, fontWeight: '700' }}
              />
            ) : (
              <TouchableOpacity
                onPress={() => setAddingOption({ type: 'emotion', val: '' })}
                style={{ paddingHorizontal: 10, paddingVertical: 7, borderRadius: 10, backgroundColor: 'transparent', borderWidth: 1, borderColor: b, borderStyle: 'dashed' }}
              >
                <Text style={{ fontSize: 11, fontWeight: '700', color: t2 }}>+ Add</Text>
              </TouchableOpacity>
            )
          )}
        </ScrollView>

        {/* Note */}
        <Text style={{ fontSize: 10, fontWeight: '900', color: t2, letterSpacing: 1.2, marginBottom: 8 }}>NOTE</Text>
        <TextInput
          value={note} onChangeText={setNote}
          placeholder="Add your trade notes..."
          placeholderTextColor={isDark ? '#334155' : '#94a3b8'}
          multiline numberOfLines={3}
          style={{
            backgroundColor: s2, borderRadius: 12, padding: 12,
            color: t, fontSize: 13, fontWeight: '500',
            borderWidth: 1, borderColor: b, minHeight: 70,
            textAlignVertical: 'top', marginBottom: 14,
          }}
        />

        {/* Save */}
        <TouchableOpacity
          onPress={() => onSave({ setup, emotion, note })}
          style={{
            backgroundColor: isProfit ? C.green : C.red,
            borderRadius: 14, paddingVertical: 13,
            flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
          }}
        >
          <CheckCircle size={16} color="#fff" />
          <Text style={{ color: '#fff', fontWeight: '900', fontSize: 14 }}>Save Recap</Text>
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}

// ── Trade Recap Tab ────────────────────────────────────────────────────────────
function TradeRecapTab({ isDark, trades, onResult, recapSettings, onUpdateSettings }: {
  isDark: boolean; trades: any[];
  onResult: (type: 'profit' | 'loss', amount: number) => void;
  recapSettings: { emotion_choices: string[], setup_choices: string[] };
  onUpdateSettings: (s: any) => void;
}) {
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [saving,     setSaving]     = useState<string | null>(null);

  const handleSave = async (
    ticket: string,
    data: { setup: string; emotion: string; note: string },
    pnl: number,
  ) => {
    setSaving(ticket);
    try {
      const token = await AsyncStorage.getItem('userToken');
      // Persist to backend — syncs with web journal, history & calendar tabs
      const res = await fetch(`${API_URL}/trades/${ticket}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ setup: data.setup, emotion: data.emotion, notes: data.note }),
      });
      if (!res.ok) console.warn('[TradeRecap] PATCH failed:', res.status);
    } catch (e) {
      console.warn('[TradeRecap] Network error:', e);
    } finally {
      setSaving(null);
    }
    setExpandedId(null);
    onResult(pnl >= 0 ? 'profit' : 'loss', pnl);
  };

  // Trades from useMT5Sync already include setup/emotion/notes synced from DB
  const items  = trades.slice(0, MAX_ITEMS).map(t => ({ ...t, dateStr: t.closeTime || t.openTime || '' }));
  const groups = groupByDate(items);

  const bg   = isDark ? C.surface.dark : C.surface.light;
  const bord = isDark ? C.border.dark  : C.border.light;
  const t    = isDark ? C.text.dark    : C.text.light;
  const t2   = isDark ? C.text2.dark   : C.text2.light;
  const t3   = isDark ? C.text3.dark   : C.text3.light;

  if (items.length === 0) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: 40 }}>
        <View style={{ width: 56, height: 56, borderRadius: 18, backgroundColor: isDark ? C.surface2.dark : C.surface2.light, alignItems: 'center', justifyContent: 'center', marginBottom: 14 }}>
          <BarChart2 size={28} color={t3} />
        </View>
        <Text style={{ fontSize: 15, fontWeight: '800', color: t, textAlign: 'center' }}>No trades yet</Text>
        <Text style={{ fontSize: 12, fontWeight: '500', color: t2, textAlign: 'center', marginTop: 6 }}>Connect your MT5 account to see trade recap</Text>
      </View>
    );
  }

  return (
    <ScrollView
      style={{ flex: 1 }}
      contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 32, paddingTop: 8 }}
      showsVerticalScrollIndicator={false}
      keyboardShouldPersistTaps="handled"
    >
      {groups.map(group => (
        <View key={group.date}>
          <Text style={{ fontSize: 10, fontWeight: '900', letterSpacing: 1, color: t3, marginTop: 16, marginBottom: 8, marginLeft: 4 }}>
            {group.date.toUpperCase()}
          </Text>
          <View style={{ backgroundColor: bg, borderRadius: 20, overflow: 'hidden', borderWidth: 1, borderColor: bord }}>
            {group.items.map((trade: any, i: number) => {
              const pnl       = Number(trade.profit || 0) + Number(trade.swap || 0) + Number(trade.commission || 0);
              const isPos     = pnl >= 0;
              const id        = String(trade.ticket || trade.id || i);
              const isExpanded = expandedId === id;
              const isSaving   = saving === id;
              const hasRecap  = !!(trade.setup || trade.emotion || trade.note || trade.notes);
              const time      = formatTime(trade.closeTime || trade.openTime || '');
              const tradeType = (trade.type || 'BUY').toUpperCase();

              return (
                <View key={id}>
                  <TouchableOpacity
                    activeOpacity={0.75}
                    onPress={() => setExpandedId(isExpanded ? null : id)}
                    style={{
                      flexDirection: 'row', alignItems: 'center',
                      paddingHorizontal: 16, paddingVertical: 14,
                      borderBottomWidth: i < group.items.length - 1 || isExpanded ? 1 : 0,
                      borderBottomColor: bord,
                    }}
                  >
                    <View style={{
                      width: 40, height: 40, borderRadius: 14, marginRight: 12,
                      alignItems: 'center', justifyContent: 'center',
                      backgroundColor: isPos ? 'rgba(16,185,129,0.10)' : 'rgba(239,68,68,0.10)',
                    }}>
                      {isPos ? <TrendingUp size={18} color={C.green} /> : <TrendingDown size={18} color={C.red} />}
                    </View>

                    <View style={{ flex: 1 }}>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                        <Text style={{ fontSize: 13, fontWeight: '900', color: t }}>{trade.symbol}</Text>
                        <View style={{
                          borderRadius: 5, paddingHorizontal: 5, paddingVertical: 2,
                          backgroundColor: tradeType === 'BUY' ? 'rgba(99,102,241,0.10)' : 'rgba(249,115,22,0.10)',
                        }}>
                          <Text style={{ fontSize: 9, fontWeight: '800', color: tradeType === 'BUY' ? C.accent : '#f97316' }}>
                            {tradeType}
                          </Text>
                        </View>
                        {hasRecap && (
                          <View style={{
                            width: 16, height: 16, borderRadius: 8,
                            backgroundColor: isPos ? 'rgba(16,185,129,0.15)' : 'rgba(239,68,68,0.10)',
                            alignItems: 'center', justifyContent: 'center',
                          }}>
                            <CheckCircle size={10} color={isPos ? C.green : C.red} />
                          </View>
                        )}
                      </View>
                      <Text style={{ fontSize: 10, fontWeight: '600', color: t3, marginTop: 2 }}>
                        {hasRecap
                          ? `${trade.setup || '—'} · ${trade.emotion || '—'}`
                          : 'Tap to add recap details'}
                      </Text>
                    </View>

                    <View style={{ alignItems: 'flex-end', marginLeft: 8 }}>
                      <Text style={{ fontSize: 13, fontWeight: '900', color: isPos ? C.green : C.red }}>
                        {isPos ? '+' : '-'}${Math.abs(pnl).toFixed(2)}
                      </Text>
                      <Text style={{ fontSize: 9, fontWeight: '700', color: t3, marginTop: 2 }}>{time}</Text>
                    </View>
                    <View style={{ marginLeft: 6 }}>
                      {isSaving
                        ? <RefreshCw size={16} color={C.accent} />
                        : isExpanded
                          ? <ChevronUp   size={16} color={t3} />
                          : <ChevronDown size={16} color={t3} />}
                    </View>
                  </TouchableOpacity>

                  {isExpanded && (
                    <View style={{ paddingHorizontal: 12, paddingBottom: 12 }}>
                      <TradeDetailExpander
                        trade={trade}
                        isDark={isDark}
                        recapSettings={recapSettings}
                        onSave={(data) => handleSave(id, data, pnl)}
                        onUpdateSettings={onUpdateSettings}
                      />
                    </View>
                  )}
                </View>
              );
            })}
          </View>
        </View>
      ))}
    </ScrollView>
  );
}

// ── News Recap Tab ─────────────────────────────────────────────────────────────
function NewsRecapTab({ isDark }: { isDark: boolean }) {
  const [news,    setNews]    = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const token = await AsyncStorage.getItem('userToken');
        const res   = await fetch(`${API_URL}/news`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (res.ok) {
          const data = await res.json();
          setNews((data.events || data.data || data || []).slice(0, MAX_ITEMS));
        }
      } catch (_) {}
      finally { setLoading(false); }
    })();
  }, []);

  const t  = isDark ? C.text.dark    : C.text.light;
  const t2 = isDark ? C.text2.dark   : C.text2.light;
  const t3 = isDark ? C.text3.dark   : C.text3.light;
  const bg = isDark ? C.surface.dark : C.surface.light;
  const b  = isDark ? C.border.dark  : C.border.light;

  const IMPACT: Record<string, { color: string; Icon: any }> = {
    high:   { color: C.red,   Icon: AlertTriangle },
    medium: { color: C.amber, Icon: Activity      },
    low:    { color: C.green, Icon: Info          },
  };

  if (loading) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
        <View style={{ width: 56, height: 56, borderRadius: 18, backgroundColor: isDark ? C.surface2.dark : C.surface2.light, alignItems: 'center', justifyContent: 'center', marginBottom: 14 }}>
          <Newspaper size={28} color={t3} />
        </View>
        <Text style={{ fontSize: 13, fontWeight: '700', color: t2 }}>Loading news recap...</Text>
      </View>
    );
  }

  if (news.length === 0) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: 40 }}>
        <View style={{ width: 56, height: 56, borderRadius: 18, backgroundColor: isDark ? C.surface2.dark : C.surface2.light, alignItems: 'center', justifyContent: 'center', marginBottom: 14 }}>
          <Newspaper size={28} color={t3} />
        </View>
        <Text style={{ fontSize: 15, fontWeight: '800', color: t, textAlign: 'center' }}>No news recap</Text>
        <Text style={{ fontSize: 12, fontWeight: '500', color: t2, textAlign: 'center', marginTop: 6 }}>Economic calendar events will appear here</Text>
      </View>
    );
  }

  const items  = news.map((n: any) => ({ ...n, dateStr: n.date || n.event_time || n.time || '' }));
  const groups = groupByDate(items);

  return (
    <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 32, paddingTop: 8 }} showsVerticalScrollIndicator={false}>
      {groups.map(group => (
        <View key={group.date}>
          <Text style={{ fontSize: 10, fontWeight: '900', letterSpacing: 1, color: t3, marginTop: 16, marginBottom: 8, marginLeft: 4 }}>
            {group.date.toUpperCase()}
          </Text>
          <View style={{ backgroundColor: bg, borderRadius: 20, overflow: 'hidden', borderWidth: 1, borderColor: b }}>
            {group.items.map((item: any, i: number) => {
              const impact = (item.impact || item.type || 'low').toLowerCase();
              const cfg    = IMPACT[impact] || IMPACT.low;
              const { Icon } = cfg;
              const time   = formatTime(item.date || item.event_time || item.time || '');
              return (
                <View key={i} style={{
                  flexDirection: 'row', alignItems: 'flex-start',
                  paddingHorizontal: 16, paddingVertical: 14,
                  borderBottomWidth: i < group.items.length - 1 ? 1 : 0, borderBottomColor: b,
                }}>
                  <View style={{ width: 40, height: 40, borderRadius: 14, backgroundColor: `${cfg.color}12`, alignItems: 'center', justifyContent: 'center', marginRight: 12 }}>
                    <Icon size={18} color={cfg.color} strokeWidth={2} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                      <Text style={{ fontSize: 13, fontWeight: '800', color: t, flex: 1, marginRight: 8 }} numberOfLines={1}>
                        {item.title || item.name || item.event || 'Economic Event'}
                      </Text>
                      <Text style={{ fontSize: 10, fontWeight: '700', color: t3 }}>{time}</Text>
                    </View>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 4 }}>
                      <View style={{ backgroundColor: `${cfg.color}12`, borderRadius: 5, paddingHorizontal: 6, paddingVertical: 2 }}>
                        <Text style={{ fontSize: 9, fontWeight: '800', color: cfg.color }}>{impact.toUpperCase()} IMPACT</Text>
                      </View>
                      {item.currency && <Text style={{ fontSize: 10, fontWeight: '700', color: t3 }}>{item.currency}</Text>}
                    </View>
                  </View>
                </View>
              );
            })}
          </View>
        </View>
      ))}
    </ScrollView>
  );
}

// Alert type → icon + color (covers price, candle/momentum, news, connection, system)
const ALERT_ICON_MAP: Record<string, { Icon: any; color: string; label: string }> = {
  price:      { Icon: Zap,       color: '#f59e0b', label: 'Price Alert'    },
  candle:     { Icon: BarChart2, color: '#6366f1', label: 'Momentum'       },
  connection: { Icon: Link2,     color: '#6366f1', label: 'Connection'     },
  sync:       { Icon: RefreshCw, color: '#10b981', label: 'Sync'           },
  system:     { Icon: Settings,  color: '#64748b', label: 'System'         },
  news:       { Icon: Newspaper, color: '#f59e0b', label: 'News Alert'    },
  mt5:        { Icon: Radio,     color: '#8b5cf6', label: 'MT5'            },
  default:    { Icon: Bell,      color: '#64748b', label: 'Alert'          },
};

function AlertsTab({ isDark }: { isDark: boolean }) {
  const [alerts,  setAlerts]  = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const token = await AsyncStorage.getItem('userToken');
        const res = await fetch(`${API_URL}/alerts/history`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (res.ok) {
          const data = await res.json();
          // data.history = [{id, data:{title,body,symbol,type,alert_data}, triggeredAt}]
          setAlerts((data.history || []).slice(0, 10));
        }
      } catch (_) {}
      finally { setLoading(false); }
    })();
  }, []);

  const t  = isDark ? C.text.dark    : C.text.light;
  const t2 = isDark ? C.text2.dark   : C.text2.light;
  const t3 = isDark ? C.text3.dark   : C.text3.light;
  const bg = isDark ? C.surface.dark : C.surface.light;
  const b  = isDark ? C.border.dark  : C.border.light;

  if (loading) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
        <View style={{ width: 56, height: 56, borderRadius: 18, backgroundColor: isDark ? C.surface2.dark : C.surface2.light, alignItems: 'center', justifyContent: 'center', marginBottom: 14 }}>
          <Bell size={28} color={t3} />
        </View>
        <Text style={{ fontSize: 13, fontWeight: '700', color: t2 }}>Loading alerts...</Text>
      </View>
    );
  }

  if (alerts.length === 0) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: 40 }}>
        <View style={{ width: 56, height: 56, borderRadius: 18, backgroundColor: isDark ? C.surface2.dark : C.surface2.light, alignItems: 'center', justifyContent: 'center', marginBottom: 14 }}>
          <Bell size={28} color={t3} />
        </View>
        <Text style={{ fontSize: 15, fontWeight: '800', color: t, textAlign: 'center' }}>No alerts yet</Text>
        <Text style={{ fontSize: 12, fontWeight: '500', color: t2, textAlign: 'center', marginTop: 6 }}>Price alerts, candle momentum, and economic news alerts will appear here</Text>
      </View>
    );
  }

  const items  = alerts.map(a => ({
    ...a,
    dateStr: a.triggeredAt || '',
    title:   a.data?.title || 'Alert',
    body:    a.data?.body || '',
    type:    a.data?.type || 'default',
    symbol:  a.data?.symbol || '',
  }));
  const groups = groupByDate(items);

  return (
    <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 32, paddingTop: 8 }} showsVerticalScrollIndicator={false}>
      {groups.map(group => (
        <View key={group.date}>
          <Text style={{ fontSize: 10, fontWeight: '900', letterSpacing: 1, color: t3, marginTop: 16, marginBottom: 8, marginLeft: 4 }}>
            {group.date.toUpperCase()}
          </Text>
          <View style={{ backgroundColor: bg, borderRadius: 20, overflow: 'hidden', borderWidth: 1, borderColor: b }}>
            {group.items.map((alert: any, i: number) => {
              const typeKey = (alert.type || 'default').toLowerCase();
              const cfg     = ALERT_ICON_MAP[typeKey] || ALERT_ICON_MAP.default;
              const { Icon } = cfg;
              const time    = formatTime(alert.triggeredAt || '');
              return (
                <View key={i} style={{
                  flexDirection: 'row', alignItems: 'flex-start',
                  paddingHorizontal: 16, paddingVertical: 14,
                  borderBottomWidth: i < group.items.length - 1 ? 1 : 0, borderBottomColor: b,
                }}>
                  <View style={{ width: 40, height: 40, borderRadius: 14, backgroundColor: `${cfg.color}18`, alignItems: 'center', justifyContent: 'center', marginRight: 12 }}>
                    <Icon size={18} color={cfg.color} strokeWidth={2} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                      <Text style={{ fontSize: 13, fontWeight: '800', color: t, flex: 1, marginRight: 8 }} numberOfLines={1}>
                        {alert.title}
                      </Text>
                      <Text style={{ fontSize: 10, fontWeight: '700', color: t3 }}>{time}</Text>
                    </View>
                    {alert.body ? (
                      <Text style={{ fontSize: 11, fontWeight: '500', color: t2, marginTop: 3, lineHeight: 16 }} numberOfLines={2}>
                        {alert.body}
                      </Text>
                    ) : null}
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 4 }}>
                      <View style={{ backgroundColor: `${cfg.color}18`, borderRadius: 5, paddingHorizontal: 6, paddingVertical: 2 }}>
                        <Text style={{ fontSize: 9, fontWeight: '800', color: cfg.color }}>{cfg.label.toUpperCase()}</Text>
                      </View>
                      {alert.symbol ? <Text style={{ fontSize: 10, fontWeight: '700', color: t3 }}>{alert.symbol}</Text> : null}
                    </View>
                  </View>
                </View>
              );
            })}
          </View>
        </View>
      ))}
    </ScrollView>
  );
}

// ── Tab Definitions ────────────────────────────────────────────────────────────
const TABS_DEF = [
  { id: 'trades', label: 'Trade Recap', Icon: BarChart2 },
  { id: 'news',   label: 'News Recap',  Icon: Newspaper },
  { id: 'alerts', label: 'Alerts',      Icon: Bell      },
];

// ── Main Screen ────────────────────────────────────────────────────────────────
const NotificationCenterScreen = React.memo(({ trades, onClose }: {
  trades: any[]; onClose: () => void;
}) => {
  const { colorScheme } = useColorScheme();
  const isDark = colorScheme === 'dark';

  const [activeTab,   setActiveTab]   = useState(0);
  const [loadedTabs,  setLoadedTabs]  = useState<Record<number, boolean>>({ 0: true });
  const [, startFn]                   = useTransition();
  const scrollRef     = useRef<ScrollView>(null);
  const indicatorAnim = useRef(new Animated.Value(0)).current;

  const [resultVisible, setResultVisible] = useState(false);
  const [resultType,    setResultType]    = useState<'profit' | 'loss'>('profit');
  const [resultAmount,  setResultAmount]  = useState(0);

  const [recapSettings, setRecapSettings] = useState({
    emotion_choices: ['Happy', 'Neutral', 'Anxious', 'FOMO', 'Calm'],
    setup_choices: ['Breakout', 'Retest', 'Reversal', 'News', 'Scalp', 'Systematic']
  });

  useEffect(() => {
    (async () => {
      try {
        const token = await AsyncStorage.getItem('userToken');
        const res = await fetch(`${API_URL}/auth/settings`, { headers: { Authorization: `Bearer ${token}` } });
        if (res.ok) {
          const sData = await res.json();
          if (sData.recap_settings?.emotion_choices) {
            setRecapSettings({
              emotion_choices: sData.recap_settings.emotion_choices,
              setup_choices: sData.recap_settings.setup_choices || recapSettings.setup_choices
            });
          }
        }
      } catch (_) {}
    })();
  }, []);

  const handleUpdateSettings = useCallback(async (newSettings: any) => {
    setRecapSettings(newSettings);
    try {
      const token = await AsyncStorage.getItem('userToken');
      await fetch(`${API_URL}/auth/settings/recap`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify(newSettings)
      });
    } catch (_) {}
  }, []);

  const handleResult = useCallback((type: 'profit' | 'loss', amount: number) => {
    setResultType(type); setResultAmount(amount); setResultVisible(true);
  }, []);

  const tabWidth   = SCREEN_WIDTH / TABS_DEF.length;
  const indicatorX = indicatorAnim.interpolate({
    inputRange:  TABS_DEF.map((_, i) => i),
    outputRange: TABS_DEF.map((_, i) => i * tabWidth + 12),
  });

  const switchTab = useCallback((idx: number) => {
    setLoadedTabs(prev => ({ ...prev, [idx]: true }));
    Animated.spring(indicatorAnim, { toValue: idx, damping: 20, stiffness: 200, mass: 0.7, useNativeDriver: true }).start();
    scrollRef.current?.scrollTo({ x: idx * SCREEN_WIDTH, animated: false });
    startFn(() => setActiveTab(idx));
  }, []);

  const onScroll = useCallback((e: any) => {
    const idx = Math.round(e.nativeEvent.contentOffset.x / SCREEN_WIDTH);
    if (idx !== activeTab) {
      setLoadedTabs(prev => ({ ...prev, [idx]: true }));
      Animated.spring(indicatorAnim, { toValue: idx, damping: 20, stiffness: 200, useNativeDriver: true }).start();
      startFn(() => setActiveTab(idx));
    }
  }, [activeTab]);

  const bg      = isDark ? C.bg.dark      : C.bg.light;
  const surface = isDark ? C.surface.dark : C.surface.light;
  const border  = isDark ? C.border.dark  : C.border.light;
  const tPri    = isDark ? C.text.dark    : C.text.light;
  const tMut    = isDark ? C.text2.dark   : C.text2.light;
  const t3      = isDark ? C.text3.dark   : C.text3.light;

  return (
    <View style={{ flex: 1, backgroundColor: bg }}>
      {/* Header */}
      <View style={{
        flexDirection: 'row', alignItems: 'center',
        paddingHorizontal: 20, paddingTop: 20, paddingBottom: 16,
        backgroundColor: surface, borderBottomWidth: 1, borderBottomColor: border,
      }}>
        <TouchableOpacity
          onPress={onClose} activeOpacity={0.75}
          style={{
            width: 38, height: 38, borderRadius: 13,
            backgroundColor: isDark ? C.surface2.dark : C.surface2.light,
            alignItems: 'center', justifyContent: 'center', marginRight: 14,
          }}
        >
          <ArrowLeft size={20} color={tMut} />
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text style={{ fontSize: 20, fontWeight: '900', color: tPri, letterSpacing: -0.5 }}>
            Notification Center
          </Text>
          <Text style={{ fontSize: 10, fontWeight: '700', color: tMut, letterSpacing: 0.8 }}>
            RECENT ACTIVITY
          </Text>
        </View>
      </View>

      {/* Tab Bar */}
      <View style={{ backgroundColor: surface, borderBottomWidth: 1, borderBottomColor: border }}>
        <View style={{ flexDirection: 'row' }}>
          {TABS_DEF.map((tab, idx) => {
            const isActive = activeTab === idx;
            const { Icon } = tab;
            return (
              <TouchableOpacity
                key={tab.id} onPress={() => switchTab(idx)} activeOpacity={0.7}
                style={{ flex: 1, alignItems: 'center', paddingVertical: 12, paddingHorizontal: 4 }}
              >
                <Icon size={17} color={isActive ? C.accent : t3} strokeWidth={isActive ? 2.5 : 1.8} style={{ marginBottom: 4 }} />
                <Text style={{ fontSize: 11, fontWeight: isActive ? '800' : '600', color: isActive ? C.accent : tMut, letterSpacing: -0.1 }}>
                  {tab.label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>
        <View style={{ height: 2, backgroundColor: border }}>
          <Animated.View style={{
            height: 2, width: tabWidth - 24, borderRadius: 1,
            backgroundColor: C.accent,
            transform: [{ translateX: indicatorX }],
          }} />
        </View>
      </View>

      {/* Tab Content */}
      <ScrollView
        ref={scrollRef} horizontal pagingEnabled
        showsHorizontalScrollIndicator={false}
        onMomentumScrollEnd={onScroll}
        scrollEventThrottle={16}
        bounces={false}
        style={{ flex: 1 }}
      >
        <View style={{ width: SCREEN_WIDTH, flex: 1 }}>
          {loadedTabs[0]
            ? <TradeRecapTab isDark={isDark} trades={trades} onResult={handleResult} recapSettings={recapSettings} onUpdateSettings={handleUpdateSettings} />
            : <View style={{ flex: 1, backgroundColor: bg }} />}
        </View>
        <View style={{ width: SCREEN_WIDTH, flex: 1 }}>
          {loadedTabs[1]
            ? <NewsRecapTab isDark={isDark} />
            : <View style={{ flex: 1, backgroundColor: bg }} />}
        </View>
        <View style={{ width: SCREEN_WIDTH, flex: 1 }}>
          {loadedTabs[2]
            ? <AlertsTab isDark={isDark} />
            : <View style={{ flex: 1, backgroundColor: bg }} />}
        </View>
      </ScrollView>

      <ResultOverlay
        visible={resultVisible} type={resultType} amount={resultAmount}
        onDone={() => setResultVisible(false)}
      />
    </View>
  );
});

export default NotificationCenterScreen;

// ── Helper: push a local alert ─────────────────────────────────────────────────
export async function pushLocalAlert(alert: {
  type: string; title: string; message?: string; urgent?: boolean; time?: string;
}) {
  try {
    const raw     = await AsyncStorage.getItem('notif_alerts');
    const existing: any[] = raw ? JSON.parse(raw) : [];
    const updated = [{ ...alert, time: alert.time || new Date().toISOString() }, ...existing].slice(0, MAX_ITEMS);
    await AsyncStorage.setItem('notif_alerts', JSON.stringify(updated));
  } catch (_) {}
}
