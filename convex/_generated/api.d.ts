/* eslint-disable */
/**
 * Generated `api` utility.
 *
 * THIS CODE IS AUTOMATICALLY GENERATED.
 *
 * To regenerate, run `npx convex dev`.
 * @module
 */

import type * as accountantCampaign from "../accountantCampaign.js";
import type * as accountantCampaignWorker from "../accountantCampaignWorker.js";
import type * as accountantCheckouts from "../accountantCheckouts.js";
import type * as accountantClients from "../accountantClients.js";
import type * as accountantInvitations from "../accountantInvitations.js";
import type * as accountantWorkspace from "../accountantWorkspace.js";
import type * as admin from "../admin.js";
import type * as ai from "../ai.js";
import type * as announcements from "../announcements.js";
import type * as betaUsage from "../betaUsage.js";
import type * as bulkPayslipEmail from "../bulkPayslipEmail.js";
import type * as bulkPayslipEmailWorker from "../bulkPayslipEmailWorker.js";
import type * as businesses from "../businesses.js";
import type * as cayla from "../cayla.js";
import type * as caylaAgent from "../caylaAgent.js";
import type * as caylaAgentActions from "../caylaAgentActions.js";
import type * as caylaAgentSchema from "../caylaAgentSchema.js";
import type * as caylaInternal from "../caylaInternal.js";
import type * as caylaQueries from "../caylaQueries.js";
import type * as compliance from "../compliance.js";
import type * as complianceVerification from "../complianceVerification.js";
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
import type * as lib_caylaAgentPolicy from "../lib/caylaAgentPolicy.js";
import type * as lib_caylaReasoning from "../lib/caylaReasoning.js";
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
import type * as lib_ownUser from "../lib/ownUser.js";
import type * as lib_paddleSubscription from "../lib/paddleSubscription.js";
import type * as lib_socialCard from "../lib/socialCard.js";
import type * as lib_socialContent from "../lib/socialContent.js";
import type * as lib_socialLinkedIn from "../lib/socialLinkedIn.js";
import type * as lib_ugcPolicy from "../lib/ugcPolicy.js";
import type * as lib_ugcProvider from "../lib/ugcProvider.js";
import type * as messages from "../messages.js";
import type * as mia from "../mia.js";
import type * as miaInternal from "../miaInternal.js";
import type * as mobileAi from "../mobileAi.js";
import type * as mobileReminders from "../mobileReminders.js";
import type * as nia from "../nia.js";
import type * as niaInternal from "../niaInternal.js";
import type * as notificationDelivery from "../notificationDelivery.js";
import type * as notifications from "../notifications.js";
import type * as paddle from "../paddle.js";
import type * as payrollRuns from "../payrollRuns.js";
import type * as privacyRetention from "../privacyRetention.js";
import type * as profile from "../profile.js";
import type * as reminders from "../reminders.js";
import type * as searchConsole from "../searchConsole.js";
import type * as social from "../social.js";
import type * as socialAssets_fonts from "../socialAssets/fonts.js";
import type * as socialAssets_resvgBytes from "../socialAssets/resvgBytes.js";
import type * as socialImages from "../socialImages.js";
import type * as socialInternal from "../socialInternal.js";
import type * as socialRender from "../socialRender.js";
import type * as socialSchema from "../socialSchema.js";
import type * as socialWorker from "../socialWorker.js";
import type * as subscriptions from "../subscriptions.js";
import type * as ugc from "../ugc.js";
import type * as ugcMedia from "../ugcMedia.js";
import type * as ugcSchema from "../ugcSchema.js";
import type * as ugcWorker from "../ugcWorker.js";
import type * as usage from "../usage.js";
import type * as users from "../users.js";

import type {
  ApiFromModules,
  FilterApi,
  FunctionReference,
} from "convex/server";

declare const fullApi: ApiFromModules<{
  accountantCampaign: typeof accountantCampaign;
  accountantCampaignWorker: typeof accountantCampaignWorker;
  accountantCheckouts: typeof accountantCheckouts;
  accountantClients: typeof accountantClients;
  accountantInvitations: typeof accountantInvitations;
  accountantWorkspace: typeof accountantWorkspace;
  admin: typeof admin;
  ai: typeof ai;
  announcements: typeof announcements;
  betaUsage: typeof betaUsage;
  bulkPayslipEmail: typeof bulkPayslipEmail;
  bulkPayslipEmailWorker: typeof bulkPayslipEmailWorker;
  businesses: typeof businesses;
  cayla: typeof cayla;
  caylaAgent: typeof caylaAgent;
  caylaAgentActions: typeof caylaAgentActions;
  caylaAgentSchema: typeof caylaAgentSchema;
  caylaInternal: typeof caylaInternal;
  caylaQueries: typeof caylaQueries;
  compliance: typeof compliance;
  complianceVerification: typeof complianceVerification;
  countryPayroll: typeof countryPayroll;
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
  "lib/accountantAccess": typeof lib_accountantAccess;
  "lib/caylaAgentPolicy": typeof lib_caylaAgentPolicy;
  "lib/caylaReasoning": typeof lib_caylaReasoning;
  "lib/countryTaxRules/barbados": typeof lib_countryTaxRules_barbados;
  "lib/countryTaxRules/belize": typeof lib_countryTaxRules_belize;
  "lib/countryTaxRules/saint_lucia": typeof lib_countryTaxRules_saint_lucia;
  "lib/countryTaxRules/trinidad_and_tobago": typeof lib_countryTaxRules_trinidad_and_tobago;
  "lib/countryTaxRules/types": typeof lib_countryTaxRules_types;
  "lib/email": typeof lib_email;
  "lib/emailComponents": typeof lib_emailComponents;
  "lib/emailTemplates": typeof lib_emailTemplates;
  "lib/googleAuth": typeof lib_googleAuth;
  "lib/niaPrompt": typeof lib_niaPrompt;
  "lib/ownUser": typeof lib_ownUser;
  "lib/paddleSubscription": typeof lib_paddleSubscription;
  "lib/socialCard": typeof lib_socialCard;
  "lib/socialContent": typeof lib_socialContent;
  "lib/socialLinkedIn": typeof lib_socialLinkedIn;
  "lib/ugcPolicy": typeof lib_ugcPolicy;
  "lib/ugcProvider": typeof lib_ugcProvider;
  messages: typeof messages;
  mia: typeof mia;
  miaInternal: typeof miaInternal;
  mobileAi: typeof mobileAi;
  mobileReminders: typeof mobileReminders;
  nia: typeof nia;
  niaInternal: typeof niaInternal;
  notificationDelivery: typeof notificationDelivery;
  notifications: typeof notifications;
  paddle: typeof paddle;
  payrollRuns: typeof payrollRuns;
  privacyRetention: typeof privacyRetention;
  profile: typeof profile;
  reminders: typeof reminders;
  searchConsole: typeof searchConsole;
  social: typeof social;
  "socialAssets/fonts": typeof socialAssets_fonts;
  "socialAssets/resvgBytes": typeof socialAssets_resvgBytes;
  socialImages: typeof socialImages;
  socialInternal: typeof socialInternal;
  socialRender: typeof socialRender;
  socialSchema: typeof socialSchema;
  socialWorker: typeof socialWorker;
  subscriptions: typeof subscriptions;
  ugc: typeof ugc;
  ugcMedia: typeof ugcMedia;
  ugcSchema: typeof ugcSchema;
  ugcWorker: typeof ugcWorker;
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
