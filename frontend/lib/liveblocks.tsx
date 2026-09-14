"use client";
import { LiveblocksProvider, RoomProvider as BaseRoomProvider } from "@liveblocks/react";
import type { ComponentProps } from "react";
import { authorizePrivateRoom } from "@/lib/crimelens-api";
import { useInvestigationStore } from "@/store/use-investigation-store";
export { useBroadcastEvent, useEventListener, useMutation, useOthers, useStatus, useUpdateMyPresence } from "@liveblocks/react";
export { useStorage } from "@liveblocks/react/suspense";
export function formatCaseName(value: string) {
  return value.trim().toLowerCase().replace(/\s+/g,"-").replace(/[^a-z0-9_-]/g,"").replace(/-+/g,"-");
}
const defaultPublicApiKey =
  "pk_dev_Tpjzr1_Gzo4_apRD2ip80XJC5uOe_KcW7V0nfUDXIz__w5UYXawRsQWtKMNpUp2C";

const publicApiKey =
  process.env.NEXT_PUBLIC_LIVEBLOCKS_PUBLIC_KEY?.trim() || defaultPublicApiKey;


export const isLiveblocksConfigured = Boolean(publicApiKey);
export const privateCollaborationEnabled = process.env.NEXT_PUBLIC_PRIVATE_COLLABORATION_ENABLED === "true";
async function privateAuth(room?: string) {
  if (!room) throw new Error("Room required");
  const investigationId = useInvestigationStore.getState().activeInvestigationId;
  return authorizePrivateRoom(investigationId, room);
}
export function RoomProvider(props: ComponentProps<typeof BaseRoomProvider>) {
  const isPrivate = props.id.startsWith("private-board-");
  return isPrivate ? <LiveblocksProvider authEndpoint={privateAuth}><BaseRoomProvider {...props}/></LiveblocksProvider> : <LiveblocksProvider publicApiKey={publicApiKey}><BaseRoomProvider {...props}/></LiveblocksProvider>;
}
