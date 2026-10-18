// Public entry point for event use cases (controllers import this). Implementation lives in ./event/*:
//   event-read   – public and admin list/detail
//   event-write  – create/update with races (no transaction, compensation on failure)
export {
  getAdmin,
  getPublicBySlug,
  listAdmin,
  listPublic,
} from "./event/event-read.service";
export { create, update } from "./event/event-write.service";