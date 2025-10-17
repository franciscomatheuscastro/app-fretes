import { Ionicons } from "@expo/vector-icons";
import { Tabs, useRouter } from "expo-router";
import { useEffect, useState } from "react";
import { ActivityIndicator, View } from "react-native";
import * as Storage from "../../backend/lib/storage";

export default function TabsLayout() {
  const router = useRouter();
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const [token, role] = await Promise.all([
          Storage.getItem("authToken"),
          Storage.getItem("userRole"),
        ]);
        if (!token || role !== "caminhoneiro") {
          router.replace("/");
          return;
        }
        if (mounted) setReady(true);
      } catch {
        router.replace("/");
      }
    })();
    return () => {
      mounted = false;
    };
  }, [router]);

  if (!ready) {
    return (
      <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
        <ActivityIndicator />
      </View>
    );
  }

  return (
    <Tabs
      initialRouteName="fretes" // ← Fretes vira a “home” das tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: "#ea580c",
        tabBarInactiveTintColor: "#6b7280",
        tabBarStyle: { borderTopWidth: 1, borderTopColor: "#e5e7eb", backgroundColor: "#fff" },
      }}
    >
      

      <Tabs.Screen
        name="fretes"
        options={{
          title: "Home",
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="home-outline" size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="notificacoes"
        options={{
          title: "Notificações",
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="notifications-outline" size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="ajuda"
        options={{
          title: "Ajuda",
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="help-buoy-outline" size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="perfil"
        options={{
          title: "Perfil",
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="person-outline" size={size} color={color} />
          ),
        }}
      />


    </Tabs>
  );
}
