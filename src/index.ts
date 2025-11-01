import { createServer, Server as HTTPServer  } from 'http';
import { Server } from 'socket.io';
import { v4 as uuid } from 'uuid';
import dotenv from 'dotenv';
import { UserType } from './types/UserType.type';
import { NewRoomType, RoomType } from './types/RoomType.type';

dotenv.config();

const httpServer: HTTPServer = createServer();
const userList = new Map<string, UserType>();
const roomList = new Map<string, RoomType>();
const roomChats = new Map<string, [][]>();
const io = new Server(httpServer, {
  cors: {
    origin: 'http://localhost:5173',
  },
});

io.on('connection', (socket) => {
  console.log(`Client connected: ${socket.id}`);

  // Validation -------------------------------------------------------------------------------->
  const regExOnlyLettersAndSpace: RegExp = /^[A-Za-z ]+$/;

  const nameIsTaken = (map: Map<string, UserType | RoomType>, newName: string): boolean => {
    return [...map.values()].some((user) => user.name.toLowerCase() === newName.toLowerCase());
  };

  // Create ------------------------------------------------------------------------------------>
  socket.on('createUser', (newUser: UserType)=>{
    if(nameIsTaken(userList, newUser.name)) return console.log('Username is already in use.');

    const newUserWithId: UserType = {
        ...newUser,
        id: `UID${uuid()}`,
      };
    userList.set(newUserWithId.id, newUserWithId);
    socket.emit('updateData', { user: userList.get(newUserWithId.id) });
    console.log(userList.get(newUserWithId.id))
  });

  socket.on('createRoom', (newRoom: NewRoomType)=>{
    if(nameIsTaken(roomList, newRoom.name)) return console.log('Room name is already in use.');
    const { name, userId } = newRoom;

    const newRoomWithId: RoomType = {
      id: `RID${uuid()}`,
      name: name,
      users: [ userId ],
    };
    roomList.set(newRoomWithId.id, newRoomWithId);
    roomChats.set(newRoomWithId.id, []);
    socket.emit('updateData', { roomData: newRoomWithId });
  });

  // Read -------------------------------------------------------------------------------------->
  socket.on('getRoomList', () => {
    const roomListData = Array.from(roomList.values()).map(room => ({ name: room.name, users: room.users, id: room.id }));
    socket.emit('roomListUpdate', roomListData);
  });

  // Update ------------------------------------------------------------------------------------>
  socket.on('joinRoom', ({ userId, roomId }: {userId: string; roomId: string;})=>{
    const room = roomList.get(roomId);
    if(!room) return console.log('That room does not exist.');
    const updatedRoom: RoomType = {
      ...room,
      users: [
        ...room!.users,
        userId
      ]
    };
    roomList.set(roomId, updatedRoom);
    socket.emit('updateData', { roomData: updatedRoom });
  });

});

const PORT = process.env.PORT || 3000;
httpServer.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});