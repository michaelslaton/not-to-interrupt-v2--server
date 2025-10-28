import { createServer, Server as HTTPServer  } from 'http';
import { Server } from 'socket.io';
import { v4 as uuid } from 'uuid';
import dotenv from 'dotenv';
import { UserType } from './types/UserType.type';
import { RoomType } from './types/RoomType.type';

dotenv.config();

const httpServer: HTTPServer = createServer();
const userList = new Map<string, UserType>();
const roomList = new Map<string, RoomType>();
const roomChats = new Map<string, {}[]>();
const regExOnlyLettersAndSpace: RegExp = /^[A-Za-z ]+$/;
const io = new Server(httpServer, {
  cors: {
    origin: 'http://localhost:5173',
  },
});

io.on('connection', (socket) => {
  console.log(`Client connected: ${socket.id}`);
  
  socket.on('createUser', (newUser: UserType)=>{
    const userNameTaken = [...userList.values()].some((user) => user.name.toLowerCase() === newUser.name.toLowerCase());
    if(userNameTaken) return console.log('Username is already in use.');

    const newUserWithId: UserType = {
        ...newUser,
        id: `UID${uuid()}`,
      };
    userList.set(newUserWithId.id, newUserWithId);
    socket.emit('updateData', { user: userList.get(newUserWithId.id) });
    console.log(userList.get(newUserWithId.id))
  });

  socket.on('createRoom', (newRoom: RoomType)=>{
    const roomNameTaken = [...roomList.values()].some((room) => room.name.toLowerCase() === newRoom.name.toLowerCase());
    if(roomNameTaken) return console.log('Room name is already in use.');

    const newRoonWithId: RoomType = {
      ...newRoom,
      id: `RID${uuid()}`,
    };
    roomList.set(newRoonWithId.id, newRoonWithId);
    socket.emit('updateData', {
      roomData: newRoom,
    });
    console.log(roomList)
  });

  socket.on('getRoomList', () => {
    const roomListData = Array.from(roomList.values()).map(room => ({ name: room.name }));
    socket.emit('roomListUpdate', roomListData);
  });
});

const PORT = process.env.PORT || 3000;
httpServer.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});