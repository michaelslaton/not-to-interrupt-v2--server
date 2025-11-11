import { PublicUserType, UserType } from "./UserType.type";

type NewRoomType = {
  userId: string;
  name: string;
}

type RoomType = {
  id: string;
  name: string;
  users: PublicUserType[]
}

export type { RoomType, NewRoomType };