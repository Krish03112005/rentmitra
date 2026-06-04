import { Ionicons } from "@expo/vector-icons";
import { Image, Modal, Text, TouchableOpacity, View } from "react-native";

export interface ImageViewerProps {
  images: { uri: string }[];
  imageIndex: number;
  visible: boolean;
  onRequestClose: () => void;
}

export default function ImageViewer({
  images,
  imageIndex,
  visible,
  onRequestClose,
}: ImageViewerProps) {
  const image = images[imageIndex];

  if (!visible || !image) return null;

  return (
    <Modal
      transparent
      animationType="fade"
      visible={visible}
      onRequestClose={onRequestClose}
    >
      <View className="flex-1 bg-black/95 items-center justify-center px-4">
        <TouchableOpacity
          onPress={onRequestClose}
          className="absolute top-12 right-5 w-10 h-10 rounded-full bg-white/15 items-center justify-center"
        >
          <Ionicons name="close" size={24} color="white" />
        </TouchableOpacity>

        <Image
          source={{ uri: image.uri }}
          className="w-full max-w-5xl rounded-xl"
          style={{ height: "80%", resizeMode: "contain" }}
        />

        <Text className="mt-4 text-white/70 text-sm">
          {imageIndex + 1}/{images.length}
        </Text>
      </View>
    </Modal>
  );
}
