import React, { useState, useRef, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TextInput,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  SafeAreaView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, spacing } from '../../constants/theme';
import { useAppStore } from '../../lib/store';
import { api } from '../../lib/api';
import type { BotAction, BotResponse, CartItem } from '@litro/types';

interface Message {
  id: string;
  text: string;
  sender: 'user' | 'bot';
  timestamp: Date;
}

async function executeBotAction(action: BotAction, cartItems: CartItem[]): Promise<void> {
  switch (action.type) {
    case 'submit_transaction':
      await api.post('/transactions', {
        items: cartItems,
        paymentMethod: action.paymentMethod,
        creditCustomerId: action.creditCustomerId,
        channel: 'app',
      });
      break;

    case 'log_credit_sale':
      await api.post('/transactions', {
        items: cartItems,
        paymentMethod: 'credit',
        creditCustomerId: action.customerId,
        channel: 'app',
      });
      break;

    case 'log_credit_payment':
      await api.post('/credits/payments', {
        customerId: action.customerId,
        amount: action.amount,
      });
      break;

    case 'show_stock':
      // Bot reply already contains the stock level — nothing to do in the UI
      break;
  }
}

export default function ChatScreen() {
  const [input, setInput] = useState('');
  const [messages, setMessages] = useState<Message[]>([
    {
      id: '1',
      text: 'Hello! I am Litro Bot. How can I help you today? You can say things like "add 2 cokes" or "what are our sales today?"',
      sender: 'bot',
      timestamp: new Date(),
    },
  ]);
  const [loading, setLoading] = useState(false);
  const flatListRef = useRef<FlatList>(null);
  const { cart, updateCart, clearCart } = useAppStore();

  const handleSend = async () => {
    if (!input.trim() || loading) return;

    const userMessage: Message = {
      id: Date.now().toString(),
      text: input,
      sender: 'user',
      timestamp: new Date(),
    };

    setMessages((prev) => [...prev, userMessage]);
    setInput('');
    setLoading(true);

    try {
      const response = await api.post<BotResponse>('/chat/message', {
        message: input,
        cart: cart,
      });

      const botMessage: Message = {
        id: (Date.now() + 1).toString(),
        text: response.reply,
        sender: 'bot',
        timestamp: new Date(),
      };

      setMessages((prev) => [...prev, botMessage]);

      // Snapshot the cart before any update — this is what gets submitted to the API
      const cartSnapshot = response.cartUpdate ?? cart;

      if (response.cartUpdate) {
        updateCart(response.cartUpdate);
      }

      if (response.action) {
        try {
          await executeBotAction(response.action, cartSnapshot);

          if (
            response.action.type === 'submit_transaction' ||
            response.action.type === 'log_credit_sale'
          ) {
            clearCart();
          }
        } catch (actionError: any) {
          setMessages((prev) => [
            ...prev,
            {
              id: (Date.now() + 2).toString(),
              text: `Hindi na-process ang order: ${actionError.message}`,
              sender: 'bot',
              timestamp: new Date(),
            },
          ]);
        }
      }
    } catch (error: any) {
      const errorMessage: Message = {
        id: (Date.now() + 1).toString(),
        text: `Sorry, I encountered an error: ${error.message}`,
        sender: 'bot',
        timestamp: new Date(),
      };
      setMessages((prev) => [...prev, errorMessage]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (messages.length > 0) {
      setTimeout(() => {
        flatListRef.current?.scrollToEnd({ animated: true });
      }, 100);
    }
  }, [messages]);

  const renderMessage = ({ item }: { item: Message }) => (
    <View
      style={[
        styles.messageBubble,
        item.sender === 'user' ? styles.userBubble : styles.botBubble,
      ]}
    >
      <Text
        style={[
          styles.messageText,
          item.sender === 'user' ? styles.userText : styles.botText,
        ]}
      >
        {item.text}
      </Text>
      <Text style={styles.timestamp}>
        {item.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
      </Text>
    </View>
  );

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.container}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}
      >
        <FlatList
          ref={flatListRef}
          data={messages}
          keyExtractor={(item) => item.id}
          renderItem={renderMessage}
          contentContainerStyle={styles.listContent}
        />

        <View style={styles.inputContainer}>
          <TextInput
            style={styles.input}
            placeholder="Type a message..."
            placeholderTextColor={colors.grey}
            value={input}
            onChangeText={setInput}
            multiline
          />
          <TouchableOpacity
            style={[styles.sendButton, !input.trim() && styles.disabledSend]}
            onPress={handleSend}
            disabled={!input.trim() || loading}
          >
            {loading ? (
              <ActivityIndicator color={colors.pale} size="small" />
            ) : (
              <Ionicons name="send" size={20} color={colors.pale} />
            )}
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.dark,
  },
  listContent: {
    padding: spacing.md,
    paddingBottom: spacing.xl,
  },
  messageBubble: {
    maxWidth: '80%',
    padding: spacing.md,
    borderRadius: 20,
    marginBottom: spacing.sm,
  },
  userBubble: {
    alignSelf: 'flex-end',
    backgroundColor: colors.green,
    borderBottomRightRadius: 4,
  },
  botBubble: {
    alignSelf: 'flex-start',
    backgroundColor: colors.ink,
    borderBottomLeftRadius: 4,
  },
  messageText: {
    fontSize: 16,
    lineHeight: 22,
  },
  userText: {
    color: colors.pale,
  },
  botText: {
    color: colors.pale,
  },
  timestamp: {
    fontSize: 10,
    color: 'rgba(255,255,255,0.4)',
    alignSelf: 'flex-end',
    marginTop: 4,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing.sm,
    backgroundColor: colors.ink,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.05)',
  },
  input: {
    flex: 1,
    backgroundColor: colors.dark,
    borderRadius: 20,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    color: colors.pale,
    fontSize: 16,
    maxHeight: 100,
  },
  sendButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.green,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: spacing.sm,
  },
  disabledSend: {
    backgroundColor: colors.grey,
    opacity: 0.5,
  },
});
