import { createServer, Server as HTTPServer  } from 'http';
import { Server } from 'socket.io';
import dotenv from 'dotenv';
import { UserType } from './types/UserType.type';

dotenv.config();

const httpServer: HTTPServer = createServer();
const userList: UserType[] = [];
const regExOnlyLettersAndSpace: RegExp = /^[A-Za-z ]+$/;
const io = new Server(httpServer, {
  cors: {
    origin: 'http://localhost:5173',
  },
});

io.on('connection', (socket) => {
  console.log(`Client connected: ${socket.id}`);
  
  socket.on('createUser', (newUser: UserType)=>{
    const userNameTaken = userList.some((user)=> user.name.toLocaleLowerCase() === newUser.name.toLocaleLowerCase());
    if(userNameTaken) return console.log("Username is already in use.");
    userList.push(newUser);
    socket.emit('updateData', {
      user: newUser,
    });
  });
});

const PORT = process.env.PORT || 3000;
httpServer.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});