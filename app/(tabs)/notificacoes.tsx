// app/(tabs)/notificacoes.tsx

import Constants from "expo-constants";
import {
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";

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

import {
  SafeAreaView,
} from "react-native-safe-area-context";

import * as Storage from "../../backend/lib/storage";

/* =========================================================
   TIPOS
========================================================= */

type SavedNotif = {
  id: string;

  title?:
    | string
    | null;

  body?:
    | string
    | null;

  data?: Record<
    string,
    unknown
  >;

  receivedAt: number;
};

/* =========================================================
   CONFIG
========================================================= */

const STORAGE_KEY =
  "notifications_v1";

const MAX_ITEMS = 200;

const EXPO_GO =
  Constants.expoGoConfig != null;

/* =========================================================
   NOTIFICATIONS
========================================================= */

function getNotifications() {
  if (EXPO_GO) {
    return null;
  }

  try {
    return require(
      "expo-notifications"
    ) as typeof import(
      "expo-notifications"
    );
  } catch (error) {
    console.warn(
      "Não foi possível carregar expo-notifications:",
      error
    );

    return null;
  }
}

/* =========================================================
   STORAGE
========================================================= */

async function loadAll(): Promise<
  SavedNotif[]
> {
  try {
    const raw =
      await Storage.getItem(
        STORAGE_KEY
      );

    const parsed =
      raw
        ? JSON.parse(raw)
        : [];

    return Array.isArray(
      parsed
    )
      ? parsed
      : [];
  } catch {
    return [];
  }
}

async function saveAll(
  list: SavedNotif[]
) {
  const trimmed =
    [...list]
      .sort(
        (a, b) =>
          b.receivedAt -
          a.receivedAt
      )
      .slice(
        0,
        MAX_ITEMS
      );

  await Storage.setItem(
    STORAGE_KEY,
    JSON.stringify(trimmed)
  );
}

async function upsert(
  items:
    | SavedNotif
    | SavedNotif[]
) {
  const arr =
    Array.isArray(items)
      ? items
      : [items];

  const prev =
    await loadAll();

  const byId =
    new Map(
      prev.map((item) => [
        item.id,
        item,
      ])
    );

  arr.forEach((item) => {
    byId.set(
      item.id,
      item
    );
  });

  await saveAll(
    Array.from(
      byId.values()
    )
  );
}

async function clearAll() {
  await Storage.deleteItem(
    STORAGE_KEY
  );
}

/* =========================================================
   DATA DA NOTIFICAÇÃO
========================================================= */

function getReceivedAt(
  notification: any
): number {
  const anyDate =
    notification?.date;

  if (
    typeof anyDate ===
    "number"
  ) {
    return anyDate;
  }

  if (
    anyDate &&
    typeof anyDate.getTime ===
      "function"
  ) {
    return anyDate.getTime();
  }

  return Date.now();
}

/* =========================================================
   COMPONENTE
========================================================= */

export default function Notificacoes() {
  const [
    items,
    setItems,
  ] =
    useState<SavedNotif[]>(
      []
    );

  const [
    loading,
    setLoading,
  ] =
    useState(true);

  const [
    refreshing,
    setRefreshing,
  ] =
    useState(false);

  const [
    perm,
    setPerm,
  ] =
    useState<
      | "granted"
      | "denied"
      | "undetermined"
    >("undetermined");

  const seenIdsRef =
    useRef<Set<string>>(
      new Set()
    );

  /* =======================================================
     CANAL ANDROID
  ======================================================= */

  useEffect(() => {
    if (EXPO_GO) {
      return;
    }

    if (
      Platform.OS !==
      "android"
    ) {
      return;
    }

    const Notifications =
      getNotifications();

    if (!Notifications) {
      return;
    }

    Notifications
      .setNotificationChannelAsync(
        "default",
        {
          name:
            "Notificações",

          importance:
            Notifications
              .AndroidImportance
              .MAX,

          sound:
            "default",

          vibrationPattern: [
            0,
            250,
            250,
            250,
          ],

          lockscreenVisibility:
            Notifications
              .AndroidNotificationVisibility
              .PUBLIC,

          enableVibrate:
            true,

          showBadge:
            true,
        }
      )
      .catch(() => {});
  }, []);

  /* =======================================================
     STORAGE
  ======================================================= */

  const reloadFromStorage =
    useCallback(
      async () => {
        setLoading(true);

        try {
          const data =
            await loadAll();

          setItems(data);

          seenIdsRef.current =
            new Set(
              data.map(
                (item) =>
                  item.id
              )
            );
        } finally {
          setLoading(false);
        }
      },
      []
    );

  /* =======================================================
     SINCRONIZAR NOTIFICAÇÕES
  ======================================================= */

  const syncDelivered =
    useCallback(
      async () => {
        if (EXPO_GO) {
          return;
        }

        const Notifications =
          getNotifications();

        if (!Notifications) {
          return;
        }

        try {
          const delivered =
            await Notifications
              .getPresentedNotificationsAsync();

          if (
            !delivered?.length
          ) {
            return;
          }

          const toSave: SavedNotif[] =
            delivered.map(
              (notification) => {
                const {
                  request,
                } =
                  notification;

                const id =
                  request.identifier ??
                  String(
                    getReceivedAt(
                      notification
                    )
                  );

                return {
                  id,

                  title:
                    request
                      .content
                      .title,

                  body:
                    request
                      .content
                      .body,

                  data:
                    request
                      .content
                      .data as Record<
                      string,
                      unknown
                    >,

                  receivedAt:
                    getReceivedAt(
                      notification
                    ),
                };
              }
            );

          await upsert(
            toSave
          );

          const fresh =
            await loadAll();

          setItems(fresh);

          seenIdsRef.current =
            new Set(
              fresh.map(
                (item) =>
                  item.id
              )
            );
        } catch (error) {
          console.warn(
            "syncDelivered:",
            error
          );
        }
      },
      []
    );

  /* =======================================================
     INICIALIZAÇÃO
  ======================================================= */

  useEffect(() => {
    let mounted = true;

    async function iniciar() {
      await reloadFromStorage();

      if (!mounted) {
        return;
      }

      if (EXPO_GO) {
        return;
      }

      const Notifications =
        getNotifications();

      if (!Notifications) {
        return;
      }

      try {
        const {
          status,
        } =
          await Notifications
            .getPermissionsAsync();

        if (!mounted) {
          return;
        }

        setPerm(
          status as typeof perm
        );

        if (
          status ===
          "granted"
        ) {
          await syncDelivered();
        }
      } catch {}

      try {
        const last =
          await Notifications
            .getLastNotificationResponseAsync();

        if (
          !last?.notification
        ) {
          return;
        }

        const {
          request,
        } =
          last.notification;

        if (
          request.identifier &&
          seenIdsRef.current.has(
            request.identifier
          )
        ) {
          return;
        }

        const saved: SavedNotif =
          {
            id:
              request.identifier ??
              String(
                Date.now()
              ),

            title:
              request.content
                .title,

            body:
              request.content
                .body,

            data:
              request.content
                .data as Record<
                string,
                unknown
              >,

            receivedAt:
              getReceivedAt(
                last.notification
              ),
          };

        await upsert(
          saved
        );

        if (mounted) {
          setItems(
            await loadAll()
          );
        }
      } catch {}
    }

    iniciar();

    return () => {
      mounted = false;
    };
  }, [
    reloadFromStorage,
    syncDelivered,
  ]);

  /* =======================================================
     LISTENERS
  ======================================================= */

  useEffect(() => {
    if (EXPO_GO) {
      return;
    }

    const Notifications =
      getNotifications();

    if (!Notifications) {
      return;
    }

    const subReceive =
      Notifications
        .addNotificationReceivedListener(
          async (
            notification
          ) => {
            const {
              request,
            } =
              notification;

            if (
              request.identifier &&
              seenIdsRef.current.has(
                request.identifier
              )
            ) {
              return;
            }

            const saved: SavedNotif =
              {
                id:
                  request
                    .identifier ??
                  String(
                    Date.now()
                  ),

                title:
                  request.content
                    .title,

                body:
                  request.content
                    .body,

                data:
                  request.content
                    .data as Record<
                    string,
                    unknown
                  >,

                receivedAt:
                  getReceivedAt(
                    notification
                  ),
              };

            await upsert(
              saved
            );

            setItems(
              (prev) =>
                [
                  saved,
                  ...prev,
                ].slice(
                  0,
                  MAX_ITEMS
                )
            );

            if (
              request.identifier
            ) {
              seenIdsRef.current.add(
                request.identifier
              );
            }
          }
        );

    const subResponse =
      Notifications
        .addNotificationResponseReceivedListener(
          async (
            response
          ) => {
            const notification =
              response.notification;

            const {
              request,
            } =
              notification;

            if (
              request.identifier &&
              seenIdsRef.current.has(
                request.identifier
              )
            ) {
              return;
            }

            const saved: SavedNotif =
              {
                id:
                  request
                    .identifier ??
                  String(
                    Date.now()
                  ),

                title:
                  request.content
                    .title,

                body:
                  request.content
                    .body,

                data:
                  request.content
                    .data as Record<
                    string,
                    unknown
                  >,

                receivedAt:
                  getReceivedAt(
                    notification
                  ),
              };

            await upsert(
              saved
            );

            setItems(
              (prev) =>
                [
                  saved,
                  ...prev,
                ].slice(
                  0,
                  MAX_ITEMS
                )
            );

            if (
              request.identifier
            ) {
              seenIdsRef.current.add(
                request.identifier
              );
            }
          }
        );

    return () => {
      subReceive.remove();
      subResponse.remove();
    };
  }, []);

  /* =======================================================
     APP VOLTOU AO FOREGROUND
  ======================================================= */

  useEffect(() => {
    if (EXPO_GO) {
      return;
    }

    const sub =
      AppState.addEventListener(
        "change",
        (state) => {
          if (
            state ===
              "active" &&
            perm ===
              "granted"
          ) {
            syncDelivered()
              .catch(
                () => {}
              );
          }
        }
      );

    return () => {
      sub.remove();
    };
  }, [
    syncDelivered,
    perm,
  ]);

  /* =======================================================
     PEDIR PERMISSÃO
  ======================================================= */

  const requestPermission =
    useCallback(
      async () => {
        if (EXPO_GO) {
          Alert.alert(
            "Expo Go",
            "As notificações push remotas são testadas no Development Build do Meu Freteiro."
          );

          return;
        }

        const Notifications =
          getNotifications();

        if (!Notifications) {
          return;
        }

        try {
          const {
            status,
          } =
            Platform.OS ===
            "ios"
              ? await Notifications
                  .requestPermissionsAsync(
                    {
                      ios: {
                        allowAlert:
                          true,

                        allowBadge:
                          true,

                        allowSound:
                          true,
                      },
                    }
                  )
              : await Notifications
                  .requestPermissionsAsync();

          setPerm(
            status as typeof perm
          );

          if (
            status !==
            "granted"
          ) {
            Alert.alert(
              "Permissão negada",
              "Habilite as notificações nas configurações do sistema para receber alertas de novos fretes.",
              [
                {
                  text:
                    "Cancelar",

                  style:
                    "cancel",
                },

                {
                  text:
                    "Abrir Configurações",

                  onPress:
                    () =>
                      Linking.openSettings(),
                },
              ]
            );

            return;
          }

          await syncDelivered();

          Alert.alert(
            "Permissão concedida",
            "Tudo pronto para receber notificações!"
          );
        } catch (error) {
          console.warn(
            "requestPermission:",
            error
          );
        }
      },
      [syncDelivered]
    );

  /* =======================================================
     REFRESH
  ======================================================= */

  const onRefresh =
    useCallback(
      async () => {
        try {
          setRefreshing(
            true
          );

          if (
            !EXPO_GO &&
            perm ===
              "granted"
          ) {
            await syncDelivered();
          }

          setItems(
            await loadAll()
          );
        } finally {
          setRefreshing(
            false
          );
        }
      },
      [
        syncDelivered,
        perm,
      ]
    );

  /* =======================================================
     LIMPAR
  ======================================================= */

  const handleClear =
    useCallback(
      async () => {
        await clearAll();

        setItems([]);

        seenIdsRef.current
          .clear();

        if (EXPO_GO) {
          return;
        }

        const Notifications =
          getNotifications();

        if (!Notifications) {
          return;
        }

        try {
          await Notifications
            .dismissAllNotificationsAsync();
        } catch {}
      },
      []
    );

  /* =======================================================
     ITEM
  ======================================================= */

  const renderItem = ({
    item,
  }: {
    item: SavedNotif;
  }) => {
    const when =
      new Date(
        item.receivedAt
      ).toLocaleString(
        "pt-BR"
      );

    return (
      <View
        style={styles.card}
      >
        <Text
          style={
            styles.cardTitle
          }
        >
          {item.title ??
            "Notificação"}
        </Text>

        {!!item.body && (
          <Text
            style={
              styles.cardBody
            }
          >
            {item.body}
          </Text>
        )}

        <Text
          style={
            styles.cardMeta
          }
        >
          {when}
        </Text>
      </View>
    );
  };

  /* =======================================================
     UI
  ======================================================= */

  return (
    <SafeAreaView
      style={styles.safe}
      edges={[
        "top",
        "left",
        "right",
      ]}
    >
      <View
        style={styles.page}
      >
        <View
          style={
            styles.headerRow
          }
        >
          <Text
            style={
              styles.title
            }
          >
            🔔 Notificações
          </Text>

          {!EXPO_GO &&
            perm !==
              "granted" && (
              <TouchableOpacity
                style={
                  styles.permissionBtn
                }
                onPress={
                  requestPermission
                }
                activeOpacity={
                  0.9
                }
              >
                <Text
                  style={
                    styles.smallBtnText
                  }
                >
                  Permitir
                </Text>
              </TouchableOpacity>
            )}

          {items.length >
            0 && (
            <TouchableOpacity
              style={
                styles.clearBtn
              }
              onPress={
                handleClear
              }
              activeOpacity={
                0.9
              }
            >
              <Text
                style={
                  styles.smallBtnText
                }
              >
                Limpar
              </Text>
            </TouchableOpacity>
          )}
        </View>

        {EXPO_GO && (
          <View
            style={
              styles.devNotice
            }
          >
            <Text
              style={
                styles.devNoticeText
              }
            >
              No Expo Go, as
              notificações push
              remotas ficam
              desativadas. Elas
              continuam ativas no
              Development Build e
              no aplicativo de
              produção.
            </Text>
          </View>
        )}

        {loading ? (
          <View
            style={
              styles.center
            }
          >
            <ActivityIndicator />

            <Text
              style={
                styles.muted
              }
            >
              Carregando…
            </Text>
          </View>
        ) : items.length ===
          0 ? (
          <View
            style={
              styles.center
            }
          >
            <Text
              style={
                styles.muted
              }
            >
              Nenhuma notificação
              por enquanto.
            </Text>

            <Text
              style={
                styles.mutedSmall
              }
            >
              Assim que novos
              fretes forem
              publicados, elas
              aparecerão aqui.
            </Text>
          </View>
        ) : (
          <FlatList
            data={items}
            keyExtractor={(
              item
            ) => item.id}
            renderItem={
              renderItem
            }
            contentContainerStyle={{
              paddingBottom: 16,
            }}
            refreshControl={
              <RefreshControl
                refreshing={
                  refreshing
                }
                onRefresh={
                  onRefresh
                }
              />
            }
          />
        )}
      </View>
    </SafeAreaView>
  );
}

/* =========================================================
   ESTILOS
========================================================= */

const styles =
  StyleSheet.create({
    safe: {
      flex: 1,
      backgroundColor:
        "#F9FAFB",
    },

    page: {
      flex: 1,
      padding: 16,
      paddingTop: 8,
    },

    headerRow: {
      flexDirection:
        "row",

      alignItems:
        "center",

      gap: 8,

      marginBottom: 8,
    },

    title: {
      fontSize: 20,
      fontWeight: "800",
      color: "#111827",
      flex: 1,
    },

    permissionBtn: {
      paddingHorizontal: 10,
      paddingVertical: 6,
      borderRadius: 8,
      backgroundColor:
        "#FACC15",
    },

    clearBtn: {
      paddingHorizontal: 10,
      paddingVertical: 6,
      borderRadius: 8,
      backgroundColor:
        "#EF4444",
    },

    smallBtnText: {
      color: "#111827",
      fontWeight: "700",
    },

    devNotice: {
      backgroundColor:
        "#FEFCE8",

      borderWidth: 1,

      borderColor:
        "#FACC15",

      borderRadius: 10,

      padding: 10,

      marginBottom: 10,
    },

    devNoticeText: {
      color: "#713F12",
      fontSize: 12,
      lineHeight: 17,
    },

    muted: {
      color: "#6B7280",
    },

    mutedSmall: {
      color: "#9CA3AF",
      marginTop: 4,
      fontSize: 12,
      textAlign: "center",
    },

    center: {
      flex: 1,
      alignItems:
        "center",
      justifyContent:
        "center",
      gap: 8,
    },

    card: {
      backgroundColor:
        "#FFFFFF",

      borderRadius: 12,

      padding: 12,

      borderWidth: 1,

      borderColor:
        "#E5E7EB",

      marginBottom: 10,
    },

    cardTitle: {
      fontSize: 16,
      fontWeight: "700",
      color: "#111827",
      marginBottom: 4,
    },

    cardBody: {
      color: "#374151",
      marginBottom: 6,
    },

    cardMeta: {
      color: "#6B7280",
      fontSize: 12,
    },
  });