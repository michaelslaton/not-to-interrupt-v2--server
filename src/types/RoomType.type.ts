type NewRoomType = {
  userId: string;
  name: string;
}

type RoomType = {
  id: string;
  name: string;
  users: string[];
}

export type { RoomType, NewRoomType };