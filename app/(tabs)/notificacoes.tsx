// app/(tabs)/notificacoes.tsx
import * as Notifications from "expo-notifications";
import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Platform,
  RefreshControl,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import * as Storage from "../backend/lib/storage";

type SavedNotif = {
  id: string;
  title?: string | null;
  body?: string | null;
  data?: Record<string, unknown>;
  receivedAt: number; // epoch ms
};

const STORAGE_KEY = "notifications:v1";

// ---------- helpers de persistência ----------
async function loadAll(): Promise<SavedNotif[]> {
  try {
    const raw = await Storage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

async function saveAll(list: SavedNotif[]) {
  const trimmed = list.slice(0, 200);
  await Storage.setItem(STORAGE_KEY, JSON.stringify(trimmed));
}

async function saveOne(item: SavedNotif) {
  const prev = await loadAll();
  const next = [item, ...prev].slice(0, 200);
  await saveAll(next);
}

async function clearAll() {
  await Storage.deleteItem(STORAGE_KEY);
}

// ---------- compat: date pode vir como number ou Date ----------
function getReceivedAt(n: Notifications.Notification): number {
  const anyDate: unknown = (n as any).date;
  if (typeof anyDate === "number") return anyDate;
  if (anyDate && typeof (anyDate as Date).getTime === "function") {
    return (anyDate as Date).getTime();
  }
  return Date.now();
}

export default function Notificacoes() {
  const [items, setItems] = useState<SavedNotif[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // evita duplicados entre listeners
  const seenIdsRef = useRef<Set<string>>(new Set());

  const load = useCallback(async () => {
    try {
      setLoading(true);
      const data = await loadAll();
      setItems(data);
    } finally {
      setLoading(false);
    }
  }, []);

  const onRefresh = useCallback(async () => {
    try {
      setRefreshing(true);
      const data = await loadAll();
      setItems(data);
    } finally {
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    (async () => {
      await load();

      try {
        const last = await Notifications.getLastNotificationResponseAsync();
        if (last?.notification) {
          const { request } = last.notification;
          const content = request.content;

          if (request.identifier && seenIdsRef.current.has(request.identifier)) return;
          if (request.identifier) seenIdsRef.current.add(request.identifier);

          const saved: SavedNotif = {
            id: request.identifier ?? String(Date.now()),
            title: content.title,
            body: content.body,
            data: content.data as Record<string, unknown>,
            receivedAt: getReceivedAt(last.notification),
          };

          await saveOne(saved);
          setItems((prev) => [saved, ...prev]);
        }
      } catch {}
    })();
  }, [load]);

  useEffect(() => {
    const subReceive = Notifications.addNotificationReceivedListener(async (n) => {
      const { request } = n;
      const content = request.content;

      if (request.identifier && seenIdsRef.current.has(request.identifier)) return;
      if (request.identifier) seenIdsRef.current.add(request.identifier);

      const saved: SavedNotif = {
        id: request.identifier ?? String(Date.now()),
        title: content.title,
        body: content.body,
        data: content.data as Record<string, unknown>,
        receivedAt: getReceivedAt(n),
      };

      await saveOne(saved);
      setItems((prev) => [saved, ...prev]);
    });

    const subResponse = Notifications.addNotificationResponseReceivedListener(async (resp) => {
      const n = resp.notification;
      const { request } = n;
      const content = request.content;

      if (request.identifier && seenIdsRef.current.has(request.identifier)) return;
      if (request.identifier) seenIdsRef.current.add(request.identifier);

      const saved: SavedNotif = {
        id: request.identifier ?? String(Date.now()),
        title: content.title,
        body: content.body,
        data: content.data as Record<string, unknown>,
        receivedAt: getReceivedAt(n),
      };

      await saveOne(saved);
      setItems((prev) => [saved, ...prev]);
    });

    return () => {
      subReceive.remove();
      subResponse.remove();
    };
  }, []);

  const handleClear = useCallback(async () => {
    await clearAll();
    setItems([]);
    seenIdsRef.current.clear();
  }, []);

  // ✅ Permissão sem chaves não suportadas
  const requestPermission = useCallback(async () => {
    try {
      const { status } =
        Platform.OS === "ios"
          ? await Notifications.requestPermissionsAsync({
              ios: {
                allowAlert: true,
                allowBadge: true,
                allowSound: true,
                // allowProvisional: true,      // opcional (se quiser)
                // allowCriticalAlerts: true,   // requer entitlement Apple
              },
            })
          : await Notifications.requestPermissionsAsync(); // Android ignora opções iOS

      if (status !== "granted") {
        Alert.alert(
          "Permissão negada",
          "Habilite as notificações nas configurações do sistema para receber alertas de novos fretes."
        );
      } else {
        Alert.alert("Permissão concedida", "Tudo pronto para receber notificações!");
      }
    } catch (e) {
      console.warn("Falha ao solicitar permissão:", e);
    }
  }, []);

  const sendLocalTest = useCallback(async () => {
    try {
      const perms = await Notifications.getPermissionsAsync();
      if (Platform.OS === "ios" && perms.status !== "granted") {
        Alert.alert("Permissão necessária", "Autorize as notificações primeiro.");
        return;
      }
      await Notifications.scheduleNotificationAsync({
        content: {
          title: "🚛 Novo frete disponível",
          body: "Cidade A → Cidade B • Produto teste",
          data: { type: "frete_novo", freteId: "teste123" },
          sound: "default",
        },
        trigger: null,
      });
    } catch (e) {
      console.warn("Falha ao enviar notificação local:", e);
    }
  }, []);

  const renderItem = ({ item }: { item: SavedNotif }) => {
    const when = new Date(item.receivedAt).toLocaleString("pt-BR");
    return (
      <View style={styles.card}>
        <Text style={styles.cardTitle}>{item.title ?? "Notificação"}</Text>
        {!!item.body && <Text style={styles.cardBody}>{item.body}</Text>}
        <Text style={styles.cardMeta}>{when}</Text>
      </View>
    );
  };

  return (
    <View style={styles.page}>
      <View style={styles.headerRow}>
        <Text style={styles.title}>🔔 Notificações</Text>

        <TouchableOpacity
          style={[styles.smallBtn, { backgroundColor: "#2563eb" }]}
          onPress={requestPermission}
        >
          <Text style={styles.smallBtnText}>Permitir</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.smallBtn, { backgroundColor: "#16a34a" }]}
          onPress={sendLocalTest}
        >
          <Text style={styles.smallBtnText}>Testar</Text>
        </TouchableOpacity>

        {items.length > 0 && (
          <TouchableOpacity
            style={[styles.smallBtn, { backgroundColor: "#ef4444" }]}
            onPress={handleClear}
          >
            <Text style={styles.smallBtnText}>Limpar</Text>
          </TouchableOpacity>
        )}
      </View>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator />
          <Text style={styles.muted}>Carregando…</Text>
        </View>
      ) : items.length === 0 ? (
        <View style={styles.center}>
          <Text style={styles.muted}>Nenhuma notificação por enquanto.</Text>
          <Text style={styles.mutedSmall}>
            Assim que novos fretes forem publicados, elas aparecerão aqui.
          </Text>
        </View>
      ) : (
        <FlatList
          data={items}
          keyExtractor={(it) => it.id}
          renderItem={renderItem}
          contentContainerStyle={{ paddingBottom: 16 }}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1, padding: 16, backgroundColor: "#f9fafb" },
  headerRow: { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 8 },
  title: { fontSize: 20, fontWeight: "800", color: "#111827", flex: 1 },
  smallBtn: { paddingHorizontal: 10, paddingVertical: 6, borderRadius: 8 },
  smallBtnText: { color: "#fff", fontWeight: "700" },
  muted: { color: "#6b7280" },
  mutedSmall: { color: "#9ca3af", marginTop: 4, fontSize: 12 },
  center: { flex: 1, alignItems: "center", justifyContent: "center", gap: 8 },
  card: {
    backgroundColor: "#fff",
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: "#e5e7eb",
    marginBottom: 10,
  },
  cardTitle: { fontSize: 16, fontWeight: "700", color: "#111827", marginBottom: 4 },
  cardBody: { color: "#374151", marginBottom: 6 },
  cardMeta: { color: "#6b7280", fontSize: 12 },
});
