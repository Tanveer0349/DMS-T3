import { adminRouter } from "~/server/api/routers/admin";
import { userRouter } from "~/server/api/routers/user";
import { createTRPCRouter, createCallerFactory } from "~/server/api/trpc";

export const appRouter = createTRPCRouter({
  admin: adminRouter,
  user: userRouter,
});

export type AppRouter = typeof appRouter;

export const createCaller = createCallerFactory(appRouter);