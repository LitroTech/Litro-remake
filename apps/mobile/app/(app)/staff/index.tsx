import { useState } from 'react'
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Modal,
  Pressable,
  Alert,
} from 'react-native'
import { router } from 'expo-router'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Ionicons } from '@expo/vector-icons'
import { Screen } from '../../../src/components/ui/Screen'
import { api } from '../../../src/lib/api'
import { useAuth, useLanguage } from '../../../src/lib/store'
import { colors } from '../../../src/constants/theme'
import type { StaffMember } from '@litro/types'

function initials(name: string) {
  return name
    .split(' ')
    .map((w) => w[0])
    .slice(0, 2)
    .join('')
    .toUpperCase()
}

export default function StaffScreen() {
  const language = useLanguage()
  const auth = useAuth()
  const queryClient = useQueryClient()
  const tl = language === 'tl'
  const isOwner = auth?.role === 'owner'

  const [selected, setSelected] = useState<StaffMember | null>(null)

  const { data: staff = [], isLoading } = useQuery<StaffMember[]>({
    queryKey: ['staff'],
    queryFn: () => api.get<StaffMember[]>('/staff'),
  })

  const removeMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/staff/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['staff'] })
      setSelected(null)
    },
  })

  const confirmRemove = (member: StaffMember) => {
    Alert.alert(
      tl ? 'Alisin ang staff?' : 'Remove staff member?',
      tl
        ? `Aalisin si ${member.name}. Hindi siya makakabalik gamit ang parehong access code.`
        : `${member.name} will be removed. They won't be able to access the store with the same code.`,
      [
        { text: tl ? 'Kanselahin' : 'Cancel', style: 'cancel' },
        {
          text: tl ? 'Alisin' : 'Remove',
          style: 'destructive',
          onPress: () => removeMutation.mutate(member.id),
        },
      ]
    )
  }

  const renderItem = ({ item }: { item: StaffMember }) => (
    <TouchableOpacity
      style={styles.card}
      onPress={() => isOwner && setSelected(item)}
      activeOpacity={isOwner ? 0.75 : 1}
    >
      <View style={styles.avatar}>
        <Text style={styles.avatarText}>{initials(item.name)}</Text>
      </View>
      <View style={styles.cardInfo}>
        <Text style={styles.cardName}>{item.name}</Text>
        <Text style={styles.cardRole}>
          {item.role === 'owner' ? (tl ? 'May-ari' : 'Owner') : (tl ? 'Staff' : 'Staff')}
          {item.messengerPsid && ' · Messenger'}
        </Text>
      </View>
      {isOwner && item.role !== 'owner' && (
        <Ionicons name="chevron-forward" size={16} color={colors.grey} />
      )}
    </TouchableOpacity>
  )

  return (
    <Screen>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} hitSlop={12}>
          <Ionicons name="arrow-back" size={24} color={colors.pale} />
        </TouchableOpacity>
        <Text style={styles.title}>{tl ? 'Mga Staff' : 'Staff'}</Text>
        <View style={{ width: 36 }} />
      </View>

      {isOwner && (
        <View style={styles.infoCard}>
          <Ionicons name="information-circle-outline" size={16} color={colors.grey} />
          <Text style={styles.infoText}>
            {tl
              ? 'Ibigay ang access code sa mga staff para makapasok sa tindahan.'
              : 'Share the access code with staff to let them in.'}
          </Text>
        </View>
      )}

      {isLoading ? (
        <View style={styles.center}>
          <ActivityIndicator color={colors.green} />
        </View>
      ) : (
        <FlatList
          data={staff}
          keyExtractor={(s) => s.id}
          renderItem={renderItem}
          contentContainerStyle={styles.list}
          showsVerticalScrollIndicator={false}
        />
      )}

      {/* Staff detail modal */}
      <Modal
        transparent
        visible={!!selected}
        animationType="slide"
        onRequestClose={() => setSelected(null)}
      >
        <Pressable style={styles.overlay} onPress={() => setSelected(null)}>
          <Pressable style={styles.sheet} onPress={() => {}}>
            {selected && (
              <>
                <View style={styles.sheetHeader}>
                  <Text style={styles.sheetTitle}>{selected.name}</Text>
                  <TouchableOpacity onPress={() => setSelected(null)}>
                    <Ionicons name="close" size={22} color={colors.grey} />
                  </TouchableOpacity>
                </View>
                <Text style={styles.sheetSub}>
                  {tl ? 'Sumali: ' : 'Joined: '}
                  {selected.createdAt
                    ? new Date(selected.createdAt).toLocaleDateString('en-PH', {
                        year: 'numeric',
                        month: 'long',
                        day: 'numeric',
                      })
                    : '—'}
                </Text>
                {selected.messengerPsid && (
                  <View style={styles.messengerTag}>
                    <Ionicons name="logo-facebook" size={14} color="#3B82F6" />
                    <Text style={styles.messengerTagText}>
                      {tl ? 'Naka-link sa Messenger' : 'Linked via Messenger'}
                    </Text>
                  </View>
                )}
                <TouchableOpacity
                  style={styles.removeBtn}
                  onPress={() => {
                    setSelected(null)
                    confirmRemove(selected)
                  }}
                  disabled={removeMutation.isPending}
                >
                  <Text style={styles.removeBtnLabel}>
                    {tl ? 'Alisin ang staff' : 'Remove staff member'}
                  </Text>
                </TouchableOpacity>
              </>
            )}
          </Pressable>
        </Pressable>
      </Modal>
    </Screen>
  )
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingTop: 12,
    paddingBottom: 12,
    gap: 12,
  },
  title: {
    flex: 1,
    fontFamily: 'BricolageGrotesque-Bold',
    fontSize: 20,
    color: colors.pale,
  },
  infoCard: {
    flexDirection: 'row',
    gap: 8,
    backgroundColor: '#0D1F1A',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#1A3530',
    padding: 12,
    marginBottom: 16,
    alignItems: 'flex-start',
  },
  infoText: {
    flex: 1,
    fontFamily: 'DMSans-Regular',
    fontSize: 13,
    color: colors.grey,
    lineHeight: 19,
  },
  list: { gap: 10, paddingBottom: 32 },
  card: {
    backgroundColor: '#0D1F1A',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#1A3530',
    padding: 14,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#1A3530',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    fontFamily: 'BricolageGrotesque-Bold',
    fontSize: 14,
    color: colors.green,
  },
  cardInfo: { flex: 1 },
  cardName: {
    fontFamily: 'DMSans-Medium',
    fontSize: 15,
    color: colors.pale,
  },
  cardRole: {
    fontFamily: 'DMSans-Regular',
    fontSize: 13,
    color: colors.grey,
  },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(7,24,18,0.7)',
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: '#0D1F1A',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 24,
    paddingBottom: 48,
    gap: 12,
  },
  sheetHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  sheetTitle: {
    fontFamily: 'BricolageGrotesque-Bold',
    fontSize: 20,
    color: colors.pale,
  },
  sheetSub: {
    fontFamily: 'DMSans-Regular',
    fontSize: 14,
    color: colors.grey,
  },
  messengerTag: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 4,
  },
  messengerTagText: {
    fontFamily: 'DMSans-Regular',
    fontSize: 13,
    color: '#3B82F6',
  },
  removeBtn: {
    marginTop: 12,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: '#D94F4F',
    paddingVertical: 14,
    alignItems: 'center',
  },
  removeBtnLabel: {
    fontFamily: 'DMSans-Medium',
    fontSize: 15,
    color: '#D94F4F',
  },
})
