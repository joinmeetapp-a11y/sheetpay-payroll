/* eslint-disable */
/**
 * Generated `api` utility.
 *
 * THIS CODE IS AUTOMATICALLY GENERATED.
 *
 * To regenerate, run `npx convex dev`.
 * @module
 */

import type * as admin from "../admin.js";
import type * as ai from "../ai.js";
import type * as businesses from "../businesses.js";
import type * as cayla from "../cayla.js";
import type * as caylaInternal from "../caylaInternal.js";
import type * as caylaQueries from "../caylaQueries.js";
import type * as crons from "../crons.js";
import type * as emailLogs from "../emailLogs.js";
import type * as emailPreferences from "../emailPreferences.js";
import type * as emailService from "../emailService.js";
import type * as emails from "../emails.js";
import type * as employees from "../employees.js";
import type * as fcm from "../fcm.js";
import type * as googleAnalytics from "../googleAnalytics.js";
import type * as guestDashboard from "../guestDashboard.js";
import type * as http from "../http.js";
import type * as invitations from "../invitations.js";
import type * as lib_email from "../lib/email.js";
import type * as lib_emailComponents from "../lib/emailComponents.js";
import type * as lib_emailTemplates from "../lib/emailTemplates.js";
import type * as lib_googleAuth from "../lib/googleAuth.js";
import type * as lib_niaPrompt from "../lib/niaPrompt.js";
import type * as messages from "../messages.js";
import type * as nia from "../nia.js";
import type * as niaInternal from "../niaInternal.js";
import type * as paddle from "../paddle.js";
import type * as payrollRuns from "../payrollRuns.js";
import type * as reminders from "../reminders.js";
import type * as searchConsole from "../searchConsole.js";
import type * as subscriptions from "../subscriptions.js";
import type * as usage from "../usage.js";
import type * as users from "../users.js";

import type {
  ApiFromModules,
  FilterApi,
  FunctionReference,
} from "convex/server";

declare const fullApi: ApiFromModules<{
  admin: typeof admin;
  ai: typeof ai;
  businesses: typeof businesses;
  cayla: typeof cayla;
  caylaInternal: typeof caylaInternal;
  caylaQueries: typeof caylaQueries;
  crons: typeof crons;
  emailLogs: typeof emailLogs;
  emailPreferences: typeof emailPreferences;
  emailService: typeof emailService;
  emails: typeof emails;
  employees: typeof employees;
  fcm: typeof fcm;
  googleAnalytics: typeof googleAnalytics;
  guestDashboard: typeof guestDashboard;
  http: typeof http;
  invitations: typeof invitations;
  "lib/email": typeof lib_email;
  "lib/emailComponents": typeof lib_emailComponents;
  "lib/emailTemplates": typeof lib_emailTemplates;
  "lib/googleAuth": typeof lib_googleAuth;
  "lib/niaPrompt": typeof lib_niaPrompt;
  messages: typeof messages;
  nia: typeof nia;
  niaInternal: typeof niaInternal;
  paddle: typeof paddle;
  payrollRuns: typeof payrollRuns;
  reminders: typeof reminders;
  searchConsole: typeof searchConsole;
  subscriptions: typeof subscriptions;
  usage: typeof usage;
  users: typeof users;
}>;

/**
 * A utility for referencing Convex functions in your app's public API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = api.myModule.myFunction;
 * ```
 */
export declare const api: FilterApi<
  typeof fullApi,
  FunctionReference<any, "public">
>;

/**
 * A utility for referencing Convex functions in your app's internal API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = internal.myModule.myFunction;
 * ```
 */
export declare const internal: FilterApi<
  typeof fullApi,
  FunctionReference<any, "internal">
>;

export declare const components: {};
