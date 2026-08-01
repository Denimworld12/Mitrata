
import multer from "multer";
import { acceptConnectionRequest, downloadProfile, findSearchUser, getAllUserBasedOnUsername, getMyConnectionRequest, getUserAndProfile, login, logout, register, sendconnectionrequest, updateProfileData, updateUserProfile, updateAccountSettings, uploadCoverPhoto, uploadImage, uploadProfilePicture, whatAreMyConnection, searchUsers, getSuggestions, googleLogin, googleLoginCallback, refreshAccessToken, deleteMyAccount, switchAccount, registerFcmToken, unregisterFcmToken, blockUser, unblockUser, getBlockedUsers, verifyTwoFactorLogin, getTwoFactorStatus, setupTwoFactor, verifyTwoFactorSetup, disableTwoFactor, getSessions, revokeSession, revokeOtherSessions, completeGoogleLogin } from "../controllers/user.controller.js";
import { sendOtp, verifyOtp, resendOtp, resetPassword } from "../controllers/otp.controller.js";
import { createReport } from "../controllers/admin.controller.js";
import { Router } from "express"
import { verifyToken } from "../middleware/auth.middleware.js";
import { Storage } from "../config/cloudinary.js";
import { deleteChat, deleteMessageForEveryone, deleteMessages, getConversations, getMessages, markMessagesRead, sendMessage } from "../controllers/message.controller.js";
const router = Router();

const upload = multer({ storage: Storage, limits: { fileSize: 25 * 1024 * 1024 } })

// ============ PUBLIC ROUTES (no auth needed) ============
router.route("/register").post(register);
router.route('/login').post(login);
router.route('/logout').post(logout);
router.route('/auth/google').post(googleLogin);
router.route('/auth/google/callback').post(googleLoginCallback);
router.route('/auth/google/complete').post(completeGoogleLogin);
router.route('/auth/refresh').post(refreshAccessToken);
router.route('/auth/send-otp').post(sendOtp);
router.route('/auth/verify-otp').post(verifyOtp);
router.route('/auth/resend-otp').post(resendOtp);
router.route('/auth/reset-password').post(resetPassword);
router.route('/auth/switch-account').post(switchAccount);
router.route('/auth/2fa/verify-login').post(verifyTwoFactorLogin);

router.route('/user/2fa/status').get(verifyToken, getTwoFactorStatus);
router.route('/user/2fa/setup').post(verifyToken, setupTwoFactor);
router.route('/user/2fa/verify').post(verifyToken, verifyTwoFactorSetup);
router.route('/user/2fa/disable').post(verifyToken, disableTwoFactor);

router.route('/user/sessions').get(verifyToken, getSessions);
router.route('/user/sessions/revoke_others').post(verifyToken, revokeOtherSessions);
router.route('/user/sessions/:id').delete(verifyToken, revokeSession);

// ============ REPORTING (any authenticated user) ============
router.route('/report').post(verifyToken, createReport);

// ============ PROTECTED ROUTES (auth required) ============

// Profile routes
// verifyToken runs BEFORE multer — multer's CloudinaryStorage uploads to
// Cloudinary as it parses the body, so with auth checked after, an
// unauthenticated request already had its file stored (and billed) before
// ever hitting the 401. Auth has to gate the upload, not follow it.
router.route('/user/update_profile_picture').post(verifyToken, upload.single('profilePicture'), uploadProfilePicture);
router.route('/user/update_cover_photo').post(verifyToken, upload.single('coverPhoto'), uploadCoverPhoto);
router.route('/upload/image').post(verifyToken, upload.single('image'), uploadImage);
router.route('/user/setting/user_update').post(verifyToken, updateUserProfile);
router.route('/user/setting/account_update').post(verifyToken, updateAccountSettings);
router.route('/user/block').post(verifyToken, blockUser);
router.route('/user/unblock').post(verifyToken, unblockUser);
router.route('/user/blocked').get(verifyToken, getBlockedUsers);
router.route('/get_user_and_profile').get(verifyToken, getUserAndProfile);
router.route('/update_profile').post(verifyToken, updateProfileData);
router.route('/user/findinguser').get(verifyToken, findSearchUser);
router.route('/user/download_resume').get(verifyToken, downloadProfile);

// Connection routes
router.route('/user/send_connection_request').post(verifyToken, sendconnectionrequest);
router.route('/user/get_connection_request').get(verifyToken, getMyConnectionRequest);
router.route('/user/get_my_connections').get(verifyToken, whatAreMyConnection);
router.route('/user/is_accepted_connection_request').post(verifyToken, acceptConnectionRequest);

// Public profile view (anyone can view profiles by username)
// Public profile view (anyone can view profiles by username)
router.route('/user/search').get(searchUsers);
router.route('/user/suggestions').get(verifyToken, getSuggestions);

// Needs to know WHO's asking to gate private accounts correctly (see
// getAllUserBasedOnUsername) — view_profile is only ever reached from
// within the authenticated app shell anyway, same as everything else here.
router.route('/user/get_user_based_on_username').get(verifyToken, getAllUserBasedOnUsername);

// Messaging routes (all protected)
router.route('/user/send_message').post(
    verifyToken,                // Auth gates the upload, not the other way around
    upload.array('media', 5),
    sendMessage
);

router.route('/user/get_messages').get(
    verifyToken,
    getMessages
);

router.route('/user/delete_chat').post(
    verifyToken,
    deleteChat
);

router.route('/user/delete_messages').post(
    verifyToken,
    deleteMessages
);

router.route('/user/delete_message_for_everyone').post(
    verifyToken,
    deleteMessageForEveryone
);

router.route('/user/conversations').get(verifyToken, getConversations);
router.route('/user/mark_read').post(verifyToken, markMessagesRead);

router.route('/user/delete_account').post(verifyToken, deleteMyAccount);

// Push notifications (FCM)
router.route('/user/fcm-token').post(verifyToken, registerFcmToken);
router.route('/user/fcm-token').delete(verifyToken, unregisterFcmToken);

export default router;
