/* eslint-disable */
  /**
   * Generated `api` utility.
   *
   * THIS CODE IS AUTOMATICALLY GENERATED.
   *
   * To regenerate, run `npx convex dev`.
   * @module
   */

  import type { ApiFromModules, FilterApi, FunctionReference } from "convex/server";
  import type * as accountantClients from "../accountantClients.js";
import type * as accountantInvitations from "../accountantInvitations.js";
import type * as accountantWorkspace from "../accountantWorkspace.js";
import type * as admin from "../admin.js";
import type * as ai from "../ai.js";
import type * as betaUsage from "../betaUsage.js";
import type * as bulkPayslipEmail from "../bulkPayslipEmail.js";
import type * as bulkPayslipEmailWorker from "../bulkPayslipEmailWorker.js";
import type * as businesses from "../businesses.js";
import type * as cayla from "../cayla.js";
import type * as caylaInternal from "../caylaInternal.js";
import type * as caylaQueries from "../caylaQueries.js";
import type * as countryPayroll from "../countryPayroll.js";
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
import type * as lib_accountantAccess from "../lib/accountantAccess.js";
import type * as lib_countryTaxRules_barbados from "../lib/countryTaxRules/barbados.js";
import type * as lib_countryTaxRules_belize from "../lib/countryTaxRules/belize.js";
import type * as lib_countryTaxRules_saint_lucia from "../lib/countryTaxRules/saint_lucia.js";
import type * as lib_countryTaxRules_trinidad_and_tobago from "../lib/countryTaxRules/trinidad_and_tobago.js";
import type * as lib_countryTaxRules_types from "../lib/countryTaxRules/types.js";
import type * as lib_email from "../lib/email.js";
import type * as lib_emailComponents from "../lib/emailComponents.js";
import type * as lib_emailTemplates from "../lib/emailTemplates.js";
import type * as lib_googleAuth from "../lib/googleAuth.js";
import type * as lib_niaPrompt from "../lib/niaPrompt.js";
import type * as messages from "../messages.js";
import type * as mobileAi from "../mobileAi.js";
import type * as mobileReminders from "../mobileReminders.js";
import type * as nia from "../nia.js";
import type * as niaInternal from "../niaInternal.js";
import type * as notificationDelivery from "../notificationDelivery.js";
import type * as notifications from "../notifications.js";
import type * as paddle from "../paddle.js";
import type * as payrollRuns from "../payrollRuns.js";
import type * as reminders from "../reminders.js";
import type * as searchConsole from "../searchConsole.js";
import type * as subscriptions from "../subscriptions.js";
import type * as usage from "../usage.js";
import type * as users from "../users.js";

  /**
   * A utility for referencing Convex functions in your app's API.
   *
   * Usage:
   * ```js
   * const myFunctionReference = api.myModule.myFunction;
   * ```
   */
  declare const fullApi: ApiFromModules<{
    "accountantClients": typeof accountantClients,
"accountantInvitations": typeof accountantInvitations,
"accountantWorkspace": typeof accountantWorkspace,
"admin": typeof admin,
"ai": typeof ai,
"betaUsage": typeof betaUsage,
"bulkPayslipEmail": typeof bulkPayslipEmail,
"bulkPayslipEmailWorker": typeof bulkPayslipEmailWorker,
"businesses": typeof businesses,
"cayla": typeof cayla,
"caylaInternal": typeof caylaInternal,
"caylaQueries": typeof caylaQueries,
"countryPayroll": typeof countryPayroll,
"crons": typeof crons,
"emailLogs": typeof emailLogs,
"emailPreferences": typeof emailPreferences,
"emailService": typeof emailService,
"emails": typeof emails,
"employees": typeof employees,
"fcm": typeof fcm,
"googleAnalytics": typeof googleAnalytics,
"guestDashboard": typeof guestDashboard,
"http": typeof http,
"invitations": typeof invitations,
"lib/accountantAccess": typeof lib_accountantAccess,
"lib/countryTaxRules/barbados": typeof lib_countryTaxRules_barbados,
"lib/countryTaxRules/belize": typeof lib_countryTaxRules_belize,
"lib/countryTaxRules/saint_lucia": typeof lib_countryTaxRules_saint_lucia,
"lib/countryTaxRules/trinidad_and_tobago": typeof lib_countryTaxRules_trinidad_and_tobago,
"lib/countryTaxRules/types": typeof lib_countryTaxRules_types,
"lib/email": typeof lib_email,
"lib/emailComponents": typeof lib_emailComponents,
"lib/emailTemplates": typeof lib_emailTemplates,
"lib/googleAuth": typeof lib_googleAuth,
"lib/niaPrompt": typeof lib_niaPrompt,
"messages": typeof messages,
"mobileAi": typeof mobileAi,
"mobileReminders": typeof mobileReminders,
"nia": typeof nia,
"niaInternal": typeof niaInternal,
"notificationDelivery": typeof notificationDelivery,
"notifications": typeof notifications,
"paddle": typeof paddle,
"payrollRuns": typeof payrollRuns,
"reminders": typeof reminders,
"searchConsole": typeof searchConsole,
"subscriptions": typeof subscriptions,
"usage": typeof usage,
"users": typeof users,
  }>;
  export declare const api: FilterApi<typeof fullApi, FunctionReference<any, "public">>;
  export declare const internal: FilterApi<typeof fullApi, FunctionReference<any, "internal">>;

