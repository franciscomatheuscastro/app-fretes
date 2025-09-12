// app/(tabs)/_layout.tsx
import { Ionicons } from "@expo/vector-icons";
import { Tabs, useRouter } from "expo-router";
import { useEffect, useState } from "react";
import { ActivityIndicator, View } from "react-native";
import * as Storage from "../backend/lib/storage"; // ⬅️ usa o wrapper (funciona iOS/Android/Web)

export default function TabsLayout() {
  const router = useRouter();
  const [ready, setReady] = useState(false);

  // Gate simples: se não houver token, manda pro login (/)
  useEffect(() => {
    (async () => {
      const token = await Storage.getItem("authToken");
      const role  = await Storage.getItem("userRole");
      if (!token || role !== "caminhoneiro") {
        router.replace("/"); // sua tela de login
        return;
      }
      setReady(true);
    })();
  }, []);

  if (!ready) {
    return (
      <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
        <ActivityIndicator />
      </View>
    );
  }

  return (
    <Tabs
      initialRouteName="home" // ⬅️ abre na Home por padrão
      screenOptions={{
        headerTitle: "",
        tabBarActiveTintColor: "#ea580c",
        tabBarInactiveTintColor: "#6b7280",
        tabBarStyle: {
          borderTopWidth: 1,
          borderTopColor: "#e5e7eb",
          backgroundColor: "#fff",
        },
      }}
    >
      {/* 🏠 HOME (novo) — precisa existir app/(tabs)/home.tsx */}
      <Tabs.Screen
        name="home"
        options={{
          title: "Home",
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="home-outline" size={size} color={color} />
          ),
        }}
      />

      <Tabs.Screen
        name="fretes"
        options={{
          title: "Fretes",
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="cube-outline" size={size} color={color} />
          ),
        }}
      />

      <Tabs.Screen
        name="explore"
        options={{
          title: "Explorar",
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="map-outline" size={size} color={color} />
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
