// components/HapticTab.tsx

import * as Haptics from "expo-haptics";
import type { BottomTabBarButtonProps } from "expo-router/js-tabs";
import { PlatformPressable } from "expo-router/react-navigation";

export function HapticTab(
  props: BottomTabBarButtonProps
) {
  return (
    <PlatformPressable
      {...props}
      onPressIn={(ev) => {
        if (process.env.EXPO_OS === "ios") {
          // Feedback tátil suave ao pressionar uma aba.
          Haptics.impactAsync(
            Haptics.ImpactFeedbackStyle.Light
          );
        }

        props.onPressIn?.(ev);
      }}
    />
  );
}