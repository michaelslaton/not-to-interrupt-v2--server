import type { PublicUserType } from "./UserType.type";

type ChatEntryType = {
  user: PublicUserType;
  message: string;
  timeStamp: Date;
}

type ChatIncomingType = {
  roomId: string;
  user: string;
  message: string;
}

export type { ChatEntryType, ChatIncomingType };