import { createServer, Server as HTTPServer  } from 'http';
import { Server } from 'socket.io';
import { v4 as uuid } from 'uuid';
import dotenv from 'dotenv';
import { PublicUserType, UserType } from './types/UserType.type';
import { NewRoomType, RoomType } from './types/RoomType.type';
import { ChatEntryType, ChatIncomingType } from './types/ChatEntryType.type';

dotenv.config();

const httpServer: HTTPServer = createServer();
const userList = new Map<string, UserType>();
const roomList = new Map<string, RoomType>();
const roomChats = new Map<string, ChatEntryType[]>();
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

  // Helpers ----------------------------------------------------------------------------------->
  const updateUserInRoomHelper = (room: RoomType, userId: string, newUserData: Partial<UserType>): { updatedRoom: RoomType; updatedUser: UserType } => {
    const foundUser: UserType | undefined = userList.get(userId);
    if(!foundUser) throw new Error(`User ${userId} not found`);
    const updatedUser: UserType = { ...foundUser, ...newUserData };

    // Update the room's users array with public user data (strip socketId)
    const updatedUsers: PublicUserType[] = room.users.map(user =>
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
    const newUserWithId: UserType = {
        ...newUser,
        id: `UID${uuid()}`,
        color: '#1ba099ff',
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
    if(!user) return console.log('That user does not exist.');
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

  socket.on('getChatEntries', ({ roomId }: {roomId: string;}) => {
    const data: ChatEntryType[] | undefined = roomChats.get(roomId);
    if(!data) return console.error('Missing Data');
    socket.emit('getChatEntries', data);
  })

  // Update ------------------------------------------------------------------------------------>
  socket.on('joinRoom', ({ userId, roomId }: {userId: string; roomId: string;})=>{
    const room: RoomType | undefined = roomList.get(roomId);
    if(!room) return console.log('That room does not exist.');
    const user: UserType | undefined = userList.get(userId);
    if(!user) return console.log('That user does not exist.');
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
    const foundRoom: RoomType | undefined = roomList.get(roomId);
    if(!foundRoom) return;
    const { updatedRoom } = updateUserInRoomHelper(foundRoom, newUserData.id, newUserData);
    io.to(roomId).emit('updateData', { roomData: updatedRoom });
  });

  socket.on('passTheMic', ({ fromUserId, toUserId, roomId }: { fromUserId: string, toUserId: string, roomId: string }) => {
    const foundRoom: RoomType | undefined = roomList.get(roomId);
    if(!foundRoom) return console.error('Room not found');

    let fromUser: UserType | undefined = userList.get(fromUserId);
    let toUser: UserType | undefined = userList.get(toUserId);
    if(!fromUser || !toUser) return console.log('User not found');
    if(!fromUser.controller.hasMic) return ('Origin user does not have the mic');
    if(toUser.controller.hasMic) return ('Target U=user already has the mic');

    const { updatedRoom: roomAfterFrom } = updateUserInRoomHelper(foundRoom, fromUserId, {
      controller: { ...fromUser.controller, hasMic: false },
    });

    const { updatedRoom: roomAfterTo } = updateUserInRoomHelper(roomAfterFrom, toUserId, {
      controller: { ...toUser.controller, hasMic: true, handUp: false },
    });

    fromUser = userList.get(fromUserId);
    toUser = userList.get(toUserId);

    io.to(roomId).emit('updateData', { roomData: roomAfterTo });
    if(toUser?.socketId) io.to(toUser.socketId).emit('updateData', { user: toUser });
    if(fromUser?.socketId) io.to(fromUser.socketId).emit('updateData', { user: fromUser });
  });

  socket.on('sendChat', ({ roomId, user, message }: ChatIncomingType)=>{
    const foundRoom: RoomType | undefined = roomList.get(roomId);
    const foundUser: UserType | undefined = userList.get(user);
    const foundChat: ChatEntryType[] | undefined = roomChats.get(roomId);
    if(!foundRoom || !foundUser || !foundChat) return console.error('Missing Element');
    const { socketId, ...publicUser } = foundUser;

    const newChatEntry: ChatEntryType = {
      user: publicUser,
      message,
      timeStamp: new Date(),
    };

    foundChat.push(newChatEntry);
    roomChats.set(roomId, foundChat);
    io.to(roomId).emit('getChatEntries', foundChat);
  });

});

const PORT = process.env.PORT || 3000;
httpServer.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});