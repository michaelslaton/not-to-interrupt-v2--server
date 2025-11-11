import { createServer, Server as HTTPServer  } from 'http';
import { Server } from 'socket.io';
import { v4 as uuid } from 'uuid';
import dotenv from 'dotenv';
import { PublicUserType, UserType } from './types/UserType.type';
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
  io.emit('reset');

  // Validation -------------------------------------------------------------------------------->
  const regExOnlyLettersAndSpace: RegExp = /^[A-Za-z ]+$/;

  const nameIsTaken = (map: Map<string, UserType | RoomType>, newName: string): boolean => {
    return [...map.values()].some((user) => user.name.toLowerCase() === newName.toLowerCase());
  };

  // Helpers ----------------------------------------------------------------------------------->
  const updateUserInRoomHelper = (room: RoomType, userId: string, newUserData: Partial<UserType>): { updatedRoom: RoomType; updatedUser: UserType } => {
    const foundUser = userList.get(userId);
    if (!foundUser) throw new Error(`User ${userId} not found`);
    const updatedUser: UserType = { ...foundUser, ...newUserData };

    // Update the room's users array with public user data (strip socketId)
    const updatedUsers = room.users.map(user =>
      user.id === userId ? (({ socketId, ...publicUser }) => publicUser)(updatedUser) : user
    );
    const updatedRoom: RoomType = { ...room, users: updatedUsers };

    roomList.set(room.id, updatedRoom);
    userList.set(userId, updatedUser);

    return { updatedRoom, updatedUser };
  };

  // Create ------------------------------------------------------------------------------------>
  socket.on('createUser', (newUser: UserType)=>{
    if(nameIsTaken(userList, newUser.name)) return console.log('Username is already in use.');
    // this a dam test
    const newUserWithId: UserType = {
        ...newUser,
        id: `UID${uuid()}`,
        controller: {
          hasMic: false,
          afk: false,
          handUp: false,
        }
      };
    userList.set(newUserWithId.id, newUserWithId);
    socket.emit('updateData', { user: userList.get(newUserWithId.id) });
  });

  socket.on('createRoom', (newRoom: NewRoomType)=>{
    if(nameIsTaken(roomList, newRoom.name)) return console.log('Room name is already in use.');
    const { name, userId } = newRoom;
    
    const user: UserType | undefined = userList.get(userId);
    if (!user) return console.log('That user does not exist.');
    const updatedUser = {
      ...user,
      controller: {
        ...user.controller,
        hasMic: true,
      }
    };
    const { socketId, ...publicUser } = updatedUser;
    const newRoomWithId: RoomType = {
      id: `RID${uuid()}`,
      name: name,
      users: [ publicUser ],
    };
    
    roomList.set(newRoomWithId.id, newRoomWithId);
    roomChats.set(newRoomWithId.id, []);
    userList.set(userId, updatedUser);
    socket.join(newRoomWithId.id);
    socket.emit('updateData', {
      user: updatedUser,
      roomData: newRoomWithId
    });
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
    const user: UserType | undefined = userList.get(userId);
    if (!user) return console.log('That user does not exist.');
    const { socketId, ...publicUser } = user;

    const updatedRoom: RoomType = {
      ...room,
      users: [...room.users, publicUser]
    };
    roomList.set(roomId, updatedRoom);
    socket.join(updatedRoom.id);
    io.to(roomId).emit('updateData', { roomData: updatedRoom });
  });

  socket.on('updateUserInRoom', ({ roomId, newUserData }: {roomId: string, newUserData: UserType}) => {
    const foundRoom = roomList.get(roomId);
    if (!foundRoom) return;

    const { updatedRoom } = updateUserInRoomHelper(foundRoom, newUserData.id, newUserData);

    io.to(roomId).emit('updateData', { roomData: updatedRoom });
  });

  socket.on('passTheMic', ({ fromUserId, toUserId, roomId }: { fromUserId: string, toUserId: string, roomId: string }) => {
    const foundRoom = roomList.get(roomId);
    if (!foundRoom) return console.log('Room not found');

    let fromUser = userList.get(fromUserId);
    let toUser = userList.get(toUserId);
    if (!fromUser || !toUser) return console.log('User not found');

    const { updatedRoom: roomAfterFrom } = updateUserInRoomHelper(foundRoom, fromUserId, {
      controller: { ...fromUser.controller, hasMic: false },
    });

    const { updatedRoom: roomAfterTo } = updateUserInRoomHelper(roomAfterFrom, toUserId, {
      controller: { ...toUser.controller, hasMic: true, handUp: false },
    });

    fromUser = userList.get(fromUserId);
    toUser = userList.get(toUserId);

    io.to(roomId).emit('updateData', { roomData: roomAfterTo });
    if (toUser?.socketId) io.to(toUser.socketId).emit('updateData', { user: toUser });
    if (fromUser?.socketId) io.to(fromUser.socketId).emit('updateData', { user: fromUser });
  });
});

const PORT = process.env.PORT || 3000;
httpServer.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});