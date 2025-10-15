// app/(tabs)/notificacoes.tsx
import * as Notifications from "expo-notifications";
import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  AppState,
  FlatList,
  Linking,
  Platform,
  RefreshControl,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import * as Storage from "../../backend/lib/storage";

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

type SavedNotif = {
  id: string;
  title?: string | null;
  body?: string | null;
  data?: Record<string, unknown>;
  receivedAt: number;
};

const STORAGE_KEY = "notifications_v1";
const MAX_ITEMS = 200;

// ---------- persistência ----------
async function loadAll(): Promise<SavedNotif[]> {
  try {
    const raw = await Storage.getItem(STORAGE_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}
async function saveAll(list: SavedNotif[]) {
  const trimmed = list.sort((a, b) => b.receivedAt - a.receivedAt).slice(0, MAX_ITEMS);
  await Storage.setItem(STORAGE_KEY, JSON.stringify(trimmed));
}
async function upsert(items: SavedNotif | SavedNotif[]) {
  const arr = Array.isArray(items) ? items : [items];
  const prev = await loadAll();
  const byId = new Map(prev.map((i) => [i.id, i]));
  arr.forEach((i) => byId.set(i.id, i));
  await saveAll(Array.from(byId.values()));
}
async function clearAll() {
  await Storage.deleteItem(STORAGE_KEY);
}

function getReceivedAt(n: Notifications.Notification): number {
  const anyDate: unknown = (n as any).date;
  if (typeof anyDate === "number") return anyDate;
  if (anyDate && typeof (anyDate as Date).getTime === "function") return (anyDate as Date).getTime();
  return Date.now();
}

export default function Notificacoes() {
  const insets = useSafeAreaInsets();

  const [items, setItems] = useState<SavedNotif[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [perm, setPerm] = useState<"granted" | "denied" | "undetermined">("undetermined");

  const seenIdsRef = useRef<Set<string>>(new Set());

  // Canal Android (defensivo)
  useEffect(() => {
    if (Platform.OS !== "android") return;
    Notifications.setNotificationChannelAsync("default", {
      name: "Notificações",
      importance: Notifications.AndroidImportance.MAX,
      sound: "default",
      vibrationPattern: [0, 250, 250, 250],
      lockscreenVisibility: Notifications.AndroidNotificationVisibility.PUBLIC,
      enableVibrate: true,
      showBadge: true,
    }).catch(() => {});
  }, []);

  const reloadFromStorage = useCallback(async () => {
    setLoading(true);
    try {
      const data = await loadAll();
      setItems(data);
      seenIdsRef.current = new Set(data.map((d) => d.id));
    } finally {
      setLoading(false);
    }
  }, []);

  // Importa notificações apresentadas na bandeja (quando possível)
  const syncDelivered = useCallback(async () => {
    try {
      const delivered = await Notifications.getPresentedNotificationsAsync();
      if (!delivered?.length) return;
      const toSave: SavedNotif[] = delivered.map((n) => {
        const { request } = n;
        const id = request.identifier ?? `${getReceivedAt(n)}`;
        return {
          id,
          title: request.content.title,
          body: request.content.body,
          data: request.content.data as Record<string, unknown>,
          receivedAt: getReceivedAt(n),
        };
      });
      await upsert(toSave);
      const fresh = await loadAll();
      setItems(fresh);
      seenIdsRef.current = new Set(fresh.map((d) => d.id));
    } catch (e) {
      console.warn("syncDelivered:", e);
    }
  }, []);

  // Carrega do storage e checa permissão inicial
  useEffect(() => {
    (async () => {
      await reloadFromStorage();
      try {
        const { status } = await Notifications.getPermissionsAsync();
        setPerm(status as typeof perm);
        if (status === "granted") {
          await syncDelivered();
        }
      } catch {}
      // Último "tap" (caso o usuário tenha clicado na bandeja)
      try {
        const last = await Notifications.getLastNotificationResponseAsync();
        if (last?.notification) {
          const { request } = last.notification;
          if (request.identifier && seenIdsRef.current.has(request.identifier)) return;
          const saved: SavedNotif = {
            id: request.identifier ?? String(Date.now()),
            title: request.content.title,
            body: request.content.body,
            data: request.content.data as Record<string, unknown>,
            receivedAt: getReceivedAt(last.notification),
          };
          await upsert(saved);
          setItems(await loadAll());
        }
      } catch {}
    })();
  }, [reloadFromStorage, syncDelivered]);

  // Listeners (foreground receive + tap)
  useEffect(() => {
    const subReceive = Notifications.addNotificationReceivedListener(async (n) => {
      const { request } = n;
      if (request.identifier && seenIdsRef.current.has(request.identifier)) return;
      const saved: SavedNotif = {
        id: request.identifier ?? String(Date.now()),
        title: request.content.title,
        body: request.content.body,
        data: request.content.data as Record<string, unknown>,
        receivedAt: getReceivedAt(n),
      };
      await upsert(saved);
      setItems((prev) => [saved, ...prev].slice(0, MAX_ITEMS));
      if (request.identifier) seenIdsRef.current.add(request.identifier);
    });

    const subResponse = Notifications.addNotificationResponseReceivedListener(async (resp) => {
      const n = resp.notification;
      const { request } = n;
      if (request.identifier && seenIdsRef.current.has(request.identifier)) return;
      const saved: SavedNotif = {
        id: request.identifier ?? String(Date.now()),
        title: request.content.title,
        body: request.content.body,
        data: request.content.data as Record<string, unknown>,
        receivedAt: getReceivedAt(n),
      };
      await upsert(saved);
      setItems((prev) => [saved, ...prev].slice(0, MAX_ITEMS));
      if (request.identifier) seenIdsRef.current.add(request.identifier);
    });

    return () => {
      subReceive.remove();
      subResponse.remove();
    };
  }, []);

  // Ao voltar ao foreground, sincroniza o que ficou na bandeja
  useEffect(() => {
    const sub = AppState.addEventListener("change", (state) => {
      if (state === "active" && perm === "granted") {
        syncDelivered().catch(() => {});
      }
    });
    return () => sub.remove();
  }, [syncDelivered, perm]);

  // Pedir permissão (só quando usuário tocar no botão)
  const requestPermission = useCallback(async () => {
    try {
      const { status } =
        Platform.OS === "ios"
          ? await Notifications.requestPermissionsAsync({
              ios: { allowAlert: true, allowBadge: true, allowSound: true },
            })
          : await Notifications.requestPermissionsAsync();

      setPerm(status as typeof perm);

      if (status !== "granted") {
        Alert.alert(
          "Permissão negada",
          "Habilite as notificações nas configurações do sistema para receber alertas de novos fretes.",
          [
            { text: "Cancelar", style: "cancel" },
            { text: "Abrir Configurações", onPress: () => Linking.openSettings() },
          ]
        );
      } else {
        await syncDelivered();
        Alert.alert("Permissão concedida", "Tudo pronto para receber notificações!");
      }
    } catch (e) {
      console.warn("requestPermission:", e);
    }
  }, [syncDelivered]);

  const onRefresh = useCallback(async () => {
    try {
      setRefreshing(true);
      if (perm === "granted") {
        await syncDelivered();
      }
      setItems(await loadAll());
    } finally {
      setRefreshing(false);
    }
  }, [syncDelivered, perm]);

  const handleClear = useCallback(async () => {
    await clearAll();
    setItems([]);
    seenIdsRef.current.clear();
    try {
      await Notifications.dismissAllNotificationsAsync();
    } catch {}
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
    <SafeAreaView style={styles.safe} edges={["top", "left", "right"]}>
      <View style={[styles.page, { paddingTop: (insets.top ?? 0) + 8 }]}>
        <View style={styles.headerRow}>
          <Text style={styles.title}>🔔 Notificações</Text>

          {/* Botão só aparece se a permissão não estiver concedida */}
          {perm !== "granted" && (
            <TouchableOpacity
              style={[styles.smallBtn, { backgroundColor: "#2563eb" }]}
              onPress={requestPermission}
            >
              <Text style={styles.smallBtnText}>Permitir</Text>
            </TouchableOpacity>
          )}

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
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: "#f9fafb" },
  page: { flex: 1, padding: 16 },
  headerRow: { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 8 },
  title: { fontSize: 20, fontWeight: "800", color: "#111827", flex: 1 },
  smallBtn: { paddingHorizontal: 10, paddingVertical: 6, borderRadius: 8 },
  smallBtnText: { color: "#fff", fontWeight: "700" },
  muted: { color: "#6b7280" },
  mutedSmall: { color: "#9ca3af", marginTop: 4, fontSize: 12 },
  center: { flex: 1, alignItems: "center", justifyContent: "center", gap: 8 },
  card: { backgroundColor: "#fff", borderRadius: 12, padding: 12, borderWidth: 1, borderColor: "#e5e7eb", marginBottom: 10 },
  cardTitle: { fontSize: 16, fontWeight: "700", color: "#111827", marginBottom: 4 },
  cardBody: { color: "#374151", marginBottom: 6 },
  cardMeta: { color: "#6b7280", fontSize: 12 },
});
