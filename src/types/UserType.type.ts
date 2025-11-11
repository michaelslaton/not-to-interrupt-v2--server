import { UserControllerType } from "./UserControllerType.type";

type UserType = {
  id: string;
  name: string;
  socketId: string | undefined;
  controller: UserControllerType;
};

export type { UserType };
export type PublicUserType = Omit<UserType, 'socketId'>;