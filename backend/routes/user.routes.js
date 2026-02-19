
import multer from "multer";
import { acceptConnectionRequest, downloadProfile, findSearchUser, getAllUserBasedOnUsername, getMyConnectionRequest, getUserAndProfile, login, logout, register, sendconnectionrequest, updateProfileData, updateUserProfile, uploadProfilePicture, whatAreMyConnection, searchUsers, getSuggestions } from "../controllers/user.controller.js";
import { Router } from "express"
import { verifyToken } from "../middleware/auth.middleware.js";
import { Storage } from "../config/cloudinary.js";
import { deleteChat, deleteMessageForEveryone, deleteMessages, getMessages, sendMessage } from "../controllers/message.controller.js";
const router = Router();

const upload = multer({ storage: Storage })

// ============ PUBLIC ROUTES (no auth needed) ============
router.route("/register").post(register);
router.route('/login').post(login);
router.route('/logout').post(logout);

// ============ PROTECTED ROUTES (auth required) ============

// Profile routes
router.route('/user/update_profile_picture').post(upload.single('profilePicture'), verifyToken, uploadProfilePicture);
router.route('/user/setting/user_update').post(verifyToken, updateUserProfile);
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
router.route('/user/suggestions').get(getSuggestions);

router.route('/user/get_user_based_on_username').get(getAllUserBasedOnUsername);

// Messaging routes (all protected)
router.route('/user/send_message').post(
    upload.array('media', 5),   // Multer parses form data FIRST
    verifyToken,                // THEN verify token
    sendMessage                 // THEN send message
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

export default router;
