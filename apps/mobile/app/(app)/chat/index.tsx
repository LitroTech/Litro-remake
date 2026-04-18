import { useState, useRef, useCallback } from 'react'
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  TextInput,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
} from 'react-native'
import { router } from 'expo-router'
import { Ionicons } from '@expo/vector-icons'
import { Screen } from '../../../src/components/ui/Screen'
import { api } from '../../../src/lib/api'
import { useLanguage } from '../../../src/lib/store'
import { colors } from '../../../src/constants/theme'

interface Message {
  id: string
  role: 'user' | 'bot'
  text: string
  ts: number
}

let msgCounter = 0
const mkId = () => String(++msgCounter)

export default function ChatScreen() {
  const language = useLanguage()
  const tl = language === 'tl'
  const listRef = useRef<FlatList>(null)

  const [messages, setMessages] = useState<Message[]>([
    {
      id: '0',
      role: 'bot',
      text: tl
        ? 'Kumusta! Magtanong ka tungkol sa benta, gastos, o produkto. Puwede kang magsulat sa Tagalog o English.'
        : 'Hello! Ask me about your sales, expenses, or products. You can write in Tagalog or English.',
      ts: Date.now(),
    },
  ])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)

  const scrollToBottom = useCallback(() => {
    setTimeout(() => listRef.current?.scrollToEnd({ animated: true }), 100)
  }, [])

  const sendMessage = async () => {
    const text = input.trim()
    if (!text || loading) return

    setInput('')

    const userMsg: Message = { id: mkId(), role: 'user', text, ts: Date.now() }
    setMessages((prev) => [...prev, userMsg])
    scrollToBottom()
    setLoading(true)

    try {
      const res = await api.post<{ reply: string }>('/chat/message', {
        message: text,
        channel: 'app',
      })
      const botMsg: Message = { id: mkId(), role: 'bot', text: res.reply, ts: Date.now() }
      setMessages((prev) => [...prev, botMsg])
    } catch {
      const errMsg: Message = {
        id: mkId(),
        role: 'bot',
        text: tl ? 'May error. Subukan ulit.' : 'Something went wrong. Try again.',
        ts: Date.now(),
      }
      setMessages((prev) => [...prev, errMsg])
    } finally {
      setLoading(false)
      scrollToBottom()
    }
  }

  const renderItem = ({ item }: { item: Message }) => {
    const isBot = item.role === 'bot'
    return (
      <View style={[styles.bubble, isBot ? styles.bubbleBot : styles.bubbleUser]}>
        {isBot && <View style={styles.botDot} />}
        <Text style={[styles.bubbleText, isBot ? styles.bubbleTextBot : styles.bubbleTextUser]}>
          {item.text}
        </Text>
      </View>
    )
  }

  return (
    <KeyboardAvoidingView
      style={{ flex: 1 }}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 0}
    >
      <Screen>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} hitSlop={12}>
            <Ionicons name="arrow-back" size={24} color={colors.pale} />
          </TouchableOpacity>
          <View style={styles.headerCenter}>
            <View style={styles.botIndicator} />
            <Text style={styles.title}>Litro AI</Text>
          </View>
          <View style={{ width: 36 }} />
        </View>

        {/* Messages */}
        <FlatList
          ref={listRef}
          data={messages}
          keyExtractor={(m) => m.id}
          renderItem={renderItem}
          contentContainerStyle={styles.list}
          showsVerticalScrollIndicator={false}
          onContentSizeChange={scrollToBottom}
        />

        {/* Typing indicator */}
        {loading && (
          <View style={[styles.bubble, styles.bubbleBot, styles.typingBubble]}>
            <View style={styles.botDot} />
            <ActivityIndicator size="small" color={colors.grey} />
          </View>
        )}

        {/* Input */}
        <View style={styles.inputRow}>
          <TextInput
            style={styles.input}
            value={input}
            onChangeText={setInput}
            placeholder={tl ? 'Magtanong...' : 'Ask something...'}
            placeholderTextColor={colors.grey}
            multiline
            maxLength={500}
            returnKeyType="send"
            onSubmitEditing={sendMessage}
            blurOnSubmit={false}
          />
          <TouchableOpacity
            style={[styles.sendBtn, (!input.trim() || loading) && styles.sendBtnDisabled]}
            onPress={sendMessage}
            disabled={!input.trim() || loading}
          >
            <Ionicons name="arrow-up" size={20} color={colors.dark} />
          </TouchableOpacity>
        </View>
      </Screen>
    </KeyboardAvoidingView>
  )
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingTop: 12,
    paddingBottom: 12,
  },
  headerCenter: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  botIndicator: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.green,
  },
  title: {
    fontFamily: 'BricolageGrotesque-Bold',
    fontSize: 18,
    color: colors.pale,
  },
  list: {
    paddingVertical: 12,
    gap: 8,
    flexGrow: 1,
  },
  bubble: {
    maxWidth: '82%',
    borderRadius: 16,
    padding: 12,
    marginHorizontal: 4,
  },
  bubbleBot: {
    alignSelf: 'flex-start',
    backgroundColor: '#0D1F1A',
    borderWidth: 1,
    borderColor: '#1A3530',
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
  },
  bubbleUser: {
    alignSelf: 'flex-end',
    backgroundColor: colors.green,
  },
  botDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: colors.green,
    marginTop: 6,
    flexShrink: 0,
  },
  bubbleText: {
    fontFamily: 'DMSans-Regular',
    fontSize: 15,
    lineHeight: 22,
    flex: 1,
  },
  bubbleTextBot: { color: colors.pale },
  bubbleTextUser: { color: colors.dark },
  typingBubble: { marginBottom: 4 },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 10,
    paddingTop: 12,
    paddingBottom: Platform.OS === 'ios' ? 24 : 16,
    borderTopWidth: 1,
    borderTopColor: '#1A3530',
  },
  input: {
    flex: 1,
    backgroundColor: '#0D1F1A',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#1A3530',
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 12,
    fontFamily: 'DMSans-Regular',
    fontSize: 15,
    color: colors.pale,
    maxHeight: 120,
  },
  sendBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.green,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sendBtnDisabled: {
    backgroundColor: '#1A3530',
  },
})
