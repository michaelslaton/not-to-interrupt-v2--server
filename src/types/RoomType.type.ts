import { UserType } from "./UserType.type";

type NewRoomType = {
  userId: string;
  name: string;
}

type RoomType = {
  id: string;
  name: string;
  users: Omit<UserType, 'socketId'>[]
}

export type { RoomType, NewRoomType };